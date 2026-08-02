<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { createRenderer, demoPanorama, project, unproject, shortestAngle } from './panorama'

// Visionneuse de panorama 360 — souris, tactile, pincement, gyroscope, clavier.
// Le rendu est délégué à ./panorama.js (WebGL natif, aucune dépendance).
//
// Les points chauds ne sont PAS dessinés dans le canvas : ce sont de vrais
// <button> HTML positionnés en pourcentage par project(). On garde ainsi le
// focus clavier, les lecteurs d'écran et les infobulles du navigateur.

const props = defineProps({
  src: { type: String, default: '' },
  type: { type: String, default: 'photo360' }, // photo360 | video360 | image
  hotspots: { type: Array, default: () => [] },
  initial: { type: Object, default: () => ({}) },
  seed: { type: Number, default: 0 },
  editable: { type: Boolean, default: false },
  autorotate: { type: Boolean, default: false },
  height: { type: String, default: '' }
})
const emit = defineEmits(['place', 'select', 'view', 'ready', 'error'])

const wrap = ref(null)
const canvasEl = ref(null)
const flatEl = ref(null)

const yaw = ref(0)
const pitch = ref(0)
const fov = ref(75)
const size = ref({ w: 1, h: 1 })
const loading = ref(true)
const failed = ref(false)
const usingDemo = ref(false)
const gyroOn = ref(false)
const fullscreen = ref(false)

const is360 = computed(() => props.type !== 'image')
const aspect = computed(() => size.value.w / Math.max(1, size.value.h))

let renderer = null
let videoEl = null
let raf = null
let fade = 1
let velYaw = 0
let velPitch = 0
let autoDrift = 0

const FOV_MIN = 32
const FOV_MAX = 100
const PITCH_MAX = 85

// ---------------------------------------------------------------- boucle ---
// L'aperçu intégré met la page en visibilityState "hidden" : requestAnimationFrame
// y est suspendu et le rendu semblerait figé. On bascule alors sur un minuteur.
let rafIsTimer = false
function nextFrame(cb) {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return { id: setTimeout(cb, 32), timer: true }
  return { id: requestAnimationFrame(cb), timer: false }
}

function schedule() {
  if (raf != null) return
  const h = nextFrame(frame)
  raf = h.id
  rafIsTimer = h.timer
}

function frame() {
  raf = null
  let busy = false

  if (!dragging && (Math.abs(velYaw) > 0.002 || Math.abs(velPitch) > 0.002)) {
    yaw.value += velYaw
    pitch.value = clampPitch(pitch.value + velPitch)
    velYaw *= 0.92
    velPitch *= 0.92
    busy = true
  }
  if (props.autorotate && !dragging && !gyroOn.value && Math.abs(velYaw) < 0.05) {
    autoDrift = Math.min(0.03, autoDrift + 0.002)
    yaw.value += autoDrift
    busy = true
  }
  if (fade < 1) {
    fade = Math.min(1, fade + 0.06)
    busy = true
  }

  draw()
  if (busy || (renderer && renderer.hasVideo())) schedule()
}

function draw() {
  if (!renderer || !canvasEl.value) return
  renderer.draw(yaw.value, pitch.value, fov.value, fade)
}

const clampPitch = (v) => Math.max(-PITCH_MAX, Math.min(PITCH_MAX, v))

// ------------------------------------------------------------ dimensions ---
let ro = null
function resize() {
  const el = wrap.value
  if (!el) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = el.clientWidth
  const h = el.clientHeight
  size.value = { w, h }
  if (canvasEl.value) {
    canvasEl.value.width = Math.max(1, Math.round(w * dpr))
    canvasEl.value.height = Math.max(1, Math.round(h * dpr))
  }
  schedule()
}

// ---------------------------------------------------------------- média ----
function applyInitial() {
  const i = props.initial || {}
  yaw.value = Number(i.yaw) || 0
  pitch.value = clampPitch(Number(i.pitch) || 0)
  fov.value = Math.max(FOV_MIN, Math.min(FOV_MAX, Number(i.fov) || 75))
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // Une texture WebGL exige une image « propre » : sans en-tête CORS, le
    // téléversement lèverait une erreur de sécurité. On demande donc le mode
    // anonyme, et l'on retombe sur le panorama de démonstration si le serveur
    // distant ne l'autorise pas.
    if (/^https?:/i.test(url)) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image'))
    img.src = url
  })
}

function loadVideo(url) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video')
    v.crossOrigin = 'anonymous'
    v.muted = true
    v.loop = true
    v.playsInline = true
    v.setAttribute('playsinline', '')
    v.oncanplay = () => { v.play().catch(() => {}); resolve(v) }
    v.onerror = () => reject(new Error('video'))
    v.src = url
  })
}

async function loadMedia() {
  if (!is360.value) { loading.value = false; return }
  loading.value = true
  failed.value = false
  usingDemo.value = false
  fade = 0
  if (videoEl) { try { videoEl.pause() } catch { /* ignore */ } videoEl = null }

  if (!renderer) { loading.value = false; return }

  try {
    if (!props.src) {
      renderer.upload(demoPanorama(props.seed))
      usingDemo.value = true
    } else if (props.type === 'video360') {
      videoEl = await loadVideo(props.src)
      renderer.upload(videoEl)
    } else {
      renderer.upload(await loadImage(props.src))
    }
  } catch (e) {
    // Média absent, hors ligne ou refusé par CORS : la visite continue avec la
    // salle de démonstration plutôt que de s'arrêter (règle de dégradation propre).
    renderer.upload(demoPanorama(props.seed))
    usingDemo.value = true
    failed.value = !!props.src
    emit('error', e)
  }
  loading.value = false
  applyInitial()
  schedule()
  emit('ready')
}

// ---------------------------------------------------- souris & tactile -----
let dragging = false
let moved = 0
const pointers = new Map()
let pinchDist = 0
let last = { x: 0, y: 0 }

function onPointerDown(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
    return
  }
  dragging = true
  moved = 0
  autoDrift = 0
  velYaw = 0
  velPitch = 0
  last = { x: e.clientX, y: e.clientY }
  try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
}

function onPointerMove(e) {
  if (!pointers.has(e.pointerId)) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    const d = Math.hypot(a.x - b.x, a.y - b.y)
    if (pinchDist) zoom((pinchDist - d) * 0.12)
    pinchDist = d
    return
  }
  if (!dragging) return

  const dx = e.clientX - last.x
  const dy = e.clientY - last.y
  last = { x: e.clientX, y: e.clientY }
  moved += Math.abs(dx) + Math.abs(dy)

  // Sensibilité proportionnelle au champ de vision : plus on est zoomé,
  // plus le geste est fin — c'est ce qui donne la sensation « naturelle ».
  const k = fov.value / Math.max(1, size.value.h)
  velYaw = -dx * k
  velPitch = dy * k
  yaw.value += velYaw
  pitch.value = clampPitch(pitch.value + velPitch)
  schedule()
}

function onPointerUp(e) {
  pointers.delete(e.pointerId)
  if (pointers.size < 2) pinchDist = 0
  if (!dragging) return
  dragging = false
  // Un geste court est un clic : en mode édition, il pose un point chaud.
  if (moved < 5 && props.editable) placeAt(e)
  schedule()
}

function placeAt(e) {
  const r = wrap.value.getBoundingClientRect()
  const fx = (e.clientX - r.left) / r.width
  const fy = (e.clientY - r.top) / r.height
  if (is360.value) {
    const p = unproject(fx, fy, yaw.value, pitch.value, fov.value, aspect.value)
    emit('place', { x: Math.round(p.yaw * 10) / 10, y: Math.round(p.pitch * 10) / 10 })
  } else {
    emit('place', { x: Math.round(fx * 1000) / 1000, y: Math.round(fy * 1000) / 1000 })
  }
}

function zoom(delta) {
  fov.value = Math.max(FOV_MIN, Math.min(FOV_MAX, fov.value + delta))
  schedule()
}

function onWheel(e) {
  e.preventDefault()
  zoom(e.deltaY * 0.05)
}

function onKey(e) {
  const step = e.shiftKey ? 12 : 4
  const map = {
    ArrowLeft: () => { yaw.value -= step },
    ArrowRight: () => { yaw.value += step },
    ArrowUp: () => { pitch.value = clampPitch(pitch.value + step) },
    ArrowDown: () => { pitch.value = clampPitch(pitch.value - step) },
    '+': () => zoom(-6),
    '-': () => zoom(6)
  }
  const fn = map[e.key]
  if (!fn) return
  e.preventDefault()
  autoDrift = 0
  fn()
  schedule()
}

// --------------------------------------------------------------- gyroscope -
// Mise en correspondance volontairement simple (alpha/beta) : elle suffit à
// « regarder autour de soi » téléphone en main, en mode portrait.
function onOrientation(e) {
  if (e.alpha == null) return
  yaw.value = -e.alpha
  pitch.value = clampPitch((e.beta || 0) - 90)
  schedule()
}

async function toggleGyro() {
  if (gyroOn.value) {
    window.removeEventListener('deviceorientation', onOrientation)
    gyroOn.value = false
    return
  }
  const D = window.DeviceOrientationEvent
  if (!D) return
  if (typeof D.requestPermission === 'function') {
    try { if ((await D.requestPermission()) !== 'granted') return } catch { return }
  }
  window.addEventListener('deviceorientation', onOrientation)
  gyroOn.value = true
}

const gyroAvailable = computed(() => typeof window !== 'undefined' && !!window.DeviceOrientationEvent)

// ------------------------------------------------------------ plein écran --
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await wrap.value.requestFullscreen()
  } catch { /* refusé par le navigateur */ }
}
function onFsChange() {
  fullscreen.value = !!document.fullscreenElement
  nextTick(resize)
}

// ------------------------------------------------------------ points chauds
const placed = computed(() => {
  const list = []
  for (const h of props.hotspots) {
    if (is360.value) {
      const p = project(Number(h.x) || 0, Number(h.y) || 0, yaw.value, pitch.value, fov.value, aspect.value)
      if (p) list.push({ h, ...p })
    } else {
      list.push({ h, left: (Number(h.x) || 0) * 100, top: (Number(h.y) || 0) * 100 })
    }
  }
  return list
})

const HOTSPOT_ICON = {
  objet: 'pi pi-box',
  personnage: 'pi pi-user',
  navigation: 'pi pi-arrow-right',
  info: 'pi pi-info'
}
const iconOf = (h) => HOTSPOT_ICON[h.type] || 'pi pi-circle'

// Amène un point chaud au centre de l'écran (utilisé par l'éditeur et le
// bandeau « salle suivante »).
function lookAt(h, animate = true) {
  const ty = Number(h.y) || 0
  const tx = Number(h.x) || 0
  if (!animate) { yaw.value = tx; pitch.value = clampPitch(ty); schedule(); return }
  const startYaw = yaw.value
  const startPitch = pitch.value
  const dYaw = shortestAngle(startYaw, tx)
  const dPitch = clampPitch(ty) - startPitch
  const t0 = performance.now()
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / 420)
    const e = 1 - (1 - k) ** 3
    yaw.value = startYaw + dYaw * e
    pitch.value = startPitch + dPitch * e
    draw()
    if (k < 1) nextFrame(step)
  }
  nextFrame(step)
}

function reset() { applyInitial(); velYaw = 0; velPitch = 0; schedule() }
const getView = () => ({
  yaw: Math.round(yaw.value * 10) / 10,
  pitch: Math.round(pitch.value * 10) / 10,
  fov: Math.round(fov.value)
})
defineExpose({ lookAt, reset, getView })

// L'éditeur enregistre la position d'arrivée : on le prévient à chaque
// changement de cadrage, sans l'inonder (une seule notification par image).
let notify = null
watch([yaw, pitch, fov], () => {
  if (!props.editable || notify) return
  notify = nextFrame(() => { notify = null; emit('view', getView()) })
})

// ------------------------------------------------------------------ cycle --
onMounted(async () => {
  if (is360.value) {
    renderer = createRenderer(canvasEl.value)
    if (!renderer) { failed.value = true; loading.value = false; return }
  }
  resize()
  ro = new ResizeObserver(resize)
  ro.observe(wrap.value)
  document.addEventListener('fullscreenchange', onFsChange)
  await loadMedia()
})

onBeforeUnmount(() => {
  if (ro) ro.disconnect()
  document.removeEventListener('fullscreenchange', onFsChange)
  window.removeEventListener('deviceorientation', onOrientation)
  if (raf != null) {
    if (rafIsTimer) clearTimeout(raf)
    else cancelAnimationFrame(raf)
    raf = null
  }
  if (videoEl) { try { videoEl.pause() } catch { /* ignore */ } videoEl = null }
  if (renderer) renderer.dispose()
  renderer = null
})

watch(() => [props.src, props.type, props.seed], loadMedia)
watch(() => props.initial, applyInitial)
</script>

<template>
  <div
    ref="wrap"
    class="pano"
    :class="{ 'pano--edit': editable, 'pano--fs': fullscreen }"
    :style="height ? { height } : {}"
    tabindex="0"
    role="application"
    :aria-label="$t('tour.viewerAria')"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel="onWheel"
    @keydown="onKey"
  >
    <canvas v-if="is360" ref="canvasEl" class="pano__gl" />
    <img v-else-if="src" ref="flatEl" :src="src" class="pano__flat" alt="" draggable="false" />
    <div v-else class="pano__flat pano__flat--empty"><i class="pi pi-image" /></div>

    <!-- Points chauds : de vrais boutons, donc focalisables au clavier -->
    <button
      v-for="p in placed"
      :key="p.h.id ?? `${p.h.x}:${p.h.y}`"
      type="button"
      class="hs"
      :class="[`hs--${p.h.type || 'objet'}`, { 'hs--active': p.h.active }]"
      :style="{ left: `${p.left}%`, top: `${p.top}%` }"
      :title="p.h.libelle || ''"
      :aria-label="p.h.libelle || $t('tour.hotspot')"
      @pointerdown.stop
      @click.stop="emit('select', p.h)"
    >
      <span class="hs__dot"><i :class="iconOf(p.h)" /></span>
      <span v-if="p.h.libelle" class="hs__label">{{ p.h.libelle }}</span>
    </button>

    <div v-if="loading" class="pano__veil">
      <i class="pi pi-spin pi-spinner" /> {{ $t('tour.loading') }}
    </div>

    <p v-if="usingDemo && !loading" class="pano__demo">
      <i class="pi pi-info-circle" />
      {{ failed ? $t('tour.mediaFailed') : $t('tour.demoScene') }}
    </p>

    <!-- Commandes -->
    <div class="pano__ctl">
      <button type="button" :title="$t('tour.zoomIn')" @click.stop="zoom(-8)"><i class="pi pi-search-plus" /></button>
      <button type="button" :title="$t('tour.zoomOut')" @click.stop="zoom(8)"><i class="pi pi-search-minus" /></button>
      <button type="button" :title="$t('tour.recenter')" @click.stop="reset"><i class="pi pi-compass" /></button>
      <button
        v-if="gyroAvailable && is360"
        type="button"
        :class="{ on: gyroOn }"
        :title="$t('tour.gyro')"
        @click.stop="toggleGyro"
      >
        <i class="pi pi-mobile" />
      </button>
      <button type="button" :title="$t('tour.fullscreen')" @click.stop="toggleFullscreen">
        <i :class="fullscreen ? 'pi pi-window-minimize' : 'pi pi-window-maximize'" />
      </button>
    </div>

    <p v-if="editable" class="pano__edit-hint"><i class="pi pi-map-marker" /> {{ $t('tour.editHint') }}</p>
  </div>
</template>

<style scoped>
.pano {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 320px;
  overflow: hidden;
  background: #14140f;
  border-radius: 14px;
  cursor: grab;
  touch-action: none;
  user-select: none;
  outline: none;
}
.pano:focus-visible { box-shadow: 0 0 0 3px var(--site-primary, #1f7a5a); }
.pano:active { cursor: grabbing; }
.pano--edit { cursor: crosshair; }
.pano--fs { border-radius: 0; }

.pano__gl, .pano__flat { display: block; width: 100%; height: 100%; object-fit: cover; }
.pano__flat--empty { display: flex; align-items: center; justify-content: center; color: #4a4a44; font-size: 2.4rem; }

/* ---------------- points chauds ---------------- */
.hs {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 0.45rem;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  color: #fff;
  white-space: nowrap;
}
.hs__dot {
  width: 38px; height: 38px; flex: 0 0 38px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255, 255, 255, 0.16);
  border: 2px solid #fff;
  backdrop-filter: blur(3px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
  font-size: 0.95rem;
  transition: transform 0.18s ease, background 0.18s ease;
}
.hs::before {
  content: '';
  position: absolute;
  left: 19px; top: 50%;
  width: 38px; height: 38px;
  margin: -19px 0 0 -19px;
  border-radius: 50%;
  border: 2px solid #fff;
  animation: hs-pulse 2.4s ease-out infinite;
  pointer-events: none;
}
@keyframes hs-pulse {
  0% { transform: scale(1); opacity: 0.75; }
  70% { transform: scale(2.1); opacity: 0; }
  100% { transform: scale(2.1); opacity: 0; }
}
.hs:hover .hs__dot, .hs:focus-visible .hs__dot { transform: scale(1.16); background: rgba(255, 255, 255, 0.3); }
.hs:focus-visible { outline: 2px solid #fff; outline-offset: 6px; border-radius: 999px; }
.hs--objet .hs__dot { border-color: var(--gold, #cda24e); color: var(--gold, #cda24e); }
.hs--objet::before { border-color: var(--gold, #cda24e); }
.hs--personnage .hs__dot { border-color: #e8c9a0; color: #e8c9a0; }
.hs--navigation .hs__dot { border-color: #fff; }
.hs--info .hs__dot { border-color: #9fd6c2; color: #9fd6c2; }
.hs--active .hs__dot { background: var(--gold, #cda24e); color: #14140f; }
.hs__label {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 0.28rem 0.6rem;
  border-radius: 999px;
  background: rgba(10, 10, 8, 0.62);
  backdrop-filter: blur(4px);
  opacity: 0;
  transform: translateX(-6px);
  transition: opacity 0.18s ease, transform 0.18s ease;
  max-width: 190px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hs:hover .hs__label, .hs:focus-visible .hs__label { opacity: 1; transform: none; }
@media (hover: none) { .hs__label { opacity: 1; transform: none; } }

/* ---------------- habillage ---------------- */
.pano__veil {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  background: #14140f; color: #cfc9bd; font-size: 0.9rem;
}
.pano__demo, .pano__edit-hint {
  position: absolute; left: 0.85rem; bottom: 0.85rem; margin: 0;
  display: flex; align-items: center; gap: 0.4rem;
  background: rgba(10, 10, 8, 0.6);
  color: #ded9cf; font-size: 0.76rem;
  padding: 0.4rem 0.7rem; border-radius: 999px;
  backdrop-filter: blur(4px);
  max-width: calc(100% - 6rem);
}
.pano__edit-hint { bottom: auto; top: 0.85rem; }
.pano__demo i, .pano__edit-hint i { color: var(--gold, #cda24e); }

.pano__ctl { position: absolute; right: 0.85rem; bottom: 0.85rem; display: flex; gap: 0.4rem; }
.pano__ctl button {
  width: 36px; height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(10, 10, 8, 0.55);
  color: #efeae0;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(4px);
  transition: background 0.15s ease;
}
.pano__ctl button:hover { background: rgba(10, 10, 8, 0.85); }
.pano__ctl button.on { background: var(--gold, #cda24e); color: #14140f; border-color: transparent; }
</style>
