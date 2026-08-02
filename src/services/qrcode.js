// Encodeur QR — zéro dépendance (npm hors service, cf. MUSEA_MASTER_PLAN §6).
//
// À quoi il sert : la réalité augmentée exige un téléphone, or la soutenance se
// fait sur ordinateur. On affiche donc à l'écran un QR que le jury scanne pour
// faire surgir l'objet dans la salle. Sans lui, l'AR reste une promesse.
//
// Portée volontairement limitée à ce besoin : mode OCTET, correction de niveau M,
// versions 1 à 6 (jusqu'à 108 octets, largement de quoi loger une URL). Au-delà
// de la version 6, la norme impose un bloc d'information de version en plus —
// inutile ici, donc non implémenté : mieux vaut refuser que produire un QR faux.

// ---------------------------------------------------------------------------
// Corps de Galois GF(256), polynôme générateur 0x11d — l'arithmétique de Reed-Solomon
// ---------------------------------------------------------------------------
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
{
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]
}
const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]])

function polyMul(a, b) {
  const r = new Array(a.length + b.length - 1).fill(0)
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) r[i + j] ^= gfMul(a[i], b[j])
  }
  return r
}

// g(x) = ∏ (x − α^i), coefficients du degré le plus fort au plus faible.
function rsGenerator(n) {
  let g = [1]
  for (let i = 0; i < n; i++) g = polyMul(g, [1, EXP[i]])
  return g
}

// Reste de la division du message par g(x) : ce sont les octets de correction.
function rsRemainder(data, ecLen) {
  const g = rsGenerator(ecLen)
  const res = new Array(data.length + ecLen).fill(0)
  for (let i = 0; i < data.length; i++) res[i] = data[i]
  for (let i = 0; i < data.length; i++) {
    const c = res[i]
    if (!c) continue
    for (let j = 0; j < g.length; j++) res[i + j] ^= gfMul(g[j], c)
  }
  return res.slice(data.length)
}

// ---------------------------------------------------------------------------
// Tables de la norme, niveau M, versions 1 à 6
// (octets de données, octets de correction par bloc, nombre de blocs)
// ---------------------------------------------------------------------------
const VERSIONS = [
  null,
  { data: 16, ec: 10, blocks: 1, align: [] },
  { data: 28, ec: 16, blocks: 1, align: [6, 18] },
  { data: 44, ec: 26, blocks: 1, align: [6, 22] },
  { data: 64, ec: 18, blocks: 2, align: [6, 26] },
  { data: 86, ec: 24, blocks: 2, align: [6, 30] },
  { data: 108, ec: 16, blocks: 4, align: [6, 34] }
]

const MASKS = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0
]

// ---------------------------------------------------------------------------
// Flux binaire
// ---------------------------------------------------------------------------
function encodeData(bytes, version) {
  const cap = VERSIONS[version].data
  const bits = []
  const push = (value, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1)
  }
  push(0b0100, 4) // mode octet
  push(bytes.length, 8) // compteur sur 8 bits pour les versions 1 à 9
  for (const b of bytes) push(b, 8)

  // Terminateur, puis alignement sur l'octet, puis remplissage normalisé.
  const total = cap * 8
  for (let i = 0; i < 4 && bits.length < total; i++) bits.push(0)
  while (bits.length % 8 !== 0) bits.push(0)

  const out = []
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0
    for (let k = 0; k < 8; k++) v = (v << 1) | bits[i + k]
    out.push(v)
  }
  const PAD = [0xec, 0x11]
  for (let k = 0; out.length < cap; k++) out.push(PAD[k % 2])
  return out
}

// Entrelacement : les blocs de données puis les blocs de correction, colonne
// par colonne. C'est ce qui permet à un QR déchiré de rester lisible.
function interleave(dataCodewords, version) {
  const { ec, blocks } = VERSIONS[version]
  const per = dataCodewords.length / blocks
  const dataBlocks = []
  const ecBlocks = []
  for (let b = 0; b < blocks; b++) {
    const chunk = dataCodewords.slice(b * per, (b + 1) * per)
    dataBlocks.push(chunk)
    ecBlocks.push(rsRemainder(chunk, ec))
  }
  const out = []
  for (let i = 0; i < per; i++) for (const b of dataBlocks) out.push(b[i])
  for (let i = 0; i < ec; i++) for (const b of ecBlocks) out.push(b[i])
  return out
}

// ---------------------------------------------------------------------------
// Trame
// ---------------------------------------------------------------------------
function blankMatrix(size) {
  return {
    m: Array.from({ length: size }, () => new Int8Array(size).fill(-1)),
    reserved: Array.from({ length: size }, () => new Uint8Array(size))
  }
}

function drawFunctionPatterns(grid, version) {
  const size = grid.m.length
  const set = (r, c, v) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return
    grid.m[r][c] = v
    grid.reserved[r][c] = 1
  }

  // Trois motifs de repérage + leur séparateur
  for (const [br, bc] of [[0, 0], [0, size - 7], [size - 7, 0]]) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6
        const ring = r === 0 || r === 6 || c === 0 || c === 6
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4
        set(br + r, bc + c, inside && (ring || core) ? 1 : 0)
      }
    }
  }

  // Motifs d'alignement, sauf là où ils chevaucheraient un motif de repérage
  const al = VERSIONS[version].align
  for (const r of al) {
    for (const c of al) {
      if ((r === 6 && c === 6) || (r === 6 && c === al[al.length - 1]) || (r === al[al.length - 1] && c === 6)) continue
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const edge = Math.max(Math.abs(dr), Math.abs(dc))
          set(r + dr, c + dc, edge === 1 ? 0 : 1)
        }
      }
    }
  }

  // Lignes de synchronisation
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0 ? 1 : 0)
    set(i, 6, i % 2 === 0 ? 1 : 0)
  }

  // Module toujours noir + zones réservées à l'information de format
  set(size - 8, 8, 1)
  for (let i = 0; i < 9; i++) {
    if (grid.m[8][i] === -1) set(8, i, 0)
    if (grid.m[i][8] === -1) set(i, 8, 0)
  }
  for (let i = 0; i < 8; i++) {
    if (grid.m[8][size - 1 - i] === -1) set(8, size - 1 - i, 0)
    if (grid.m[size - 1 - i][8] === -1) set(size - 1 - i, 8, 0)
  }
}

// Parcours en zigzag depuis le coin inférieur droit, colonnes deux par deux,
// en sautant la colonne 6 occupée par la synchronisation.
function placeData(grid, codewords) {
  const size = grid.m.length
  let bit = 0
  const nextBit = () => {
    const byte = codewords[bit >> 3]
    const v = byte === undefined ? 0 : (byte >> (7 - (bit & 7))) & 1
    bit++
    return v
  }
  let upward = true
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--
    for (let k = 0; k < size; k++) {
      const row = upward ? size - 1 - k : k
      for (const c of [col, col - 1]) {
        if (grid.reserved[row][c]) continue
        grid.m[row][c] = nextBit()
      }
    }
    upward = !upward
  }
}

// BCH(15,5) puis masquage par 0x5412, comme l'impose la norme.
function formatBits(maskIndex) {
  const data = (0b00 << 3) | maskIndex // 00 = niveau M
  let rem = data << 10
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) rem ^= 0x537 << (i - 10)
  }
  return ((data << 10) | rem) ^ 0x5412
}

// Les 15 bits sont écrits DEUX fois, en L autour du repère haut-gauche et en
// deux tronçons près des deux autres repères. Attention au sens : ici la matrice
// s'indexe [ligne][colonne], alors que la norme raisonne en (x, y).
function applyFormat(grid, maskIndex) {
  const size = grid.m.length
  const bits = formatBits(maskIndex)
  const at = (i) => (bits >> i) & 1

  // Première copie : colonne 8 de haut en bas, puis ligne 8 de droite à gauche.
  for (let i = 0; i <= 5; i++) grid.m[i][8] = at(i)
  grid.m[7][8] = at(6)
  grid.m[8][8] = at(7)
  grid.m[8][7] = at(8)
  for (let i = 9; i <= 14; i++) grid.m[8][14 - i] = at(i)

  // Seconde copie : ligne 8 côté droit, puis colonne 8 en bas.
  for (let i = 0; i <= 7; i++) grid.m[8][size - 1 - i] = at(i)
  for (let i = 8; i <= 14; i++) grid.m[size - 15 + i][8] = at(i)
  grid.m[size - 8][8] = 1 // module toujours noir
}

// ---------------------------------------------------------------------------
// Choix du masque : les quatre pénalités de la norme. Un mauvais masque produit
// un QR « lisible sur écran, capricieux à la caméra » — exactement ce qu'il ne
// faut pas le jour de la soutenance.
// ---------------------------------------------------------------------------
function penalty(m) {
  const size = m.length
  let score = 0

  const runScore = (line) => {
    let s = 0
    let run = 1
    for (let i = 1; i < line.length; i++) {
      if (line[i] === line[i - 1]) run++
      else {
        if (run >= 5) s += 3 + (run - 5)
        run = 1
      }
    }
    if (run >= 5) s += 3 + (run - 5)
    return s
  }
  const hasPattern = (line, i) =>
    line[i] === 1 && line[i + 1] === 0 && line[i + 2] === 1 && line[i + 3] === 1 &&
    line[i + 4] === 1 && line[i + 5] === 0 && line[i + 6] === 1

  for (let r = 0; r < size; r++) {
    const row = Array.from(m[r])
    const col = m.map((x) => x[r])
    score += runScore(row) + runScore(col)

    // Règle 3 : le motif 1:1:3:1:1 bordé de quatre modules clairs
    for (const line of [row, col]) {
      for (let i = 0; i + 10 < size; i++) {
        if (hasPattern(line, i) && line.slice(i + 7, i + 11).every((v) => v === 0)) score += 40
        if (hasPattern(line, i + 4) && line.slice(i, i + 4).every((v) => v === 0)) score += 40
      }
    }
  }

  // Règle 2 : blocs 2×2 uniformes
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c]
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3
    }
  }

  // Règle 4 : écart de la proportion de noir par rapport à 50 %
  let dark = 0
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) dark += m[r][c]
  const pct = (dark * 100) / (size * size)
  score += Math.floor(Math.abs(pct - 50) / 5) * 10

  return score
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

// Renvoie la matrice de modules (tableau de 0/1) du QR encodant `text`.
// Lève une erreur si le texte dépasse la capacité de la version 6 — un QR
// silencieusement tronqué serait pire qu'une absence de QR.
export function qrMatrix(text) {
  const bytes = Array.from(new TextEncoder().encode(String(text)))
  const version = VERSIONS.findIndex((v, i) => i > 0 && bytes.length + 2 <= v.data)
  if (version < 1) throw new Error(`QR : ${bytes.length} octets, maximum ${VERSIONS[6].data - 2}`)

  const codewords = interleave(encodeData(bytes, version), version)
  const size = 17 + 4 * version

  let best = null
  for (let mask = 0; mask < 8; mask++) {
    const grid = blankMatrix(size)
    drawFunctionPatterns(grid, version)
    placeData(grid, codewords)
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!grid.reserved[r][c] && MASKS[mask](r, c)) grid.m[r][c] ^= 1
      }
    }
    applyFormat(grid, mask)
    const matrix = grid.m.map((row) => Array.from(row))
    const score = penalty(matrix)
    if (!best || score < best.score) best = { score, matrix }
  }
  return best.matrix
}

// Rend le QR en SVG autonome. `quiet` est la marge blanche obligatoire :
// sans elle (au moins 4 modules), beaucoup de lecteurs échouent.
export function qrSvg(text, { size = 220, quiet = 4, dark = '#101210', light = '#ffffff' } = {}) {
  const m = qrMatrix(text)
  const n = m.length + quiet * 2
  const rects = []
  for (let r = 0; r < m.length; r++) {
    let c = 0
    while (c < m.length) {
      if (!m[r][c]) { c++; continue }
      let end = c
      while (end + 1 < m.length && m[r][end + 1]) end++
      rects.push(`<rect x="${c + quiet}" y="${r + quiet}" width="${end - c + 1}" height="1"/>`)
      c = end + 1
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img">` +
    `<rect width="${n}" height="${n}" fill="${light}"/>` +
    `<g fill="${dark}">${rects.join('')}</g></svg>`
}
