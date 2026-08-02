// Accès client à l'Edge Function « memory-search » (Mémoire Réunifiée, Phase 5).
//
// Rappel de la règle du projet : aucune clé de modèle dans le navigateur. La
// traduction et la synthèse se font donc côté serveur, et tout ce qui suit
// dégrade proprement — sans clé, l'ERP reste utilisable à la main.

const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const memoryAiDisponible = !!SUPA_URL

async function appeler(payload) {
  if (!SUPA_URL) return { ok: false, error: 'no_backend' }
  try {
    const res = await fetch(`${SUPA_URL}/functions/v1/memory-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) return { ok: false, error: `http_${res.status}` }
    return await res.json()
  } catch (e) {
    console.warn('[memory-search]', e.message)
    return { ok: false, error: 'network' }
  }
}

// Requête en français → termes de catalogage anglais + culture, pays, matériaux.
export function enrichirRequete({ requete, culture, pays, materiau, periode }) {
  return appeler({ action: 'enrichir', requete, culture, pays, materiau, periode })
}

// Bilan sourcé des correspondances trouvées.
export function synthetiser({ objet, candidats }) {
  return appeler({
    action: 'synthese',
    objet,
    // On n'envoie que les champs que la synthèse doit citer : titre, musée,
    // pays, inventaire, date, matière, score. Rien d'autre ne la regarde.
    candidats: (candidats || []).slice(0, 30).map((c) => ({
      title: c.title, musee: c.musee, sourceLabel: c.sourceLabel,
      paysMusee: c.paysMusee, inventaire: c.inventaire,
      date: c.date, medium: c.medium, score: c.score
    }))
  })
}

// Termes réellement envoyés aux collections : les expressions anglaises d'abord,
// puis culture et pays, puis les synonymes vernaculaires. L'ordre compte —
// les adaptateurs s'arrêtent dès qu'ils ont atteint leur quota de résultats.
export function termesDeRecherche(enrichi) {
  if (!enrichi?.ok) return []
  const out = [
    ...(enrichi.termes_en || []),
    enrichi.culture,
    enrichi.pays,
    ...(enrichi.synonymes || [])
  ]
  const vus = new Set()
  return out
    .map((t) => String(t || '').trim())
    .filter((t) => {
      if (!t || vus.has(t.toLowerCase())) return false
      vus.add(t.toLowerCase())
      return true
    })
}
