# Visite Immersive — Back-office d'administration

Interface d'administration (Vue 3 + PrimeVue) pour une fondation gérant des musées :
gestion des **musées**, **secteurs/salles**, **objets** (avec IA et 3D) et de la **grille tarifaire**.

## Démarrer

```bash
npm install
npm run dev      # serveur de dev (http://localhost:5173)
npm run build    # build de production
npm run preview  # prévisualiser le build
```

## Fonctionnalités

- **Menu hamburger** (en haut à gauche) → Musées · Secteurs · Objets · Grille Tarifaire.
- **Musées** : création via modal (nom, description, année de fondation, type, photo).
  Chaque musée s'affiche en carte avec ses caractéristiques.
- **Secteurs** : rattachés à un musée (sélection par **nom**), + étage et description.
- **Objets** : modal en **onglets** (Général / Description / Médias & 3D / SEO) :
  - bouton **IA** pour corriger/améliorer la description ;
  - section **SEO générée par IA** (à partir du nom + description) enregistrée avec l'objet ;
  - **switch** publier / brouillon ;
  - upload photo + **modèle 3D** (.glb/.gltf) et bouton **« Voir en 3D »** (`<model-viewer>`).
- **Grille Tarifaire** : deux sections — tarifs des **objets** (le prix d'une visite guidée
  varie selon l'objet) et **donation** (paliers de dons pour la fondation).

## Intégration IA (à brancher)

Les fonctions IA vivent dans [`src/services/aiService.js`](src/services/aiService.js).
Un **mock local** fonctionne sans backend pour la démo. Pour brancher le vrai modèle :

1. Créer un backend qui détient la clé API (jamais dans le frontend).
2. Renseigner `VITE_AI_API_BASE` dans un fichier `.env` (voir `.env.example`).
3. Le backend appelle Claude (`claude-opus-4-8`) via le SDK officiel `@anthropic-ai/sdk`
   sur les routes `/ai/improve-description` et `/ai/generate-seo`
   (exemple commenté dans `aiService.js`).

## Pile technique

Vue 3 · Vite · Vue Router · Pinia · PrimeVue 4 (thème Aura) · `@google/model-viewer`.

> Les données sont en mémoire (stores Pinia avec données d'exemple) — à remplacer par
> des appels API quand le backend sera disponible.
