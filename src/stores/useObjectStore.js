import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { scopeToTenant } from '@/services/tenant'

const today = () => new Date().toISOString().slice(0, 10)

const fromRow = (r) => ({
  id: r.id,
  sectorId: r.sector_id,
  nom: r.nom,
  nomCommun: r.nom_commun,
  description: r.description,
  photo: r.photo,
  model3d: r.model3d,
  model3dName: r.model3d_name,
  // Réalité augmentée (migration 20260801_object_ar.sql)
  model3dIos: r.model3d_ios || null,
  model3dIosName: r.model3d_ios_name || '',
  arPlacement: r.ar_placement || 'floor',
  arEchelle: r.ar_echelle == null ? 1 : Number(r.ar_echelle),
  published: r.published,
  publishedAt: r.published_at,
  seo: r.seo || { title: '', description: '', slug: '', keywords: [] },
  createdAt: r.created_at
})
const toRow = (o) => ({
  sector_id: o.sectorId ?? null,
  nom: o.nom,
  nom_commun: o.nomCommun ?? null,
  description: o.description ?? null,
  photo: o.photo ?? null,
  model3d: o.model3d ?? null,
  model3d_name: o.model3dName ?? null,
  model3d_ios: o.model3dIos ?? null,
  model3d_ios_name: o.model3dIosName ?? null,
  ar_placement: o.arPlacement || 'floor',
  ar_echelle: o.arEchelle == null || o.arEchelle === '' ? 1 : Number(o.arEchelle),
  published: o.published ?? false,
  seo: o.seo ?? {}
})

// Compatibilité avec une base où la migration 20260801_object_ar.sql n'a pas
// encore été passée : ses colonnes n'existent pas, et PostgREST rejette alors
// l'écriture entière. Plutôt que de bloquer l'enregistrement d'un objet — ce
// qui rendrait l'ERP inutilisable pour un motif sans rapport — on réessaie une
// fois sans ces colonnes, et on ne les renvoie plus jusqu'au rechargement.
const AR_COLONNES = ['model3d_ios', 'model3d_ios_name', 'ar_placement', 'ar_echelle']
let arColonnesPresentes = true

const sansAr = (row) => {
  const copie = { ...row }
  for (const c of AR_COLONNES) delete copie[c]
  return copie
}
const colonneAbsente = (e) =>
  /does not exist|Could not find the .* column|schema cache/i.test(e?.message || '')

// Exécute une écriture, en retirant les colonnes RA si la base ne les connaît pas.
async function ecrire(requete) {
  const { data, error } = await requete(arColonnesPresentes)
  if (!error) return data
  if (!arColonnesPresentes || !colonneAbsente(error)) throw error

  console.warn(
    '[objects] colonnes de réalité augmentée absentes — exécutez ' +
    'supabase/migrations/20260801_object_ar.sql. Enregistrement sans elles.'
  )
  arColonnesPresentes = false
  const { data: d2, error: e2 } = await requete(false)
  if (e2) throw e2
  return d2
}

export const useObjectStore = defineStore('objects', () => {
  const items = ref([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    const { data, error } = await scopeToTenant(supabase.from('objects').select('*')).order('id')
    if (error) console.error('[objects] load', error.message)
    else items.value = data.map(fromRow)
    loading.value = false
  }

  async function add(data) {
    const row = toRow(data)
    if (row.published && !row.published_at) row.published_at = today()
    const r = await ecrire((avecAr) =>
      supabase.from('objects').insert(avecAr ? row : sansAr(row)).select().single()
    )
    const o = fromRow(r)
    items.value.push(o)
    return o
  }

  async function update(id, data) {
    const row = toRow(data)
    const existing = getById(id)
    if (row.published && !existing?.publishedAt) row.published_at = today()
    const r = await ecrire((avecAr) =>
      supabase.from('objects').update(avecAr ? row : sansAr(row)).eq('id', id).select().single()
    )
    const i = items.value.findIndex((x) => x.id === id)
    if (i !== -1) items.value[i] = fromRow(r)
  }

  async function remove(id) {
    const { error } = await supabase.from('objects').delete().eq('id', id)
    if (error) throw error
    items.value = items.value.filter((x) => x.id !== id)
  }

  async function togglePublished(id) {
    const o = getById(id)
    if (!o) return
    const published = !o.published
    const patch = { published }
    if (published && !o.publishedAt) patch.published_at = today()
    const { data: r, error } = await supabase.from('objects').update(patch).eq('id', id).select().single()
    if (error) throw error
    const i = items.value.findIndex((x) => x.id === id)
    if (i !== -1) items.value[i] = fromRow(r)
  }

  const getById = (id) => items.value.find((o) => o.id === id)

  return { items, loading, load, add, update, remove, togglePublished, getById }
})
