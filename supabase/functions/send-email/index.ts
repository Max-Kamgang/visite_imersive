// Edge Function : e-mails transactionnels via Resend.
// La clé API reste 100 % côté serveur (secret RESEND_API_KEY) — jamais dans le frontend.
//
// Types gérés : recu_commande | acces_debloque | organisation_approuvee | bienvenue
//
// Sans clé configurée, la fonction répond 200 { skipped: true } : l'application
// continue de fonctionner normalement, seul l'e-mail n'est pas envoyé.
//
// IMPORTANT (offre gratuite Resend) : tant qu'aucun domaine n'est vérifié, on ne peut
// écrire QU'À l'adresse du titulaire du compte, depuis onboarding@resend.dev.
// Une fois le domaine vérifié, poser RESEND_FROM="MUSÉA <contact@votredomaine.cm>".

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

const money = (v: unknown, d = '€') =>
  `${Number(v || 0).toLocaleString('fr-FR')} ${esc(d)}`

// ---------- Gabarit commun (sobre, lisible sur tous les clients mail) ----------
function layout(opts: { titre: string; corps: string; marque: string; couleur: string; lien?: string; lienTexte?: string; desinscription?: string }) {
  const { titre, corps, marque, couleur, lien, lienTexte, desinscription } = opts
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f3;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#101210">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f3;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e8e9e6;border-radius:10px;overflow:hidden">
        <tr><td style="background:${couleur};padding:22px 28px">
          <div style="color:#fff;font-size:20px;font-weight:800;letter-spacing:.04em">${esc(marque)}</div>
        </td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 14px;font-size:20px;line-height:1.25">${esc(titre)}</h1>
          ${corps}
          ${lien ? `<div style="margin-top:24px"><a href="${esc(lien)}" style="display:inline-block;background:${couleur};color:#fff;text-decoration:none;padding:12px 22px;border-radius:4px;font-weight:700;font-size:14px">${esc(lienTexte || 'Ouvrir')}</a></div>` : ''}
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid #eef0ed;color:#7c817b;font-size:12px">
          ${esc(marque)} — message automatique, merci de ne pas y répondre.
          ${desinscription ? `<br><a href="${esc(desinscription)}" style="color:#7c817b">Se désinscrire de ces e-mails</a>` : ''}
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`
}

function ligneArticles(items: Array<Record<string, unknown>>, devise: string) {
  return items.map((i) =>
    `<tr>
       <td style="padding:8px 0;border-bottom:1px solid #eef0ed;font-size:14px">${esc(i.label)}</td>
       <td style="padding:8px 0;border-bottom:1px solid #eef0ed;font-size:14px;text-align:right;white-space:nowrap"><strong>${money(i.montant, devise)}</strong></td>
     </tr>`).join('')
}

// ---------- Construction du message selon le type ----------
function build(type: string, d: Record<string, any>) {
  const marque = d.marque || 'MUSÉA'
  const couleur = d.couleur || '#0e6f5c'

  if (type === 'recu_commande') {
    const items = Array.isArray(d.items) ? d.items : []
    const corps = `
      <p style="margin:0 0 16px;line-height:1.6;font-size:15px">Bonjour${d.prenom ? ' ' + esc(d.prenom) : ''}, merci pour votre commande.</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px">
        ${ligneArticles(items, d.devise || '€')}
        <tr>
          <td style="padding:12px 0;font-size:15px"><strong>Total</strong></td>
          <td style="padding:12px 0;font-size:18px;text-align:right"><strong>${money(d.total, d.devise || '€')}</strong></td>
        </tr>
      </table>
      <p style="margin:14px 0 0;color:#5c615c;font-size:13px">Commande n°${esc(d.orderId)} — ${esc(d.date || '')}</p>`
    return {
      sujet: `Votre commande n°${d.orderId} — ${marque}`,
      html: layout({ titre: 'Reçu de votre commande', corps, marque, couleur, lien: d.lien, lienTexte: 'Voir mes accès' })
    }
  }

  if (type === 'acces_debloque') {
    const corps = `
      <p style="margin:0 0 16px;line-height:1.6;font-size:15px">Bonjour${d.prenom ? ' ' + esc(d.prenom) : ''}, votre accès est désormais actif.</p>
      <p style="margin:0 0 8px;line-height:1.6;font-size:15px"><strong>${esc(d.libelle)}</strong></p>
      ${d.expiration ? `<p style="margin:0;color:#5c615c;font-size:13px">Valable jusqu'au ${esc(d.expiration)}.</p>` : ''}`
    return {
      sujet: `Votre accès est actif — ${marque}`,
      html: layout({ titre: 'Accès débloqué', corps, marque, couleur, lien: d.lien, lienTexte: 'Commencer la visite' })
    }
  }

  if (type === 'organisation_approuvee') {
    const corps = `
      <p style="margin:0 0 16px;line-height:1.6;font-size:15px">Bonne nouvelle : l'espace de <strong>${esc(d.nomOrganisation)}</strong> vient d'être approuvé.</p>
      <p style="margin:0 0 16px;line-height:1.6;font-size:15px">Votre site public est en ligne à l'adresse :<br>
        <a href="${esc(d.lien)}" style="color:${couleur}">${esc(d.lien)}</a></p>`
    return {
      sujet: `Votre espace est en ligne — ${marque}`,
      html: layout({ titre: 'Votre organisation est approuvée', corps, marque, couleur, lien: d.lien, lienTexte: 'Voir mon site' })
    }
  }

  // Campagne aux visiteurs (V2 Phase 4). Contenu saisi/assisté côté ERP : on le reçoit
  // en TEXTE BRUT et on l'échappe intégralement — aucun HTML de l'admin n'est interprété.
  if (type === 'campagne') {
    const paragraphes = String(d.contenu || '')
      .split(/\n\s*\n/)
      .map((p: string) => p.trim())
      .filter(Boolean)
      .map((p: string) => `<p style="margin:0 0 16px;line-height:1.65;font-size:15px">${esc(p).replace(/\n/g, '<br>')}</p>`)
      .join('')
    const corps = `
      ${d.prenom ? `<p style="margin:0 0 16px;line-height:1.6;font-size:15px">Bonjour ${esc(d.prenom)},</p>` : ''}
      ${paragraphes}
      ${d.image ? `<img src="${esc(d.image)}" alt="" style="width:100%;border-radius:8px;margin:8px 0 4px">` : ''}`
    return {
      sujet: `${esc(d.sujet || marque)}`,
      html: layout({
        titre: d.titre || d.sujet || marque,
        corps, marque, couleur,
        lien: d.lien, lienTexte: d.lienTexte || 'En savoir plus',
        desinscription: d.desinscription
      })
    }
  }

  if (type === 'bienvenue') {
    const corps = `
      <p style="margin:0 0 16px;line-height:1.6;font-size:15px">Bienvenue ! L'espace de <strong>${esc(d.nomOrganisation)}</strong> a bien été créé.</p>
      <p style="margin:0 0 16px;line-height:1.6;font-size:15px">Il est en cours de validation. Vous pourrez préparer vos contenus dès maintenant ;
      votre site public sera visible une fois l'espace approuvé.</p>`
    return {
      sujet: `Votre espace a été créé — ${marque}`,
      html: layout({ titre: 'Espace créé', corps, marque, couleur, lien: d.lien, lienTexte: 'Ouvrir mon espace' })
    }
  }

  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: Record<string, any>
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }

  const { type, to, tenantId, orderId, ...data } = body || {}
  if (!type || !to) return json({ error: 'missing_fields' }, 400)

  const message = build(String(type), data)
  if (!message) return json({ error: 'unknown_type' }, 400)

  const key = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM') || 'MUSÉA <onboarding@resend.dev>'

  // Journalisation (service role : contourne la RLS en écriture).
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
  const log = async (statut: string, erreur?: string, providerId?: string) => {
    try {
      await admin.from('email_log').insert({
        tenant_id: tenantId ?? null, type, destinataire: to, sujet: message.sujet,
        statut, erreur: erreur ?? null, order_id: orderId ?? null, provider_id: providerId ?? null
      })
    } catch { /* le journal ne doit jamais bloquer l'envoi */ }
  }

  // Pas de clé configurée : on ne bloque pas l'application.
  if (!key) {
    await log('desactive', 'RESEND_API_KEY absente')
    return json({ skipped: true, reason: 'no_api_key' })
  }

  let r: Response
  try {
    r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: message.sujet, html: message.html })
    })
  } catch (e) {
    await log('echec', `reseau: ${String(e).slice(0, 200)}`)
    return json({ error: 'network' }, 502)
  }

  const payload = await r.json().catch(() => ({}))
  if (!r.ok) {
    await log('echec', `${r.status}: ${JSON.stringify(payload).slice(0, 300)}`)
    return json({ error: 'resend_error', status: r.status, detail: payload }, 502)
  }

  await log('envoye', undefined, payload?.id)
  return json({ ok: true, id: payload?.id })
})
