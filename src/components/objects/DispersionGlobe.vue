<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { MONDE } from '@/assets/world-110m.js'

// ============================================================================
// GLOBE DE DISPERSION — vrai globe terrestre, en SVG pur.
//
// • 137 pays dessinés (Natural Earth 110m, embarqué : zéro dépendance, hors ligne)
// • Projection orthographique calculée à la main
// • Découpe sphérique : les polygones à cheval sur l'horizon sont coupés net,
//   puis refermés le long du limbe — sinon les continents « débordent » du globe
// • Rotation continue, et rotation libre à la souris/au doigt sur DEUX axes
// • Arcs de grand cercle : le trajet réel des objets hors de leur terre natale
// ============================================================================

const props = defineProps({
  origine: { type: Object, default: null },   // { lat, lon, label }
  lieux: { type: Array, default: () => [] },  // [{ musee, pays, lat, lon, total }]
  taille: { type: Number, default: 420 }
})

const R = computed(() => props.taille / 2 - 26)
const C = computed(() => props.taille / 2)

// Orientation courante : λ0 = méridien central, φ0 = inclinaison.
const lambda0 = ref(-10)
const phi0 = ref(15)
const autoRotation = ref(true)
const survole = ref(null)
const glisse = ref(false)

const rad = (d) => (d * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI

// ---------- Animation ----------
let raf = null
let dernier = 0
function boucle(t) {
  if (dernier && autoRotation.value && !glisse.value) {
    lambda0.value = (lambda0.value + (t - dernier) * 0.011) % 360
  }
  dernier = t
  raf = requestAnimationFrame(boucle)
}
onMounted(() => { raf = requestAnimationFrame(boucle) })
onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  detacherGlisse()
})

watch(() => props.origine, (o) => { if (o) lambda0.value = o.lon - 25 })

// ---------- Rotation à la souris / au doigt ----------
let depart = null
function pointeur(e) {
  const t = e.touches?.[0] || e
  return { x: t.clientX, y: t.clientY }
}
function debutGlisse(e) {
  glisse.value = true
  const p = pointeur(e)
  depart = { ...p, lambda: lambda0.value, phi: phi0.value }
  window.addEventListener('mousemove', pendantGlisse)
  window.addEventListener('mouseup', finGlisse)
  window.addEventListener('touchmove', pendantGlisse, { passive: false })
  window.addEventListener('touchend', finGlisse)
}
function pendantGlisse(e) {
  if (!depart) return
  if (e.cancelable) e.preventDefault()
  const p = pointeur(e)
  // 0,32°/px : rotation naturelle, ni trop lente ni trop nerveuse
  lambda0.value = depart.lambda + (p.x - depart.x) * 0.32
  // L'inclinaison est bornée : au-delà des pôles le globe se retournerait
  phi0.value = Math.max(-80, Math.min(80, depart.phi + (p.y - depart.y) * 0.28))
}
function finGlisse() {
  glisse.value = false
  depart = null
  detacherGlisse()
}
function detacherGlisse() {
  window.removeEventListener('mousemove', pendantGlisse)
  window.removeEventListener('mouseup', finGlisse)
  window.removeEventListener('touchmove', pendantGlisse)
  window.removeEventListener('touchend', finGlisse)
}

// ---------- Projection orthographique ----------
// Renvoie la position à l'écran + cosc (> 0 : face visible ; = 0 : sur l'horizon).
function projeter(lat, lon) {
  const p = rad(lat)
  const l = rad(lon - lambda0.value)
  const p0 = rad(phi0.value)
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l)
  return {
    x: C.value + R.value * Math.cos(p) * Math.sin(l),
    y: C.value - R.value * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)),
    cosc
  }
}

// Ramène un point sur le cercle du limbe (utilisé aux points de coupe).
function surLimbe(pt) {
  const dx = pt.x - C.value
  const dy = pt.y - C.value
  const d = Math.hypot(dx, dy) || 1
  return { x: C.value + (dx / d) * R.value, y: C.value + (dy / d) * R.value }
}

// Angle d'un point du limbe, pour refermer le contour par un arc de cercle.
const angleLimbe = (p) => Math.atan2(p.y - C.value, p.x - C.value)

// ---------- Découpe sphérique d'un anneau de pays ----------
// On parcourt l'anneau ; à chaque franchissement de l'horizon on insère le point
// de coupe. Les tronçons visibles sont ensuite refermés le long du limbe, ce qui
// donne un polygone plein correct même quand le pays est à cheval sur le bord.
function decouperAnneau(anneau) {
  const proj = anneau.map(([lon, lat]) => projeter(lat, lon))
  const n = proj.length
  const visibles = proj.map((p) => p.cosc > 0)

  if (visibles.every((v) => !v)) return null            // entièrement caché
  if (visibles.every((v) => v)) {                       // entièrement visible
    return proj.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  }

  // Cas mixte : on construit le contour en insérant les points de coupe.
  const sortie = []
  for (let i = 0; i < n; i++) {
    const a = proj[i]
    const b = proj[(i + 1) % n]
    if (visibles[i]) sortie.push({ ...a, coupe: false })
    if (visibles[i] !== visibles[(i + 1) % n]) {
      // Interpolation linéaire vers cosc = 0, puis projection exacte sur le limbe.
      const t = a.cosc / (a.cosc - b.cosc)
      const pt = surLimbe({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
      sortie.push({ ...pt, coupe: true })
    }
  }
  if (sortie.length < 3) return null

  // Entre deux points de coupe consécutifs, on suit le limbe plutôt qu'une corde.
  const pts = []
  for (let i = 0; i < sortie.length; i++) {
    const p = sortie[i]
    const q = sortie[(i + 1) % sortie.length]
    pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    if (p.coupe && q.coupe) {
      let a0 = angleLimbe(p)
      let a1 = angleLimbe(q)
      let d = a1 - a0
      while (d > Math.PI) d -= 2 * Math.PI
      while (d < -Math.PI) d += 2 * Math.PI
      const pas = Math.max(2, Math.ceil(Math.abs(d) / 0.12))
      for (let k = 1; k < pas; k++) {
        const a = a0 + (d * k) / pas
        pts.push(`${(C.value + Math.cos(a) * R.value).toFixed(1)},${(C.value + Math.sin(a) * R.value).toFixed(1)}`)
      }
    }
  }
  return pts.join(' ')
}

const terres = computed(() => {
  const out = []
  for (const pays of MONDE) {
    for (const anneau of pays.r) {
      const d = decouperAnneau(anneau)
      if (d) out.push({ nom: pays.n, points: d })
    }
  }
  return out
})

// ---------- Grille de repères ----------
function segmenter(points) {
  const out = []
  let courant = []
  for (const p of points) {
    if (p.cosc > 0) courant.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    else { if (courant.length > 1) out.push(courant.join(' ')); courant = [] }
  }
  if (courant.length > 1) out.push(courant.join(' '))
  return out
}

const graticule = computed(() => {
  const traits = []
  for (let lon = -180; lon < 180; lon += 30) {
    const pts = []
    for (let lat = -85; lat <= 85; lat += 5) pts.push(projeter(lat, lon))
    traits.push(segmenter(pts))
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = []
    for (let lon = -180; lon <= 180; lon += 5) pts.push(projeter(lat, lon))
    traits.push(segmenter(pts))
  }
  return traits.flat()
})

// ---------- Arcs de grand cercle ----------
function grandCercle(a, b, n = 56) {
  const p1 = rad(a.lat), l1 = rad(a.lon)
  const p2 = rad(b.lat), l2 = rad(b.lon)
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2
  ))
  if (!d) return []
  const pts = []
  for (let i = 0; i <= n; i++) {
    const f = i / n
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2)
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2)
    const z = A * Math.sin(p1) + B * Math.sin(p2)
    pts.push(projeter(deg(Math.atan2(z, Math.hypot(x, y))), deg(Math.atan2(y, x))))
  }
  return pts
}

const maxTotal = computed(() => Math.max(1, ...props.lieux.map((l) => l.total)))
const origineProj = computed(() => (props.origine ? projeter(props.origine.lat, props.origine.lon) : null))

const marqueurs = computed(() =>
  props.lieux.map((l) => {
    const p = projeter(l.lat, l.lon)
    return { ...l, ...p, visible: p.cosc > 0, r: 3 + (l.total / maxTotal.value) * 7 }
  })
)

const arcs = computed(() => {
  if (!props.origine) return []
  return props.lieux.map((l) => ({
    musee: l.musee,
    total: l.total,
    troncons: segmenter(grandCercle(props.origine, l))
  }))
})

function recentrer() {
  if (props.origine) { lambda0.value = props.origine.lon - 25; phi0.value = 15 }
}
</script>

<template>
  <figure class="globe">
    <svg
      :width="taille" :height="taille" :viewBox="`0 0 ${taille} ${taille}`"
      role="img" :aria-label="$t('globe.aria')"
      :class="{ glisse }"
      @mousedown.prevent="debutGlisse" @touchstart.prevent="debutGlisse"
      @mouseenter="autoRotation = false" @mouseleave="autoRotation = true; survole = null"
    >
      <defs>
        <radialGradient id="g-ocean" cx="34%" cy="28%">
          <stop offset="0%" stop-color="#14564a" />
          <stop offset="65%" stop-color="#0a2f28" />
          <stop offset="100%" stop-color="#051713" />
        </radialGradient>
        <radialGradient id="g-halo" cx="50%" cy="50%">
          <stop offset="58%" stop-color="rgba(20,150,120,0)" />
          <stop offset="100%" stop-color="rgba(20,150,120,0.35)" />
        </radialGradient>
        <radialGradient id="g-ombre" cx="34%" cy="28%">
          <stop offset="0%" stop-color="rgba(255,255,255,.16)" />
          <stop offset="55%" stop-color="rgba(255,255,255,0)" />
          <stop offset="100%" stop-color="rgba(0,0,0,.45)" />
        </radialGradient>
        <filter id="g-glow" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <!-- Atmosphère -->
      <circle :cx="C" :cy="C" :r="R + 15" fill="url(#g-halo)" />
      <!-- Océans -->
      <circle :cx="C" :cy="C" :r="R" fill="url(#g-ocean)" />

      <!-- Continents -->
      <g class="terres">
        <polygon v-for="(t, i) in terres" :key="'t' + i" :points="t.points">
          <title>{{ t.nom }}</title>
        </polygon>
      </g>

      <!-- Méridiens et parallèles -->
      <g class="grat">
        <polyline v-for="(t, i) in graticule" :key="'gr' + i" :points="t" />
      </g>

      <!-- Trajets vers les musées détenteurs -->
      <g class="arcs">
        <template v-for="(a, i) in arcs" :key="'a' + i">
          <polyline
            v-for="(t, j) in a.troncons" :key="'a' + i + '-' + j" :points="t"
            :class="{ actif: survole === a.musee }"
            :style="{ strokeWidth: 0.9 + (a.total / maxTotal) * 1.8 }"
          />
        </template>
      </g>

      <!-- Relief : lumière rasante et terminateur -->
      <circle :cx="C" :cy="C" :r="R" fill="url(#g-ombre)" pointer-events="none" />
      <circle :cx="C" :cy="C" :r="R" fill="none" stroke="rgba(130,235,200,.35)" stroke-width="1" pointer-events="none" />

      <!-- Terre d'origine -->
      <g v-if="origineProj && origineProj.cosc > 0" class="origine" filter="url(#g-glow)">
        <circle :cx="origineProj.x" :cy="origineProj.y" r="5.5" />
        <circle :cx="origineProj.x" :cy="origineProj.y" r="5.5" class="pulse" />
      </g>

      <!-- Musées détenteurs -->
      <g class="lieux">
        <g
          v-for="m in marqueurs.filter((x) => x.visible)" :key="m.musee"
          @mouseenter="survole = m.musee" @mouseleave="survole = null"
        >
          <circle :cx="m.x" :cy="m.y" :r="m.r" :opacity="0.5 + m.cosc * 0.5" :class="{ actif: survole === m.musee }" />
          <title>{{ m.musee }} — {{ m.pays }} : {{ m.total }}</title>
        </g>
      </g>
    </svg>

    <figcaption class="globe__cap">
      <span v-if="origine" class="globe__from"><i class="pi pi-map-marker" /> {{ origine.label }}</span>
      <span class="globe__to"><i class="pi pi-arrow-right" /> {{ $t('globe.museums', { n: lieux.length }) }}</span>
      <button type="button" class="globe__btn" @click="recentrer">
        <i class="pi pi-compass" /> {{ $t('globe.recenter') }}
      </button>
      <span class="globe__hint">{{ $t('globe.drag') }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.globe { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 0.7rem; }
.globe svg { display: block; cursor: grab; touch-action: none; user-select: none; }
.globe svg.glisse { cursor: grabbing; }

.terres polygon { fill: #2f7d5f; stroke: #57b98d; stroke-width: 0.4; stroke-linejoin: round; }
.grat polyline { fill: none; stroke: rgba(150, 240, 210, 0.13); stroke-width: 0.6; }

.arcs polyline { fill: none; stroke: #ffcf6b; stroke-linecap: round; opacity: 0.6; transition: opacity 0.15s, stroke 0.15s; }
.arcs polyline.actif { stroke: #fff0c2; opacity: 1; }

.origine circle { fill: #ff6b4a; }
.origine .pulse { fill: none; stroke: #ff6b4a; stroke-width: 2; animation: onde 2.4s ease-out infinite; }
@keyframes onde { 0% { r: 5.5; opacity: 0.9; } 100% { r: 24; opacity: 0; } }

.lieux circle { fill: #9df3d2; stroke: rgba(5, 23, 19, 0.85); stroke-width: 1; cursor: pointer; transition: fill 0.15s; }
.lieux circle.actif { fill: #fff; }

.globe__cap { display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap; justify-content: center; font-size: 0.8rem; color: var(--vi-muted); }
.globe__from { color: #e07253; font-weight: 700; }
.globe__to { font-weight: 600; }
.globe__btn {
  display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer;
  background: transparent; border: 1px solid var(--vi-border); color: inherit;
  border-radius: 999px; padding: 0.25rem 0.7rem; font-size: 0.76rem; font-family: inherit;
}
.globe__btn:hover { border-color: #2f7d5f; color: #57b98d; }
.globe__hint { opacity: 0.7; font-size: 0.74rem; }

@media (prefers-reduced-motion: reduce) { .origine .pulse { animation: none; } }
</style>
