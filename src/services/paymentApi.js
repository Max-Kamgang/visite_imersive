import { supabase } from './supabase'
import { getPublicTenant } from './publicApi'

// Prestataire de paiement actif. Vide (défaut) = simulation (débloque réellement les accès
// via confirm_order, sans argent). Mettre VITE_PAYMENT_PROVIDER=cinetpay dans .env pour
// activer le paiement réel (nécessite les secrets CinetPay côté Edge Functions).
export const PAYMENT_PROVIDER = (import.meta.env.VITE_PAYMENT_PROVIDER || '').trim()
export const isRealPayment = !!PAYMENT_PROVIDER

// Crée la commande (statut en_attente) + ses lignes. Renvoie la commande.
export async function createOrder(userId, items, total) {
  // Organisation du site où l'achat a lieu : le visiteur n'appartenant à aucune
  // organisation, le trigger ne peut pas la deviner — on la transmet ici.
  const tenantId = getPublicTenant()

  const { data: order, error: e1 } = await supabase
    .from('orders')
    .insert({
      user_id: userId, total, statut: 'en_attente',
      moyen_paiement: PAYMENT_PROVIDER || 'simulation',
      tenant_id: tenantId
    })
    .select()
    .single()
  if (e1) throw e1

  const { error: e2 } = await supabase.from('order_items').insert(
    items.map((i) => ({
      order_id: order.id,
      type: i.type,
      ref_id: i.refId ?? null,
      museum_id: i.museumId ?? null,
      label: i.label,
      montant: i.montant,
      tenant_id: tenantId,
    }))
  )
  if (e2) throw e2
  return order
}

// Paiement simulé : confirme immédiatement (RPC côté visiteur, source de vérité RLS).
export async function confirmSimulated(orderId) {
  const { error } = await supabase.rpc('confirm_order', { p_order_id: orderId })
  if (error) throw error
}

// Paiement réel : demande une URL de paiement à l'Edge Function. Renvoie
// { paymentUrl } (à ouvrir) ou { simulated: true } si les clés ne sont pas posées.
export async function startRealPayment(orderId, returnUrl) {
  const { data, error } = await supabase.functions.invoke('payment-create', {
    body: { orderId, returnUrl },
  })
  if (error) throw error
  if (data?.simulated) return { simulated: true }
  if (!data?.payment_url) throw new Error(data?.error || 'Initialisation du paiement impossible.')
  return { paymentUrl: data.payment_url }
}

// Statut d'une commande (pour la page de retour après paiement).
export async function orderStatus(orderId) {
  const { data } = await supabase.from('orders').select('statut').eq('id', orderId).maybeSingle()
  return data?.statut || null
}
