// Moteur de panorama 360 — WebGL natif, ZÉRO dépendance.
//
// Pourquoi à la main : npm est hors service sur ce poste (voir MUSEA_MASTER_PLAN §6),
// donc `three.js` est impossible. Le rendu équirectangulaire ne demande de toute
// façon pas de moteur 3D : un quadrilatère plein écran suffit, et l'on calcule
// pour chaque pixel la direction du rayon, que l'on convertit en coordonnées
// (longitude, latitude) dans l'image. C'est plus rapide qu'une sphère maillée
// et sans artefact de facettes.
//
// Convention d'orientation, partagée avec les points chauds :
//   yaw   (azimut)   0° = centre de l'image, positif vers la droite  (-180..180)
//   pitch (élévation) 0° = horizon,          positif vers le haut     (-90..90)

export const DEG = Math.PI / 180

const VERT = `
attribute vec2 aPos;
uniform mat3 uRot;
uniform vec2 uScale;
varying vec3 vDir;
void main() {
  vDir = uRot * vec3(aPos.x * uScale.x, aPos.y * uScale.y, -1.0);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const FRAG = `
precision highp float;
varying vec3 vDir;
uniform sampler2D uTex;
uniform float uFade;
const float PI = 3.141592653589793;
void main() {
  vec3 d = normalize(vDir);
  float u = atan(d.x, -d.z) / (2.0 * PI) + 0.5;
  float v = acos(clamp(d.y, -1.0, 1.0)) / PI;
  vec3 c = texture2D(uTex, vec2(u, v)).rgb;
  gl_FragColor = vec4(c * uFade, 1.0);
}`

function compile(gl, type, source) {
  const sh = gl.createShader(type)
  gl.shaderSource(sh, source)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh)
    gl.deleteShader(sh)
    throw new Error(`shader : ${log}`)
  }
  return sh
}

const isPot = (n) => n > 0 && (n & (n - 1)) === 0

// Ramène une image à une taille puissance de deux : cela autorise le mode REPEAT
// sur l'axe horizontal, seul moyen d'effacer complètement la couture du panorama
// (le pixel de gauche doit se fondre avec celui de droite).
function toPot(img, max) {
  const w = img.naturalWidth || img.videoWidth || img.width
  const h = img.naturalHeight || img.videoHeight || img.height
  if (isPot(w) && isPot(h) && w <= max) return { source: img, wrap: true }
  const pot = (n) => Math.min(max, 2 ** Math.round(Math.log2(Math.max(2, n))))
  const c = document.createElement('canvas')
  c.width = pot(w)
  c.height = pot(h)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  return { source: c, wrap: true }
}

// ---------------------------------------------------------------------------
// Panorama de démonstration, dessiné au vol.
//
// Le musée n'a pas encore ses prises de vue 360 : plutôt que d'afficher un carré
// gris, on génère une salle stylisée (plafond sombre, cimaise éclairée, cadres
// régulièrement espacés, sol en dégradé). Le parcours est donc démontrable
// immédiatement, et chaque scène reçoit une teinte différente via `seed`.
// ---------------------------------------------------------------------------
export function demoPanorama(seed = 0, w = 2048, h = 1024) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const x = c.getContext('2d')

  const teintes = [
    ['#1b1a17', '#c9b184', '#6d5a3f', '#2a2521'],
    ['#171b1a', '#9fbfae', '#3f6d5a', '#212a26'],
    ['#1b1719', '#c2a0a8', '#6d3f4c', '#2a2124'],
    ['#191b17', '#b7c193', '#5a6d3f', '#252a21']
  ]
  const [plafond, mur, alcove, sol] = teintes[Math.abs(seed) % teintes.length]

  // Plafond → cimaise → sol : un dégradé vertical, l'axe Y de l'image
  // équirectangulaire étant exactement la latitude.
  const g = x.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, plafond)
  g.addColorStop(0.3, plafond)
  g.addColorStop(0.4, mur)
  g.addColorStop(0.62, mur)
  g.addColorStop(0.72, sol)
  g.addColorStop(1, '#0d0c0b')
  x.fillStyle = g
  x.fillRect(0, 0, w, h)

  // Alcôves : 8 travées régulières, soit une tous les 45° d'azimut.
  const n = 8
  const pas = w / n
  for (let i = 0; i < n; i++) {
    const cx = i * pas + pas / 2
    const lw = pas * 0.44
    x.fillStyle = alcove
    x.fillRect(cx - lw / 2, h * 0.42, lw, h * 0.17)
    // Halo chaud au-dessus de chaque alcôve
    const halo = x.createRadialGradient(cx, h * 0.4, 0, cx, h * 0.4, pas * 0.5)
    halo.addColorStop(0, 'rgba(255, 226, 168, 0.30)')
    halo.addColorStop(1, 'rgba(255, 226, 168, 0)')
    x.fillStyle = halo
    x.fillRect(cx - pas * 0.5, h * 0.28, pas, h * 0.34)
    // Refend vertical entre deux travées
    x.fillStyle = 'rgba(0,0,0,0.22)'
    x.fillRect(i * pas, h * 0.34, 3, h * 0.34)
  }

  // Plinthe et liseré de cimaise
  x.fillStyle = 'rgba(0,0,0,0.30)'
  x.fillRect(0, h * 0.615, w, 6)
  x.fillStyle = 'rgba(255,255,255,0.10)'
  x.fillRect(0, h * 0.395, w, 3)

  return c
}

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------
export function createRenderer(canvas) {
  const opts = { antialias: false, alpha: false, preserveDrawingBuffer: false }
  const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts)
  if (!gl) return null

  const prog = gl.createProgram()
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null
  gl.useProgram(prog)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const uRot = gl.getUniformLocation(prog, 'uRot')
  const uScale = gl.getUniformLocation(prog, 'uScale')
  const uFade = gl.getUniformLocation(prog, 'uFade')
  gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0)

  const tex = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([20, 20, 22]))
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)

  const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  let live = null // média vidéo à re-téléverser à chaque image

  function upload(media) {
    gl.bindTexture(gl.TEXTURE_2D, tex)
    const isVideo = media instanceof HTMLVideoElement
    const { source, wrap } = isVideo ? { source: media, wrap: false } : toPot(media, maxSize)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap ? gl.REPEAT : gl.CLAMP_TO_EDGE)
    live = isVideo ? media : null
  }

  function refreshVideo() {
    if (!live || live.readyState < 2) return
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, live)
  }

  // R = Ry(−yaw) · Rx(pitch), envoyée en column-major comme WebGL l'attend.
  //
  // Le signe négatif n'est pas un détail : il fixe la convention partagée avec
  // project()/unproject(). Avec Ry(+yaw), la caméra tournerait vers la GAUCHE de
  // l'image quand l'azimut augmente, alors qu'un point chaud d'azimut croissant
  // se trouve vers la DROITE — les pastilles partiraient à l'opposé du décor.
  // Vérification : R·(0,0,−1) = (sin yaw·cos pitch, sin pitch, −cos yaw·cos pitch),
  // exactement la direction que project() calcule pour un point chaud.
  function draw(yaw, pitch, fov, fade = 1) {
    const w = canvas.width
    const h = canvas.height
    if (!w || !h) return
    gl.viewport(0, 0, w, h)
    refreshVideo()

    const a = yaw * DEG
    const b = pitch * DEG
    const ca = Math.cos(a)
    const sa = Math.sin(a)
    const cb = Math.cos(b)
    const sb = Math.sin(b)
    gl.uniformMatrix3fv(uRot, false, [
      ca, 0, sa,
      -sa * sb, cb, ca * sb,
      -sa * cb, -sb, ca * cb
    ])
    const ty = Math.tan((fov * DEG) / 2)
    gl.uniform2f(uScale, ty * (w / h), ty)
    gl.uniform1f(uFade, fade)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  function dispose() {
    live = null
    gl.deleteTexture(tex)
    gl.deleteBuffer(buf)
    gl.deleteProgram(prog)
    const ext = gl.getExtension('WEBGL_lose_context')
    if (ext) ext.loseContext()
  }

  return { upload, draw, dispose, hasVideo: () => !!live }
}

// ---------------------------------------------------------------------------
// Projections — utilisées par l'incrustation HTML des points chauds
// (des vrais <button>, donc accessibles au clavier et aux lecteurs d'écran).
// ---------------------------------------------------------------------------

// Point chaud (yaw°, pitch°) → position à l'écran, en pourcentage.
export function project(hx, hy, yaw, pitch, fov, aspect) {
  const a = yaw * DEG
  const b = pitch * DEG
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const cb = Math.cos(b)
  const sb = Math.sin(b)

  const hyr = hx * DEG
  const hpr = hy * DEG
  const chp = Math.cos(hpr)
  const d = [Math.sin(hyr) * chp, Math.sin(hpr), -Math.cos(hyr) * chp]

  // Repère caméra = Rᵀ·d, soit d projeté sur les colonnes de R.
  const cx = ca * d[0] + sa * d[2]
  const cy = -sa * sb * d[0] + cb * d[1] + ca * sb * d[2]
  const cz = -sa * cb * d[0] - sb * d[1] + ca * cb * d[2]

  if (cz >= -1e-4) return null // derrière la caméra
  const ty = Math.tan((fov * DEG) / 2)
  const ndcX = cx / -cz / (ty * aspect)
  const ndcY = cy / -cz / ty
  if (Math.abs(ndcX) > 1.3 || Math.abs(ndcY) > 1.3) return null
  return { left: (ndcX + 1) * 50, top: (1 - ndcY) * 50 }
}

// Clic à l'écran (fractions 0..1) → (yaw°, pitch°). Réciproque de project().
export function unproject(fx, fy, yaw, pitch, fov, aspect) {
  const ty = Math.tan((fov * DEG) / 2)
  const cx = (fx * 2 - 1) * ty * aspect
  const cy = (1 - fy * 2) * ty
  const cz = -1

  const a = yaw * DEG
  const b = pitch * DEG
  const ca = Math.cos(a)
  const sa = Math.sin(a)
  const cb = Math.cos(b)
  const sb = Math.sin(b)

  const dx = ca * cx - sa * sb * cy - sa * cb * cz
  const dy = cb * cy - sb * cz
  const dz = sa * cx + ca * sb * cy + ca * cb * cz

  const len = Math.hypot(dx, dy, dz) || 1
  return {
    yaw: Math.atan2(dx, -dz) / DEG,
    pitch: Math.asin(Math.max(-1, Math.min(1, dy / len))) / DEG
  }
}

// Écart angulaire signé le plus court entre deux azimuts (pour animer une visée).
export function shortestAngle(from, to) {
  return ((((to - from) % 360) + 540) % 360) - 180
}
