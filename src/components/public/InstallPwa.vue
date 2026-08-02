<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/useSettingsStore'

// Section d'installation de l'application (PWA).
// - Chrome/Edge/Android : intercepte `beforeinstallprompt` → vrai bouton « Installer ».
// - iOS Safari : pas d'API → on affiche le mode d'emploi (Partager → Sur l'écran d'accueil).
// - Déjà installée (mode standalone) : message de confirmation.

const { t } = useI18n()
const settings = useSettingsStore()

// Textes personnalisables par organisation (ERP) ; sinon textes traduits par défaut.
const bloc = computed(() => {
  const b = settings.settings?.blocPwa || {}
  const perks = Array.isArray(b.perks) ? b.perks.filter(Boolean) : []
  return {
    eyebrow: b.eyebrow || t('pwa.eyebrow'),
    titre: b.titre || t('pwa.title'),
    lead: b.lead || t('pwa.lead'),
    perks: perks.length ? perks : [t('pwa.perk1'), t('pwa.perk2'), t('pwa.perk3')]
  }
})
const PERK_ICONS = ['pi-bolt', 'pi-wifi', 'pi-home', 'pi-star', 'pi-check']

const deferredPrompt = ref(null)
const installed = ref(false)
const showHint = ref(false)

const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

function onBip(e) {
  e.preventDefault()
  deferredPrompt.value = e
}
function onInstalled() {
  installed.value = true
  deferredPrompt.value = null
}
onMounted(() => {
  window.addEventListener('beforeinstallprompt', onBip)
  window.addEventListener('appinstalled', onInstalled)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', onBip)
  window.removeEventListener('appinstalled', onInstalled)
})

const state = computed(() => {
  if (installed.value || isStandalone) return 'installed'
  if (deferredPrompt.value) return 'ready'
  return isIos ? 'ios' : 'manual'
})

async function install() {
  if (deferredPrompt.value) {
    deferredPrompt.value.prompt()
    const choice = await deferredPrompt.value.userChoice
    if (choice?.outcome === 'accepted') installed.value = true
    deferredPrompt.value = null
    return
  }
  // Pas d'événement dispo (iOS, ou navigateur qui ne l'a pas encore émis) → mode d'emploi.
  showHint.value = !showHint.value
}
</script>

<template>
  <section class="pwa">
    <div class="pwa__in">
      <div class="pwa__phone"><i class="pi pi-mobile" /></div>
      <div class="pwa__body">
        <span class="pwa__over">{{ bloc.eyebrow }}</span>
        <h2>{{ bloc.titre }}</h2>
        <p>{{ bloc.lead }}</p>
        <ul class="pwa__perks">
          <li v-for="(p, i) in bloc.perks" :key="i">
            <i :class="`pi ${PERK_ICONS[i] || 'pi-check'}`" /> {{ p }}
          </li>
        </ul>
      </div>
      <div class="pwa__cta">
        <template v-if="state === 'installed'">
          <span class="pwa__done"><i class="pi pi-check-circle" /> {{ $t('pwa.installed') }}</span>
        </template>
        <template v-else>
          <button class="pwa__btn" @click="install">
            <i class="pi pi-download" /> {{ $t('pwa.install') }}
          </button>
          <p v-if="state === 'ios'" class="pwa__hint">
            <i class="pi pi-upload" /> {{ $t('pwa.iosHint') }}
          </p>
          <p v-else-if="showHint" class="pwa__hint">
            <i class="pi pi-info-circle" /> {{ $t('pwa.manualHint') }}
          </p>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.pwa { margin-top: 3.6rem; background: linear-gradient(135deg, color-mix(in srgb, var(--site-primary) 90%, #fff) 0%, var(--site-primary) 50%, color-mix(in srgb, var(--site-primary) 70%, #000) 100%); color: #fff; }
.pwa__in { max-width: 1240px; margin: 0 auto; padding: 3rem 1.5rem; display: flex; align-items: center; gap: 2.5rem; flex-wrap: wrap; }
.pwa__phone { width: 92px; height: 92px; border-radius: 24px; background: rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center; font-size: 2.6rem; flex: 0 0 auto; }
.pwa__body { flex: 1 1 320px; }
.pwa__over { display: block; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.75); margin-bottom: 0.4rem; }
.pwa__body h2 { font-family: 'Anton', 'Inter', sans-serif; font-weight: 400; text-transform: uppercase; font-size: clamp(1.5rem, 3vw, 2.1rem); margin: 0 0 0.5rem; color: #fff; }
.pwa__body p { margin: 0 0 0.9rem; color: rgba(255,255,255,0.88); line-height: 1.6; max-width: 560px; }
.pwa__perks { list-style: none; margin: 0; padding: 0; display: flex; gap: 1.4rem; flex-wrap: wrap; }
.pwa__perks li { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.85rem; font-weight: 600; color: rgba(255,255,255,0.92); }
.pwa__perks i { font-size: 1rem; }
.pwa__cta { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-start; gap: 0.7rem; max-width: 300px; }
.pwa__btn {
  display: inline-flex; align-items: center; gap: 0.6rem;
  background: #fff; color: var(--site-primary); border: none; cursor: pointer;
  padding: 0.95rem 1.8rem; font-weight: 800; font-size: 0.88rem; letter-spacing: 0.1em; text-transform: uppercase; border-radius: 4px;
  transition: 0.15s;
}
.pwa__btn:hover { transform: translateY(-2px); box-shadow: 0 14px 30px -12px rgba(0,0,0,0.45); }
.pwa__done { display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 800; font-size: 1rem; }
.pwa__done i { font-size: 1.3rem; }
.pwa__hint { margin: 0; font-size: 0.82rem; color: rgba(255,255,255,0.85); line-height: 1.5; display: flex; align-items: flex-start; gap: 0.45rem; }
.pwa__hint i { margin-top: 0.15rem; }
</style>
