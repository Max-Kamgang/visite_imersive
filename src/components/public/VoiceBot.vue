<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ask } from '@/services/guideAgent'
import { useTts } from '@/services/tts'

// Bot vocal 100 % voix — AUCUN texte affiché.
// Il accueille, écoute le visiteur au micro, interroge l'agent ANCRÉ (ask),
// répond à voix haute (useTts) et GUIDE en naviguant automatiquement vers
// l'objet / le musée demandé. Trois états visuels : idle · listening · speaking.

const router = useRouter()
const route = useRoute()
const { t, locale } = useI18n()

// Scope selon la page courante : sur une fiche musée, on ancre les réponses à ce musée.
function currentScope() {
  const s = {}
  if (route.name === 'pub-museum' && route.params.id) s.museumId = Number(route.params.id)
  return s
}
const { speak, stop: ttsStop, speaking } = useTts()

const open = ref(false)
const state = ref('idle')          // 'idle' | 'listening' | 'thinking' | 'speaking'
const micSupported = ref(false)
let recog = null
let pendingLink = null             // dernière destination proposée (confirmation vocale)

// ---- Reconnaissance vocale (Web Speech API) ----
const SR = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null

function buildRecognizer() {
  if (!SR) return null
  const r = new SR()
  r.lang = locale.value === 'en' ? 'en-US' : 'fr-FR'
  r.interimResults = false
  r.maxAlternatives = 1
  r.continuous = false
  r.onresult = (e) => {
    const said = e.results?.[0]?.[0]?.transcript?.trim()
    if (said) handleUtterance(said)
  }
  r.onend = () => { if (state.value === 'listening') state.value = 'idle' }
  r.onerror = () => { state.value = 'idle' }
  return r
}

function listen() {
  if (!recog) recog = buildRecognizer()
  if (!recog) return
  ttsStop()
  try {
    state.value = 'listening'
    recog.lang = locale.value === 'en' ? 'en-US' : 'fr-FR'
    recog.start()
  } catch { state.value = 'idle' } // start() lève si déjà démarré
}

// ---- Parole du bot ----
async function say(text) {
  if (!text) return
  state.value = 'speaking'
  await speak(text, { lang: locale.value })
}

// ---- Confirmation « oui / non » pour la navigation ----
const YES = /\b(oui|ouais|d'accord|daccord|ok|okay|vas[- ]y|allons[- ]y|bien s[uû]r|yes|yeah|sure)\b/i
const NO = /\b(non|nan|pas|no|nope)\b/i

async function handleUtterance(said) {
  // Réponse à une proposition de navigation en cours ?
  if (pendingLink) {
    if (YES.test(said)) { const dest = pendingLink; pendingLink = null; await go(dest); return }
    if (NO.test(said)) { pendingLink = null; await say(t('voiceBot.elseHelp')); return }
    pendingLink = null // sinon on traite l'énoncé comme une nouvelle demande
  }

  state.value = 'thinking'
  let r
  try { r = await ask(said, currentScope()) } catch { await say(t('voiceBot.error')); return }

  const link = (r.links || [])[0]
  if (link) {
    pendingLink = link
    // On lit la réponse puis on propose d'y aller — le tout à la voix.
    await say(`${r.text} ${t('voiceBot.wantToGo', { label: link.label })}`)
  } else {
    await say(r.text)
  }
}

async function go(link) {
  await say(t('voiceBot.leadingYou', { label: link.label }))
  router.push(link.to)
}

// ---- Ouverture / fermeture ----
async function toggle() {
  open.value = !open.value
  if (open.value) {
    await say(t('voiceBot.welcome'))     // accueil parlé, puis on invite à parler
  } else {
    ttsStop(); if (recog) try { recog.stop() } catch { /* noop */ }
    state.value = 'idle'; pendingLink = null
  }
}

// Le halo suit l'état réel de la synthèse (fin de phrase → idle).
let poll = null
onMounted(() => {
  micSupported.value = !!SR
  poll = setInterval(() => {
    if (state.value === 'speaking' && !speaking.value) state.value = 'idle'
  }, 300)
})
onBeforeUnmount(() => {
  if (poll) clearInterval(poll)
  ttsStop(); if (recog) try { recog.stop() } catch { /* noop */ }
})
</script>

<template>
  <div class="vb">
    <transition name="pop">
      <div v-if="open" class="vb__panel" :class="`is-${state}`">
        <button class="vb__close" :aria-label="$t('common.close')" @click="toggle"><i class="pi pi-times" /></button>

        <!-- Avatar parlant : orbe animé, seul retour visuel (pas de texte) -->
        <div class="vb__orb" :class="`is-${state}`" @click="listen" role="button"
             :aria-label="$t('voiceBot.tapToSpeak')">
          <span class="vb__ring" /><span class="vb__ring vb__ring--2" />
          <i class="pi" :class="{
            'pi-volume-up': state === 'speaking',
            'pi-microphone': state === 'listening',
            'pi-spin pi-spinner': state === 'thinking',
            'pi-comments': state === 'idle'
          }" />
        </div>

        <p class="vb__hint">{{
          state === 'listening' ? $t('voiceBot.listening')
          : state === 'speaking' ? $t('voiceBot.speaking')
          : state === 'thinking' ? $t('voiceBot.thinking')
          : $t('voiceBot.tapToSpeak')
        }}</p>

        <button v-if="micSupported" class="vb__mic" :disabled="state === 'listening'" @click="listen">
          <i class="pi pi-microphone" /> {{ $t('voiceBot.speakBtn') }}
        </button>
        <p v-else class="vb__nomic">{{ $t('voiceBot.noMic') }}</p>
      </div>
    </transition>

    <button class="vb__bubble" :class="{ 'vb__bubble--open': open, 'is-live': speaking }"
            @click="toggle" :aria-label="$t('voiceBot.title')">
      <i :class="open ? 'pi pi-chevron-down' : 'pi pi-microphone'" />
      <span v-if="!open" class="vb__bubble-txt">{{ $t('voiceBot.help') }}</span>
    </button>
  </div>
</template>

<style scoped>
.vb { position: fixed; left: 20px; bottom: 20px; z-index: 200; display: flex; flex-direction: column; align-items: flex-start; gap: 0.75rem; }
.vb__bubble {
  display: inline-flex; align-items: center; gap: 0.5rem;
  background: var(--site-primary, #a86b2d); color: #fff; border: none; cursor: pointer;
  padding: 0.8rem 1.1rem; border-radius: 999px; font-weight: 700; font-size: 0.9rem;
  box-shadow: 0 10px 30px -8px rgba(62,42,22,0.5);
}
.vb__bubble.is-live { animation: livepulse 1.4s ease-in-out infinite; }
.vb__bubble-txt { white-space: nowrap; }
.vb__panel {
  position: relative; width: min(320px, calc(100vw - 40px));
  background: linear-gradient(160deg, #3d2611, #22160a); color: #f5eddd;
  border: 1px solid #5d3a1c; border-radius: 22px; padding: 1.6rem 1.2rem 1.4rem;
  display: flex; flex-direction: column; align-items: center; gap: 0.9rem;
  box-shadow: 0 24px 60px -20px rgba(0,0,0,0.6);
}
.vb__close { position: absolute; top: 0.7rem; right: 0.8rem; background: transparent; border: none; color: #c9b48f; cursor: pointer; font-size: 1rem; }
.vb__orb {
  position: relative; width: 128px; height: 128px; border-radius: 50%; cursor: pointer;
  display: grid; place-items: center;
  background: radial-gradient(circle at 35% 30%, #e7c988, #cda24e 55%, #8a6321);
  box-shadow: 0 0 0 6px rgba(205,162,78,0.15), inset 0 4px 16px rgba(255,255,255,0.35);
  transition: transform 0.2s ease;
}
.vb__orb i { font-size: 2.6rem; color: #3d2611; }
.vb__orb.is-speaking { animation: breathe 0.9s ease-in-out infinite; }
.vb__orb.is-listening { box-shadow: 0 0 0 6px rgba(220,80,80,0.25), inset 0 4px 16px rgba(255,255,255,0.35); }
.vb__ring { position: absolute; inset: 0; border-radius: 50%; border: 2px solid rgba(205,162,78,0.5); opacity: 0; }
.is-speaking .vb__ring, .is-listening .vb__ring { animation: ripple 1.6s ease-out infinite; }
.is-speaking .vb__ring--2, .is-listening .vb__ring--2 { animation-delay: 0.8s; }
.vb__hint { margin: 0; font-size: 0.9rem; color: #e4d3ad; min-height: 1.2em; text-align: center; }
.vb__mic {
  display: inline-flex; align-items: center; gap: 0.5rem;
  background: var(--gold, #cda24e); color: #201607; border: none;
  padding: 0.6rem 1.2rem; border-radius: 999px; font-weight: 800; cursor: pointer; font-size: 0.9rem;
}
.vb__mic:disabled { opacity: 0.55; cursor: default; }
.vb__nomic { margin: 0; font-size: 0.78rem; color: #b9a582; text-align: center; }
@keyframes breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
@keyframes ripple { 0% { opacity: 0.6; transform: scale(1); } 100% { opacity: 0; transform: scale(1.5); } }
@keyframes livepulse { 0%,100% { box-shadow: 0 10px 30px -8px rgba(62,42,22,0.5); } 50% { box-shadow: 0 0 0 8px rgba(168,107,45,0.25), 0 10px 30px -8px rgba(62,42,22,0.5); } }
.pop-enter-active, .pop-leave-active { transition: transform 0.18s ease, opacity 0.18s ease; transform-origin: bottom left; }
.pop-enter-from, .pop-leave-to { transform: scale(0.85); opacity: 0; }
</style>
