// Edge Function « payment-webhook » — notification serveur-à-serveur de CinetPay.
//
// verify_jwt = false : CinetPay ne peut pas envoyer de JWT Supabase. La sécurité vient
// de la RE-VÉRIFICATION du statut auprès de CinetPay (API /v2/payment/check avec NOTRE
// apikey + site_id) : un attaquant ne peut pas forger un statut « ACCEPTED ». On vérifie
// aussi que le montant payé correspond au montant attendu de la commande.
//
// Confirmation via confirm_order_service (service_role) → commande payée + accès débloqués.
// Toujours répondre 200 pour que CinetPay cesse ses relances une fois traité.
//
// Secrets requis : CINETPAY_API_KEY, CINETPAY_SITE_ID (+ auto : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const CINETPAY_CHECK = 'https://api-checkout.cinetpay.com/v2/payment/check'

function eurToXaf(totalEur: number): number {
  const rate = Number(Deno.env.get('PAYMENT_XAF_PER_EUR') || '655.957')
  return Math.max(5, Math.round((totalEur * rate) / 5) * 5)
}

async function readTransId(req: Request): Promise<string> {
  const ct = req.headers.get('content-type') || ''
  try {
    if (ct.includes('application/json')) {
      const b = await req.json()
      return String(b.cpm_trans_id || b.transaction_id || '')
    }
    const form = await req.formData()
    return String(form.get('cpm_trans_id') || form.get('transaction_id') || '')
  } catch {
    return ''
  }
}

Deno.serve(async (req) => {
  // CinetPay teste parfois l'URL en GET/HEAD.
  if (req.method !== 'POST') return new Response('OK', { status: 200 })
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const apikey = Deno.env.get('CINETPAY_API_KEY')
    const siteId = Deno.env.get('CINETPAY_SITE_ID')

    const transId = await readTransId(req)
    if (!transId || !apikey || !siteId) return new Response('OK', { status: 200 })

    // 1) Vérification autoritative auprès de CinetPay.
    const checkRes = await fetch(CINETPAY_CHECK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey, site_id: siteId, transaction_id: transId }),
    })
    const check = await checkRes.json().catch(() => ({}))
    const status = check?.data?.status // ACCEPTED | REFUSED | ...
    const paidAmount = Number(check?.data?.amount ?? 0)
    const opId = check?.data?.operator_id || check?.data?.payment_method || null

    if (status !== 'ACCEPTED') {
      console.log('[payment-webhook] non ACCEPTED', transId, status)
      return new Response('OK', { status: 200 })
    }

    // 2) Retrouver la commande par la référence + contrôler le montant.
    const admin = createClient(SUPABASE_URL, SERVICE)
    const { data: order } = await admin.from('orders').select('*').eq('payment_ref', transId).single()
    if (!order) {
      console.error('[payment-webhook] commande introuvable pour', transId)
      return new Response('OK', { status: 200 })
    }
    const expected = eurToXaf(Number(order.total))
    if (paidAmount && Math.abs(paidAmount - expected) > 1) {
      console.error('[payment-webhook] montant incohérent', transId, paidAmount, '≠', expected)
      return new Response('OK', { status: 200 })
    }

    // 3) Confirmation (idempotente) → accès débloqués.
    const { error } = await admin.rpc('confirm_order_service', {
      p_order_id: order.id, p_provider: 'cinetpay', p_provider_tx: opId ? String(opId) : null,
    })
    if (error) console.error('[payment-webhook] confirm_order_service', error.message)

    return new Response('OK', { status: 200 })
  } catch (e) {
    console.error('[payment-webhook]', String(e))
    return new Response('OK', { status: 200 })
  }
})
