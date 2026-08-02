import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'
import { useAuthStore } from './useAuthStore'
import { getPublicTenant } from '@/services/publicApi'

// Accès du visiteur (lecture de user_access — la source de vérité du paywall est côté serveur/RLS).
//
// MULTI-TENANT : un visiteur peut avoir acheté des accès auprès de PLUSIEURS
// organisations. Les droits ne valent que pour l'organisation qui les a vendus :
// un pass « tous les musées » de la chefferie A ne déverrouille rien chez B.
export const useAccessStore = defineStore('access', () => {
  const rows = ref([])
  const loaded = ref(false)

  async function load() {
    const auth = useAuthStore()
    await auth.ensureReady()
    if (!auth.user) {
      rows.value = []
      loaded.value = true
      return
    }
    const { data, error } = await supabase.from('user_access').select('*').eq('user_id', auth.user.id)
    if (error) console.error('[access] load', error.message)
    rows.value = (data || []).filter((r) => !r.expires_at || new Date(r.expires_at) > new Date())
    loaded.value = true
  }

  // Droits valables sur le site actuellement consulté.
  const scopedRows = computed(() => {
    const tid = getPublicTenant()
    if (tid == null) return rows.value // site historique : aucune organisation imposée
    return rows.value.filter((r) => r.tenant_id === tid)
  })

  const hasAllAccess = computed(() =>
    scopedRows.value.some((r) => r.type === 'abonnement' && r.museum_id == null)
  )
  function hasMuseum(museumId) {
    return hasAllAccess.value || scopedRows.value.some((r) => r.type === 'abonnement' && r.museum_id === museumId)
  }
  function hasVoice(museumId) {
    return scopedRows.value.some((r) => r.type === 'assistant_vocal' && r.museum_id === museumId)
  }

  return { rows, scopedRows, loaded, load, hasAllAccess, hasMuseum, hasVoice }
})
