-- ============================================================================
-- RÉALITÉ AUGMENTÉE — champs manquants sur les objets
-- ----------------------------------------------------------------------------
-- À exécuter dans l'éditeur SQL de Supabase (ou via `supabase db push`).
--
-- Objectif : qu'une fois le site déployé sur un vrai domaine HTTPS, la RA
-- fonctionne sur TOUS les appareils sans intervention supplémentaire.
--
-- Trois manques identifiés :
--
--  1. iPhone / iPad. Apple ne fait de RA que par Quick Look, qui exige un
--     fichier .usdz — un .glb ne sera jamais lu. Sans une seconde colonne,
--     la moitié du public reste sur le carreau, domaine valide ou pas.
--
--  2. Placement. Un tabouret se pose au SOL, un masque s'accroche au MUR.
--     Sans distinction, model-viewer suppose le sol et les masques
--     apparaissent couchés par terre.
--
--  3. Échelle. Un scan photogrammétrique sort rarement à l'échelle 1 : selon
--     le logiciel, l'unité peut être le centimètre ou le pouce. Un facteur
--     correctif évite de devoir réexporter le modèle.
-- ============================================================================

ALTER TABLE public.objects
  ADD COLUMN IF NOT EXISTS model3d_ios      text,
  ADD COLUMN IF NOT EXISTS model3d_ios_name text,
  ADD COLUMN IF NOT EXISTS ar_placement     text NOT NULL DEFAULT 'floor',
  ADD COLUMN IF NOT EXISTS ar_echelle       numeric NOT NULL DEFAULT 1;

-- Contraintes posées à part : `ADD CONSTRAINT IF NOT EXISTS` n'existe pas en
-- PostgreSQL, et on veut que le fichier reste rejouable sans erreur.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'objects_ar_placement_check') THEN
    ALTER TABLE public.objects
      ADD CONSTRAINT objects_ar_placement_check CHECK (ar_placement IN ('floor', 'wall'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'objects_ar_echelle_check') THEN
    ALTER TABLE public.objects
      ADD CONSTRAINT objects_ar_echelle_check CHECK (ar_echelle > 0 AND ar_echelle <= 1000);
  END IF;
END $$;

-- Nettoyage des modèles hérités du bug `URL.createObjectURL`.
-- Une adresse « blob: » n'existe que dans l'onglet qui l'a créée : celles
-- enregistrées en base sont mortes et ne pourront jamais s'afficher. On les
-- efface pour que l'ERP les signale comme absentes plutôt que comme cassées.
UPDATE public.objects
   SET model3d = NULL, model3d_name = NULL
 WHERE model3d LIKE 'blob:%';

COMMENT ON COLUMN public.objects.model3d_ios IS
  'Modèle .usdz pour Quick Look (iPhone/iPad). Indispensable : iOS ne lit pas le .glb.';
COMMENT ON COLUMN public.objects.ar_placement IS
  'floor = posé au sol (statue, tabouret) | wall = accroché au mur (masque, tenture).';
COMMENT ON COLUMN public.objects.ar_echelle IS
  'Facteur correctif si le modèle n''a pas été exporté en mètres. 1 = taille réelle.';
