<script setup>
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { useVoiceStore } from '@/stores/useVoiceStore'
import { useSectorStore } from '@/stores/useSectorStore'
import { useObjectStore } from '@/stores/useObjectStore'
import { LANGUES } from '@/constants/options'

const props = defineProps({ visible: { type: Boolean, default: false }, assistant: { type: Object, default: null } })
defineEmits(['update:visible'])

const { t } = useI18n()
const store = useVoiceStore()
const sectorStore = useSectorStore()
const objectStore = useObjectStore()
const toast = useToast()

const tracks = computed(() => (props.assistant ? store.tracksFor(props.assistant.id) : []))
const sectorOptions = computed(() =>
  sectorStore.items.filter((s) => s.museumId === props.assistant?.museumId).map((s) => ({ label: s.nom, value: s.id }))
)
const objectOptions = computed(() => {
  const ids = sectorStore.items.filter((s) => s.museumId === props.assistant?.museumId).map((s) => s.id)
  return objectStore.items.filter((o) => ids.includes(o.sectorId)).map((o) => ({ label: o.nom, value: o.id }))
})

const nt = reactive({ langue: 'fr', sectorId: null, objectId: null, texte: '', fichier: '', actif: true })

function sectorName(id) { return sectorStore.getById(id)?.nom }
function objectName(id) { return objectStore.getById(id)?.nom }

async function addTrack() {
  if (props.assistant?.source !== 'synthese' && !nt.fichier.trim()) {
    toast.add({ severity: 'warn', summary: t('admin.voice.needFile'), life: 2500 }); return
  }
  if (props.assistant?.source === 'synthese' && !nt.texte.trim()) {
    toast.add({ severity: 'warn', summary: t('admin.voice.needTts'), life: 2500 }); return
  }
  try {
    await store.addTrack({ assistantId: props.assistant.id, ...nt })
    Object.assign(nt, { langue: 'fr', sectorId: null, objectId: null, texte: '', fichier: '', actif: true })
    toast.add({ severity: 'success', summary: t('admin.voice.trackAdded'), life: 1800 })
  } catch (e) { toast.add({ severity: 'error', summary: t('admin.voice.failed'), detail: e.message, life: 3000 }) }
}
async function del(id) {
  try { await store.removeTrack(id) } catch (e) { toast.add({ severity: 'error', summary: t('admin.voice.failed'), detail: e.message, life: 3000 }) }
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :header="$t('admin.voice.tracksHeader', { title: assistant?.titre || $t('admin.voice.assistantFallback') })"
    :style="{ width: '44rem', maxWidth: '96vw' }"
    @update:visible="$emit('update:visible', $event)"
  >
    <ul v-if="tracks.length" class="tracks">
      <li v-for="t in tracks" :key="t.id">
        <div class="tracks__main">
          <Tag :value="t.langue" severity="info" />
          <span v-if="t.sectorId" class="tracks__loc"><i class="pi pi-sitemap" /> {{ sectorName(t.sectorId) }}</span>
          <span v-if="t.objectId" class="tracks__loc"><i class="pi pi-box" /> {{ objectName(t.objectId) }}</span>
          <span class="tracks__txt">{{ t.texte || t.fichier }}</span>
        </div>
        <Button icon="pi pi-trash" text size="small" severity="danger" @click="del(t.id)" />
      </li>
    </ul>
    <div v-else class="vi-empty" style="padding:1.5rem"><i class="pi pi-volume-off" /><p>{{ $t('admin.voice.emptyTracks') }}</p></div>

    <div class="track-form">
      <div class="vi-row">
        <div class="vi-field" style="flex:0 1 110px"><label>{{ $t('admin.voice.tLang') }}</label><Select v-model="nt.langue" :options="LANGUES" /></div>
        <div class="vi-field"><label>{{ $t('admin.voice.tSectorOptional') }}</label><Select v-model="nt.sectorId" :options="sectorOptions" option-label="label" option-value="value" show-clear placeholder="—" /></div>
        <div class="vi-field"><label>{{ $t('admin.voice.tObjectOptional') }}</label><Select v-model="nt.objectId" :options="objectOptions" option-label="label" option-value="value" show-clear placeholder="—" /></div>
      </div>
      <div v-if="assistant?.source === 'synthese'" class="vi-field">
        <label>{{ $t('admin.voice.tTtsLabel') }}</label>
        <Textarea v-model="nt.texte" rows="2" auto-resize :placeholder="$t('admin.voice.tTtsPlaceholder')" />
      </div>
      <div v-else class="vi-field">
        <label>{{ $t('admin.voice.tFileLabel') }}</label>
        <InputText v-model="nt.fichier" :placeholder="$t('admin.voice.tFilePlaceholder')" />
      </div>
      <Button :label="$t('admin.voice.addTrackBtn')" icon="pi pi-plus" size="small" @click="addTrack" />
    </div>
  </Dialog>
</template>

<style scoped>
.tracks { list-style: none; margin: 0 0 1rem; padding: 0; display: flex; flex-direction: column; }
.tracks li { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.55rem 0; border-top: 1px solid var(--vi-border); }
.tracks li:first-child { border-top: none; }
.tracks__main { display: flex; align-items: center; gap: 0.6rem; min-width: 0; flex-wrap: wrap; }
.tracks__loc { color: var(--vi-muted); font-size: 0.8rem; }
.tracks__txt { color: var(--vi-text); font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }
.track-form { border-top: 1px solid var(--vi-border); padding-top: 1rem; }
</style>
