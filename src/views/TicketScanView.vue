<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import { supabase } from '@/services/supabase'

// Contrôle des billets à l'entrée du musée.
// Scan par la caméra via l'API navigateur BarcodeDetector (gratuite, native Chrome/Edge/Android).
// Repli universel : saisie manuelle du code imprimé sur le billet.

const { t } = useI18n()
const code = ref('')
const result = ref(null)      // { ok, reason, museum_nom, access_type, expires_at }
const checking = ref(false)
const scanning = ref(false)
const camError = ref('')
const history = ref([])       // derniers contrôles de la session

const video = ref(null)
let stream = null
let detector = null
let rafId = null

const cameraSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window

async function check(raw) {
  const value = String(raw || '').trim()
  if (!value || checking.value) return
  checking.value = true
  try {
    const { data, error } = await supabase.rpc('validate_ticket', { p_code: value })
    if (error) throw error
    const r = (data && data[0]) || { ok: false, reason: 'not_found' }
    result.value = r
    history.value.unshift({ code: value, ok: r.ok, reason: r.reason, at: new Date() })
    history.value = history.value.slice(0, 8)
    // Retour haptique sur mobile : court = OK, long = refus.
    if (navigator.vibrate) navigator.vibrate(r.ok ? 80 : [90, 60, 90])
  } catch (e) {
    result.value = { ok: false, reason: 'error', detail: e.message }
  } finally {
    checking.value = false
  }
}

function submitManual() {
  check(code.value)
  code.value = ''
}

async function startScan() {
  camError.value = ''
  if (!cameraSupported) { camError.value = t('admin.tickets.camUnsupported'); return }
  try {
    detector = new window.BarcodeDetector({ formats: ['qr_code'] })
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    scanning.value = true
    await new Promise((r) => setTimeout(r, 0)) // laisse le <video> se monter
    if (video.value) {
      video.value.srcObject = stream
      await video.value.play()
      loop()
    }
  } catch (e) {
    camError.value = e.message
    stopScan()
  }
}

let lastCode = ''
let lastAt = 0
async function loop() {
  if (!scanning.value || !video.value) return
  try {
    const codes = await detector.detect(video.value)
    if (codes.length) {
      const found = codes[0].rawValue
      // Anti-rebond : on ignore le même code pendant 3 s.
      if (found !== lastCode || Date.now() - lastAt > 3000) {
        lastCode = found
        lastAt = Date.now()
        await check(found)
      }
    }
  } catch { /* image non exploitable : on continue */ }
  rafId = requestAnimationFrame(loop)
}

function stopScan() {
  scanning.value = false
  if (rafId) { cancelAnimationFrame(rafId); rafId = null }
  if (stream) { stream.getTracks().forEach((tr) => tr.stop()); stream = null }
}
onBeforeUnmount(stopScan)

function dateFmt(d) { return d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—' }
function typeLabel(v) { return v === 'assistant_vocal' ? t('admin.tickets.typeAudio') : t('admin.tickets.typeVisit') }
</script>

<template>
  <div class="vi-page">
    <div class="vi-page__header">
      <div>
        <h1 class="vi-page__title">{{ $t('admin.tickets.title') }}</h1>
        <p class="vi-page__subtitle">{{ $t('admin.tickets.subtitle') }}</p>
      </div>
    </div>

    <div class="tk">
      <!-- Colonne scan -->
      <section class="tk-card">
        <h2>{{ $t('admin.tickets.scanTitle') }}</h2>

        <div v-if="scanning" class="tk-cam">
          <video ref="video" playsinline muted />
          <div class="tk-cam__frame" />
        </div>

        <div class="tk-actions">
          <Button v-if="!scanning" :label="$t('admin.tickets.startCam')" icon="pi pi-camera" @click="startScan" />
          <Button v-else :label="$t('admin.tickets.stopCam')" icon="pi pi-times" severity="secondary" outlined @click="stopScan" />
        </div>
        <Message v-if="camError" severity="warn" :closable="false">{{ camError }}</Message>
        <p v-else-if="!cameraSupported" class="tk-hint">{{ $t('admin.tickets.camUnsupported') }}</p>

        <div class="tk-manual">
          <label>{{ $t('admin.tickets.manualLabel') }}</label>
          <div class="tk-manual__row">
            <InputText v-model="code" placeholder="MUSEA-XXXXXXXX" @keyup.enter="submitManual" />
            <Button :label="$t('admin.tickets.verify')" icon="pi pi-check" :loading="checking" @click="submitManual" />
          </div>
        </div>
      </section>

      <!-- Colonne résultat -->
      <section class="tk-card">
        <h2>{{ $t('admin.tickets.resultTitle') }}</h2>

        <div v-if="!result" class="tk-idle">
          <i class="pi pi-qrcode" />
          <p>{{ $t('admin.tickets.idle') }}</p>
        </div>

        <div v-else class="tk-result" :class="result.ok ? 'is-ok' : 'is-ko'">
          <i :class="result.ok ? 'pi pi-check-circle' : 'pi pi-times-circle'" />
          <strong>{{ result.ok ? $t('admin.tickets.valid') : $t(`admin.tickets.r_${result.reason}`) }}</strong>
          <ul v-if="result.access_id" class="tk-info">
            <li v-if="result.museum_nom"><i class="pi pi-building" /> {{ result.museum_nom }}</li>
            <li><i class="pi pi-tag" /> {{ typeLabel(result.access_type) }}</li>
            <li v-if="result.expires_at"><i class="pi pi-calendar" /> {{ $t('admin.tickets.validUntil', { d: dateFmt(result.expires_at) }) }}</li>
            <li v-if="!result.ok && result.scanned_at"><i class="pi pi-clock" /> {{ $t('admin.tickets.usedAt', { d: dateFmt(result.scanned_at) }) }}</li>
          </ul>
          <p v-if="result.detail" class="tk-detail">{{ result.detail }}</p>
        </div>

        <template v-if="history.length">
          <h3 class="tk-hist-title">{{ $t('admin.tickets.historyTitle') }}</h3>
          <ul class="tk-hist">
            <li v-for="(h, i) in history" :key="i" :class="h.ok ? 'ok' : 'ko'">
              <i :class="h.ok ? 'pi pi-check' : 'pi pi-times'" />
              <code>{{ h.code }}</code>
              <span>{{ h.at.toLocaleTimeString('fr-FR') }}</span>
            </li>
          </ul>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.tk { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 1.25rem; align-items: start; }
.tk-card { background: var(--vi-surface); border: 1px solid var(--vi-border); border-radius: 16px; padding: 1.15rem 1.25rem 1.35rem; }
.tk-card h2 { font-size: 1.05rem; margin: 0 0 1rem; }

.tk-cam { position: relative; border-radius: 12px; overflow: hidden; background: #000; aspect-ratio: 4/3; margin-bottom: 0.9rem; }
.tk-cam video { width: 100%; height: 100%; object-fit: cover; display: block; }
.tk-cam__frame { position: absolute; inset: 18%; border: 3px solid #0e6f5c; border-radius: 12px; box-shadow: 0 0 0 100vmax rgba(0,0,0,0.25); }

.tk-actions { display: flex; gap: 0.6rem; margin-bottom: 0.8rem; }
.tk-hint { font-size: 0.82rem; color: var(--vi-muted); margin: 0 0 0.8rem; }

.tk-manual { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--vi-border); }
.tk-manual label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.45rem; }
.tk-manual__row { display: flex; gap: 0.5rem; }
.tk-manual__row :deep(input) { flex: 1; }

.tk-idle { text-align: center; padding: 2.5rem 1rem; color: var(--vi-muted); }
.tk-idle i { font-size: 3rem; opacity: 0.4; }
.tk-idle p { margin: 0.8rem 0 0; font-size: 0.9rem; }

.tk-result { border-radius: 14px; padding: 1.4rem 1.2rem; text-align: center; }
.tk-result.is-ok { background: #e6f4ee; border: 2px solid #0e6f5c; }
.tk-result.is-ko { background: #fdecea; border: 2px solid #c0392b; }
.tk-result > i { font-size: 3.2rem; }
.tk-result.is-ok > i { color: #0e6f5c; }
.tk-result.is-ko > i { color: #c0392b; }
.tk-result strong { display: block; font-size: 1.2rem; margin: 0.6rem 0 0.2rem; }
.tk-info { list-style: none; margin: 0.9rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; text-align: left; }
.tk-info li { display: flex; align-items: center; gap: 0.5rem; font-size: 0.88rem; background: rgba(255,255,255,0.65); border-radius: 8px; padding: 0.45rem 0.7rem; }
.tk-detail { font-size: 0.8rem; color: var(--vi-muted); margin: 0.7rem 0 0; }

.tk-hist-title { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--vi-muted); margin: 1.4rem 0 0.6rem; }
.tk-hist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.tk-hist li { display: flex; align-items: center; gap: 0.6rem; font-size: 0.82rem; padding: 0.4rem 0.6rem; border-radius: 8px; background: var(--vi-bg); }
.tk-hist li.ok i { color: #0e6f5c; }
.tk-hist li.ko i { color: #c0392b; }
.tk-hist code { flex: 1; font-size: 0.8rem; }
.tk-hist span { color: var(--vi-muted); }
</style>
