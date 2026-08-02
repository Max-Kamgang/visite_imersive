import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/services/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const role = ref(null)
  const tenantId = ref(null)   // organisation de l'utilisateur (multi-tenant)
  const tenant = ref(null)     // sa fiche complète (nom, slug, statut…)
  const ready = ref(false)

  let resolveReady
  const readyPromise = new Promise((r) => { resolveReady = r })

  // Le super-admin de la plateforme voit toutes les organisations.
  const isSuperAdmin = computed(() => role.value === 'super_admin')
  const isStaff = computed(() => ['staff', 'admin', 'super_admin'].includes(role.value))

  async function fetchRole() {
    if (!user.value) { role.value = null; tenantId.value = null; tenant.value = null; return }
    const { data } = await supabase
      .from('profiles').select('role, tenant_id').eq('id', user.value.id).single()
    role.value = data?.role ?? 'visitor'
    tenantId.value = data?.tenant_id ?? null
    tenant.value = null
    if (tenantId.value) {
      const { data: t } = await supabase.from('tenants').select('*').eq('id', tenantId.value).maybeSingle()
      tenant.value = t ?? null
    }
  }

  async function init() {
    const { data } = await supabase.auth.getSession()
    user.value = data.session?.user ?? null
    await fetchRole()
    ready.value = true
    resolveReady()
    supabase.auth.onAuthStateChange(async (_event, session) => {
      user.value = session?.user ?? null
      await fetchRole()
    })
  }
  function ensureReady() { return readyPromise }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    user.value = data.user
    await fetchRole()
  }
  // `profil` accepte soit une chaîne (ancien appel : le nom complet), soit un
  // objet { prenom, nom, pays, telephone }. Ces métadonnées sont recopiées dans
  // `profiles` par le trigger `handle_new_user` — le client n'écrit jamais
  // directement dans la table, il ne fait que déclarer.
  async function signUp(email, password, profil = {}) {
    const p = typeof profil === 'string' ? { nom: profil } : (profil || {})
    const fullName = [p.prenom, p.nom].filter(Boolean).join(' ').trim() || p.fullName || email
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          prenom: p.prenom || null,
          nom: p.nom || null,
          pays: p.pays || null,
          telephone: p.telephone || null
        }
      }
    })
    if (error) throw error
    // En dev, les comptes sont auto-confirmés côté base → connexion immédiate.
    if (data.session) {
      user.value = data.user
      await fetchRole()
    } else {
      await signIn(email, password)
    }
  }
  // Login Google (OAuth). redirectPath = page PUBLIQUE de retour après authentification
  // (jamais '/' qui est l'ERP réservé au staff). Cette URL doit figurer dans les
  // « Redirect URLs » autorisées du Dashboard Supabase (ex. http://localhost:5173/**).
  async function signInGoogle(redirectPath = '/site/compte') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + redirectPath,
        queryParams: { prompt: 'select_account' }
      }
    })
    if (error) throw error
  }
  // Connexion SANS mot de passe : envoi d'un code à 6 chiffres par e-mail (aucune console externe requise).
  async function sendEmailOtp(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true }
    })
    if (error) throw error
  }
  async function verifyEmailOtp(email, token) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (error) throw error
    user.value = data.user
    await fetchRole()
  }
  async function signOut() {
    await supabase.auth.signOut()
    user.value = null
    role.value = null
    tenantId.value = null
    tenant.value = null
  }

  // Met à jour la fiche de l'organisation (nom, slug, domaine…).
  async function updateTenant(patch) {
    if (!tenantId.value) throw new Error('Aucune organisation')
    const { data, error } = await supabase
      .from('tenants').update(patch).eq('id', tenantId.value).select().single()
    if (error) throw error
    tenant.value = data
    return data
  }

  return {
    user, role, tenantId, tenant, ready, isStaff, isSuperAdmin,
    init, ensureReady, signIn, signUp, signInGoogle, sendEmailOtp, verifyEmailOtp,
    signOut, fetchRole, updateTenant
  }
})
