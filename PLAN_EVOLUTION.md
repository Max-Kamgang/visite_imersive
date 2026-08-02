> ⚠️ **Lire d'abord [`MUSEA_MASTER_PLAN.md`](MUSEA_MASTER_PLAN.md)** — document maître
> (vision, état mesuré, phases 1 à 8). Ce fichier-ci est l'archive du travail V1.

# MUSÉA — Plan d'évolution

Plan d'implémentation suivi par phases. Règle : **aucune API payante** pour l'instant.
Tout ce qui exige un abonnement est explicitement reporté en fin de document.

---

## Phase 1 — Commerce complet dans l'ERP ⚙️ ✅
Objectif : l'admin peut vendre de bout en bout, sans SQL.

- [x] **CRUD Produits** — vue ERP « Produits » : créer / modifier / supprimer / publier un produit
      (nom, description, prix, devise, image, catégorie, stock, musée) + filtre par musée
- [x] **Gestion des commandes** — liste + lignes dépliables, statut logistique
      (nouvelle → préparée → livrée), CA encaissé, commandes à préparer
- [x] Navigation ERP (groupe « Commerce ») + traductions fr/en

## Phase 2 — Billetterie QR 🎟️ ✅
Objectif : boucler le lien numérique → physique (entrée du musée).

- [x] Migration : `ticket_code` (unique) + `scanned_at` sur `user_access`
- [x] Espace visiteur : billet avec **QR code** (API gratuite `api.qrserver.com`)
- [x] ERP « Contrôle des billets » : scan **caméra** (`BarcodeDetector` natif) + anti-rebond,
      saisie manuelle de secours, historique des contrôles, vibration de retour
- [x] RPC `validate_ticket` : testée — valide / introuvable / expiré / **déjà utilisé**

## Phase 3 — Événements & Livre d'or 📅 ✅
Objectif : faire vivre le site entre deux expositions.

- [x] Table `events` + CRUD ERP + agenda public (accueil & page musée)
- [x] Table `reviews` (livre d'or) : dépôt public, **modération** dans l'ERP (onglet dédié)
- [x] RLS vérifiée : un avis déposé arrive toujours en `published = false`

## Phase 4 — Généalogie publique, WhatsApp & statistiques 🌍 ✅
Objectif : l'âme du projet + les ventes locales.

- [x] Page publique **/site/genealogie** : arbre interactif + recherche + fiche du chef
- [x] Bouton **« Commander via WhatsApp »** sur les produits (gratuit, `wa.me`)
- [x] Dashboard ERP : CA, commandes payées, à préparer, produits en ligne,
      avis à modérer, **top 5 des ventes**

---

# MULTI-TENANT — Plateforme SaaS 🏛️

Objectif : chaque chefferie / institution s'inscrit, configure son espace,
et obtient son propre site public. Isolation garantie au niveau base de données.

**Adressage retenu** : chemin d'abord (`/c/<slug>`), domaine propre prévu dès maintenant.
**Inscription** : libre, mais le site public reste hors ligne jusqu'à validation par le super-admin.

## Étape A — Fondations base de données ✅
- [x] Table `tenants` (slug, nom, type, custom_domain, statut, plan)
- [x] `profiles.tenant_id` + rôle `super_admin`
- [x] Colonne `tenant_id` sur les **21 tables métier** (+ index)
- [x] Migration de l'existant vers l'organisation « fondation » (rien perdu)
- [x] Fonctions : `is_super_admin()`, `current_tenant_id()`, `can_manage_tenant()`, `tenant_is_public()`
- [x] **RLS d'isolation réécrite** sur toutes les tables
- [x] **Trigger `set_tenant_id`** : rattachement automatique à l'insertion
      → le code applicatif existant fonctionne sans modification
- [x] RPC `create_tenant()` (inscription) + `slug_available()`

### Tests d'isolation passés
| Test | Résultat |
|---|---|
| Brouillons d'une autre organisation | invisibles ✅ |
| Modification croisée (UPDATE) | bloquée ✅ |
| Suppression croisée (DELETE) | bloquée ✅ |
| `can_manage_tenant()` sur une autre org | refusé ✅ |

## Étape B — ERP multi-organisation ✅
- [x] `useAuthStore` expose `tenantId`, `tenant`, `isSuperAdmin`, `updateTenant()`
- [x] Utilitaire `services/tenant.js` → `scopeToTenant(query)`
      (le super-admin n'est pas filtré ; sans organisation on ne renvoie rien)
- [x] Filtrage appliqué aux **12 stores ERP** (musées, secteurs, objets, produits,
      commandes, événements, avis, FAQ, généalogie, tarifs, guides vocaux, réglages)
- [x] `useSettingsStore.load()` à 3 modes : organisation imposée (site public /c/:slug),
      organisation de l'utilisateur (ERP), ou repli public anonyme
- [x] Temps réel filtré sur l'organisation affichée
- [x] Page **« Mon organisation »** : statut, lien public copiable, identité,
      slug avec vérification de disponibilité en direct, domaine personnalisé

> ⚠️ Piège rencontré : le filtre a d'abord vidé les réglages du site public
> (visiteur anonyme → `tenant_id = -1`). D'où le 3ᵉ mode de `load()`.

## Étape C — Site public par organisation ✅
- [x] `publicApi` : `setPublicTenant(id)` + helper `scoped()` sur **toutes** les requêtes
      (musées, secteurs, objets, produits, événements, avis, généalogie, tarifs…)
- [x] `usePublicTenantStore` : résolution par **slug**, par **domaine personnalisé**,
      ou repli sur la 1re organisation approuvée (site historique `/site`)
- [x] Routes `/c/:slug` partageant les mêmes pages que `/site` (noms suffixés `-c`)
- [x] `useSiteLink()` : les **52 liens internes** des 11 pages publiques préfixés
      automatiquement → on ne quitte jamais le site consulté
- [x] Écran « Ce site est introuvable » si le slug n'existe pas ou n'est pas approuvé
- [x] **Vitrine de la plateforme** `/` (atouts, étapes, organisations en ligne)
- [x] **Inscription** `/inscription` en 3 étapes : compte → organisation → confirmation,
      avec slug proposé automatiquement et vérifié en direct
- [x] Le staff connecté arrivant sur `/` est renvoyé vers son tableau de bord

### Vérifié dans le navigateur
| Test | Résultat |
|---|---|
| `/` vitrine (6 atouts, 4 étapes, 1 organisation listée) | ✅ |
| `/c/fondation` → 3 musées, 4 produits, liens en `/c/fondation/…` | ✅ |
| `/c/nexiste-pas` → « Site not found », **0 donnée affichée** | ✅ |
| `/site` (historique) → identique, liens en `/site/…` | ✅ |
| `/inscription` → 3 étapes, formulaire compte | ✅ |

## Étape D — Back-office super-admin ✅
- [x] RPC `admin_tenants_overview()` (stats par organisation) — refuse tout non super-admin
- [x] RPC `set_tenant_status()` et `set_domain_verified()` — refusent tout non super-admin
- [x] Vue « Organisations » : liste, filtres, indicateurs, approbation / suspension / réactivation
- [x] Détail dépliable : lien public, contacts, membres, commandes, domaine personnalisé
- [x] Entrée de navigation **visible uniquement au super-admin**, avec badge « en attente »
- [x] Garde de route `requiresSuperAdmin` (double verrou avec la base)

## Étape E — Audit d'isolation & correctifs ✅

Passe de vérification menée après coup sur l'ensemble du code. Deux fuites réelles
trouvées et corrigées — elles ne se voyaient pas à l'usage :

**1. Contenu payant accessible entre organisations** (base de données)
`get_guide()` et `can_read_track()` accordaient l'accès dès que `is_staff()` était vrai,
sans regarder l'organisation. Un employé de la chefferie A pouvait donc lire le script,
la voix et les pistes audio des audioguides **payants** de la chefferie B.
→ Remplacé par `can_manage_tenant(tenant_id)`.
*Vérifié : 0 ligne sur le musée d'une autre organisation, 1 ligne sur le sien.*

**2. Pass valable chez toutes les organisations** (application)
`useAccessStore` considérait qu'un abonnement « tous les musées » débloquait les musées
de **n'importe quelle** organisation. Un pass acheté chez A ouvrait le contenu de B.
→ Les droits sont désormais filtrés sur l'organisation du site consulté (`scopedRows`).

**Magasins ERP** : 12 sur 14 filtrent par organisation. Les deux autres sont corrects
par nature — `useAuthStore` (profil par identifiant) et `useAccessStore` (droits du
visiteur lui-même, désormais filtrés à l'usage).

### Comment devenir super-admin
La plateforme n'accorde ce rôle à personne automatiquement. À exécuter une fois en SQL :
```sql
update public.profiles set role = 'super_admin' where id = '<votre-user-id>';
```

### Contrôles effectués
| Vérification | Résultat |
|---|---|
| `admin_tenants_overview()` par un admin d'organisation | 0 ligne ✅ |
| `set_tenant_status()` par un admin d'organisation | `forbidden` ✅ |
| Site `/c/fondation` (28 liens internes) | aucun lien ne fuit vers `/site` ✅ |
| Slug inconnu `/c/nexiste-pas` | page « site introuvable », 0 donnée ✅ |

---

# E-MAILS TRANSACTIONNELS ✉️ ✅

Envoi via **Resend** (offre gratuite : 3 000 e-mails/mois, 100/jour).
Clé API 100 % côté serveur — jamais dans le frontend.

- [x] Edge Function `send-email` (déployée) — 4 gabarits HTML responsives
      aux couleurs de chaque organisation :
      `recu_commande` · `acces_debloque` · `bienvenue` · `organisation_approuvee`
- [x] Table `email_log` : journal des envois (destinataire, statut, erreur), cloisonnée par organisation
- [x] Service `src/services/emailApi.js` — un échec d'envoi **ne bloque jamais** le parcours
- [x] Reçu envoyé après paiement (simulé **et** réel, au retour du prestataire)
- [x] Accusé d'inscription d'une organisation
- [x] Notification d'approbation (le site public est en ligne)

### Mise en service (2 minutes)
1. Créer un compte sur [resend.com](https://resend.com) puis générer une clé API.
2. Poser le secret :
   ```
   supabase secrets set RESEND_API_KEY=re_xxxxx --project-ref dvwwwlqrwwzfwxukyoxz
   ```
3. Vérifier : le journal `email_log` passe de `desactive` à `envoye`.

**Sans clé** : la fonction répond `{ skipped: true }`, l'application fonctionne
normalement et le journal note `desactive`. *Vérifié.*

⚠️ **Limite de l'offre gratuite** : tant qu'aucun domaine n'est vérifié chez Resend,
on ne peut écrire **qu'à l'adresse du titulaire du compte**, depuis `onboarding@resend.dev`.
Pour écrire à de vrais visiteurs : vérifier un domaine chez Resend, puis poser
`RESEND_FROM="MUSÉA <contact@votredomaine.cm>"`.

### Correctif d'isolation lié
`confirm_order()` créait les accès **sans organisation** : combiné au filtrage des droits
par organisation, cela aurait cassé le paywall pour tout nouvel achat. La fonction déduit
désormais l'organisation de la commande (ou du musée acheté), et `createOrder()` la
transmet depuis le site consulté.

---

# MÉMOIRE RÉUNIFIÉE 🌍 — Module 1 : les objets frères dispersés

**Le problème.** Environ 90 % du patrimoine d'Afrique subsaharienne se trouve hors du
continent (rapport Sarr-Savoy, 2018) ; près de 40 000 objets camerounais sont dans les
seuls musées allemands (Gouaffo & Savoy). Les musées européens détiennent l'**objet**,
les chefferies détiennent le **savoir** — et personne ne possède les deux.

**Ce module rassemble numériquement ce que l'histoire a dispersé.**

## Étape 1 — Appariement lexical (référence de base) ✅
- [x] `src/services/collectionsApi.js` — interroge **The Met** (API ouverte, **sans clé**, CORS autorisé)
- [x] Notation explicable sur 100 : culture (40) · pays (25) · titre (20) · matériau (10) · période (10) · image (5)
- [x] `SiblingsFinder.vue` dans la fiche objet de l'ERP : critères, progression, décomposition de la note
- [x] Migration `supabase/migrations/20260730_object_siblings.sql` — correspondances validées par un conservateur

### Résultats mesurés sur données réelles
| Requête | Trouvés | Meilleur résultat |
|---|---|---|
| Bamum + Cameroon | 24 | **80 %** — *Helmet crest from a nja masquerade*, royaume Bamum, ca. 1800-80 |
| Bamileke | 14 | *Tsesah crest* (Cameroun) |
| Kuba | 14 | *Woman's ceremonial overskirt* (RD Congo) |
| Dogon | 14 | *Priest with raised arms* (Mali) |

Chaque culture renvoie bien son pays de conservation : l'appariement **discrimine** correctement.

## Étape 2 — Appariement sémantique (contribution de recherche) ⏳
Le point d'extension est déjà en place : `scoreSemantic()` dans `collectionsApi.js`.
- [ ] Plongements **CLIP** sur les photographies (similarité visuelle de style/atelier)
- [ ] Encodeur de phrases sur les descriptions
- [ ] **Évaluation comparée** lexical vs sémantique sur les correspondances validées
      (les décisions du conservateur constituent la vérité terrain)
- Gratuit et faisable : `transformers.js` exécute CLIP dans le navigateur, sans serveur ni clé.

## Étape 3 — Élargir les sources ✅ (5 collections interrogées en parallèle)

Toutes vérifiées **sans clé** et **CORS autorisé** depuis le navigateur :

| Source | Portée | Intérêt |
|---|---|---|
| **The Met** — New York | mondiale | fiches très complètes |
| **Art Institute of Chicago** | mondiale | fort en art des Grassfields |
| **Cleveland Museum of Art** | mondiale | excellent sur le Cameroun |
| **Victoria & Albert** — Londres | mondiale | collections britanniques |
| **Wikidata (SPARQL)** | **musées européens** | ⭐ seule voie vers Berlin, Stuttgart, Brême, Tervuren — qui n'ont aucune API |

Wikidata est la pièce maîtresse : elle donne le **musée détenteur, son pays et le numéro
d'inventaire réel**. C'est elle qui fait remonter le **Ngonnso'** (`III C 15017`, musée
ethnologique de Berlin), objet emblématique du débat sur les restitutions.

Écartées faute de clé : Smithsonian (`API_KEY_MISSING`), Harvard (`Unauthorized`),
Europeana, Rijksmuseum. L'architecture par adaptateurs permet de les ajouter en une fonction.

### Mesure réelle — « Bamileke / Cameroon / wood / 1900 »
| Indicateur | Valeur |
|---|---|
| Objets frères trouvés | **41** |
| Durée | 8,2 s (5 sources en parallèle) |
| Sources en échec | **0** |
| Répartition | Met 12 · Cleveland 11 · Wikidata 9 · Chicago 8 · V&A 1 |
| **Dispersion** | 🇺🇸 États-Unis 31 · 🇩🇪 Allemagne 6 · 🇧🇪 Belgique 3 · 🇬🇧 Royaume-Uni 1 |
| Meilleure correspondance | **90 %** — *Mask (mbap mteng): Elephant (aka)*, Cleveland, inv. 1985.1082 |

Le masque-éléphant *mbap mteng* est l'une des pièces les plus emblématiques des
Grassfields : l'appariement remonte bien les objets réellement pertinents.

### Sources africaines : le constat à retenir
J'ai testé les pistes africaines et spécialisées — **aucune n'expose d'API ouverte** :

| Piste | Résultat |
|---|---|
| Digital Benin | `404` — pas d'API publique |
| Penn Museum | `403` |
| Brooklyn Museum | `429` (bloqué) |
| Finna (Finlande) | `403` Cloudflare |
| Europeana | `401` — clé requise |
| Smithsonian | fonctionne avec `DEMO_KEY`, mais ne renvoie que des **livres** pour l'art africain (unité `SIL`) — écarté, faible valeur |

**C'est en soi un résultat du travail** : l'asymétrie numérique double l'asymétrie
patrimoniale. Les objets africains sont en Europe et aux États-Unis, et leurs
métadonnées ne sont accessibles que par les portails de ces pays.
**Wikidata reste la seule voie vers les musées européens détenteurs.**

## Globe de dispersion 🌍 ✅
`src/components/objects/DispersionGlobe.vue` — **vrai globe terrestre, SVG pur,
zéro dépendance** (le projet n'a pas `d3-geo` et npm échoue sur ce poste).

**Données géographiques** — `src/assets/world-110m.js` (67 Ko)
Natural Earth 110m (domaine public) via `world-atlas`, téléchargé une fois, décodé
depuis TopoJSON et simplifié **hors ligne**, puis embarqué tel quel : **137 pays,
5 154 points**. Aucun appel réseau, fonctionne hors ligne avec la PWA.

- **Projection orthographique** calculée à la main
- **Découpe sphérique** des polygones à cheval sur l'horizon : point de coupe
  interpolé à `cosc = 0`, projeté exactement sur le limbe, puis contour refermé
  par un arc de cercle — sans quoi les continents « débordent » du disque
- **Rotation libre à la souris et au doigt, sur deux axes** (longitude + inclinaison
  bornée à ±80° pour éviter le retournement) + rotation automatique au repos
- **Arcs de grand cercle** du pays d'origine vers chaque musée détenteur,
  épaisseur proportionnelle au nombre d'objets
- Relief : halo atmosphérique, lumière rasante, terminateur ; marqueur d'origine pulsant
- Coordonnées : `P625` sur Wikidata ; table fixe pour Met/Chicago/Cleveland/V&A

### Contrôles effectués
| Vérification | Résultat |
|---|---|
| Pays dessinés (hémisphère visible) | 144 polygones |
| Points de continents hors du disque | **0** sur 3 866 |
| Points d'arcs hors du disque | **0** sur 398 |
| Points de grille hors du disque | **0** sur 391 |
| Distance maximale au centre | 204 px = rayon exact |
| Rotation au cliquer-glisser | géométrie modifiée, 144 → 145 pays visibles |
| Masquage de la face cachée | 6 marqueurs sur 7 après rotation (le 7ᵉ est derrière) |

Mesure réelle (Bamileke/Cameroon) : **8 musées géolocalisés** — Met, Cleveland,
Chicago, KADOC Louvain, Linden Stuttgart, ethnologique Berlin, V&A.

⚠️ **Piège de test** : l'aperçu intégré met la page en `visibilityState: hidden`, ce qui
**suspend `requestAnimationFrame`** (mesuré : 0 image/s). La rotation automatique paraît
alors figée, alors qu'elle fonctionne dans un vrai navigateur. Le cliquer-glisser, lui,
est piloté par événements et reste testable.

### Robustesse
- Interrogation **en parallèle** (`Promise.allSettled`) : une source lente ou en panne
  n'empêche pas les autres ; l'échec est signalé sans casser la recherche
- **Dédoublonnage** par `source:externalId`
- Sources **désactivables une à une**, et résultats filtrables par collection
- **Répartition par pays détenteur** calculée et affichée en barres

## Étape 4 — Affichage public & réalité augmentée ⏳
- [ ] Sur la fiche publique : « cet objet a N frères dans X pays » + carte de dispersion
- [ ] AR « retour au pays » : pointer un socle vide dans la cour de la chefferie
      et voir apparaître l'objet exilé (`model-viewer` est déjà intégré au projet)

---

## Reporté — nécessite une API payante 💳

| Fonctionnalité | Bloqueur |
|---|---|
| Voix IA ElevenLabs | quota épuisé — clé posée, 0 crédit |
| Reconnaissance d'œuvre par photo | quotas Gemini/Groq Vision à régler |
| E-mails transactionnels (reçus) | Resend — gratuit jusqu'à 3 000/mois, à activer plus tard |
| Notifications push PWA | nécessite un serveur de push (VAPID) |
| Visite virtuelle 360° | nécessite la prise de vue sur site |

---

## Conventions respectées
- Design system public : classes `.ps-*` de `src/assets/public-site.css`
- Titres display : **Anton** majuscules · couleur : émeraude `--site-primary`
- ERP : PrimeVue + classes `vi-*`
- Toute chaîne visible passe par **i18n** (`fr.js` / `en.js`)
- Toute table exposée au public a une **RLS** explicite
