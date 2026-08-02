<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import PanoramaViewer from '@/components/immersive/PanoramaViewer.vue'
import { useTourStore } from '@/stores/useTourStore'
import { useSectorStore } from '@/stores/useSectorStore'
import { useObjectStore } from '@/stores/useObjectStore'
import { useGenealogyStore } from '@/stores/useGenealogyStore'

// Éditeur de parcours : à gauche les salles, au centre le panorama, à droite
// les réglages. On pose un point chaud EN CLIQUANT dans le panorama — l'éditeur
// convertit le clic en azimut/élévation, puis on choisit l'objet lié.

const props = defineProps({
  visible: { type: Boolean, default: false },
  tour: { type: Object, default: null }
})
const emit = defineEmits(['update:visible'])

const { t } = useI18n()
const store = useTourStore()
const sectorStore = useSectorStore()
const objectStore = useObjectStore()
const genealogy = useGenealogyStore()
const confirm = useConfirm()
const toast = useToast()

const panoRef = ref(null)
const currentId = ref(null)
const hotspotId = ref(null)
const busy = ref(false)

const scenes = computed(() => store.orderedScenes())
const current = computed(() => scenes.value.find((s) => s.id === currentId.value) || null)
const hotspots = computed(() =>
  store.sceneHotspots(currentId.value).map((h) => ({ ...h, active: h.id === hotspotId.value }))
)
const hotspot = computed(() => store.hotspots.find((h) => h.id === hotspotId.value) || null)

// ---- Choix proposés, restreints au musée de la visite -----------------------
const museumSectors = computed(() =>
  props.tour ? sectorStore.items.filter((s) => s.museumId === props.tour.museumId) : []
)
const sectorOptions = computed(() => museumSectors.value.map((s) => ({ label: s.nom, value: s.id })))
const objectOptions = computed(() => {
  const ids = new Set(museumSectors.value.map((s) => s.id))
  return objectStore.items
    .filter((o) => ids.has(o.sectorId))
    .map((o) => ({ label: o.published ? o.nom : `${o.nom} — ${t('admin.tours.draft')}`, value: o.id }))
})
const personnageOptions = computed(() =>
  genealogy.individus.map((p) => ({ label: genealogy.nomComplet(p), value: p.id }))
)
const sceneOptions = computed(() =>
  scenes.value.filter((s) => s.id !== currentId.value).map((s) => ({ label: s.titre, value: s.id }))
)

const typeOptions = computed(() => [
  { label: t('admin.tours.type360'), value: 'photo360' },
  { label: t('admin.tours.typeVideo'), value: 'video360' },
  { label: t('admin.tours.typeFlat'), value: 'image' }
])
const hotspotTypeOptions = computed(() => [
  { label: t('admin.tours.hsObjet'), value: 'objet' },
  { label: t('admin.tours.hsPersonnage'), value: 'personnage' },
  { label: t('admin.tours.hsNavigation'), value: 'navigation' },
  { label: t('admin.tours.hsInfo'), value: 'info' }
])

// ---- Formulaires ------------------------------------------------------------
const sceneForm = reactive({ titre: '', sectorId: null, type: 'photo360', mediaUrl: '', positionInitiale: {} })
const hsForm = reactive({ type: 'objet', objectId: null, personnageId: null, sceneCibleId: null, libelle: '', texte: '' })

function selectScene(id) {
  currentId.value = id
  hotspotId.value = null
  const s = scenes.value.find((x) => x.id === id)
  if (!s) return
  sceneForm.titre = s.titre
  sceneForm.sectorId = s.sectorId
  sceneForm.type = s.type
  sceneForm.mediaUrl = s.mediaUrl
  mediaPreview.value = s.mediaUrl
  sceneForm.positionInitiale = { ...(s.positionInitiale || {}) }
}

// L'adresse du média se saisit caractère par caractère : sans temporisation,
// la visionneuse rechargerait une texture à chaque frappe.
const mediaPreview = ref('')
let mediaTimer = null
watch(
  () => sceneForm.mediaUrl,
  (v) => {
    clearTimeout(mediaTimer)
    mediaTimer = setTimeout(() => { mediaPreview.value = v }, 600)
  }
)

function selectHotspot(h) {
  hotspotId.value = h.id
  hsForm.type = h.type
  hsForm.objectId = h.objectId
  hsForm.personnageId = h.personnageId
  hsForm.sceneCibleId = h.sceneCibleId
  hsForm.libelle = h.libelle
  hsForm.texte = h.texte
  panoRef.value?.lookAt(h)
}

watch(
  () => props.visible,
  async (open) => {
    if (!open || !props.tour) return
    busy.value = true
    await store.loadScenes(props.tour.id)
    busy.value = false
    const first = scenes.value[0]
    if (first) selectScene(first.id)
    else { currentId.value = null; hotspotId.value = null }
  }
)

// ---- Salles -----------------------------------------------------------------
async function addScene() {
  try {
    const s = await store.addScene({
      tourId: props.tour.id,
      titre: t('admin.tours.newSceneName', { n: scenes.value.length + 1 }),
      type: 'photo360',
      positionInitiale: { yaw: 0, pitch: 0, fov: 75 }
    })
    selectScene(s.id)
  } catch (e) {
    toast.add({ severity: 'error', summary: t('admin.common.saveFailed'), detail: e.message, life: 3500 })
  }
}

async function saveScene() {
  if (!current.value) return
  try {
    await store.updateScene(current.value.id, { ...current.value, ...sceneForm })
    toast.add({ severity: 'success', summary: t('admin.tours.sceneSaved'), life: 2000 })
  } catch (e) {
    toast.add({ severity: 'error', summary: t('admin.common.saveFailed'), detail: e.message, life: 3500 })
  }
}

function removeScene(s) {
  confirm.require({
    message: t('admin.tours.sceneDeleteConfirm', { name: s.titre }),
    header: t('admin.common.confirmDelete'),
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: t('admin.common.cancel'),
    acceptLabel: t('admin.common.delete'),
    acceptClass: 'p-button-danger',
    accept: async () => {
      await store.removeScene(s.id)
      const first = scenes.value[0]
      if (currentId.value === s.id) {
        if (first) selectScene(first.id)
        else currentId.value = null
      }
    }
  })
}

// Le cadrage courant devient la position d'arrivée : c'est ce que verra le
// visiteur en entrant dans la salle.
function captureView() {
  const v = panoRef.value?.getView()
  if (!v) return
  sceneForm.positionInitiale = v
  toast.add({ severity: 'info', summary: t('admin.tours.viewCaptured'), detail: `${v.yaw}° / ${v.pitch}°`, life: 2000 })
}

// ---- Points chauds ----------------------------------------------------------
async function placeHotspot({ x, y }) {
  if (!current.value) return
  try {
    const h = await store.addHotspot({ sceneId: current.value.id, type: 'objet', x, y })
    selectHotspot(h)
  } catch (e) {
    toast.add({ severity: 'error', summary: t('admin.common.saveFailed'), detail: e.message, life: 3500 })
  }
}

async function saveHotspot() {
  if (!hotspot.value) return
  try {
    await store.updateHotspot(hotspot.value.id, { ...hotspot.value, ...hsForm })
    toast.add({ severity: 'success', summary: t('admin.tours.hotspotSaved'), life: 2000 })
  } catch (e) {
    toast.add({ severity: 'error', summary: t('admin.common.saveFailed'), detail: e.message, life: 3500 })
  }
}

async function removeHotspot() {
  if (!hotspot.value) return
  await store.removeHotspot(hotspot.value.id)
  hotspotId.value = null
}

function hotspotLabel(h) {
  if (h.libelle) return h.libelle
  if (h.type === 'objet') return objectStore.getById?.(h.objectId)?.nom || t('admin.tours.hsNoTarget')
  if (h.type === 'personnage') {
    const p = genealogy.getIndividu(h.personnageId)
    return p ? genealogy.nomComplet(p) : t('admin.tours.hsNoTarget')
  }
  if (h.type === 'navigation') return scenes.value.find((s) => s.id === h.sceneCibleId)?.titre || t('admin.tours.hsNoTarget')
  return t('admin.tours.hsInfo')
}

// Un point chaud sans cible ne mène nulle part : on le signale dans la liste.
const incomplete = (h) =>
  (h.type === 'objet' && !h.objectId) ||
  (h.type === 'personnage' && !h.personnageId) ||
  (h.type === 'navigation' && !h.sceneCibleId) ||
  (h.type === 'info' && !h.texte)
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    maximizable
    :header="$t('admin.tours.editorTitle', { name: tour?.titre || '' })"
    :style="{ width: '94rem', maxWidth: '98vw' }"
    @update:visible="$emit('update:visible', $event)"
  >
    <div class="se">
      <!-- ---------------- Salles ---------------- -->
      <aside class="se__col se__scenes">
        <div class="se__head">
          <span>{{ $t('admin.tours.rooms') }}</span>
          <Button icon="pi pi-plus" text rounded :aria-label="$t('admin.tours.addRoom')" @click="addScene" />
        </div>
        <ol v-if="scenes.length" class="se__slist">
          <li v-for="(s, i) in scenes" :key="s.id">
            <button class="se__scene" :class="{ on: s.id === currentId }" @click="selectScene(s.id)">
              <span class="se__num">{{ i + 1 }}</span>
              <span class="se__stitle">{{ s.titre }}</span>
              <span v-if="!s.mediaUrl" class="se__flag" :title="$t('admin.tours.noMedia')"><i class="pi pi-image" /></span>
            </button>
            <div class="row-actions">
              <Button icon="pi pi-arrow-up" text rounded :disabled="i === 0" @click="store.moveScene(s.id, -1)" />
              <Button icon="pi pi-arrow-down" text rounded :disabled="i === scenes.length - 1" @click="store.moveScene(s.id, 1)" />
              <Button icon="pi pi-trash" text rounded severity="danger" @click="removeScene(s)" />
            </div>
          </li>
        </ol>
        <div v-else class="vi-empty vi-empty--sm">
          <i class="pi pi-images" />
          <strong>{{ $t('admin.tours.noRoomTitle') }}</strong>
          <p>{{ $t('admin.tours.noRoomText') }}</p>
        </div>
      </aside>

      <!-- ---------------- Panorama ---------------- -->
      <div class="se__col se__stage">
        <PanoramaViewer
          v-if="current"
          ref="panoRef"
          :key="current.id"
          :src="mediaPreview"
          :type="sceneForm.type"
          :hotspots="hotspots"
          :initial="sceneForm.positionInitiale"
          :seed="scenes.findIndex((s) => s.id === current.id)"
          editable
          @place="placeHotspot"
          @select="selectHotspot"
        />
        <div v-else class="se__novide">
          <i class="pi pi-compass" />
          <p>{{ busy ? $t('common.loading') : $t('admin.tours.pickRoom') }}</p>
        </div>
      </div>

      <!-- ---------------- Réglages ---------------- -->
      <aside class="se__col se__props">
        <template v-if="current">
          <div class="se__head"><span>{{ $t('admin.tours.roomSettings') }}</span></div>

          <div class="vi-field">
            <label>{{ $t('admin.common.name') }}</label>
            <InputText v-model="sceneForm.titre" />
          </div>

          <div class="vi-field">
            <label>{{ $t('admin.tours.fSector') }}</label>
            <Select
              v-model="sceneForm.sectorId"
              :options="sectorOptions"
              option-label="label"
              option-value="value"
              show-clear
              filter
              :placeholder="$t('admin.common.all')"
            />
            <small>{{ $t('admin.tours.fSectorHint') }}</small>
          </div>

          <div class="vi-field">
            <label>{{ $t('admin.tours.fSceneType') }}</label>
            <Select v-model="sceneForm.type" :options="typeOptions" option-label="label" option-value="value" />
          </div>

          <div class="vi-field">
            <label>{{ $t('admin.tours.fMedia') }}</label>
            <InputText v-model="sceneForm.mediaUrl" placeholder="https://…" />
            <small>{{ $t('admin.tours.fMediaHint') }}</small>
          </div>

          <div class="vi-field">
            <label>{{ $t('admin.tours.fStartView') }}</label>
            <div class="se__view">
              <code>{{ sceneForm.positionInitiale.yaw ?? 0 }}° / {{ sceneForm.positionInitiale.pitch ?? 0 }}° · {{ sceneForm.positionInitiale.fov ?? 75 }}°</code>
              <Button :label="$t('admin.tours.captureView')" icon="pi pi-camera" size="small" outlined @click="captureView" />
            </div>
            <small>{{ $t('admin.tours.fStartViewHint') }}</small>
          </div>

          <Button :label="$t('admin.tours.saveRoom')" icon="pi pi-check" size="small" @click="saveScene" />

          <!-- ---------------- Points chauds ---------------- -->
          <div class="se__head se__head--sep">
            <span>{{ $t('admin.tours.hotspots') }}</span>
            <small>{{ hotspots.length }}</small>
          </div>

          <p v-if="!hotspots.length" class="se__tip"><i class="pi pi-map-marker" /> {{ $t('admin.tours.hotspotTip') }}</p>
          <ul v-else class="se__hlist">
            <li v-for="h in hotspots" :key="h.id">
              <button class="se__hs" :class="{ on: h.id === hotspotId, warn: incomplete(h) }" @click="selectHotspot(h)">
                <i :class="`pi pi-${h.type === 'objet' ? 'box' : h.type === 'personnage' ? 'user' : h.type === 'navigation' ? 'arrow-right' : 'info-circle'}`" />
                <span>{{ hotspotLabel(h) }}</span>
                <i v-if="incomplete(h)" class="pi pi-exclamation-triangle se__warn" :title="$t('admin.tours.hsNoTarget')" />
              </button>
            </li>
          </ul>

          <div v-if="hotspot" class="se__hedit">
            <div class="vi-field">
              <label>{{ $t('admin.tours.fHotspotType') }}</label>
              <Select v-model="hsForm.type" :options="hotspotTypeOptions" option-label="label" option-value="value" />
            </div>

            <div v-if="hsForm.type === 'objet'" class="vi-field">
              <label>{{ $t('admin.tours.fObject') }}</label>
              <Select v-model="hsForm.objectId" :options="objectOptions" option-label="label" option-value="value" filter show-clear :placeholder="$t('admin.tours.fObjectPlaceholder')" />
            </div>
            <div v-else-if="hsForm.type === 'personnage'" class="vi-field">
              <label>{{ $t('admin.tours.fPersonnage') }}</label>
              <Select v-model="hsForm.personnageId" :options="personnageOptions" option-label="label" option-value="value" filter show-clear />
            </div>
            <div v-else-if="hsForm.type === 'navigation'" class="vi-field">
              <label>{{ $t('admin.tours.fTargetScene') }}</label>
              <Select v-model="hsForm.sceneCibleId" :options="sceneOptions" option-label="label" option-value="value" show-clear />
            </div>
            <div v-else class="vi-field">
              <label>{{ $t('admin.tours.fNote') }}</label>
              <Textarea v-model="hsForm.texte" rows="3" auto-resize />
            </div>

            <div class="vi-field">
              <label>{{ $t('admin.tours.fLabel') }}</label>
              <InputText v-model="hsForm.libelle" :placeholder="$t('admin.tours.fLabelPlaceholder')" />
            </div>

            <div class="se__hact">
              <Button :label="$t('admin.common.save')" icon="pi pi-check" size="small" @click="saveHotspot" />
              <Button :label="$t('admin.common.delete')" icon="pi pi-trash" size="small" severity="danger" outlined @click="removeHotspot" />
            </div>
          </div>
        </template>

        <div v-else class="se__tip">{{ $t('admin.tours.pickRoom') }}</div>
      </aside>
    </div>

    <template #footer>
      <Button :label="$t('admin.common.close')" severity="secondary" text @click="$emit('update:visible', false)" />
    </template>
  </Dialog>
</template>

<style scoped>
.se { display: grid; grid-template-columns: 240px minmax(0, 1fr) 320px; gap: 1rem; min-height: 60vh; }
@media (max-width: 1100px) { .se { grid-template-columns: 1fr; } }

.se__col { min-width: 0; }
.se__head {
  display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
  font-weight: 700; font-size: 0.85rem; margin-bottom: 0.6rem;
}
.se__head--sep { margin-top: 1.4rem; padding-top: 1rem; border-top: 1px solid var(--p-content-border-color); }
.se__head small { color: var(--vi-muted); font-weight: 500; }

/* --- salles --- */
.se__slist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.se__slist li { display: flex; align-items: center; gap: 0.2rem; }
.se__scene {
  flex: 1 1 auto; min-width: 0;
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.5rem 0.6rem; border-radius: 8px; cursor: pointer;
  border: 1px solid transparent; background: var(--vi-bg, #f6f7f9);
  font-size: 0.86rem; text-align: left; font-family: inherit; color: inherit;
}
.se__scene:hover { border-color: var(--p-content-border-color); }
.se__scene.on { background: var(--p-primary-color); color: #fff; }
.se__num { font-variant-numeric: tabular-nums; opacity: 0.65; flex: 0 0 auto; }
.se__stitle { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 auto; }
.se__flag { opacity: 0.6; flex: 0 0 auto; font-size: 0.75rem; }
.row-actions { display: flex; gap: 0.05rem; }

/* --- panorama --- */
.se__stage { min-height: 420px; display: flex; }
.se__novide {
  flex: 1 1 auto; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.6rem; border: 2px dashed var(--vi-border, #e5e7eb); border-radius: 14px; color: var(--vi-muted);
}
.se__novide i { font-size: 2.2rem; opacity: 0.5; }

/* --- réglages --- */
.se__props { max-height: 72vh; overflow-y: auto; padding-right: 0.3rem; }
.se__view { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.se__view code { font-size: 0.8rem; background: var(--vi-bg, #f6f7f9); padding: 0.3rem 0.55rem; border-radius: 6px; }
.se__tip { color: var(--vi-muted); font-size: 0.83rem; line-height: 1.6; }
.se__tip i { color: var(--gold, #cda24e); }

.se__hlist { list-style: none; margin: 0 0 0.8rem; padding: 0; display: flex; flex-direction: column; gap: 0.25rem; }
.se__hs {
  width: 100%; display: flex; align-items: center; gap: 0.5rem;
  padding: 0.45rem 0.6rem; border-radius: 8px; cursor: pointer; text-align: left;
  border: 1px solid transparent; background: var(--vi-bg, #f6f7f9);
  font-size: 0.84rem; font-family: inherit; color: inherit;
}
.se__hs span { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.se__hs.on { background: var(--p-primary-color); color: #fff; }
.se__warn { color: var(--p-orange-500, #f59e0b); }
.se__hs.on .se__warn { color: #fff; }
.se__hedit { border-top: 1px dashed var(--p-content-border-color); padding-top: 0.9rem; }
.se__hact { display: flex; gap: 0.5rem; margin-top: 0.4rem; }
.vi-empty--sm { padding: 1.4rem 0.5rem; }
</style>
