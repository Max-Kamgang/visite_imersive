# 🔑 Activer la connexion Google (Supabase OAuth)

Le **code est déjà fait et vérifié** (bouton « Continuer avec Google », flux PKCE, retour sur `/site/compte`, création automatique d'un profil `visitor`). Il reste **uniquement la configuration** dans deux consoles — c'est à faire une seule fois, avec **ton** compte Google.

> ⚠️ Sans ces étapes, le clic sur le bouton renvoie : `Unsupported provider: provider is not enabled`. C'est normal.

---

## Étape 1 — Google Cloud Console (créer les identifiants OAuth)

1. Va sur **https://console.cloud.google.com/** → crée/sélectionne un projet (ex. « MUSEA »).
2. **APIs & Services → OAuth consent screen** :
   - Type : **External**
   - Nom de l'app : **MUSÉA**, e-mail de support, logo (optionnel)
   - Scopes : `email`, `profile`, `openid`
   - Tant que l'app est en mode **Testing**, ajoute ton e-mail dans **Test users** (sinon « Publish app » pour ouvrir à tous).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** :
   - Application type : **Web application**
   - Name : **MUSÉA Web**
   - **Authorized JavaScript origins** :
     - `http://localhost:5173`
     - (plus tard) l'URL de production, ex. `https://musea.votredomaine.com`
   - **Authorized redirect URIs** → colle **exactement** l'URL de callback Supabase :
     ```
     https://dvwwwlqrwwzfwxukyoxz.supabase.co/auth/v1/callback
     ```
4. **Create** → note le **Client ID** et le **Client Secret**.

---

## Étape 2 — Supabase Dashboard (activer le provider)

1. **Authentication → Providers → Google** :
   `https://supabase.com/dashboard/project/dvwwwlqrwwzfwxukyoxz/auth/providers`
   - Active **Google**
   - Colle le **Client ID** et le **Client Secret** de l'étape 1
   - **Save**
2. **Authentication → URL Configuration** :
   - **Site URL** : `http://localhost:5173` (en dev ; mettre l'URL de prod plus tard)
   - **Redirect URLs** → ajoute (le `/**` autorise `/site/compte`, `/site/panier`, etc.) :
     ```
     http://localhost:5173/**
     ```
     (plus tard) `https://musea.votredomaine.com/**`

---

## Étape 3 — Tester

1. Recharge `http://localhost:5173/site/compte`
2. Clique **« Continuer avec Google »** → choix du compte Google → retour automatique sur `/site/compte`, connecté.
3. Vérifie : un profil est créé avec le rôle **`visitor`** (donc **aucun** accès à l'ERP `/`, c'est voulu).

---

## Ce que fait le code (déjà en place)

| Fichier | Rôle |
|---|---|
| `src/services/supabase.js` | Client en **flux PKCE** + `detectSessionInUrl` (échange sécurisé du code au retour, nettoyage de l'URL). |
| `src/stores/useAuthStore.js` → `signInGoogle(redirectPath)` | Lance l'OAuth Google, revient sur une **page publique** (`/site/compte` par défaut, jamais l'ERP), avec sélecteur de compte (`prompt=select_account`). |
| `src/views/public/PublicAccount.vue` | Bouton Google + rechargement des accès/commandes dès que la session Google arrive (watch sur `auth.user`). |
| Trigger `handle_new_user` (DB) | Crée le profil `visitor` avec `full_name` (Google : `full_name`/`name`, repli e-mail). |

## Notes production
- Répéter l'ajout des URLs (origins + redirect) avec le **domaine de prod** dans les deux consoles.
- Passer l'écran de consentement Google en **Published** pour ouvrir à tous les visiteurs.
- Le trigger de dev `dev_autoconfirm` (auto-confirmation e-mail) n'affecte pas Google (déjà vérifié) mais reste **à retirer en prod**.
