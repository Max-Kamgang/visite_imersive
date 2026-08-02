import { createClient } from '@supabase/supabase-js'

// Client Supabase (backend MUSÉA). La clé publiable est prévue pour être exposée
// côté frontend ; l'accès réel est contrôlé par les policies RLS côté serveur.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  // eslint-disable-next-line no-console
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants — voir .env')
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Récupère la session depuis l'URL au retour d'un login OAuth (Google), puis nettoie l'URL.
    detectSessionInUrl: true,
    // PKCE : flux OAuth recommandé pour une SPA (échange de code sécurisé, pas de jeton en clair dans l'URL).
    flowType: 'pkce'
  }
})
