<script setup>
import { ref, onMounted } from 'vue'
import { pubBoutiques } from '@/services/publicApi'
import { useSiteLink } from '@/composables/useSiteLink'

// Liens internes : reste sur le site consulte (/site ou /c/<slug>)
const { to } = useSiteLink()

const boutiques = ref([])
const loading = ref(true)

onMounted(async () => {
  boutiques.value = await pubBoutiques()
  loading.value = false
})
</script>

<template>
  <div>
    <header class="ps-hero">
      <div class="ps-hero__in">
        <span class="ps-hero__over">{{ $t('boutique.eyebrow') }}</span>
        <h1>{{ $t('boutique.title') }}</h1>
        <p class="ps-hero__lead">{{ $t('boutique.lead') }}</p>
      </div>
    </header>

    <div class="ps-wrap">
      <p v-if="loading" class="ps-muted">{{ $t('common.loading') }}</p>
      <p v-else-if="!boutiques.length" class="ps-muted">{{ $t('boutique.empty') }}</p>

      <div v-else class="grid">
        <router-link v-for="b in boutiques" :key="b.id" :to="to(`/musees/${b.id}/boutique`)" class="bqc ps-card ps-card--hover">
          <div class="bqc__img">
            <img v-if="b.photo" :src="b.photo" :alt="b.nom" loading="lazy" />
            <div v-else class="ps-ph"><i class="pi pi-shop" /></div>
            <span v-if="b.type" class="ps-tag bqc__type">{{ b.type }}</span>
          </div>
          <div class="bqc__b">
            <h2>{{ b.nom }}</h2>
            <span class="bqc__count">{{ $t('boutique.itemsCount', { n: b.count }) }}</span>
            <span class="ps-link">{{ $t('boutique.enter') }} <i class="pi pi-arrow-right" /></span>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 1.4rem; }
.bqc { overflow: hidden; display: flex; flex-direction: column; }
.bqc__img { position: relative; aspect-ratio: 16 / 10; background: #eef0ed; overflow: hidden; }
.bqc__img img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.35s; }
.bqc:hover .bqc__img img { transform: scale(1.04); }
.bqc__type { position: absolute; top: 0.8rem; left: 0.8rem; }
.bqc__b { padding: 1.05rem 1.2rem 1.25rem; display: flex; flex-direction: column; gap: 0.35rem; }
.bqc__b h2 { font-size: 1.2rem; font-weight: 800; margin: 0; color: #101210; }
.bqc__count { font-size: 0.85rem; color: #7c817b; }
.bqc__b .ps-link { margin-top: 0.45rem; }
</style>
