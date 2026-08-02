<script setup>
import { ref, onMounted } from 'vue'
import { pubEvents } from '@/services/publicApi'

// Agenda public : expositions et événements à venir.
// museumId = null → tous les musées (page d'accueil) ; sinon l'agenda d'un musée.
const props = defineProps({ museumId: { type: Number, default: null }, limit: { type: Number, default: 6 } })

const events = ref([])
onMounted(async () => { events.value = await pubEvents(props.limit, props.museumId) })

function day(d) { return d ? new Date(d).getDate() : '' }
function month(d) {
  return d ? new Date(d).toLocaleDateString(undefined, { month: 'short' }).replace('.', '').toUpperCase() : ''
}
function range(e) {
  if (!e.dateDebut) return ''
  const opts = { day: 'numeric', month: 'long', year: 'numeric' }
  const a = new Date(e.dateDebut).toLocaleDateString(undefined, opts)
  if (!e.dateFin || e.dateFin === e.dateDebut) return a
  return `${a} → ${new Date(e.dateFin).toLocaleDateString(undefined, opts)}`
}
</script>

<template>
  <section v-if="events.length" class="ps-wrap">
    <div class="ev-head">
      <div>
        <span class="ps-over">{{ $t('events.eyebrow') }}</span>
        <h2 class="ev-title">{{ $t('events.title') }}</h2>
      </div>
    </div>

    <div class="ev-grid">
      <article v-for="e in events" :key="e.id" class="ev ps-card ps-card--hover">
        <div class="ev__img">
          <img v-if="e.image" :src="e.image" :alt="e.titre" loading="lazy" />
          <div v-else class="ps-ph"><i class="pi pi-calendar" /></div>
          <span v-if="e.dateDebut" class="ev__date">
            <strong>{{ day(e.dateDebut) }}</strong>
            <small>{{ month(e.dateDebut) }}</small>
          </span>
        </div>
        <div class="ev__b">
          <h3>{{ e.titre }}</h3>
          <p v-if="e.description" class="ev__desc">{{ e.description }}</p>
          <div class="ev__meta">
            <span v-if="e.dateDebut"><i class="pi pi-clock" /> {{ range(e) }}</span>
            <span v-if="e.lieu"><i class="pi pi-map-marker" /> {{ e.lieu }}</span>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.ev-head { margin-bottom: 1.5rem; }
.ev-title {
  font-family: 'Anton', 'Inter', sans-serif; font-weight: 400; text-transform: uppercase;
  font-size: clamp(1.5rem, 3vw, 2.1rem); margin: 0; color: #101210;
}
.ev-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.4rem; }
.ev { overflow: hidden; display: flex; flex-direction: column; }
.ev__img { position: relative; height: 180px; background: #eef0ed; overflow: hidden; }
.ev__img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.35s; }
.ev:hover .ev__img img { transform: scale(1.04); }
.ev__date {
  position: absolute; top: 0.8rem; left: 0.8rem;
  background: var(--site-primary, #0e6f5c); color: #fff; border-radius: 6px;
  padding: 0.4rem 0.6rem; text-align: center; line-height: 1; min-width: 48px;
}
.ev__date strong { display: block; font-size: 1.2rem; font-weight: 800; }
.ev__date small { display: block; font-size: 0.6rem; letter-spacing: 0.08em; margin-top: 0.15rem; }
.ev__b { padding: 1rem 1.15rem 1.2rem; display: flex; flex-direction: column; gap: 0.4rem; }
.ev__b h3 { margin: 0; font-size: 1.1rem; font-weight: 800; color: #101210; }
.ev__desc { margin: 0; font-size: 0.88rem; color: #5c615c; line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ev__meta { display: flex; flex-direction: column; gap: 0.25rem; margin-top: 0.3rem; font-size: 0.8rem; color: #7c817b; }
.ev__meta i { color: var(--site-primary, #0e6f5c); margin-right: 0.35rem; }
</style>
