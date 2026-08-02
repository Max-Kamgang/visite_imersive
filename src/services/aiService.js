/**
 * Service IA pour l'amélioration de description et la génération de SEO.
 *
 * ⚠️ SÉCURITÉ : on n'appelle JAMAIS Claude directement depuis le frontend
 * (la clé API serait exposée). Ces fonctions appellent un endpoint backend
 * (configuré via VITE_AI_API_BASE) qui, lui, détient la clé côté serveur.
 *
 * Tant qu'aucun backend n'est configuré, un fallback local (mock) est utilisé
 * pour que l'interface reste pleinement démontrable.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Exemple d'endpoint backend (Node/Express + SDK officiel @anthropic-ai/sdk) :
 *
 *   import Anthropic from '@anthropic-ai/sdk'
 *   const client = new Anthropic() // lit ANTHROPIC_API_KEY côté serveur
 *
 *   app.post('/ai/improve-description', async (req, res) => {
 *     const { text, nom } = req.body
 *     const msg = await client.messages.create({
 *       model: 'claude-opus-4-8',
 *       max_tokens: 1024,
 *       thinking: { type: 'adaptive' },
 *       system: "Tu es un médiateur culturel. Améliore et corrige la description " +
 *               "d'un objet de musée : style clair, vivant, sans inventer de faits.",
 *       messages: [{ role: 'user', content: `Objet : ${nom}\n\nDescription à améliorer :\n${text}` }],
 *     })
 *     res.json({ text: msg.content.find(b => b.type === 'text')?.text ?? text })
 *   })
 *
 *   // Pour le SEO, préférer une sortie structurée (output_config.format / json_schema)
 *   // afin d'obtenir directement { title, description, slug, keywords }.
 * ───────────────────────────────────────────────────────────────────────────
 */

const API_BASE = import.meta.env.VITE_AI_API_BASE || ''

function slugify(text) {
  return (text || '')
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

async function postJson(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Erreur IA (${res.status})`)
  return res.json()
}

/** Améliore / corrige une description d'objet. */
export async function improveDescription({ nom, description }) {
  if (!description || !description.trim()) return description

  if (API_BASE) {
    const data = await postJson('/ai/improve-description', { nom, text: description })
    return data.text
  }

  // Fallback local (mock) — petites corrections de présentation + enrichissement léger.
  await delay(700)
  const cleaned = description.trim().replace(/\s+/g, ' ')
  const phrase = cleaned.endsWith('.') ? cleaned : `${cleaned}.`
  return (
    `${capitalize(phrase)} ` +
    `Pièce emblématique${nom ? ` autour de « ${nom} »` : ''}, elle invite le visiteur ` +
    `à découvrir son histoire et son contexte de création. (Texte amélioré — démo IA locale)`
  )
}

/** Génère les métadonnées SEO à partir du nom + description. */
export async function generateSeo({ nom, description }) {
  if (API_BASE) {
    return postJson('/ai/generate-seo', { nom, description })
  }

  // Fallback local (mock).
  await delay(700)
  const base = (description || '').trim().replace(/\s+/g, ' ')
  const shortDesc = base.length > 150 ? `${base.slice(0, 147)}…` : base
  const keywords = buildKeywords(nom, base)
  return {
    title: nom ? `${nom} — MUSÉA` : 'Objet — MUSÉA',
    description:
      shortDesc ||
      `Découvrez ${nom || 'cet objet'} en visite immersive : histoire, contexte et modèle 3D.`,
    slug: slugify(nom) || slugify(base).slice(0, 40),
    keywords
  }
}

function buildKeywords(nom, description) {
  const stop = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'à', 'au', 'aux',
    'en', 'dans', 'sur', 'par', 'pour', 'avec', 'son', 'sa', 'ses', 'ce', 'cette'
  ])
  const words = `${nom || ''} ${description || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w))
  return [...new Set(words)].slice(0, 6)
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
