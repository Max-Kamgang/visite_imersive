import { useAuthStore } from '@/stores/useAuthStore'

// ---------------------------------------------------------------
// Multi-tenant — cadrage des requêtes de l'ERP sur SON organisation.
//
// La sécurité réelle est en base (RLS) : elle empêche déjà toute écriture
// croisée et masque les brouillons des autres organisations. Mais la lecture
// du contenu *publié* reste ouverte (c'est nécessaire au site public) : sans
// ce filtre, l'ERP afficherait les musées publiés des autres chefferies.
// ---------------------------------------------------------------

// Restreint une requête Supabase à l'organisation de l'utilisateur.
// Le super-admin de la plateforme n'est pas filtré : il voit tout.
export function scopeToTenant(query) {
  const auth = useAuthStore()
  if (auth.isSuperAdmin) return query
  // Sans organisation, on ne renvoie rien plutôt que tout (principe de prudence).
  return query.eq('tenant_id', auth.tenantId ?? -1)
}

// Identifiant à poser explicitement lors d'une insertion.
// (Un trigger en base le fait aussi ; ceci garde le store cohérent en mémoire.)
export function currentTenantId() {
  return useAuthStore().tenantId ?? null
}
