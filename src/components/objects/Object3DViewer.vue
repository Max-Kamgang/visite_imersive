<script setup>
import Dialog from 'primevue/dialog'

defineProps({
  visible: { type: Boolean, default: false },
  src: { type: String, default: '' },
  title: { type: String, default: '' }
})
defineEmits(['update:visible'])
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :header="title || $t('viewer3d.defaultTitle')"
    :style="{ width: '46rem', maxWidth: '95vw' }"
    @update:visible="$emit('update:visible', $event)"
  >
    <div class="viewer3d">
      <template v-if="src">
        <model-viewer
          :src="src"
          camera-controls
          auto-rotate
          ar
          ar-modes="webxr scene-viewer quick-look"
          ar-scale="auto"
          shadow-intensity="1"
          touch-action="pan-y"
          style="width: 100%; height: 440px; background: #f0ece4; border-radius: 12px"
        >
          <button slot="ar-button" class="viewer3d__ar">
            <i class="pi pi-mobile" /> {{ $t('viewer3d.arButton') }}
          </button>
        </model-viewer>
        <p class="viewer3d__hint">
          <i class="pi pi-sync" /> {{ $t('viewer3d.hint') }}
        </p>
      </template>

      <div v-else class="viewer3d__empty">
        <i class="pi pi-box" />
        <p>{{ $t('viewer3d.empty') }}</p>
        <small>{{ $t('viewer3d.emptyHint') }}</small>
      </div>
    </div>
  </Dialog>
</template>

<style scoped>
.viewer3d__ar {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  border: none;
  background: var(--p-primary-color);
  color: #fff;
  font-weight: 600;
  font-size: 0.85rem;
  padding: 0.55rem 1rem;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.22);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.viewer3d__hint {
  margin: 0.9rem 0 0;
  color: var(--vi-muted);
  font-size: 0.82rem;
  line-height: 1.5;
}
.viewer3d__hint i {
  color: var(--p-primary-color);
  margin-right: 0.25rem;
}
.viewer3d__empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--vi-muted);
}
.viewer3d__empty i {
  font-size: 3rem;
  opacity: 0.5;
  display: block;
  margin-bottom: 0.75rem;
}
.viewer3d__empty small {
  display: block;
  margin-top: 0.4rem;
  opacity: 0.8;
}
</style>
