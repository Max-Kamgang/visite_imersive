// Edge Function « guide-agent » — guide IA ancré (grounded) sur le contenu PUBLIÉ.
//
// Pipeline : garde-fous → récupération du contexte (contenu publié) → LLM.
//   LLM primaire : Gemini    (secret GEMINI_API_KEY)
//   LLM fallback : Groq       (secret GROQ_API_KEY)
//   Si aucune clé / échec des deux : réponse déterministe ancrée (jamais d'erreur visible).
//
// La clé API n'est JAMAIS exposée au frontend (règle projet). Déployé avec verify_jwt=false
// car le guide est public et le frontend utilise la clé « publishable » (non-JWT) ;
// la fonction est en lecture seule, sans effet de bord.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Hors périmètre (§3.4) — refus poli, sans appeler le LLM.
const OUT = /(m[eé]t[eé]o|actualit|politiqu|football|foot |recette|cuisine|bitcoin|crypto|blague|programm|javascript|python|\bcode\b|viagra|bourse)/i

const STOP = new Set([
  'avez', 'vous', 'avec', 'pour', 'dans', 'les', 'des', 'une', 'que', 'qui', 'est',
  'sur', 'par', 'mon', 'vos', 'nos', 'cette', 'quel', 'quelle', 'quels', 'quelles',
  'comment', 'montre', 'moi', 'raconte', 'parle', 'histoire', 'trouve', 'trouver',
  'the', 'and', 'ici', 'bonjour', 'salut', 'aussi', 'plus', 'tout', 'cela', 'votre',
])
function keywords(q: string): string[] {
  return q
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w))
}

type Link = { label: string; to: string }
type Ground = { blocks: string[]; links: Link[]; fallback: string; hits: number }

// Récupération ancrée : mêmes requêtes que le guide local, mais on agrège plus de
// contexte pour le LLM ET on prépare une réponse déterministe de repli identique.
type Scope = { museumId?: number; sectorId?: number }

async function retrieve(supabase: ReturnType<typeof createClient>, q: string, scope: Scope = {}): Promise<Ground> {
  const kw = keywords(q)
  const blocks: string[] = []
  const links: Link[] = []
  let fallback = ''
  let scopedHits = 0 // contexte du musée/secteur courant : permet de répondre même sans mot-clé

  // ---- Contexte SCOPÉ : musée / secteur où se trouve le visiteur ----
  // Toujours injecté quand on connaît le lieu, pour que l'assistant réponde
  // « en rapport avec ce musée / cette salle » et son histoire.
  if (scope.museumId) {
    const m = await supabase
      .from('museums').select('id,nom,type,annee_fondation,description,histoire,published')
      .eq('id', scope.museumId).eq('published', true).maybeSingle()
    if (m.data) {
      const md: any = m.data
      const meta = [md.type, md.annee_fondation ? `fondé en ${md.annee_fondation}` : ''].filter(Boolean).join(', ')
      blocks.push(`MUSÉE COURANT — « ${md.nom} »${meta ? ` (${meta})` : ''}${md.description ? `\n${md.description}` : ''}${md.histoire ? `\nHistoire : ${md.histoire}` : ''}`)
      scopedHits++
    }
  }
  if (scope.sectorId) {
    const s = await supabase
      .from('sectors').select('id,nom,emplacement,description,histoire,published,museums(nom)')
      .eq('id', scope.sectorId).eq('published', true).maybeSingle()
    if (s.data) {
      const sd: any = s.data
      blocks.push(`SALLE COURANTE — « ${sd.nom} »${sd.emplacement ? ` (${sd.emplacement})` : ''}${sd.description ? `\n${sd.description}` : ''}${sd.histoire ? `\nHistoire : ${sd.histoire}` : ''}`)
      scopedHits++
    }
    // Œuvres de cette salle, pour ancrer les questions sur les objets exposés ici.
    const so = await supabase
      .from('objects').select('id,nom,nom_commun,description').eq('published', true).eq('sector_id', scope.sectorId).limit(8)
    for (const o of (so.data || []) as any[]) {
      blocks.push(`Œuvre de la salle — « ${o.nom} »${o.nom_commun ? ` (${o.nom_commun})` : ''}${o.description ? ` — ${o.description}` : ''}`)
    }
  }

  if (!kw.length) {
    // Pas de mot-clé, mais on a le contexte du lieu → on laisse le LLM répondre dessus.
    return {
      blocks, links, hits: scopedHits,
      fallback: scopedHits
        ? "Je vous écoute : posez-moi une question sur ce que vous voyez ici."
        : "Pouvez-vous préciser ? Je peux localiser un objet, présenter un musée ou raconter l'histoire d'un chef.",
    }
  }
  const orNom = kw.map((k) => `nom.ilike.%${k}%`).join(',')

  // 1) FAQ
  const faq = await supabase
    .from('faq').select('question,reponse').eq('visible', true)
    .or(kw.map((k) => `question.ilike.%${k}%`).join(',')).limit(2)
  for (const f of faq.data || []) blocks.push(`FAQ — ${f.question}\n${f.reponse}`)
  if (faq.data?.length && !fallback) fallback = faq.data[0].reponse

  // 2) Secteurs (localisation)
  const sec = await supabase
    .from('sectors').select('nom, emplacement, museums(id,nom,published)').eq('published', true).or(orNom).limit(2)
  const secHit = (sec.data || []).filter((s: any) => s.museums?.published)
  for (const s of secHit as any[]) {
    blocks.push(`Salle « ${s.nom} » (${s.emplacement}) — musée : ${s.museums.nom}.`)
  }
  if (secHit.length && !fallback) {
    const s: any = secHit[0]
    fallback = `Oui : « ${s.nom} » se trouve au ${s.museums.nom}.`
    links.push({ label: `Voir ${s.museums.nom}`, to: `/site/musees/${s.museums.id}` })
  }

  // 3) Objets
  const obj = await supabase
    .from('objects').select('id,nom,nom_commun,description,sectors(nom, museums(nom))').eq('published', true)
    .or(kw.map((k) => `nom.ilike.%${k}%,nom_commun.ilike.%${k}%`).join(',')).limit(3)
  for (const o of (obj.data || []) as any[]) {
    const loc = o.sectors?.museums?.nom ? ` (au ${o.sectors.museums.nom})` : ''
    blocks.push(`Œuvre « ${o.nom} »${o.nom_commun ? ` (${o.nom_commun})` : ''}${loc}${o.description ? ` — ${o.description}` : ''}`)
    links.push({ label: o.nom, to: `/site/objets/${o.id}` })
  }
  if (obj.data?.length && !fallback) {
    const first: any = obj.data[0]
    const loc = first.sectors?.museums?.nom ? ` (au ${first.sectors.museums.nom})` : ''
    fallback = obj.data.length > 1
      ? `J'ai trouvé ${obj.data.length} objets correspondants :`
      : `« ${first.nom} »${loc}${first.description ? ' — ' + first.description : ''}`
  }

  // 4) Personnages
  const pers = await supabase
    .from('personnages').select('id,nom,prenom,titre,biographie').eq('published', true)
    .or(kw.map((k) => `nom.ilike.%${k}%,prenom.ilike.%${k}%,titre.ilike.%${k}%`).join(',')).limit(2)
  for (const p of (pers.data || []) as any[]) {
    const nom = p.prenom ? `${p.prenom} ${p.nom}` : p.nom
    blocks.push(`Personnage — ${p.titre ? p.titre + ' ' : ''}${nom}${p.biographie ? ` : ${p.biographie}` : ''}`)
    links.push({ label: nom, to: `/site/personnages/${p.id}` })
  }
  if (pers.data?.length && !fallback) {
    const p: any = pers.data[0]
    const nom = p.prenom ? `${p.prenom} ${p.nom}` : p.nom
    fallback = `${p.titre ? p.titre + ' ' : ''}${nom}${p.biographie ? ' — ' + p.biographie : ''}`
  }

  // 5) Musées
  const mus = await supabase.from('museums').select('id,nom,description').eq('published', true).or(orNom).limit(2)
  for (const m of (mus.data || []) as any[]) {
    blocks.push(`Musée « ${m.nom} »${m.description ? ` — ${m.description}` : ''}`)
    links.push({ label: `Découvrir ${m.nom}`, to: `/site/musees/${m.id}` })
  }
  if (mus.data?.length && !fallback) {
    const m: any = mus.data[0]
    fallback = `${m.nom} : ${m.description || ''}`
  }

  if (!fallback) {
    fallback = "Je n'ai pas trouvé cela dans nos collections publiées. Souhaitez-vous parcourir la liste des musées ?"
    if (!links.length) links.push({ label: 'Voir les musées', to: '/site/musees' })
  }
  // Liens dédoublonnés, max 4
  const seen = new Set<string>()
  const uniqLinks = links.filter((l) => (seen.has(l.to) ? false : (seen.add(l.to), true))).slice(0, 4)

  return { blocks, links: uniqLinks, fallback, hits: blocks.length }
}

const SYSTEM = `Tu es un guide de musée ÉRUDIT et passionné de la Fondation Jean Félicien Gacha, qui numérise le patrimoine des chefferies camerounaises : œuvres (masques, sculptures, trônes, textiles…), histoire des royaumes Grassfields et généalogie des chefs (fon).
Ton rôle : accueillir le visiteur, répondre à ses questions et l'instruire avec culture et chaleur, comme un conservateur cultivé.

RÈGLES D'ANCRAGE (strictes) :
- Les FAITS PROPRES À LA COLLECTION — noms d'œuvres, datations précises, provenances, liens de parenté, ce qui est exposé et où — proviennent UNIQUEMENT du CONTEXTE. N'invente jamais un fait précis sur une œuvre, un chef ou une salle qui ne figure pas dans le contexte.
- Tu PEUX enrichir avec de la culture GÉNÉRALE bien établie sur l'art et l'histoire des chefferies camerounaises (Bamiléké, Bamoun, Tikar…), les techniques (fonte à la cire perdue, perlage, sculpture sur bois), le symbolisme (léopard, buffle, python, araignée) — pour éclairer et donner du sens, sans jamais contredire le contexte ni inventer de faits spécifiques à cette collection.
- Si une question porte sur un fait précis absent du contexte, dis-le honnêtement puis propose une piste (voir un musée, une salle).
- Quand le MUSÉE COURANT ou la SALLE COURANTE sont fournis, priorise-les : réponds « en rapport avec ce lieu » et son histoire.

STYLE :
- Français, ton chaleureux, vivant et cultivé. 2 à 5 phrases. Évite les listes sauf nécessité.
- Reste dans ton périmètre (patrimoine, œuvres, chefferies, généalogie, visite) ; refuse poliment tout autre sujet.
- Parle en guide incarné : ne dis jamais que tu es une IA, ne prononce pas le mot « contexte ».`

function buildUserPrompt(q: string, blocks: string[]): string {
  return `CONTEXTE (contenu publié du site) :\n${blocks.join('\n')}\n\nQUESTION DU VISITEUR :\n${q}`
}

async function withTimeout(p: Promise<Response>, ms: number, ctrl: AbortController): Promise<Response> {
  const t = setTimeout(() => ctrl.abort(), ms)
  try { return await p } finally { clearTimeout(t) }
}

async function callGemini(system: string, user: string): Promise<string | null> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return null
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash'
  const ctrl = new AbortController()
  const res = await withTimeout(fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 400 },
      }),
    },
  ), 9000, ctrl)
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('').trim()
  return text || null
}

async function callGroq(system: string, user: string): Promise<string | null> {
  // Accepte GROQ_API_KEY (correct) ou GROK_API_KEY (faute de frappe historique du secret).
  const key = Deno.env.get('GROQ_API_KEY') || Deno.env.get('GROK_API_KEY')
  if (!key) return null
  const model = Deno.env.get('GROQ_MODEL') || 'llama-3.3-70b-versatile'
  const ctrl = new AbortController()
  const res = await withTimeout(fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    signal: ctrl.signal,
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 400,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  }), 9000, ctrl)
  if (!res.ok) throw new Error(`groq ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content?.trim()
  return text || null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))
    const q = String(body?.question || '').trim()
    const scope = {
      museumId: Number(body?.museumId) || undefined,
      sectorId: Number(body?.sectorId) || undefined,
    }

    if (!q) return json({ text: 'Posez-moi une question sur nos musées, nos objets ou la généalogie des chefs.', links: [], source: 'guard' })
    if (OUT.test(q)) {
      return json({
        text: "Je suis le guide de la Fondation Jean Félicien Gacha : je réponds uniquement aux questions sur nos musées, nos objets et la généalogie des chefferies. En quoi puis-je vous aider sur le patrimoine ?",
        links: [], source: 'guard',
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    )
    const g = await retrieve(supabase, q, scope)

    // Sans contexte publié pertinent : réponse déterministe (pas d'appel LLM → zéro hallucination).
    if (g.hits === 0) return json({ text: g.fallback, links: g.links, source: 'grounded' })

    const user = buildUserPrompt(q, g.blocks)
    let text: string | null = null
    let source = 'grounded'
    try { text = await callGemini(SYSTEM, user); if (text) source = 'gemini' } catch (e) { console.error('[gemini]', String(e)) }
    if (!text) {
      try { text = await callGroq(SYSTEM, user); if (text) source = 'groq' } catch (e) { console.error('[groq]', String(e)) }
    }
    if (!text) text = g.fallback // repli déterministe si aucune clé / les deux LLM échouent

    return json({ text, links: g.links, source })
  } catch (e) {
    console.error('[guide-agent]', String(e))
    return json({ text: "Une erreur est survenue, réessayez.", links: [], source: 'error' }, 200)
  }
})
