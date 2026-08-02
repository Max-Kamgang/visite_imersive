<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { pubMuseum, pubMuseumProducts } from '@/services/publicApi'
import ProductCard from '@/components/public/ProductCard.vue'
import { useSiteLink } from '@/composables/useSiteLink'

// Liens internes : reste sur le site consulte (/site ou /c/<slug>)
const { to } = useSiteLink()

const route = useRoute()
const museum = ref(null)
const products = ref([])
const loading = ref(true)
const activeCat = ref('')

onMounted(async () => {
  const id = route.params.id
  const [m, p] = await Promise.all([pubMuseum(id), pubMuseumProducts(id)])
  museum.value = m
  products.value = p
  loading.value = false
})

const categories = computed(() => [...new Set(products.value.map((p) => p.categorie).filter(Boolean))])
const shown = computed(() => activeCat.value ? products.value.filter((p) => p.categorie === activeCat.value) : products.value)
</script>

<template>
  <div>
    <p v-if="loading" class="ps-wrap ps-muted">{{ $t('common.loading') }}</p>
    <template v-else>
      <header class="ps-hero" :style="museum?.photo ? { backgroundImage: `url(${museum.photo})` } : {}">
        <div class="ps-hero__in">
          <router-link :to="to('/boutiques')" class="ps-back"><i class="pi pi-arrow-left" /> {{ $t('boutique.title') }}</router-link>
          <div><span class="ps-hero__over">{{ $t('boutique.museumShop') }}</span></div>
          <h1>{{ museum?.nom }}</h1>
          <p v-if="museum?.description" class="ps-hero__lead">{{ museum.description }}</p>
          <div class="mbh-actions">
            <router-link v-if="museum" :to="to(`/musees/${museum.id}`)" class="ps-btn ps-btn--sm mbh-visit">
              <i class="pi pi-building" /> {{ $t('boutique.visitMuseum') }}
            </router-link>
          </div>
        </div>
      </header>

      <div class="ps-wrap">
        <div v-if="categories.length" class="ps-chips filters">
          <button :class="{ on: !activeCat }" @click="activeCat = ''">{{ $t('boutique.all') }}</button>
          <button v-for="c in categories" :key="c" :class="{ on: activeCat === c }" @click="activeCat = c">{{ c }}</button>
        </div>

        <p v-if="!products.length" class="ps-muted">{{ $t('boutique.emptyMuseum') }}</p>
        <div v-else class="grid">
          <ProductCard v-for="p in shown" :key="p.id" :product="p" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.mbh-actions { margin-top: 1.3rem; }
.mbh-visit { background: rgba(255, 255, 255, 0.14); border: 1px solid rgba(255, 255, 255, 0.4); }
.mbh-visit:hover { background: var(--site-primary); border-color: var(--site-primary); }
.filters { margin-bottom: 1.6rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 1.3rem; }
</style>
