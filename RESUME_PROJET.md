# MUSÉA — Résumé du projet

> Plateforme numérique de la **Fondation Jean Félicien Gacha** : un ERP d'administration + un site public e-commerce pour la valorisation du patrimoine des chefferies camerounaises (musées, œuvres, généalogie, visite immersive 3D/AR, audioguide vocal, boutiques).

_Dernière mise à jour : 2026-07-28_

---

## 1. Vue d'ensemble

MUSÉA est une **application web unique (SPA Vue 3)** qui contient en réalité **deux produits** partageant le même code et la même base de données :

| Produit | URL | Public | Rôle |
|---|---|---|---|
| **ERP / Back-office** | `/` (dashboard, musées, objets…) | Staff/Admin uniquement | Gérer tout le contenu et les réglages |
| **Site public** | `/site` | Visiteurs | Découvrir, visiter, acheter (e-commerce) |

Le tout est multilingue (**français / anglais**) et piloté par des réglages configurables (branding, couleurs, SEO, etc.).

---

## 2. Stack technique

- **Frontend** : Vue 3 (Composition API, `<script setup>`), Vite, Vue Router, Pinia (stores), vue-i18n (fr/en).
- **UI** : PrimeVue 4 + PrimeIcons + thème `@primevue/themes` (Aura). Polices : Fraunces (serif) + Inter.
- **3D / AR** : `@google/model-viewer`, `three` (visualisation des objets, réalité augmentée).
- **Backend** : **Supabase** (projet `dvwwwlqrwwzfwxukyoxz`) — PostgreSQL + Auth + Row Level Security (RLS) + Edge Functions + Realtime + Storage.
- **Paiement** : CinetPay (mobile money / carte) avec repli en mode simulation.
- **IA** : agent conversationnel « guide » (Groq opérationnel ; Gemini en quota 0) + synthèse vocale (voix navigateur / ElevenLabs).

---

## 3. Fonctionnalités

### ERP (back-office, réservé au staff)
- **Tableau de bord** (`DashboardView`).
- **Collections** : Musées, Secteurs, Objets (avec fiches détaillées, photos, modèle 3D, tarifs par objet).
- **Généalogie** : personnages/chefs, liens généalogiques, rattachement aux objets.
- **Tarifs** : plans d'abonnement, tarification.
- **FAQ**.
- **Assistant vocal / Guide** : création de guides par musée (script, langue, voix, timbre, débit, mode narration/dialogue, tarif), choix du **moteur de voix** (navigateur ou ElevenLabs) et de la voix.
- **Paramètres du site** (très complet) : identité/branding, logo, favicon, couleurs, contact, réseaux sociaux, langues, authentification, **SEO & partage**, **bandeau d'annonce**, **hero d'accueil**, **infos pratiques**, **pied de page**, **mode maintenance**, mentions légales.

### Site public (visiteurs)
- **Accueil** (`PublicHome`) : hero, catégories, œuvres/musées mis en avant.
- **Catalogue des musées** + **fiche musée** (histoire, objets, chefs liés, guide IA, offres).
- **Fiche objet** (photo, description, 3D/AR, chefs liés).
- **Généalogie publique** (fiche personnage + objets liés).
- **Boutiques** : page « Nos Boutiques » + **une boutique par musée** (grille produits, filtres par catégorie, ajout au panier). Prix en FCFA.
- **Panier & paiement** : abonnements, audioguide, dons, produits → commande (réelle CinetPay ou simulée).
- **Compte visiteur** (accès débloqués).
- **Guide IA** (chat + vocal) flottant.
- **Comportements dynamiques** (temps réel) : bandeau, hero, infos pratiques, maintenance — toute modification enregistrée dans l'ERP s'applique **immédiatement** sur les onglets ouverts (Supabase Realtime).

---

## 4. Base de données (tables principales)

| Table | Rôle |
|---|---|
| `profiles` | Rôle des utilisateurs (visitor / staff / admin) |
| `museums` | Musées (nom, type, année, histoire, photo, publié) |
| `sectors` | Secteurs/salles d'un musée |
| `objects` | Œuvres/objets (photo, 3D, description) |
| `object_tariffs` | Tarifs par objet |
| `personnages` | Chefs / personnages (généalogie) |
| `genealogy_links` | Liens généalogiques |
| `object_personnage` | Lien objet ↔ personnage |
| `voice_assistants` | Guides vocaux (script, voix, `provider`, tarif) |
| `audio_tracks` | Pistes audio de l'audioguide (contenu payant) |
| `subscription_plans` | Plans d'abonnement |
| `donation_tiers` | Paliers de dons |
| `products` | **Produits des boutiques** (par musée, prix FCFA, catégorie, stock) |
| `orders` / `order_items` | Commandes e-commerce |
| `user_access` | Accès débloqués par utilisateur (paywall) |
| `site_settings` | **Tous les réglages du site** (branding, SEO, bandeau, hero, maintenance…) |
| `faq` | Foire aux questions |
| `ai_agent_config` | Configuration de l'agent IA |

**Sécurité** : RLS activée. Lecture publique limitée au contenu `published` ; le staff (`is_staff()`) gère tout. Le contenu payant (scripts de guide, pistes audio) n'est renvoyé qu'aux visiteurs ayant un accès actif, via des RPC sécurisées (`get_guide`, `pub_voice_offer`).

---

## 5. Edge Functions (Supabase)

| Fonction | Rôle |
|---|---|
| `tts` | Synthèse vocale ElevenLabs (clé 100 % côté serveur). Repli navigateur si quota/erreur. |
| `guide-agent` | Agent IA conversationnel du guide. |
| `payment-create` | Création d'un paiement CinetPay. |
| `payment-webhook` | Confirmation serveur du paiement. |

---

## 6. Organisation du code (`src/`)

- `layouts/` : `AdminLayout` (ERP), `PublicLayout` (site public — header, footer, bandeau, maintenance).
- `views/` : écrans ERP (`MuseumsView`, `ObjectsView`, `GenealogyView`, `SiteSettingsView`…) et `views/public/` (site).
- `components/` : dialogues de formulaire ERP + composants publics (`ProductCard`, `VoiceGuide`, `GuideChat`, `Object3DViewer`…).
- `stores/` : Pinia (`useMuseumStore`, `useVoiceStore`, `useSettingsStore`, `useCartStore`, `useAuthStore`…).
- `services/` : `supabase`, `publicApi`, `paymentApi`, `tts`, `guideAgent`, `aiService`.
- `composables/` : `useTheme`, `useSiteHead` (SEO/meta/analytics).
- `i18n/` : `fr.js`, `en.js`.
- `router/` : routes ERP (protégées `requiresStaff`) + routes publiques.

---

## 7. État actuel & points en attente

### Fait récemment
- Moteur de voix (navigateur / ElevenLabs) sélectionnable **par guide** dans l'ERP.
- Réglages du site étendus : SEO, bandeau, hero, infos pratiques, réseaux sociaux étendus, pied de page, **mode maintenance** (avec aperçu de la page visiteur).
- Application **temps réel** des réglages (Realtime).
- **Boutiques par musée** : table `products`, pages « Nos Boutiques » + boutique par musée, ajout au panier.
- Nouvelle palette : **vert émeraude `#0e6f5c` + or `#c9a227`**.

### ⚠️ Limites / à faire
1. **Design / style à retravailler en priorité** — le rendu visuel du site public n'est pas au niveau attendu (mise en page, cohérence, finitions). Objectif : refonte propre inspirée d'un template e-commerce moderne, avec un vrai design system.
2. **Pas de CRUD produits dans l'ERP** — les produits des boutiques ne peuvent pas encore être créés/édités depuis le back-office (seulement en base). À construire.
3. **ElevenLabs** : clé posée mais **quota épuisé** (0 crédit) → le site retombe sur la voix du navigateur. À recharger côté compte ElevenLabs.
4. **Devises mélangées** dans le panier : produits en FCFA, pass/dons en €. Le total est affiché en `€` en dur → à harmoniser.
5. **Gemini** en quota 0 (Groq prend le relais pour l'IA).

---

## 8. Prochaines étapes recommandées

1. **Refonte visuelle du site public** (design system, composants cohérents, responsive soigné) — priorité n°1.
2. Construire l'**écran de gestion des produits** (boutiques) dans l'ERP.
3. Harmoniser la **devise** du panier / e-commerce.
4. Recharger / basculer la clé **ElevenLabs** si la voix IA est souhaitée.

---

_Projet MUSÉA — Fondation Jean Félicien Gacha. Document généré automatiquement comme état des lieux._
