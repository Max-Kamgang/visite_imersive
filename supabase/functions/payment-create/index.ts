// Edge Function « payment-create » — initialise un paiement réel (CinetPay).
//
// Flux : le frontend crée d'abord la commande (statut en_attente) puis appelle cette
// fonction. On génère une référence de transaction, on la stocke sur la commande, on
// demande à CinetPay une URL de paiement (mobile money / carte) et on la renvoie au
// frontend qui redirige l'utilisateur. La confirmation se fait ensuite via le webhook
// « payment-webhook » (source de vérité), jamais côté client.
//
// verify_jwt = true (défaut) : seul un visiteur connecté peut initier un paiement.
//
// Secrets requis (sinon la fonction répond { simulated: true } et le frontend garde la
// simulation) : CINETPAY_API_KEY, CINETPAY_SITE_ID.
// Optionnels : CINETPAY_CURRENCY (défaut XAF), PAYMENT_XAF_PER_EUR (défaut 655.957 — peg fixe).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const CINETPAY_INIT = 'https://api-checkout.cinetpay.com/v2/payment'

// € → XAF (franc CFA d'Afrique centrale). Le XAF est pégé à l'euro (1 € = 655,957 XAF).
// CinetPay exige un montant entier, multiple de 5 pour le XAF/XOF.
function eurToXaf(totalEur: number): number {
  const rate = Number(Deno.env.get('PAYMENT_XAF_PER_EUR') || '655.957')
  const raw = totalEur * rate
  return Math.max(5, Math.round(raw / 5) * 5)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const body = await req.json().catch(() => ({}))
    const orderId = Number(body.orderId)
    const returnUrl = String(body.returnUrl || '') // page de retour côté site public
    if (!orderId) return json({ error: 'orderId requis' }, 400)

    // 1) Identité du visiteur (JWT validé par la gateway ; on récupère l'user id).
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'non authentifié' }, 401)

    // 2) La commande doit appartenir au visiteur et être en attente.
    const admin = createClient(SUPABASE_URL, SERVICE)
    const { data: order, error: e1 } = await admin.from('orders').select('*').eq('id', orderId).single()
    if (e1 || !order) return json({ error: 'commande introuvable' }, 404)
    if (order.user_id !== user.id) return json({ error: 'commande non autorisée' }, 403)
    if (order.statut !== 'en_attente') return json({ error: 'commande déjà traitée' }, 409)

    // 3) Sans clés CinetPay → on signale au frontend de rester en simulation.
    const apikey = Deno.env.get('CINETPAY_API_KEY')
    const siteId = Deno.env.get('CINETPAY_SITE_ID')
    if (!apikey || !siteId) return json({ simulated: true })

    // 4) Référence de transaction (idempotente : réutilise celle déjà posée).
    const ref = order.payment_ref || `MUSEA-${orderId}-${crypto.randomUUID().slice(0, 8)}`
    const currency = Deno.env.get('CINETPAY_CURRENCY') || 'XAF'
    const amount = eurToXaf(Number(order.total))

    await admin.from('orders').update({
      payment_ref: ref, payment_provider: 'cinetpay',
    }).eq('id', orderId).eq('statut', 'en_attente')

    // 5) Initialisation CinetPay.
    const notifyUrl = `${SUPABASE_URL}/functions/v1/payment-webhook`
    const initRes = await fetch(CINETPAY_INIT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey,
        site_id: siteId,
        transaction_id: ref,
        amount,
        currency,
        description: `MUSEA — commande #${orderId}`,
        notify_url: notifyUrl,
        return_url: returnUrl || `${SUPABASE_URL}`,
        channels: 'ALL', // mobile money + carte
        metadata: String(orderId),
        customer_email: user.email ?? '',
      }),
    })
    const data = await initRes.json().catch(() => ({}))
    const paymentUrl = data?.data?.payment_url
    if (!initRes.ok || !paymentUrl) {
      console.error('[payment-create] cinetpay init', initRes.status, JSON.stringify(data))
      return json({ error: 'init paiement échouée', detail: data?.message || null }, 502)
    }

    return json({ payment_url: paymentUrl, ref, amount, currency })
  } catch (e) {
    console.error('[payment-create]', String(e))
    return json({ error: 'erreur serveur' }, 500)
  }
})
