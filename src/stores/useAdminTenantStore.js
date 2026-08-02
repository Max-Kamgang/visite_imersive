import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'

// Back-office plateforme : gestion de TOUTES les organisations.
// Réservé au super-admin (les RPC refusent tout autre utilisateur).
export const useAdminTenantStore = defineStore('adminTenants', () => {
  const items = ref([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    const { data, error } = await supabase.rpc('admin_tenants_overview')
    if (error) console.error('[admin tenants] load', error.message)
    else items.value = data || []
    loading.value = false
  }

  async function setStatus(id, statut) {
    const { data, error } = await supabase.rpc('set_tenant_status', { p_tenant_id: id, p_statut: statut })
    if (error) throw error
    const r = (data && data[0]) || {}
    if (!r.ok) throw new Error(r.reason || 'error')
    const t = items.value.find((x) => x.id === id)
    if (t) {
      t.statut = statut
      if (statut === 'approuve' && !t.approved_at) t.approved_at = new Date().toISOString()
    }
  }

  async function setDomainVerified(id, verified) {
    const { data, error } = await supabase.rpc('set_domain_verified', { p_tenant_id: id, p_verified: verified })
    if (error) throw error
    if (!data) throw new Error('forbidden')
    const t = items.value.find((x) => x.id === id)
    if (t) t.domain_verified = verified
  }

  const pending = computed(() => items.value.filter((t) => t.statut === 'en_attente'))
  const approved = computed(() => items.value.filter((t) => t.statut === 'approuve'))
  const totalRevenue = computed(() => items.value.reduce((s, t) => s + Number(t.ca_total || 0), 0))

  return { items, loading, pending, approved, totalRevenue, load, setStatus, setDomainVerified }
})
