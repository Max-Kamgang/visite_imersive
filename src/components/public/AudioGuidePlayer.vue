<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { pubAudioTracks } from '@/services/publicApi'

const { t: tr } = useI18n()

const props = defineProps({
  assistant: { type: Object, required: true }, // { id, titre, source, ... }
  museumName: { type: String, default: '' }
})

const tracks = ref([])
const loading = ref(true)
const playingId = ref(null) // id de la piste en cours (synthèse)
const supportsTTS = typeof window !== 'undefined' && 'speechSynthesis' in window

function labelFor(t) {
  if (t.objects?.nom) return tr('audioguide.work', { name: t.objects.nom })
  if (t.sectors?.nom) return tr('audioguide.room', { name: t.sectors.nom })
  return tr('audioguide.intro')
}
function fmtDuree(s) {
  if (!s) return ''
  const m = Math.floor(s / 60)
  const r = s % 60
  return m ? `${tr('audioguide.min', { n: m })} ${r ? tr('audioguide.sec', { n: r }) : ''}`.trim() : tr('audioguide.sec', { n: r })
}

let pickedVoice = null
function ensureVoice() {
  if (!supportsTTS) return
  const voices = window.speechSynthesis.getVoices()
  pickedVoice =
    voices.find((v) => /fr[-_]FR/i.test(v.lang)) ||
    voices.find((v) => /^fr/i.test(v.lang)) ||
    null
}

function stopSpeech() {
  if (supportsTTS) window.speechSynthesis.cancel()
  playingId.value = null
}

function toggle(t) {
  if (playingId.value === t.id) {
    stopSpeech()
    return
  }
  stopSpeech()
  if (!supportsTTS || !t.texte) return
  ensureVoice()
  const u = new SpeechSynthesisUtterance(t.texte)
  u.lang = 'fr-FR'
  if (pickedVoice) u.voice = pickedVoice
  u.rate = 0.98
  u.onend = () => {
    if (playingId.value === t.id) playingId.value = null
  }
  u.onerror = () => {
    if (playingId.value === t.id) playingId.value = null
  }
  playingId.value = t.id
  window.speechSynthesis.speak(u)
}

onMounted(async () => {
  if (supportsTTS) {
    ensureVoice()
    // Les voix peuvent se charger de façon asynchrone.
    window.speechSynthesis.onvoiceschanged = ensureVoice
  }
  tracks.value = await pubAudioTracks(props.assistant.id)
  loading.value = false
})
onBeforeUnmount(stopSpeech)
</script>

<template>
  <div class="ag">
    <div class="ag__head">
      <i class="pi pi-volume-up" />
      <div>
        <strong>{{ assistant.titre || $t('audioguide.title') }}</strong>
        <span class="ag__ok"><i class="pi pi-check-circle" /> {{ $t('common.unlocked') }}</span>
      </div>
    </div>

    <p v-if="loading" class="ag__muted">{{ $t('audioguide.loading') }}</p>
    <p v-else-if="!tracks.length" class="ag__muted">{{ $t('audioguide.empty') }}</p>

    <ul v-else class="ag__list">
      <li v-for="t in tracks" :key="t.id" class="ag__track" :class="{ 'is-playing': playingId === t.id }">
        <div class="ag__meta">
          <span class="ag__label">{{ labelFor(t) }}</span>
          <span v-if="t.duree_sec" class="ag__dur">{{ fmtDuree(t.duree_sec) }}</span>
        </div>

        <!-- Fichier audio fourni : lecteur natif -->
        <audio v-if="t.fichier" class="ag__audio" controls preload="none" :src="t.fichier" />

        <!-- Sinon : synthèse vocale du texte -->
        <template v-else>
          <p class="ag__text">{{ t.texte }}</p>
          <button
            v-if="supportsTTS"
            class="ag__btn"
            :aria-pressed="playingId === t.id"
            @click="toggle(t)"
          >
            <i :class="playingId === t.id ? 'pi pi-stop-circle' : 'pi pi-play-circle'" />
            {{ playingId === t.id ? $t('audioguide.stop') : $t('audioguide.listen') }}
          </button>
          <span v-else class="ag__muted">{{ $t('audioguide.unsupported') }}</span>
        </template>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.ag { background: #fff; border: 1px solid #e7ddcf; border-left: 4px solid var(--gold, #cda24e); border-radius: 16px; padding: 1.1rem 1.2rem; }
.ag__head { display: flex; align-items: center; gap: 0.8rem; }
.ag__head > i { color: var(--gold, #cda24e); font-size: 1.5rem; }
.ag__head strong { font-family: 'Fraunces', Georgia, serif; font-size: 1.1rem; display: block; }
.ag__ok { color: #3f8f5f; font-weight: 700; font-size: 0.82rem; }
.ag__muted { color: #897f70; font-size: 0.88rem; margin: 0.6rem 0 0; }
.ag__list { list-style: none; margin: 0.9rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.7rem; }
.ag__track { border: 1px solid #efe7d9; border-radius: 12px; padding: 0.8rem 0.9rem; background: #fbf8f2; transition: 0.15s; }
.ag__track.is-playing { border-color: var(--gold, #cda24e); background: #fff; box-shadow: 0 10px 26px -16px rgba(205,162,78,0.6); }
.ag__meta { display: flex; align-items: baseline; justify-content: space-between; gap: 0.6rem; margin-bottom: 0.35rem; }
.ag__label { font-weight: 700; color: #4b4034; font-size: 0.92rem; }
.ag__dur { font-size: 0.75rem; color: #897f70; white-space: nowrap; }
.ag__text { margin: 0 0 0.6rem; font-size: 0.9rem; line-height: 1.6; color: #6b6052; }
.ag__audio { width: 100%; }
.ag__btn { display: inline-flex; align-items: center; gap: 0.45rem; background: var(--gold, #cda24e); color: #201607; border: none; padding: 0.45rem 0.95rem; border-radius: 999px; font-weight: 700; cursor: pointer; font-size: 0.82rem; }
.ag__btn:hover { transform: translateY(-1px); }
.ag__track.is-playing .ag__btn { background: #201607; color: var(--gold, #cda24e); }
</style>
