import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/services/supabase'
import { scopeToTenant } from '@/services/tenant'
import i18n from '@/i18n'
import { useObjectStore } from './useObjectStore'

// Généalogie sur Supabase — modèle filiation directe (pere_id / mere_id).
const iFrom = (r) => ({
  id: r.id,
  nom: r.nom,
  prenom: r.prenom,
  titre: r.titre,
  sexe: r.sexe,
  lieuOrigine: r.chefferie,
  photo: r.portrait,
  biographie: r.biographie,
  naissance: r.date_naissance,
  deces: r.date_deces,
  regneDebut: r.regne_debut,
  regneFin: r.regne_fin,
  pereId: r.pere_id,
  mereId: r.mere_id,
  published: r.published
})
const iTo = (a) => ({
  nom: a.nom,
  prenom: a.prenom ?? null,
  titre: a.titre ?? null,
  sexe: a.sexe ?? null,
  chefferie: a.lieuOrigine ?? null,
  portrait: a.photo ?? null,
  biographie: a.biographie ?? null,
  date_naissance: a.naissance ?? null,
  date_deces: a.deces ?? null,
  regne_debut: a.regneDebut ?? null,
  regne_fin: a.regneFin ?? null,
  pere_id: a.parent1Id ?? a.pereId ?? null,
  mere_id: a.parent2Id ?? a.mereId ?? null,
  published: a.published ?? true
})

export const useGenealogyStore = defineStore('genealogy', () => {
  const individus = ref([])
  const migrations = ref([])
  const objetLiens = ref([]) // { id, objectId, individuId, relation }

  async function load() {
    const [p, m, l] = await Promise.all([
      scopeToTenant(supabase.from('personnages').select('*')).order('id'),
      scopeToTenant(supabase.from('migrations_historiques').select('*')).order('id'),
      scopeToTenant(supabase.from('object_personnage').select('*')).order('id')
    ])
    if (p.error) console.error('[genealogy] personnages', p.error.message)
    else individus.value = p.data.map(iFrom)
    if (m.error) console.error('[genealogy] migrations', m.error.message)
    else migrations.value = m.data.map((r) => ({
      id: r.id, individuId: r.personnage_id, lieuDepart: r.lieu_depart,
      lieuArrivee: r.lieu_arrivee, dateMigration: r.date_migration, recit: r.recit
    }))
    if (l.error) console.error('[genealogy] liens', l.error.message)
    else objetLiens.value = l.data.map((r) => ({
      id: r.id, objectId: r.object_id, individuId: r.personnage_id, relation: r.type_lien
    }))
  }

  const getIndividu = (id) => individus.value.find((i) => i.id === id)
  function nomComplet(ind) { return ind ? (ind.prenom ? `${ind.nom}, ${ind.prenom}` : ind.nom) : '—' }
  function vieOf(ind) {
    if (!ind) return ''
    if (ind.regneDebut) return i18n.global.t('admin.genealogy.reignShort', { from: ind.regneDebut, to: ind.regneFin ?? '…' })
    return [ind.naissance, ind.deces].filter(Boolean).join(' – ')
  }
  const chefs = () => individus.value.filter((i) => /Fo|Sa Majesté|Roi|Chef/i.test(i.titre || ''))

  function nodeOf(ind) {
    return { id: ind.id, nom: nomComplet(ind), titre: ind.titre, vie: vieOf(ind), photo: ind.photo || '', children: [] }
  }
  function buildAncestorTree(id, depth = 0) {
    const ind = getIndividu(id)
    if (!ind) return null
    const node = nodeOf(ind)
    if (depth >= 5) return node
    for (const pid of [ind.pereId, ind.mereId]) {
      if (pid) {
        const c = buildAncestorTree(pid, depth + 1)
        if (c) node.children.push(c)
      }
    }
    return node
  }

  function objetsLies(individuId) {
    const objects = useObjectStore()
    return objetLiens.value
      .filter((l) => l.individuId === individuId)
      .map((l) => {
        const o = objects.getById(l.objectId)
        return o ? { ...o, relation: l.relation, _linkId: l.id } : null
      })
      .filter(Boolean)
  }

  async function addMember(data, parents = {}) {
    const row = iTo({ ...data, parent1Id: parents.parent1Id, parent2Id: parents.parent2Id })
    const { data: r, error } = await supabase.from('personnages').insert(row).select().single()
    if (error) throw error
    const ind = iFrom(r)
    individus.value.push(ind)
    return ind
  }

  function linkForObject(objectId) {
    return objetLiens.value.find((l) => l.objectId === objectId) || null
  }
  async function setObjetLien(objectId, individuId, relation) {
    const had = objetLiens.value.some((l) => l.objectId === objectId)
    if (had) {
      const { error } = await supabase.from('object_personnage').delete().eq('object_id', objectId)
      if (error) throw error
      objetLiens.value = objetLiens.value.filter((l) => l.objectId !== objectId)
    }
    if (individuId) {
      const { data: r, error } = await supabase
        .from('object_personnage')
        .insert({ object_id: objectId, personnage_id: individuId, type_lien: relation || 'lié à' })
        .select().single()
      if (error) throw error
      objetLiens.value.push({ id: r.id, objectId: r.object_id, individuId: r.personnage_id, relation: r.type_lien })
    }
  }

  return {
    individus, migrations, objetLiens, load,
    getIndividu, nomComplet, vieOf, chefs, buildAncestorTree, objetsLies,
    addMember, linkForObject, setObjetLien
  }
})
