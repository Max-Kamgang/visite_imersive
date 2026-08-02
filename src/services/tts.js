import { ref } from 'vue'
import { ELEVENLABS_VOICES } from '@/constants/voices'

// Service de synthèse vocale (texte → audio) partagé.
//
// Deux moteurs, même API publique speak()/stop()/pause()/resume() :
//   1. « browser » (par défaut) : Web Speech API — audible immédiatement, sans clé ni coût.
//   2. « elevenlabs » : voix IA cloud ultra-naturelle via l'Edge Function `tts`
//      (clé ElevenLabs 100 % côté serveur). Activé quand VITE_TTS_PROVIDER=elevenlabs.
//      En cas d'échec (pas de clé, réseau, quota) → repli automatique sur la voix du navigateur.

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null

const PROVIDER = import.meta.env.VITE_TTS_PROVIDER || 'browser' // défaut global : 'browser' | 'elevenlabs'
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
// La voix cloud est *techniquement disponible* dès que Supabase est configuré :
// chaque guide choisit ensuite son moteur (provider) dans l'ERP.
const cloudAvailable = !!SUPA_URL
const cloudEnabled = PROVIDER === 'elevenlabs' && cloudAvailable // défaut si le guide ne précise rien

// Un guide utilise-t-il la voix cloud ? opts.provider ('browser'|'elevenlabs') prime sur le défaut global.
function wantsCloud(opts = {}) {
  const p = opts.provider || PROVIDER
  return p === 'elevenlabs' && cloudAvailable
}

const supported = ref(!!synth || cloudAvailable)
const speaking = ref(false)
const paused = ref(false)
const voices = ref([])

let keepAlive = null
let userPaused = false
let audioEl = null // <audio> pour la voix cloud (MP3)
let audioUrl = null

// ---------- Voix navigateur ----------
function refreshVoices() { if (synth) voices.value = synth.getVoices() || [] }
if (synth) {
  refreshVoices()
  try { synth.addEventListener('voiceschanged', refreshVoices) } catch { /* Safari ancien */ }
}

const LANG_MAP = { fr: 'fr-FR', en: 'en-US', ewo: 'fr-FR', fub: 'fr-FR', bbj: 'fr-FR' }
const TIMBRE_PITCH = { standard: 1, grave: 0.6, douce: 1.4, robot: 0.2 }
function toBcp47(lang) { return LANG_MAP[lang] || lang || 'fr-FR' }

function pickVoice(lang) {
  const want = toBcp47(lang).toLowerCase()
  const base = want.slice(0, 2)
  const list = voices.value
  return (
    list.find((v) => v.lang && v.lang.toLowerCase() === want) ||
    list.find((v) => v.lang && v.lang.toLowerCase().startsWith(base)) ||
    null
  )
}

function cleanupAudio() {
  if (audioEl) { try { audioEl.pause() } catch { /* ignore */ } audioEl = null }
  if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null }
}

function stop() {
  if (keepAlive) { clearInterval(keepAlive); keepAlive = null }
  userPaused = false
  if (synth) synth.cancel()
  cleanupAudio()
  speaking.value = false
  paused.value = false
}

function speakBrowser(content, opts) {
  if (!synth) return false
  const u = new SpeechSynthesisUtterance(content)
  u.lang = toBcp47(opts.lang)
  u.rate = Math.min(2, Math.max(0.5, Number(opts.rate) || 1))
  u.pitch = opts.pitch != null ? opts.pitch : (TIMBRE_PITCH[opts.timbre] ?? 1)
  const v = pickVoice(opts.lang)
  if (v) u.voice = v
  u.onstart = () => { speaking.value = true; paused.value = false }
  u.onend = () => { speaking.value = false; paused.value = false; if (keepAlive) { clearInterval(keepAlive); keepAlive = null } }
  u.onerror = () => { speaking.value = false; paused.value = false; if (keepAlive) { clearInterval(keepAlive); keepAlive = null } }
  speaking.value = true
  synth.speak(u)
  // Contournement du bug Chromium qui coupe la synthèse au bout de ~15 s.
  if (keepAlive) clearInterval(keepAlive)
  keepAlive = setInterval(() => {
    if (!synth.speaking) { clearInterval(keepAlive); keepAlive = null; return }
    if (userPaused) return
    synth.pause(); synth.resume()
  }, 9000)
  return true
}

// ---------- Voix IA cloud (ElevenLabs via Edge Function) ----------
async function speakCloud(content, opts) {
  const res = await fetch(`${SUPA_URL}/functions/v1/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`
    },
    body: JSON.stringify({ text: content, voiceId: opts.voiceId || undefined, lang: opts.lang || 'fr' })
  })
  if (!res.ok) throw new Error(`tts cloud ${res.status}`)
  const blob = await res.blob()
  if (!blob || !/audio/i.test(blob.type)) throw new Error('tts cloud : réponse non audio')
  audioUrl = URL.createObjectURL(blob)
  audioEl = new Audio(audioUrl)
  audioEl.onplay = () => { speaking.value = true; paused.value = false }
  audioEl.onended = () => { speaking.value = false; paused.value = false; cleanupAudio() }
  audioEl.onerror = () => { speaking.value = false; paused.value = false }
  await audioEl.play()
}

// ---------- API publique ----------
async function speak(text, opts = {}) {
  const content = String(text || '').trim()
  if (!content) return false
  stop()
  speaking.value = true // retour visuel immédiat le temps de charger la voix cloud
  if (wantsCloud(opts)) {
    try { await speakCloud(content, opts); return true }
    catch (e) { console.warn('[tts] voix cloud indisponible, repli navigateur :', e.message) }
  }
  const ok = speakBrowser(content, opts)
  if (!ok) speaking.value = false
  return ok
}

function pause() {
  if (audioEl && !audioEl.paused) { audioEl.pause(); paused.value = true; return }
  if (synth && synth.speaking && !synth.paused) { userPaused = true; synth.pause(); paused.value = true }
}
function resume() {
  if (audioEl && audioEl.paused) { audioEl.play(); paused.value = false; return }
  if (synth && synth.paused) { userPaused = false; synth.resume(); paused.value = false }
}

// Voix cloud proposées dans l'ERP. Si la clé ElevenLabs a la permission « Voices: Read »,
// on renvoie la bibliothèque complète du compte ; sinon on garde la sélection vérifiée.
async function listVoices() {
  if (cloudAvailable) {
    try {
      const res = await fetch(`${SUPA_URL}/functions/v1/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` },
        body: JSON.stringify({ action: 'voices' })
      })
      if (res.ok) {
        const d = await res.json()
        if (Array.isArray(d?.voices) && d.voices.length) {
          return d.voices.map((v) => ({
            id: v.id,
            name: v.name,
            hint: [v.labels?.gender, v.labels?.age, v.labels?.accent].filter(Boolean).join(' · ')
          }))
        }
      }
    } catch { /* permission absente ou réseau : on garde la liste vérifiée */ }
  }
  return ELEVENLABS_VOICES
}

export function useTts() {
  return { supported, speaking, paused, voices, provider: PROVIDER, cloudEnabled, cloudAvailable, speak, stop, pause, resume, refreshVoices, listVoices }
}
