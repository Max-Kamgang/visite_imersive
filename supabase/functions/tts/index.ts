// Edge Function : Text-To-Speech via ElevenLabs.
// La clé API reste 100 % côté serveur (secret Supabase ELEVENLABS_API_KEY) — jamais dans le frontend.
// Reçoit { text, voiceId?, modelId?, lang? } → renvoie un flux audio/mpeg (MP3).
// Tant que le secret n'est pas posé, renvoie 503 "no_api_key" → le frontend bascule sur la voix du navigateur.
//
// Durcissement production recommandé (à faire avant lancement, pour protéger le quota ElevenLabs) :
//   - limiter le débit (rate-limit par IP / utilisateur),
//   - vérifier l'accès payant (user_access) côté serveur pour l'audioguide.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

// Voix multilingue par défaut ("Sarah", douce — lit bien le français). Surchargée par le
// corps de requête (voix du musée/secteur) ou le secret ELEVENLABS_VOICE_ID.
const DEFAULT_VOICE = 'EXAVITQu4vr4xnSDxMaL'
const DEFAULT_MODEL = 'eleven_multilingual_v2'

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const key = Deno.env.get('ELEVENLABS_API_KEY')
  if (!key) {
    // Aucune clé configurée → le frontend utilisera la synthèse vocale du navigateur.
    return json({ error: 'no_api_key', message: 'ELEVENLABS_API_KEY non configurée sur le projet.' }, 503)
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }

  // Lister les voix disponibles (pour le sélecteur de voix dans l'ERP).
  if (body?.action === 'voices') {
    const lr = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key } })
    if (!lr.ok) return json({ error: 'elevenlabs_error', status: lr.status }, 502)
    const data = await lr.json()
    const voices = (data?.voices ?? []).map((v: Record<string, unknown>) => ({
      id: v.voice_id,
      name: v.name,
      category: v.category,
      labels: v.labels,
      preview: v.preview_url
    }))
    return json({ voices })
  }

  const text = String(body?.text ?? '').slice(0, 5000).trim()
  if (!text) return json({ error: 'empty_text' }, 400)

  const voiceId = String(body?.voiceId || Deno.env.get('ELEVENLABS_VOICE_ID') || DEFAULT_VOICE)
  const modelId = String(body?.modelId || Deno.env.get('ELEVENLABS_MODEL_ID') || DEFAULT_MODEL)

  let r: Response
  try {
    r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg'
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true }
      })
    })
  } catch (e) {
    return json({ error: 'network', detail: String(e).slice(0, 300) }, 502)
  }

  if (!r.ok) {
    const detail = await r.text().catch(() => '')
    return json({ error: 'elevenlabs_error', status: r.status, detail: detail.slice(0, 500) }, 502)
  }

  const audio = await r.arrayBuffer()
  return new Response(audio, {
    headers: { ...CORS, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' }
  })
})
