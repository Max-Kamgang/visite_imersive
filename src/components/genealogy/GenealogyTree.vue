<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { hierarchy, tree } from 'd3-hierarchy'
import { select } from 'd3-selection'
import { zoom, zoomIdentity } from 'd3-zoom'
import { lignee } from '@/services/genealogy'

// ARBRE DE LIGNÉE — ascendants à gauche, descendants à droite, la personne au
// centre. L'ancienne version ne montrait que les ancêtres, en lecture seule :
// on ne pouvait ni cliquer un nom, ni voir qui avait succédé. On tournait donc
// en rond dès qu'on entrait par un objet du musée.
//
// Trois ajouts qui changent l'usage :
//   · un clic sur un nœud recentre l'arbre sur lui, en fondu ;
//   · les résultats de recherche s'allument dans l'arbre ;
//   · le chemin de filiation entre deux personnes se surligne.

const props = defineProps({
  // Personnes normalisées par services/genealogy.js
  people: { type: Array, default: () => [] },
  focusId: { type: [Number, String], default: null },
  highlightIds: { type: Array, default: () => [] },
  pathIds: { type: Array, default: () => [] },
  height: { type: Number, default: 620 },
  // Sur le site public la charte est claire (or et émeraude), dans l'ERP c'est
  // la palette PrimeVue : une seule bascule plutôt que deux composants.
  variant: { type: String, default: 'erp' }
})
const emit = defineEmits(['focus', 'open'])

const svgRef = ref()
const gRef = ref()
const anime = ref(false)
const echelle = ref(1)

const CARD_W = 196
const CARD_H = 86
const ECART_V = 24
const ECART_H = 96

let zoomer = null
let selection = null

// ---------------------------------------------------------------- disposition
const dispo = computed(() => {
  const noeuds = []
  const liens = []
  if (props.focusId == null || !props.people.length) return { noeuds, liens }

  const { haut, bas } = lignee(props.people, props.focusId)
  const poser = (racine, sens) => {
    if (!racine) return null
    const h = hierarchy(racine)
    tree().nodeSize([CARD_H + ECART_V, CARD_W + ECART_H])(h)
    const decalage = h.x
    h.each((n) => {
      n.sx = sens * n.y
      n.sy = n.x - decalage
    })
    return h
  }

  const hHaut = poser(haut, -1)
  const hBas = poser(bas, 1)

  // La personne au centre appartient aux deux arbres : on ne la dessine qu'une
  // fois, sinon deux cartes se superposent exactement et le survol clignote.
  const vus = new Set()
  for (const [h, sens] of [[hBas, 'bas'], [hHaut, 'haut']]) {
    if (!h) continue
    h.each((n) => {
      if (vus.has(n.data.id)) return
      vus.add(n.data.id)
      noeuds.push({ ...n.data, sx: n.sx, sy: n.sy, profondeur: n.depth, sens })
    })
    for (const l of h.links()) {
      liens.push({
        cle: `${l.source.data.id}-${l.target.data.id}`,
        d: courbe(l.source, l.target),
        sens
      })
    }
  }
  return { noeuds, liens }
})

// Courbe horizontale douce : plus lisible qu'une ligne brisée quand plusieurs
// branches se rejoignent sur un même parent.
function courbe(a, b) {
  const mx = (a.sx + b.sx) / 2
  return `M${a.sx},${a.sy}C${mx},${a.sy} ${mx},${b.sy} ${b.sx},${b.sy}`
}

const surlignes = computed(() => new Set(props.highlightIds))
const chemin = computed(() => new Set(props.pathIds))
const cheminLiens = computed(() => {
  const s = new Set()
  for (let i = 0; i < props.pathIds.length - 1; i++) {
    s.add(`${props.pathIds[i]}-${props.pathIds[i + 1]}`)
    s.add(`${props.pathIds[i + 1]}-${props.pathIds[i]}`)
  }
  return s
})

// ------------------------------------------------------------------ zoom -----
function installerZoom() {
  if (!svgRef.value) return
  zoomer = zoom()
    .scaleExtent([0.25, 2.2])
    .on('zoom', (e) => {
      select(gRef.value).attr('transform', e.transform)
      echelle.value = e.transform.k
    })
  selection = select(svgRef.value).call(zoomer)
  // Le double-clic natif de d3-zoom zoome ; ici il ouvre la fiche, donc on le retire.
  selection.on('dblclick.zoom', null)
}

// Recentre sur la personne au centre. `d3-transition` n'est pas installé
// (npm hors service) : on anime par une transition CSS posée le temps du trajet.
function recentrer(animer = true) {
  if (!selection || !zoomer || !svgRef.value) return
  const largeur = svgRef.value.clientWidth || 900
  const t = zoomIdentity.translate(largeur / 2, props.height / 2).scale(echelle.value)
  if (animer) {
    anime.value = true
    setTimeout(() => { anime.value = false }, 540)
  }
  selection.call(zoomer.transform, t)
}

function zoomer_(facteur) {
  if (!selection || !zoomer) return
  selection.call(zoomer.scaleBy, facteur)
}

// Ajuste l'échelle pour que toute la lignée tienne dans le cadre.
function ajuster() {
  const { noeuds } = dispo.value
  if (!noeuds.length || !svgRef.value || !selection) return
  const xs = noeuds.map((n) => n.sx)
  const ys = noeuds.map((n) => n.sy)
  const largeur = Math.max(...xs) - Math.min(...xs) + CARD_W * 1.6
  const hauteur = Math.max(...ys) - Math.min(...ys) + CARD_H * 1.6
  const k = Math.max(0.25, Math.min(1.2, Math.min(svgRef.value.clientWidth / largeur, props.height / hauteur)))
  anime.value = true
  setTimeout(() => { anime.value = false }, 540)
  selection.call(zoomer.transform, zoomIdentity.translate(svgRef.value.clientWidth / 2, props.height / 2).scale(k))
  echelle.value = k
}

function choisir(n) {
  if (n.id === props.focusId) { emit('open', n.id); return }
  emit('focus', n.id)
}

let ro = null
onMounted(async () => {
  installerZoom()
  await nextTick()
  ajuster()
  ro = new ResizeObserver(() => recentrer(false))
  if (svgRef.value) ro.observe(svgRef.value)
})
onBeforeUnmount(() => { if (ro) ro.disconnect() })

// Un changement de personne au centre redéploie l'arbre : on le recadre, sinon
// la nouvelle lignée s'affiche hors champ et paraît vide.
watch(() => props.focusId, () => nextTick(() => recentrer(true)))
watch(() => props.people.length, () => nextTick(() => ajuster()))

defineExpose({ ajuster, recentrer })
</script>

<template>
  <div class="gtree" :class="`gtree--${variant}`">
    <svg ref="svgRef" class="gtree__svg" :height="height" width="100%">
      <g ref="gRef" :class="{ 'gtree__g--anim': anime }">
        <path
          v-for="l in dispo.liens"
          :key="l.cle"
          :d="l.d"
          class="gtree__link"
          :class="[`gtree__link--${l.sens}`, { 'gtree__link--path': cheminLiens.has(l.cle) }]"
        />
        <foreignObject
          v-for="n in dispo.noeuds"
          :key="n.id"
          :x="n.sx - CARD_W / 2"
          :y="n.sy - CARD_H / 2"
          :width="CARD_W"
          :height="CARD_H"
        >
          <button
            type="button"
            class="pcard"
            :class="{
              'pcard--chef': n.titre,
              'pcard--focus': n.id === focusId,
              'pcard--hit': surlignes.has(n.id),
              'pcard--path': chemin.has(n.id)
            }"
            :title="n.id === focusId ? $t('genealogy.openProfile') : $t('genealogy.centerOn', { name: n.nom })"
            @click="choisir(n)"
          >
            <img v-if="n.portrait" :src="n.portrait" :alt="n.nom" class="pcard__img" />
            <span v-else class="pcard__img pcard__img--ph"><i class="pi pi-user" /></span>
            <span class="pcard__txt">
              <strong class="pcard__nom">{{ n.nom }}</strong>
              <span v-if="n.titre" class="pcard__titre">{{ n.titre }}</span>
              <span v-if="n.periode" class="pcard__dates">{{ n.periode }}</span>
            </span>
          </button>
        </foreignObject>
      </g>
    </svg>

    <div class="gtree__ctl">
      <button type="button" :title="$t('genealogy.zoomIn')" @click="zoomer_(1.3)"><i class="pi pi-search-plus" /></button>
      <button type="button" :title="$t('genealogy.zoomOut')" @click="zoomer_(1 / 1.3)"><i class="pi pi-search-minus" /></button>
      <button type="button" :title="$t('genealogy.fit')" @click="ajuster"><i class="pi pi-expand" /></button>
    </div>

    <p class="gtree__hint"><i class="pi pi-arrows-alt" /> {{ $t('genealogy.treeHelp') }}</p>
    <div class="gtree__legend">
      <span><i class="dot dot--up" /> {{ $t('genealogy.legendUp') }}</span>
      <span><i class="dot dot--down" /> {{ $t('genealogy.legendDown') }}</span>
    </div>
  </div>
</template>

<style scoped>
.gtree {
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--vi-border, #e5e7eb);
  background:
    radial-gradient(circle at 1px 1px, rgba(120, 120, 120, 0.18) 1px, transparent 0) 0 0 / 22px 22px,
    var(--vi-surface-2, #f6f7f9);
}
.gtree--public {
  border-color: #e8e9e6;
  background:
    radial-gradient(circle at 1px 1px, rgba(20, 40, 30, 0.12) 1px, transparent 0) 0 0 / 22px 22px,
    #fbfbf9;
}
.gtree__svg { display: block; cursor: grab; }
.gtree__svg:active { cursor: grabbing; }

/* d3-transition n'est pas installé : l'animation de recentrage passe par le CSS. */
.gtree__g--anim { transition: transform 0.52s cubic-bezier(0.22, 0.61, 0.36, 1); }

.gtree__link { fill: none; stroke-width: 1.8; }
/* La couleur du trait dit le sens de lecture : vers les aïeux ou vers la suite. */
.gtree__link--haut { stroke: color-mix(in srgb, var(--gold, #c9a227) 62%, transparent); }
.gtree__link--bas { stroke: color-mix(in srgb, var(--p-primary-color, #0e6f5c) 52%, transparent); }
.gtree__link--path { stroke: var(--gold, #c9a227); stroke-width: 3.4; }

/* ---------------- cartes ---------------- */
.pcard {
  display: flex; gap: 0.55rem; align-items: center;
  width: 100%; height: 100%; padding: 0.45rem 0.55rem;
  background: var(--vi-surface, #fff);
  border: 1px solid var(--vi-border, #e5e7eb);
  border-left: 4px solid var(--p-primary-color, #0e6f5c);
  border-radius: 11px; cursor: pointer; text-align: left;
  font-family: inherit; color: inherit;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.pcard:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.14); }
.pcard:focus-visible { outline: 2px solid var(--gold, #c9a227); outline-offset: 2px; }
.pcard--chef { border-left-color: var(--gold, #c9a227); }
.pcard--focus {
  border-color: var(--gold, #c9a227);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold, #c9a227) 35%, transparent), 0 8px 20px rgba(0, 0, 0, 0.16);
}
.pcard--hit { border-color: var(--p-primary-color, #0e6f5c); background: color-mix(in srgb, var(--p-primary-color, #0e6f5c) 8%, #fff); }
.pcard--path { border-left-color: var(--gold, #c9a227); background: color-mix(in srgb, var(--gold, #c9a227) 10%, #fff); }

.pcard__img { width: 46px; height: 46px; border-radius: 9px; object-fit: cover; flex: 0 0 46px; }
.pcard__img--ph { display: flex; align-items: center; justify-content: center; background: rgba(120, 120, 120, 0.12); color: rgba(90, 90, 90, 0.6); font-size: 1.2rem; }
.pcard__txt { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
.pcard__nom { font-size: 0.83rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pcard__titre { font-size: 0.68rem; color: var(--gold, #b8860b); font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pcard__dates { font-size: 0.71rem; color: var(--vi-muted, #7c817b); font-variant-numeric: tabular-nums; }

/* ---------------- habillage ---------------- */
.gtree__ctl { position: absolute; top: 10px; right: 12px; display: flex; flex-direction: column; gap: 0.35rem; }
.gtree__ctl button {
  width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--vi-border, #e5e7eb); background: rgba(255, 255, 255, 0.92);
  color: #3c403c; display: flex; align-items: center; justify-content: center;
}
.gtree__ctl button:hover { background: #fff; border-color: var(--gold, #c9a227); }

.gtree__hint, .gtree__legend {
  position: absolute; bottom: 8px; margin: 0;
  font-size: 0.72rem; color: var(--vi-muted, #7c817b);
  background: rgba(255, 255, 255, 0.85); padding: 0.24rem 0.55rem; border-radius: 8px;
}
.gtree__hint { right: 12px; }
.gtree__legend { left: 12px; display: flex; gap: 0.85rem; }
.gtree__legend span { display: inline-flex; align-items: center; gap: 0.3rem; }
.dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.dot--up { background: var(--gold, #c9a227); }
.dot--down { background: var(--p-primary-color, #0e6f5c); }
</style>
