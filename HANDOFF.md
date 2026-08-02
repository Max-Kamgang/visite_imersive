> ⚠️ **Lire d'abord [`MUSEA_MASTER_PLAN.md`](MUSEA_MASTER_PLAN.md)** — document maître
> (vision, état mesuré, phases 1 à 8). Ce handoff date du 2026-07-14 : plusieurs points
> ci-dessous ont été dépassés depuis (multi-tenant, sous-domaines, campagnes, voix par secteur).

# 🏛️ MUSÉA — Résumé du projet & feuille de route

> Document de passation (handoff) — dernière mise à jour : **2026-07-14**
> Prêt à être lu par un développeur ou une autre IA pour reprendre le travail.

---

## 1. Contexte

Plateforme numérique pour la **Fondation Jean Félicien Gacha** (Cameroun). Objectif : numériser des **musées**, leurs **œuvres** (masques, sculptures…), les présenter en **3D / réalité augmentée**, retracer la **généalogie des chefferies** camerounaises, et monétiser l'accès via un **site public e-commerce** (pass de visite, audioguides, dons).

Deux applications dans un même projet Vue :
- **ERP / back-office** (`/`) — gestion du contenu par le staff (musées, secteurs, objets, tarifs, généalogie, FAQ, assistant vocal, paramètres).
- **Site public** (`/site`) — vitrine grand public, catalogue, fiches, généalogie, panier & comptes visiteurs.

Dossier projet : `C:\Users\maxib\Desktop\visite_immersive`
Langue de travail : **français**.

---

## 2. Stack technique

| Domaine | Choix |
|---|---|
| Framework | **Vue 3** (`<script setup>`) + **Vite 5** |
| UI | **PrimeVue 4** (preset Aura via `definePreset`, primary marron `#a86b2d`) + PrimeIcons |
| État | **Pinia** (setup stores) |
| Routing | **Vue Router** (`createWebHistory`, guards, meta `requiresStaff`) |
| Backend | **Supabase** (Postgres 17 + Auth + RLS) |
| Généalogie | **D3** (`d3-hierarchy`, `d3-shape`, `d3-selection`, `d3-zoom`) — arbre `<foreignObject>` + zoom |
| 3D / AR | **@google/model-viewer** (lazy, `isCustomElement` dans `vite.config.js`) |
| Fonts | Fraunces (serif display) + Inter |

**Conventions**
- Mapping **camelCase (app) ↔ snake_case (DB)** via `fromRow`/`toRow` dans chaque store.
- Branding ERP par variables CSS `--vi-*` ; site public `--site-primary` + `--gold: #cda24e` (fond sombre `#17110b`).
- Dark mode ERP : classe `.app-dark` sur `<html>` + `darkModeSelector` PrimeVue (composable `useTheme.js`).
- On n'affiche côté public que le contenu **publié** (`published = true`) — garanti aussi par la RLS.

---

## 3. Backend Supabase

- **Projet** : `dvwwwlqrwwzfwxukyoxz` (nom « musea », région `eu-west-3`)
- **URL** : `https://dvwwwlqrwwzfwxukyoxz.supabase.co`
- **Clé publiable** (sûre côté frontend) : `sb_publishable_iyN4-CI2ee5bF6p7PICMIQ_eHfHFkbp`
- Config front dans `.env` : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Comptes de dev**
| Rôle | Identifiants | Note |
|---|---|---|
| Staff ERP | `admin@musea.app` / `Musea2026!` | role `admin` |
| Visiteur | `visiteur@musea.app` / `Visiteur2026!` | role `visitor`, possède déjà un abonnement all-access actif |

### Migrations appliquées (dans l'ordre)
1. **`v2_core_schema`** — 14 tables : `museums`, `sectors`, `objects`, `object_tariffs`, `donation_tiers`, `personnages` (modèle `pere_id`/`mere_id`/`predecesseur_id`/`successeur_id`), `genealogy_links`, `migrations_historiques`, `object_personnage`, `faq`, `voice_assistants`, `audio_tracks`, `ai_agent_config`, `site_settings`.
2. **`auth_profiles`** — table `profiles` + fonction `is_staff()` (SECURITY DEFINER) + trigger `handle_new_user`.
3. **`harden_rls`** — lectures publiques restreintes à `published = true`, écritures réservées au staff.
4. **`commerce_schema`** — voir §5.
5. **`dev_autoconfirm_users`** — trigger `dev_autoconfirm` sur `auth.users` qui auto-confirme l'e-mail (inscription → connexion immédiate sans SMTP). **⚠️ À SUPPRIMER en production** (`drop trigger dev_autoconfirm on auth.users;`) quand la vraie confirmation e-mail sera en place.
6. **`gate_audio_tracks_by_voice_access`** — lecture de `audio_tracks` réservée au staff ou aux visiteurs avec accès `assistant_vocal` actif (paywall audioguide réel côté serveur). Voir §5.

### Edge Functions
- **`guide-agent`** (`verify_jwt=false`) — guide IA ancré : grounding contenu publié → Gemini → Groq → fallback. Secrets attendus : `GEMINI_API_KEY`, `GROQ_API_KEY` (+ optionnels `GEMINI_MODEL`, `GROQ_MODEL`). Voir §6 P3.

### Données seed
2 musées, 4 secteurs (dont « Village des Cases Mousgoum » en Extérieur), 2 objets (« La Vague Bleue » publié, « Amphore » brouillon), tarifs, 7 personnages de la lignée Gacha, liens objet↔personnage (obj → « offert par » / « a appartenu à »), 3 paliers de dons (20/100/500 €), **3 pistes d'audioguide** (assistant 1, musée 1 : intro / salle / œuvre).

---

## 4. Structure du code

```
src/
├─ services/
│  ├─ supabase.js        # createClient(url, anonKey)
│  ├─ publicApi.js       # requêtes site public (published only) : pubMuseums, pubMuseum,
│  │                     #   pubObjectsForMuseum, pubObject, pubObjectChefs, pubMuseumChefs,
│  │                     #   pubPersonnage, pubAllPersonnages, pubPersonnageObjects,
│  │                     #   pubFeaturedObjects, pubSearch, pubVoiceAssistant, pubPlans, pubDonationTiers
│  └─ guideAgent.js      # agent guide IA "grounded" (regex garde-fous + recherche ilike sur contenu publié)
├─ stores/               # Pinia (setup)
│  ├─ useAuthStore.js    # user, role, isStaff, init, signIn, signUp, signInGoogle, signOut, ensureReady
│  ├─ useCartStore.js    # panier localStorage (musea-cart) : items, count, total, add/remove/clear
│  ├─ useAccessStore.js  # lit user_access : hasAllAccess, hasMuseum(id), hasVoice(id)
│  ├─ useMuseumStore / useSectorStore / useObjectStore / usePricingStore / useGenealogyStore
│  └─ useFaqStore / useVoiceStore / useSettingsStore
├─ layouts/
│  ├─ AdminLayout.vue    # shell ERP (sidebar marron, topbar, breadcrumb, menu user) — charge les stores onMounted
│  └─ PublicLayout.vue   # topbar sombre, logo centré, drawer, icônes compte/panier (badge), footer, GuideChat
├─ router/index.js       # /login, /site/* (public), /* (ERP protégé requiresStaff)
├─ components/
│  ├─ objects/Object3DViewer.vue
│  ├─ genealogy/GenealogyTree.vue
│  └─ public/GuideChat.vue (bulle flottante), GuideInline.vue (guide inline réutilisable)
└─ views/
   ├─ (ERP) DashboardView, MuseumsView, SectorsView, ObjectsView, ObjectDetailView,
   │        GenealogyView, PricingView, FaqView, VoiceAssistantsView, SiteSettingsView, LoginView
   └─ public/ PublicHome, PublicCatalog, PublicMuseum, PublicObject, PublicPersonnage,
              PublicCart, PublicAccount
```

---

## 5. Ce qui est FAIT ✅

### ERP (back-office) — complet et branché sur Supabase
- CRUD **Musées → Secteurs → Objets → Grille tarifaire** (dialogs async).
- Objet : amélioration IA de la description, SEO, switch **publier**, visionneuse **3D/AR**.
- **Généalogie & Histoire** : personnages, filiation, liens objet↔personnage, arbre D3.
- Modules V2 : **FAQ**, **Assistant vocal** (+ pistes audio), **Paramètres du site** (branding).
- Identité visuelle propre (sidebar marron, serif Fraunces), dark mode.
- **Auth staff** + **RLS durcie** (le staff voit les brouillons ; l'anonyme ne lit que le publié et ne peut rien écrire — vérifié des deux côtés).

### Site public — Zénith Gallery (fond sombre + or), branché sur données réelles
- **Accueil** : hero éditorial, badges de confiance (adaptés musée), thèmes, œuvres à la une (favori ❤), musées, bande généalogie.
- **Catalogue**, **fiche musée**, **fiche objet** (3D/AR, chefs liés cliquables).
- **Généalogie publique complète** :
  - Fiche musée → section **« La généalogie du musée »** (chefs dérivés des objets publiés).
  - Page **`/site/personnages/:id`** (`PublicPersonnage.vue`) = fiche complète : identité (portrait, titre, chefferie, règne), **son histoire**, faits (règne, décès, **filiation & descendance cliquables**), **« son histoire à travers les œuvres »**, **arbre D3**, guide IA contextuel.
  - Boucle narrative **musée → généalogie → personnage → objet → musée** vérifiée via DOM.
- **Guide IA contextuel** sur les fiches objet et musée + bulle flottante globale. Depuis le 2026-07-12, il passe par l'**Edge Function `guide-agent`** (Gemini→Groq→fallback ancré, clé serveur) avec repli local — voir §6 P3.

### E-commerce visiteur — NOUVEAU (cœur du parcours, paiement simulé)
- **`commerce_schema`** en base : `subscription_plans` (seed : `free` / `all_access` 15 €/30j / `per_museum` 6 €/30j), `orders`, `order_items`, **`user_access`** (source de vérité du paywall), + fonction **`confirm_order(p_order_id)`** SECURITY DEFINER = paiement simulé → commande `payee` + insertion des `user_access` (abonnement avec expiration selon la durée du plan / assistant_vocal sans expiration).
- **Auth visiteur** : `signUp` (auto-connexion grâce à l'auto-confirmation dev), role `visitor`.
- **Panier** persisté (`useCartStore`, localStorage) + badge dans la topbar.
- **`PublicCart.vue`** : choix des pass & dons → checkout (`orders` → `order_items` → `rpc('confirm_order')`) → écran de confirmation → accès déverrouillés.
- **`PublicAccount.vue`** : connexion/inscription + espace « Mes accès » et « Mes commandes ».
- **Fiche musée** : offres **Pass Musée** (6 €) et **Audioguide payant** (§5.3), affichées selon `useAccessStore`.
- **Paywall (§2.4⑤)** sur la fiche objet : description tronquée + guide IA verrouillé tant que l'abonnement n'est pas actif.
- **Audioguide fonctionnel (NOUVEAU 2026-07-12)** : composant **`AudioGuidePlayer.vue`** affiché sur la fiche musée **uniquement si `access.hasVoice(museumId)`**. Liste les pistes `audio_tracks` (libellées Introduction / Salle — … / Œuvre — …, durée), lit le texte par **synthèse vocale** (Web Speech API, `SpeechSynthesisUtterance` fr-FR) — ou via un `<audio>` natif si `fichier` est renseigné. API : **`pubAudioTracks(assistantId)`** dans `publicApi.js`.
- **Paywall audioguide durci côté serveur (migration `gate_audio_tracks_by_voice_access`)** : la lecture de `audio_tracks` est réservée au staff ou aux visiteurs ayant un `user_access` de type `assistant_vocal` actif pour le musée (l'ancienne policy `pub_read = true` cosmétique a été supprimée). `voice_assistants` reste public (pour afficher l'offre/prix). Seed : 3 pistes de narration pour l'assistant 1 (musée 1).

### État de vérification (2026-07-12)
- `npm run build` : **✅** (~11 s, seul un warning de taille de chunk).
- **Parcours backend end-to-end vérifié via Node** : inscription → role `visitor` → commande (15 €) → `confirm_order` OK → `user_access` déverrouillé (30 j) → **écriture contenu bloquée par RLS ✅**.
- **Navigateur** : `/site/panier` (pass 15 €/6 € + dons 20/100/500 € chargés depuis Supabase) et `/site/compte` (connexion/inscription) **rendent correctement ✅**.
- **Parcours payant complet vérifié dans le navigateur (P1 ✅)** : connexion visiteur → objet 21 débloqué (description complète + guide IA, all-access) → **achat de l'audioguide (3 €)** → `Payer (simulation)` → `user_access` `assistant_vocal` musée 1 inséré → retour fiche musée → **lecteur audioguide affiché avec les 3 pistes**, bouton « Écouter » → `speechSynthesis.speaking = true`. **RLS vérifiée** : un client anonyme reçoit **0 piste** (`audio_tracks`). ⚠️ Le screenshot headless timeoute dans ce sandbox → vérif via `get_page_text`/JS.
- ⚠️ *Artefact de test* : le compte `visiteur@musea.app` possède désormais un accès audioguide (musée 1, sans expiration) + une commande #2 de 3 € — pratique pour les démos, à ignorer ou purger si besoin.

---

## 6. Ce qui RESTE À FAIRE 📋 (par priorité)

### P1 — Finaliser le parcours d'achat ✅ (fait le 2026-07-12)
1. ~~**Test navigateur complet du flux payant**~~ **✅** — vérifié de bout en bout dans le navigateur (voir « État de vérification »).
2. ~~**Lecture de l'audioguide** (payant), restreinte à `access.hasVoice(museumId)` + pistes `audio_tracks`~~ **✅** — `AudioGuidePlayer.vue` + `pubAudioTracks` + RLS durcie (voir §5).
   - *Reste optionnel* : remplacer la synthèse vocale par de **vrais fichiers audio** (upload via l'ERP dans Supabase Storage, colonne `fichier`) — le lecteur bascule déjà automatiquement sur `<audio>` si `fichier` est présent.

### P2 — Paiement réel ✅ (architecture faite le 2026-07-13 — reste à poser les clés CinetPay) — voir §11
3. ~~Remplacer la **simulation** par un vrai prestataire~~ **✅ architecture CinetPay en place, non bloquante** :
   - Prestataire retenu : **CinetPay** (mobile money + carte, contexte camerounais). Structure prête à basculer vers Flutterwave/Stripe (adaptateur isolé dans l'Edge Function).
   - **Tant que `VITE_PAYMENT_PROVIDER` est vide → simulation inchangée** (rien de cassé). Mettre `VITE_PAYMENT_PROVIDER=cinetpay` + poser les secrets active le vrai paiement.
   - **⚠️ RESTE À FAIRE pour activer** : créer un compte CinetPay, puis `supabase secrets set CINETPAY_API_KEY=… CINETPAY_SITE_ID=… --project-ref dvwwwlqrwwzfwxukyoxz`, et `VITE_PAYMENT_PROVIDER=cinetpay` dans `.env`. **Le webhook doit être testé avec un vrai paiement sandbox** (parties spécifiques CinetPay non testables sans compte).

### P3 — Agent IA « vrai » ✅ (architecture faite le 2026-07-12 — reste à poser les clés)
4. ~~Passer le guide de la recherche `ilike` locale à un **LLM**~~ **✅ fait** :
   - **Edge Function `guide-agent`** déployée (`supabase/functions/guide-agent/index.ts`, `verify_jwt=false`) : garde-fous hors-sujet → **grounding** sur le contenu publié (mêmes requêtes faq/secteurs/objets/personnages/musées) → **Gemini** (primaire) → **Groq** (fallback) → **fallback déterministe ancré** si aucune clé/échec. Renvoie `{ text, links, source }`. CORS géré.
   - `guideAgent.js` : `ask()` appelle la fonction via `supabase.functions.invoke('guide-agent')`, avec **repli sur la recherche locale** (`askLocal`) si la fonction est injoignable → le guide marche toujours.
   - **Vérifié** : POST/OPTIONS 200 dans les logs Edge, réponses ancrées + liens (dont personnages), refus hors-sujet, `npm run build` ✅.
   - **⚠️ RESTE À FAIRE pour activer les vrais LLM** : poser les secrets (sinon `source: "grounded"`, comportement identique à l'ancien guide) :
     ```bash
     supabase secrets set GEMINI_API_KEY=xxx GROQ_API_KEY=yyy --project-ref dvwwwlqrwwzfwxukyoxz
     # (optionnel) GEMINI_MODEL=gemini-2.0-flash  GROQ_MODEL=llama-3.3-70b-versatile
     ```
     Aucune redéploiement/code à changer ensuite : la fonction lit les clés à chaud via `Deno.env`.

### P4 — Divers (fait le 2026-07-12, sauf #7 volontairement reporté)
5. **Google OAuth — ✅ code fait & vérifié.** Client Supabase en **flux PKCE** (`detectSessionInUrl`), `signInGoogle(redirectPath)` revient sur une **page publique** (`/site/compte` visiteur, `/` staff — jamais l'ERP par erreur), `prompt=select_account`, watch sur `auth.user` pour recharger accès/commandes au retour, trigger DB `handle_new_user` robustifié (`full_name`/`name`/email → rôle `visitor`). Vérifié : le clic redirige vers `.../auth/v1/authorize?provider=google&redirect_to=…/site/compte&code_challenge=…`. **⚠️ RESTE : config Dashboard uniquement** (Client ID/Secret Google Cloud + activer provider + Redirect URLs) → voir **`GOOGLE_AUTH_SETUP.md`**. Callback à déclarer côté Google : `https://dvwwwlqrwwzfwxukyoxz.supabase.co/auth/v1/callback`.
6. **Connexion visiteur par CODE E-MAIL (sans mot de passe) — ✅ code fait & vérifié, MÉTHODE ACTIVE côté visiteur.** L'utilisateur a refusé Google Cloud → sur `/site/compte` le bouton Google est **retiré** (Google conservé côté staff `LoginView`) et remplacé par : saisie e-mail → **code à 6 chiffres** reçu par e-mail → validation. Store : `sendEmailOtp` (`signInWithOtp`) + `verifyEmailOtp` (`verifyOtp` type `email`). Vérifié preview : requête OTP acceptée, écran de saisie du code affiché, 0 erreur. **⚠️ RESTE (dans Supabase uniquement, pas de console externe)** : ajouter `{{ .Token }}` aux templates e-mail **Magic Link** ET **Confirm signup** (sinon l'e-mail contient un lien, pas le code) + SMTP perso pour la prod (built-in rate-limité ~2-4/h) → voir **`EMAIL_LOGIN_SETUP.md`**.
6. ~~**Multilingue FR/EN**~~ **✅ (toute l'app)** — voir §9.
7. **Nettoyage production** — *reporté au lancement* (checklist en §10) : supprimer `dev_autoconfirm` et activer la confirmation e-mail réelle (SMTP). Le faire maintenant casserait l'inscription visiteur en dev.
8. ~~Renommer en **MUSÉA**~~ **✅** — `package.json` (`name: "musea"`), `index.html` `<title>` « MUSÉA — Fondation Jean Félicien Gacha », marque sidebar/footer ERP, titre SEO généré (`aiService.js`).

---

## 7. Conventions & pièges (à connaître avant de coder)

- **Modifier directement les fichiers** — ne pas coller le code dans le chat.
- **PowerShell + npm** : `npm` renvoie exit 255 quand il écrit sur stderr, et `2>&1` sur un exe natif casse tout. → Lancer les builds via **Bash** : `npm run build 2>&1 | tail -3`. Vérifier les installs via `Test-Path` / `node -e require`.
- **Node → Supabase** timeout par intermittence dans ce sandbox (réseau Cloudflare flaky). → Prévoir des **retries**, ou vérifier via le **navigateur preview** (qui atteint Supabase de façon fiable).
- **Screenshot headless** peut timeouter → préférer `get_page_text` / `read_page` (text-based).
- **Dev server** : `.claude/launch.json` → nom **`visite-immersive`**, port 5173 (`autoPort`). `vite.config.js` honore `process.env.PORT`.
- **Ne jamais** mettre de clé API IA dans le frontend.

---

## 8. Démarrage rapide

```bash
npm install
npm run dev        # http://localhost:5173  (site public : /site ; ERP : / )
npm run build      # via Bash si PowerShell : npm run build 2>&1 | tail -3
```

- Se connecter à l'ERP : `admin@musea.app` / `Musea2026!`
- Tester le parcours visiteur : `/site/compte` (`visiteur@musea.app` / `Visiteur2026!`)

---

## 9. Internationalisation FR/EN (NOUVEAU 2026-07-12)

- **Stack** : **vue-i18n 9** (`legacy:false`, Composition API). Instance dans **`src/i18n/index.js`** — détection langue : `localStorage['musea-lang']` → `navigator.language` → défaut `fr` ; `setLocale()` met à jour `i18n.global.locale` + `localStorage` + `<html lang>`. Locales dans **`src/i18n/fr.js`** et **`src/i18n/en.js`** (mêmes clés ; namespaces : `common`, `publicLayout`, `home`, `catalog`, `museum`, `object`, `audioguide`, `personnage`, `guideChat`, `guideInline`, `cart`, `account`, `uploader`, `viewer3d`, `admin.*`).
- **Sélecteur de langue** : composant **`src/components/LangSwitcher.vue`** (variantes `dark` topbar publique, `light` ERP/login) — dans `PublicLayout`, `AdminLayout` (topbar) et `LoginView`.
- **Couverture** : **toute l'app** — site public (layout, accueil, catalogue, musée, objet, personnage, panier, compte, guides, audioguide, visionneuse 3D) **et** ERP (AdminLayout, LoginView, Dashboard, Musées, Secteurs, Objets, Fiche objet, Généalogie, Tarifs, FAQ, Assistant vocal, Paramètres + **tous les dialogs de formulaire** + composants partagés `ImageUploader`/`Object3DViewer`). Les **titres de vues ERP** viennent du `router` : `meta.title/group` contiennent des **clés i18n** traduites dans le fil d'Ariane.
- **Périmètre** : on traduit **tous les libellés d'interface** — y compris les captions d'arbre généalogique (`vieOf` du store via `i18n.global.t`, et le `nodeOf` de `PublicPersonnage`) et les labels du dropdown « source » (`VOICE_SOURCES`, dont les *valeurs* `import`/`enregistrement`/`synthese` restent inchangées). Le seul contenu non traduit est **les données de la base** et **les valeurs de constantes stockées** (types de musée, relations objet↔chef, emplacements `Intérieur`/`Extérieur`, titres coutumiers dans `src/constants/options.js`) : ce sont des valeurs persistées, les traduire casserait le matching — cela nécessiterait des colonnes par langue en base (chantier séparé).
- **Ajouter une chaîne** : ajouter la clé dans **`fr.js` ET `en.js`** (mêmes chemins), puis `$t('namespace.cle')` (template) ou `const { t } = useI18n()` (script). Interpolation : `$t('cle', { var })` + `{var}` dans la valeur.
- **⚠️ Piège `@`** : vue-i18n interprète `@` comme sa syntaxe de « message lié » → un littéral `@` (ex. e-mail) casse la compilation. L'échapper via l'interpolation littérale : `"you{'@'}example.com"`.
- **Vérifié navigateur** : switch FR↔EN OK sur le site public (hero, CTA, footer) **et** l'ERP (menu, dashboard, page Musées, dialog formulaire, fil d'Ariane) ; `<html lang>` suit ; **aucune erreur console** ; `npm run build` ✅.

---

## 10. Checklist mise en production (à faire au lancement — P4 #7 reporté)

- [ ] **SMTP réel** : configurer un fournisseur d'e-mails dans Supabase (Auth → SMTP) pour la confirmation d'inscription.
- [ ] **Supprimer l'auto-confirmation dev** une fois le SMTP en place : `drop trigger dev_autoconfirm on auth.users;` (sinon les comptes restent auto-confirmés sans vérification e-mail).
- [ ] **Google OAuth** : config Dashboard uniquement (le code est fait & vérifié) — suivre **`GOOGLE_AUTH_SETUP.md`** (Google Cloud : Client ID/Secret + callback `https://dvwwwlqrwwzfwxukyoxz.supabase.co/auth/v1/callback` ; Supabase : activer provider + Redirect URLs `http://localhost:5173/**`).
- [ ] **Paiement réel** (P2) : compte CinetPay + secrets + `VITE_PAYMENT_PROVIDER=cinetpay` (détail §11).
- [ ] **Clés LLM** (P3) : `supabase secrets set GEMINI_API_KEY=… GROQ_API_KEY=…` pour activer le vrai agent IA.
- [ ] **Audioguide** : remplacer la synthèse vocale par de vrais fichiers audio (Supabase Storage, colonne `fichier`) si souhaité.

---

## 11. Paiement réel — architecture CinetPay (NOUVEAU 2026-07-13)

**Principe** : non bloquant. `VITE_PAYMENT_PROVIDER` vide (défaut) ⇒ **simulation inchangée** (`confirm_order` côté client). `= "cinetpay"` ⇒ vrai paiement. La **source de vérité** du déblocage est le **webhook serveur**, jamais le client.

**DB (migration `payment_real_schema`)**
- Colonnes ajoutées à `orders` : `payment_provider`, `payment_ref` (unique, réf. de transaction qu'on envoie au prestataire), `provider_tx_id`.
- Fonction **`confirm_order_service(order_id, provider, tx)`** SECURITY DEFINER : réplique `confirm_order` mais lit `user_id` **depuis la commande** (pas `auth.uid()`, car appelée par le webhook sans utilisateur). **Idempotente** (rejeu webhook = no-op). **Révoquée** à `anon`/`authenticated`, **accordée** à `service_role` uniquement. (`confirm_order` reste utilisée pour la simulation côté client.)

**Edge Functions** (`supabase/functions/`)
- **`payment-create`** (`verify_jwt=true`) : vérifie que la commande appartient au visiteur connecté et est `en_attente` → convertit **€→XAF** (peg fixe **655,957**, arrondi multiple de 5 exigé par CinetPay) → pose `payment_ref` → appelle l'API CinetPay `/v2/payment` → renvoie `{ payment_url }`. **Sans clés CinetPay → `{ simulated:true }`** (le frontend retombe sur la simulation).
- **`payment-webhook`** (`verify_jwt=false`) : reçoit `cpm_trans_id` → **re-vérifie le statut auprès de CinetPay** (`/v2/payment/check` avec notre apikey — un attaquant ne peut pas forger « ACCEPTED ») → contrôle le **montant** attendu → appelle `confirm_order_service`. Répond toujours `200`.

**Frontend**
- `src/services/paymentApi.js` : `createOrder`, `confirmSimulated` (simulation), `startRealPayment` (invoke `payment-create`), `orderStatus`, `isRealPayment`.
- `PublicCart.vue` : `checkout()` crée la commande ; si `isRealPayment` → `startRealPayment` → **redirection** vers `payment_url` (retour sur `/site/panier?ret=1&order=ID`) ; sinon simulation. Au **retour**, sonde le statut de la commande quelques secondes → confirmation ou écran « paiement en cours » (le webhook confirme en asynchrone).

**Pour activer (à faire par l'utilisateur)**
1. Créer un compte **CinetPay**, récupérer `apikey` + `site_id`.
2. `supabase secrets set CINETPAY_API_KEY=xxx CINETPAY_SITE_ID=yyy --project-ref dvwwwlqrwwzfwxukyoxz` (optionnel : `CINETPAY_CURRENCY`, `PAYMENT_XAF_PER_EUR`).
3. `.env` : `VITE_PAYMENT_PROVIDER=cinetpay` puis rebuild.
4. Dans le back-office CinetPay, l'URL de notification est renseignée automatiquement (`notify_url` = `…/functions/v1/payment-webhook`).
5. **Tester un vrai paiement** (les parties spécifiques CinetPay — contrat exact `/v2/payment`, format du webhook — n'ont pas pu être testées sans compte ; à valider en sandbox).

> Pour **Flutterwave/Stripe** à la place : ne toucher qu'à l'adaptateur dans `payment-create`/`payment-webhook` (init + vérification), le reste (DB, frontend, gating) est agnostique. Stripe étant en EUR, la conversion XAF ne s'appliquerait pas.

---

## 12. Design de l'ERP — style « Génius Restaurants » (FINAL 2026-07-14)

Après plusieurs itérations (une passe « Tenant Portal » marron/crème, abandonnée), le design **final** de l'ERP copie le template **Génius Restaurants** fourni : **blanc + navy `#16223C` + orange `#F26B21`** sur fond **gris froid `#F6F7F9`**. Le **site public garde son identité propre** (sombre + or) — inchangé.

**Fichiers pivots (les vues suivent via les tokens `--vi-*` / `.vi-*`)**
- **`src/main.js`** : preset PrimeVue → primaire **orange `#F26B21`** (ramp 50→950) ⇒ `--p-primary-color = #f26b21`.
- **`src/style.css`** (tokens) : `--vi-bg #F6F7F9` (gris froid), surfaces blanches, `--vi-surface-2 #F1F3F6`, bordures `#E9EDF2`, `--vi-text #1B2A4A` (navy), `--vi-muted #6B7280`, **`--vi-navy #16223C`** (item actif + avatars). **Sidebar blanche à item actif NAVY** : `--vi-side-active-bg #16223C` / `--vi-side-active-text #fff`, labels/icônes `--vi-side-muted #98A1B2`. ERP en sans-serif (Inter). `.vi-page` pleine largeur (max 1640px). `--vi-sidebar-w 258px` / `-mini 74px`.
- **`src/layouts/AdminLayout.vue`** : **plein écran** (plus de carte flottante) — `.layout { height:100vh }`, `.main { overflow-y:auto }`. **Sidebar blanche à SECTIONS** : labels gris majuscules (`PILOTAGE` / `CONTENU` / `ENGAGEMENT` / `GESTION`), item actif **navy plein arrondi**, **badges orange** (ex. nb de brouillons sur « Objets »). Marque : carré orange (icône) + « MUSÉA » navy + « ERP & SITE ». **Carte utilisateur** en bas (avatar carré orange + nom + rôle « Super-admin » → menu). **Topbar BLANCHE** (bordure basse, collante) : recherche + bouton « Voir le site » + LangSwitcher + cloche (badge orange) + thème + **avatar rond navy** (initiales). Mode réduit **258↔74px** (labels/badges masqués), tiroir sur mobile.
- **`src/views/DashboardView.vue`** : titre **« Bonjour, {nom} 👋 »** + sous-titre, **4 cartes KPI** style Génius (label + icône en carré à droite, grande valeur navy) — Musées / Objets / Objets publiés / **Brouillons** (icône orange « alerte »). En dessous : panneaux « Objets récents » + « Historique de publication ».

**Vérifié navigateur (FR + EN)** : `--p-primary-color #f26b21`, fond `#f6f7f9`, sidebar blanche, sections `PILOTAGE/CONTENU/ENGAGEMENT/GESTION`, item actif `#16223c` texte blanc, badge orange, topbar blanche + recherche + « Voir le site », avatar navy « AD », carte « admin / Super-admin », « Bonjour, Admin 👋 » + 4 KPI, bouton primaire orange sur `/musees`, bascule **258↔74px**, **aucune erreur console**, `npm run build` ✅. (Screenshot headless timeoute dans ce sandbox → vérif par styles calculés.)

> Adaptations (app musée ≠ restaurant) : le sélecteur de boutique multi-magasins du template est omis (une seule fondation) ; les libellés de nav restent ceux de MUSÉA. Le site public n'est pas touché.

---

## 13. Guide IA vocal (module « Assistant vocal » v2 — NOUVEAU 2026-07-14)

L'« assistant vocal » n'est plus un simple lecteur de fichier + prix : c'est un **Guide IA vocal** créé/assigné dans l'ERP, branché sur la base de connaissances du musée, qui **salue le visiteur par son nom** et raconte / dialogue. (Remplace le §5 du cahier des charges V2.)

**DB (migrations `voice_guide_columns` + `voice_guide_access`)**
- `voice_assistants` étendue : `langues text[]`, `mode_interaction` (narration | narration_dialogue), `personnalisation_nominative`, `modele_salutation`, `source_type` (texte | audio), `script_texte`, `timbre_voix` (standard | robot | grave | douce), `debit`, `ton`, `audio_source_url`, `audio_traitement` (tel_quel | inspiration), `published`.
- **Paywall serveur** (le script/audio ne doivent pas fuiter avant paiement) : la lecture publique directe de la table est **coupée** (`drop policy pub_read`). Deux RPC SECURITY DEFINER :
  - **`pub_voice_offer(museum_id)`** (anon) → **offre uniquement** (nom, prix, devise, langues, mode, salutation) et seulement si `published + actif + prix`.
  - **`get_guide(museum_id)`** (authenticated) → **guide complet** (script, voix, audio) **uniquement si** `is_staff()` OU accès `assistant_vocal` actif — sinon vide. *Vérifié : anon → 0 ligne sur `get_guide`, 1 sur `pub_voice_offer`.*
- `audio_tracks` : policy `access_read` **découplée** de la RLS de `voice_assistants` via `can_read_track(assistant_id)` (SECURITY DEFINER), pour rester gated après la coupure ci-dessus.

**ERP** — `components/voice/VoiceAssistantDialog.vue` réécrit en **formulaire Guide à 5 onglets** : Identité & assignation (musée, nom, langues, publié/actif + encart « base de connaissances »), Source & voix (SelectButton texte↔audio ; texte → script + timbre/débit/ton ; audio → URL + traitement tel_quel/inspiration), Personnalisation (salutation nominative + modèle `{prenom}`/`{musee}`), Comportement (narration | narration+dialogue + garde-fous), Tarif & accès. Store `useVoiceStore` : `aFrom`/`aTo` mappent tous les nouveaux champs.

**Site public** — `components/public/VoiceGuide.vue` (remplace `AudioGuidePlayer` sur la fiche musée, affiché si `access.hasVoice`) :
- **Salutation nominative** : prénom depuis `user_metadata.full_name`, sinon déduit de l'e-mail (`visiteur@…` → « Visiteur ») ; repli « Bonjour et bienvenue au {musée} ». *Vérifié : « Bonjour Visiteur, bienvenue au Musée National d'Art Contemporain… ».*
- **Narration** par **synthèse vocale** (Web Speech API) : lit accueil + script ; `débit`→rate, `timbre`→pitch (robot/grave/douce), voix selon la langue choisie. Mode audio `tel_quel` → `<audio>` natif. Prise de parole automatique à l'ouverture (si le navigateur l'autorise).
- **Segments** par salle/œuvre depuis `audio_tracks` (gated), filtrés par langue.
- **Dialogue** (si `narration_dialogue`) : `GuideInline` (Edge Function `guide-agent`, ancrée sur le contenu publié = la base de connaissances).
- **Contrôles** : écouter/arrêter, sélecteur de langue, réécoute par segment.
- Contenu chargé via **`getGuide`** (RPC gated) : rien n'est exposé avant paiement.

**Reste / limites** : la **synthèse est gratuite** (Web Speech API navigateur) ; pour une voix serveur/mise en cache par objet, prévoir une Edge Function TTS. Le mode audio **« inspiration »** (analyse d'un audio importé par l'IA) nécessiterait un **speech-to-text** (non branché — l'audio `tel_quel` fonctionne, l'inspiration retombe sur script + collections). Traductions du script multilingue non stockées (le sélecteur de langue change la voix TTS + filtre les pistes ; le script reste dans sa langue de saisie).
