import { computed } from 'vue'
import { useRoute } from 'vue-router'

// Les pages publiques servent deux adresses : le site historique (/site/…)
// et le site d'une organisation (/c/<slug>/…). Ce composable préfixe les liens
// internes avec la bonne base pour qu'on ne quitte jamais le site consulté.
//
//   const { to } = useSiteLink()
//   <router-link :to="to('/musees')">…</router-link>
export function useSiteLink() {
  const route = useRoute()
  const base = computed(() => (route.params.slug ? `/c/${route.params.slug}` : '/site'))
  const to = (path = '') => `${base.value}${path}`
  return { base, to }
}
