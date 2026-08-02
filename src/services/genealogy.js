// Généalogie — logique partagée entre l'ERP et le site public.
//
// Les deux côtés manipulaient jusqu'ici la même matière avec des formes
// différentes (camelCase dans le store, snake_case dans les lignes Supabase) et
// chacun reconstruisait son arbre dans son coin. Trois copies de la même
// récursion, trois occasions de diverger. Tout passe désormais par ici.
//
// Parti pris de fond : la lignée d'un chef ne se lit pas seulement vers le haut.
// Un arbre purement ascendant répond à « de qui descend-il ? » alors que la
// question du visiteur est « qui régnait avant lui, qui après ». On construit
// donc les DEUX sens autour de la personne au centre.

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------
export function normalise(rows = []) {
  return rows.map((r) => ({
    id: r.id,
    nom: r.nom ?? '',
    prenom: r.prenom ?? '',
    titre: r.titre ?? '',
    portrait: r.portrait ?? r.photo ?? '',
    chefferie: r.chefferie ?? r.lieuOrigine ?? '',
    biographie: r.biographie ?? '',
    naissance: r.date_naissance ?? r.naissance ?? null,
    deces: r.date_deces ?? r.deces ?? null,
    regneDebut: r.regne_debut ?? r.regneDebut ?? null,
    regneFin: r.regne_fin ?? r.regneFin ?? null,
    pereId: r.pere_id ?? r.pereId ?? null,
    mereId: r.mere_id ?? r.mereId ?? null
  }))
}

export const indexer = (people) => new Map(people.map((p) => [p.id, p]))

export function nomComplet(p) {
  if (!p) return ''
  return [p.prenom, p.nom].filter(Boolean).join(' ')
}

// Les années de règne priment sur les dates de vie : c'est ce qui situe un chef
// dans l'histoire de la chefferie, et c'est ce que le visiteur cherche.
export function periode(p) {
  if (!p) return ''
  if (p.regneDebut) return `${p.regneDebut} – ${p.regneFin ?? '…'}`
  const an = (d) => (d ? String(d).slice(0, 4) : null)
  const a = an(p.naissance)
  const b = an(p.deces)
  return a || b ? `${a ?? '?'} – ${b ?? '…'}` : ''
}

export const estChef = (p) => !!p?.titre

const parentsDe = (p) => [p?.pereId, p?.mereId].filter((x) => x != null)

// ---------------------------------------------------------------------------
// Lignée
// ---------------------------------------------------------------------------
const noeud = (p) => ({
  id: p.id,
  nom: nomComplet(p),
  titre: p.titre,
  periode: periode(p),
  portrait: p.portrait,
  children: []
})

// Ascendants : les « enfants » du nœud sont les PARENTS. Profondeur bornée pour
// que l'affichage reste lisible, et garde anti-cycle — une base saisie à la main
// finit toujours par contenir une boucle.
export function ascendants(byId, id, profondeur = 4, vus = new Set()) {
  const p = byId.get(id)
  if (!p || vus.has(id)) return null
  vus.add(id)
  const n = noeud(p)
  if (profondeur > 0) {
    for (const pid of parentsDe(p)) {
      const enfant = ascendants(byId, pid, profondeur - 1, vus)
      if (enfant) n.children.push(enfant)
    }
  }
  return n
}

export function enfantsDe(people, id) {
  return people.filter((p) => p.pereId === id || p.mereId === id)
}

export function descendants(people, byId, id, profondeur = 3, vus = new Set()) {
  const p = byId.get(id)
  if (!p || vus.has(id)) return null
  vus.add(id)
  const n = noeud(p)
  if (profondeur > 0) {
    for (const e of enfantsDe(people, id)) {
      const enfant = descendants(people, byId, e.id, profondeur - 1, vus)
      if (enfant) n.children.push(enfant)
    }
  }
  return n
}

// Les deux sens autour d'une même personne, prêts pour la mise en page.
export function lignee(people, id, { haut = 4, bas = 3 } = {}) {
  const byId = indexer(people)
  if (!byId.has(id)) return { haut: null, bas: null }
  return {
    haut: ascendants(byId, id, haut, new Set()),
    bas: descendants(people, byId, id, bas, new Set())
  }
}

// ---------------------------------------------------------------------------
// Chemin de filiation entre deux personnes
//
// Répond à « quel lien de sang entre ces deux-là ? ». On remonte les ancêtres
// de chacun, on cherche le premier aïeul commun, puis on recolle les deux
// branches. Renvoie la suite d'identifiants, ou null s'il n'y a aucun lien —
// et dire « aucun lien » est une réponse utile, pas un échec.
// ---------------------------------------------------------------------------
function chaineAscendante(byId, id, max = 40) {
  // id → parent par lequel on y est arrivé, pour pouvoir rembobiner.
  const venantDe = new Map([[id, null]])
  const file = [id]
  let garde = 0
  while (file.length && garde++ < max * 4) {
    const courant = file.shift()
    for (const pid of parentsDe(byId.get(courant))) {
      if (venantDe.has(pid)) continue
      venantDe.set(pid, courant)
      file.push(pid)
    }
  }
  return venantDe
}

const remonter = (venantDe, depuis) => {
  const out = []
  let c = depuis
  while (c != null) { out.push(c); c = venantDe.get(c) }
  return out // de l'aïeul vers la personne de départ
}

export function cheminFiliation(people, aId, bId) {
  if (aId == null || bId == null || aId === bId) return null
  const byId = indexer(people)
  if (!byId.has(aId) || !byId.has(bId)) return null

  const versA = chaineAscendante(byId, aId)
  const versB = chaineAscendante(byId, bId)

  // Aïeul commun le plus proche : celui dont la somme des distances est minimale.
  let meilleur = null
  let meilleurCout = Infinity
  for (const candidat of versA.keys()) {
    if (!versB.has(candidat)) continue
    const cout = remonter(versA, candidat).length + remonter(versB, candidat).length
    if (cout < meilleurCout) { meilleurCout = cout; meilleur = candidat }
  }
  if (meilleur == null) return null

  const brancheA = remonter(versA, meilleur).reverse() // A … aïeul
  const brancheB = remonter(versB, meilleur) // aïeul … B
  return [...brancheA, ...brancheB.slice(1)]
}

// ---------------------------------------------------------------------------
// Recherche
// ---------------------------------------------------------------------------
export function rechercher(people, terme) {
  const q = String(terme || '').trim().toLowerCase()
  if (!q) return []
  return people.filter((p) =>
    nomComplet(p).toLowerCase().includes(q) ||
    (p.titre || '').toLowerCase().includes(q) ||
    (p.chefferie || '').toLowerCase().includes(q) ||
    String(p.regneDebut ?? '').includes(q)
  )
}

// Chefs ordonnés dans le temps — matière de la frise chronologique.
export function regnesOrdonnes(people) {
  return people
    .filter((p) => p.regneDebut != null && p.regneDebut !== '')
    .map((p) => ({ ...p, debut: Number(String(p.regneDebut).slice(0, 4)) }))
    .filter((p) => Number.isFinite(p.debut))
    .sort((a, b) => a.debut - b.debut)
    .map((p, i, liste) => ({
      ...p,
      // Un règne sans fin saisie court jusqu'au début du suivant : sans cela la
      // frise afficherait des trous là où la succession est pourtant continue.
      fin: Number(String(p.regneFin ?? '').slice(0, 4)) ||
        (liste[i + 1] ? liste[i + 1].debut : new Date().getFullYear()),
      finEstimee: !p.regneFin
    }))
}
