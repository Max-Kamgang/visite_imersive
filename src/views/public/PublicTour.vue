<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import PanoramaViewer from '@/components/immersive/PanoramaViewer.vue'
import ArViewer from '@/components/immersive/ArViewer.vue'
import { pubTour, pubObjectChefs } from '@/services/publicApi'
import { useSiteLink } from '@/composables/useSiteLink'
import { useTts } from '@/services/tts'

// VISITE IMMERSIVE — le cœur de la démonstration.
//
// Le visiteur avance de salle en salle, touche un objet, le voit en 3D ou en
// réalité augmentée, l'entend raconté, puis remonte au chef qui l'a possédé et
// à sa lignée. Chaque écran doit permettre de continuer ce fil : un objet qui
// ne mène nulle part est un échec de conception.

const { t } = useI18n()
const route = useRoute()
const { to } = useSiteLink()
const { speaking: ttsSpeaking, speak: ttsSpeak, stop: ttsStop } = useTts()

const tour = ref(null)
const loading = ref(true)
const index = ref(0)
const selected = ref(null) // point chaud ouvert
const chefs = ref([])
const viewer3d = ref(false) // superposition 3D/AR, sans quitter le parcours
const finished = ref(false)
const panoRef = ref(null)

const scenes = computed(() => tour.value?.scenes || [])
const scene = computed(() => scenes.value[index.value] || null)
const sceneHotspots = computed(() =>
  (tour.value?.hotspots || [])
    .filter((h) => h.sceneId === scene.value?.id)
    .map((h) => ({ ...h, libelle: h.libelle || defaultLabel(h), active: selected.value?.id === h.id }))
)
const progress = computed(() => (scenes.value.length ? ((index.value + 1) / scenes.value.length) * 100 : 0))
const museumId = computed(() => tour.value?.museumId ?? null)

// Le QR affiché sur l'ordinateur doit mener à la page RA autonome de l'objet,
// pas à l'adresse du parcours : sur téléphone, on veut la pièce, pas la salle.
const arLink = computed(() => {
  const o = selected.value?.objet
  if (!o || typeof window === 'undefined') return ''
  return `${window.location.origin}${to(`/ar/${o.id}`)}`
})

function defaultLabel(h) {
  if (h.type === 'objet') return h.objet?.nom || ''
  if (h.type === 'personnage') return chefLabel(h.personnage)
  if (h.type === 'navigation') return sceneTitle(h.sceneCibleId)
  return ''
}
function chefLabel(p) {
  if (!p) return ''
  const nom = p.prenom ? `${p.prenom} ${p.nom}` : p.nom
  return p.titre ? `${p.titre} ${nom}` : nom
}
function sceneTitle(id) {
  return scenes.value.find((s) => s.id === id)?.titre || t('tour.nextRoom')
}

async function load() {
  loading.value = true
  tour.value = await pubTour(Number(route.params.id))
  index.value = 0
  selected.value = null
  finished.value = false
  loading.value = false
}
onMounted(load)
watch(() => route.params.id, load)
onBeforeUnmount(() => ttsStop())

// ------------------------------------------------------------- navigation --
function goTo(i) {
  if (i < 0 || i >= scenes.value.length) return
  ttsStop()
  selected.value = null
  chefs.value = []
  index.value = i
  finished.value = false
}
function goToScene(id) {
  const i = scenes.value.findIndex((s) => s.id === id)
  if (i !== -1) goTo(i)
}
function next() {
  if (index.value >= scenes.value.length - 1) { ttsStop(); selected.value = null; finished.value = true; return }
  goTo(index.value + 1)
}

// ----------------------------------------------------------- points chauds --
async function openHotspot(h) {
  if (h.type === 'navigation') { goToScene(h.sceneCibleId); return }
  ttsStop()
  selected.value = h
  chefs.value = []
  panoRef.value?.lookAt(h)
  // Le fil du chef : dès qu'un objet s'ouvre, on cherche à qui il a appartenu.
  if (h.type === 'objet' && h.objet) {
    const r = await pubObjectChefs(h.objet.id)
    if (selected.value?.id === h.id) chefs.value = r.map((x) => x.personnages)
  }
}
function closeCard() { ttsStop(); selected.value = null; chefs.value = [] }

// Récit vocal : la voix du secteur si la salle en a une, sinon la voix par défaut.
// Le texte reste du contenu public (description de l'objet, histoire de la salle).
function narration() {
  const h = selected.value
  const sec = scene.value?.secteur
  if (h?.type === 'objet' && h.objet) {
    return [h.objet.nom, h.objet.description || sec?.histoire || t('tour.noStory')].filter(Boolean).join('. ')
  }
  if (h?.type === 'personnage' && h.personnage) {
    const p = h.personnage
    const regne = p.regne_debut ? t('museum.reign', { from: p.regne_debut, to: p.regne_fin ?? '…' }) : ''
    return [chefLabel(p), regne].filter(Boolean).join('. ')
  }
  if (h?.type === 'info') return h.texte
  return [scene.value?.titre, sec?.histoire || sec?.description].filter(Boolean).join('. ')
}

function listen() {
  if (ttsSpeaking.value) { ttsStop(); return }
  const sec = scene.value?.secteur
  ttsSpeak(narration(), {
    lang: 'fr',
    rate: sec?.debit || 1,
    timbre: sec?.timbreVoix || 'standard',
    voiceId: sec?.voiceId || undefined,
    provider: sec?.voiceId ? 'elevenlabs' : undefined
  })
}
</script>

<template>
  <div class="tour">
    <p v-if="loading" class="ps-wrap ps-muted">{{ $t('common.loading') }}</p>

    <template v-else-if="tour && scenes.length">
      <!-- ---------------- Bandeau du parcours ---------------- -->
      <header class="tour__bar">
        <router-link :to="museumId ? to(`/musees/${museumId}`) : to('/musees')" class="ps-back tour__back">
          <i class="pi pi-arrow-left" /> {{ $t('tour.leave') }}
        </router-link>
        <div class="tour__id">
          <span class="tour__over">{{ tour.titre }}</span>
          <strong>{{ scene.titre }}</strong>
          <small v-if="scene.secteur">{{ scene.secteur.nom }}</small>
        </div>
        <div class="tour__count">{{ index + 1 }} / {{ scenes.length }}</div>
      </header>
      <div class="tour__progress"><span :style="{ width: `${progress}%` }" /></div>

      <!-- ---------------- Panorama ---------------- -->
      <div class="tour__stage">
        <PanoramaViewer
          ref="panoRef"
          :src="scene.mediaUrl"
          :type="scene.type"
          :hotspots="sceneHotspots"
          :initial="scene.positionInitiale"
          :seed="index"
          class="tour__pano"
          @select="openHotspot"
        />

        <!-- Fiche flottante : objet, personnage ou note -->
        <transition name="card">
          <aside v-if="selected" class="card" :key="selected.id">
            <button class="card__x" :aria-label="$t('common.close')" @click="closeCard"><i class="pi pi-times" /></button>

            <!-- ----- Objet ----- -->
            <template v-if="selected.type === 'objet' && selected.objet">
              <div class="card__media">
                <img v-if="selected.objet.photo" :src="selected.objet.photo" :alt="selected.objet.nom" />
                <div v-else class="card__ph"><i class="pi pi-box" /></div>
              </div>
              <div class="card__body">
                <span class="card__over">{{ scene.secteur?.nom || $t('home.workFallback') }}</span>
                <h2>{{ selected.objet.nom }}</h2>
                <p v-if="selected.objet.nom_commun" class="card__common">{{ selected.objet.nom_commun }}</p>
                <p class="card__desc">{{ selected.objet.description || $t('object.descriptionSoon') }}</p>

                <div class="card__actions">
                  <button class="ps-btn ps-btn--sm" @click="viewer3d = true">
                    <i class="pi pi-mobile" /> {{ $t('tour.see3d') }}
                  </button>
                  <button class="ps-btn ps-btn--sm ps-btn--line" @click="listen">
                    <i :class="ttsSpeaking ? 'pi pi-stop' : 'pi pi-volume-up'" />
                    {{ ttsSpeaking ? $t('tour.stopGuide') : $t('tour.listenGuide') }}
                  </button>
                </div>

                <!-- Le fil du chef : de l'objet à la lignée -->
                <div v-if="chefs.length" class="thread">
                  <span class="thread__lead"><i class="pi pi-sitemap" /> {{ $t('tour.threadLead') }}</span>
                  <router-link
                    v-for="c in chefs"
                    :key="c.id"
                    :to="to(`/personnages/${c.id}`)"
                    class="thread__chef"
                  >
                    <img v-if="c.portrait" :src="c.portrait" :alt="chefLabel(c)" />
                    <span v-else class="thread__ph"><i class="pi pi-user" /></span>
                    <span class="thread__n">
                      <strong>{{ chefLabel(c) }}</strong>
                      <small>{{ $t('tour.seeLineage') }}</small>
                    </span>
                    <i class="pi pi-arrow-right" />
                  </router-link>
                </div>

                <router-link :to="to(`/objets/${selected.objet.id}`)" class="card__more">
                  {{ $t('tour.fullRecord') }} <i class="pi pi-arrow-right" />
                </router-link>
              </div>
            </template>

            <!-- ----- Personnage ----- -->
            <template v-else-if="selected.type === 'personnage' && selected.personnage">
              <div class="card__media">
                <img v-if="selected.personnage.portrait" :src="selected.personnage.portrait" :alt="chefLabel(selected.personnage)" />
                <div v-else class="card__ph"><i class="pi pi-user" /></div>
              </div>
              <div class="card__body">
                <span class="card__over">{{ $t('tour.chief') }}</span>
                <h2>{{ chefLabel(selected.personnage) }}</h2>
                <p v-if="selected.personnage.regne_debut" class="card__common">
                  {{ $t('museum.reign', { from: selected.personnage.regne_debut, to: selected.personnage.regne_fin ?? '…' }) }}
                </p>
                <div class="card__actions">
                  <button class="ps-btn ps-btn--sm ps-btn--line" @click="listen">
                    <i :class="ttsSpeaking ? 'pi pi-stop' : 'pi pi-volume-up'" />
                    {{ ttsSpeaking ? $t('tour.stopGuide') : $t('tour.listenGuide') }}
                  </button>
                </div>
                <router-link :to="to(`/personnages/${selected.personnage.id}`)" class="card__more">
                  {{ $t('tour.seeLineage') }} <i class="pi pi-arrow-right" />
                </router-link>
              </div>
            </template>

            <!-- ----- Note ----- -->
            <template v-else>
              <div class="card__body card__body--note">
                <span class="card__over">{{ selected.libelle || $t('tour.note') }}</span>
                <p class="card__desc">{{ selected.texte }}</p>
                <button class="ps-btn ps-btn--sm ps-btn--line" @click="listen">
                  <i :class="ttsSpeaking ? 'pi pi-stop' : 'pi pi-volume-up'" />
                  {{ ttsSpeaking ? $t('tour.stopGuide') : $t('tour.listenGuide') }}
                </button>
              </div>
            </template>
          </aside>
        </transition>

        <!-- Fin de parcours : on ne laisse jamais le visiteur au bout d'une impasse -->
        <transition name="card">
          <div v-if="finished" class="end">
            <div class="end__in">
              <span class="ps-over">{{ $t('tour.endOver') }}</span>
              <h2>{{ $t('tour.endTitle') }}</h2>
              <p>{{ $t('tour.endText') }}</p>
              <div class="end__act">
                <router-link :to="to('/genealogie')" class="ps-btn"><i class="pi pi-sitemap" /> {{ $t('tour.endGenealogy') }}</router-link>
                <router-link v-if="museumId" :to="to(`/musees/${museumId}`)" class="ps-btn btn-dark-ghost">
                  <i class="pi pi-building" /> {{ $t('tour.endMuseum') }}
                </router-link>
                <button class="ps-btn btn-dark-ghost" @click="goTo(0)"><i class="pi pi-replay" /> {{ $t('tour.endRestart') }}</button>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- ---------------- Mini-carte des salles ---------------- -->
      <nav class="rooms" :aria-label="$t('tour.roomsAria')">
        <button class="rooms__nav" :disabled="index === 0" :aria-label="$t('tour.prev')" @click="goTo(index - 1)">
          <i class="pi pi-chevron-left" />
        </button>
        <ol class="rooms__list">
          <li v-for="(s, i) in scenes" :key="s.id">
            <button class="room" :class="{ 'room--on': i === index }" @click="goTo(i)">
              <span class="room__n">{{ i + 1 }}</span>
              <span class="room__t">{{ s.titre }}</span>
            </button>
          </li>
        </ol>
        <button class="rooms__nav rooms__nav--next" :aria-label="$t('tour.next')" @click="next">
          <i class="pi pi-chevron-right" />
        </button>
      </nav>

      <!-- 3D et réalité augmentée en superposition : le visiteur garde sa place
           dans le parcours, et retrouve la salle en refermant. -->
      <transition name="card">
        <div v-if="viewer3d && selected?.objet" class="arwrap" @click.self="viewer3d = false">
          <div class="arwrap__in">
            <ArViewer
              :objet="selected.objet"
              :variante="selected.objet.id % 2 ? 'recipient' : 'tabouret'"
              :lien-mobile="arLink"
              compact
              @close="viewer3d = false"
            />
          </div>
        </div>
      </transition>
    </template>

    <div v-else class="ps-wrap ps-muted">{{ $t('tour.notFound') }}</div>
  </div>
</template>

<style scoped>
.tour { background: #0d0d0b; min-height: 70vh; padding-bottom: 1.2rem; }

/* ---------------- bandeau ---------------- */
.tour__bar {
  display: flex; align-items: center; gap: 1.2rem;
  max-width: 1240px; margin: 0 auto; padding: 1.2rem 1.5rem 0.9rem;
}
.tour__back { margin: 0; flex: 0 0 auto; }
.tour__id { flex: 1 1 auto; min-width: 0; text-align: center; }
.tour__over { display: block; font-size: 0.66rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold, #c9a227); font-weight: 800; }
.tour__id strong {
  display: block; color: #fff; font-family: 'Anton', 'Inter', sans-serif; font-weight: 400;
  text-transform: uppercase; font-size: clamp(1.1rem, 2.6vw, 1.7rem); line-height: 1.15;
}
.tour__id small { color: #9a9a90; font-size: 0.78rem; }
.tour__count { flex: 0 0 auto; color: #9a9a90; font-size: 0.85rem; font-variant-numeric: tabular-nums; }

.tour__progress { max-width: 1240px; margin: 0 auto; height: 3px; background: rgba(255,255,255,0.12); }
.tour__progress span { display: block; height: 100%; background: var(--gold, #c9a227); transition: width 0.4s ease; }

/* ---------------- scène ---------------- */
.tour__stage { position: relative; max-width: 1240px; margin: 0 auto; padding: 1rem 1.5rem 0; }
.tour__pano { height: min(64vh, 620px); }
@media (max-width: 720px) { .tour__pano { height: 54vh; } }

/* ---------------- fiche flottante ---------------- */
.card {
  position: absolute; right: 2.2rem; top: 2rem; bottom: 1.4rem;
  width: min(390px, calc(100% - 4.4rem));
  background: #fff; border-radius: 14px; overflow-y: auto;
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.5);
}
@media (max-width: 720px) {
  .card { right: 1.5rem; left: 1.5rem; top: auto; bottom: 1rem; width: auto; max-height: 62%; }
}
.card__x {
  position: absolute; right: 0.6rem; top: 0.6rem; z-index: 2;
  width: 32px; height: 32px; border-radius: 50%; border: 0; cursor: pointer;
  background: rgba(10, 10, 8, 0.55); color: #fff;
}
.card__media { aspect-ratio: 16/10; background: #eef0ed; }
.card__media img { width: 100%; height: 100%; object-fit: cover; }
.card__ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #b9beb8; font-size: 2.2rem; }
.card__body { padding: 1.1rem 1.25rem 1.4rem; }
.card__body--note { padding-top: 2.2rem; }
.card__over { display: block; font-size: 0.66rem; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--site-primary, #0e6f5c); }
.card h2 {
  font-family: 'Anton', 'Inter', sans-serif; font-weight: 400; text-transform: uppercase;
  font-size: 1.4rem; line-height: 1.1; margin: 0.3rem 0 0.2rem; color: #101210;
}
.card__common { font-style: italic; color: #7c817b; margin: 0 0 0.7rem; font-size: 0.9rem; }
.card__desc { color: #3c403c; line-height: 1.65; font-size: 0.92rem; margin: 0.4rem 0 0; }
.card__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1rem 0 0; }
.card__more {
  display: inline-flex; align-items: center; gap: 0.4rem; margin-top: 1rem;
  font-size: 0.78rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
  color: var(--site-primary, #0e6f5c);
}

/* ---------------- le fil du chef ---------------- */
.thread { margin-top: 1.1rem; border-top: 1px solid #e8e9e6; padding-top: 0.9rem; }
.thread__lead { display: block; font-size: 0.76rem; color: #7c817b; margin-bottom: 0.5rem; }
.thread__lead i { color: var(--gold, #c9a227); }
.thread__chef {
  display: flex; align-items: center; gap: 0.7rem; padding: 0.5rem 0.6rem;
  border-radius: 10px; background: #f6f7f4; margin-bottom: 0.4rem;
}
.thread__chef:hover { background: #eef0ea; }
.thread__chef img, .thread__ph { width: 42px; height: 42px; border-radius: 8px; object-fit: cover; flex: 0 0 42px; }
.thread__ph { display: flex; align-items: center; justify-content: center; background: #e3e6e0; color: #a9aea6; }
.thread__n { min-width: 0; flex: 1 1 auto; }
.thread__n strong { display: block; font-size: 0.9rem; color: #101210; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.thread__n small { font-size: 0.72rem; color: var(--site-primary, #0e6f5c); font-weight: 700; }
.thread__chef > i { color: var(--site-primary, #0e6f5c); }

/* ---------------- fin de parcours ---------------- */
.end {
  position: absolute; inset: 1rem 1.5rem 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(10, 10, 8, 0.86); border-radius: 14px; backdrop-filter: blur(6px);
}
.end__in { text-align: center; padding: 2rem 1.5rem; max-width: 560px; }
.end__in h2 {
  font-family: 'Anton', 'Inter', sans-serif; font-weight: 400; text-transform: uppercase;
  font-size: clamp(1.5rem, 3.4vw, 2.2rem); color: #fff; margin: 0.4rem 0 0.6rem;
}
.end__in p { color: #cfd4ce; line-height: 1.7; margin: 0 0 1.4rem; }
.end__act { display: flex; flex-wrap: wrap; gap: 0.6rem; justify-content: center; }
/* Variante claire de .ps-btn : le fond de fin de parcours est sombre, la
   variante --line du design system (bordure noire) y serait invisible. */
.btn-dark-ghost { background: transparent; border: 2px solid rgba(255, 255, 255, 0.45); padding: 0.72rem 1.5rem; }
.btn-dark-ghost:hover { background: rgba(255, 255, 255, 0.12); filter: none; }

/* ---------------- mini-carte ---------------- */
.rooms {
  display: flex; align-items: center; gap: 0.6rem;
  max-width: 1240px; margin: 0 auto; padding: 1rem 1.5rem 0;
}
.rooms__list { display: flex; gap: 0.5rem; overflow-x: auto; list-style: none; margin: 0; padding: 0 0 0.4rem; flex: 1 1 auto; }
.rooms__nav {
  flex: 0 0 auto; width: 38px; height: 38px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.2); background: transparent; color: #efeae0; cursor: pointer;
}
.rooms__nav:disabled { opacity: 0.3; cursor: default; }
.rooms__nav--next { border-color: var(--gold, #c9a227); color: var(--gold, #c9a227); }
.room {
  display: flex; align-items: center; gap: 0.5rem; white-space: nowrap;
  padding: 0.5rem 0.85rem; border-radius: 999px; cursor: pointer;
  border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.05); color: #cfc9bd;
  font-size: 0.82rem; transition: background 0.15s ease;
}
.room:hover { background: rgba(255,255,255,0.12); }
.room--on { background: var(--gold, #c9a227); border-color: transparent; color: #14140f; font-weight: 700; }
.room__n { font-variant-numeric: tabular-nums; opacity: 0.7; }
.room--on .room__n { opacity: 1; }

/* ---------------- superposition 3D / réalité augmentée ---------------- */
.arwrap {
  position: fixed; inset: 0; z-index: 1200;
  background: rgba(8, 9, 8, 0.82); backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center; padding: 1.5rem;
}
.arwrap__in {
  background: #fff; border-radius: 16px; padding: 1.4rem;
  width: min(1080px, 100%); max-height: 92vh; overflow-y: auto;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5);
}

/* ---------------- transitions ---------------- */
.card-enter-active, .card-leave-active { transition: opacity 0.22s ease, transform 0.22s ease; }
.card-enter-from, .card-leave-to { opacity: 0; transform: translateY(10px); }
</style>
