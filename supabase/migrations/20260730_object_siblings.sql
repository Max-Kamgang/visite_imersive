-- ============================================================================
-- MÉMOIRE RÉUNIFIÉE — Module 1 : correspondances entre objets dispersés
-- ----------------------------------------------------------------------------
-- À exécuter dans l'éditeur SQL de Supabase (ou via `supabase db push`).
-- Conserve les correspondances VALIDÉES par le conservateur : la recherche
-- automatique propose, l'humain décide. C'est cette validation qui fait la
-- valeur scientifique du corpus (et fournit la vérité terrain pour évaluer
-- ensuite une approche par plongements sémantiques).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.object_siblings (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id     bigint REFERENCES public.tenants(id) ON DELETE CASCADE,
  object_id     bigint NOT NULL REFERENCES public.objects(id) ON DELETE CASCADE,

  -- Identification de l'objet distant
  source        text NOT NULL,              -- met | europeana | smithsonian | rijksmuseum
  external_id   text NOT NULL,
  titre         text,
  culture       text,
  pays          text,
  date_objet    text,
  materiau      text,
  image_url     text,
  source_url    text,

  -- Résultat de l'appariement automatique
  score         integer,                    -- 0-100
  raisons       jsonb NOT NULL DEFAULT '[]'::jsonb,
  methode       text NOT NULL DEFAULT 'lexical',  -- lexical | semantique | manuel

  -- Décision humaine : c'est elle qui fait foi
  statut        text NOT NULL DEFAULT 'propose'
                CHECK (statut IN ('propose', 'valide', 'rejete')),
  note_curateur text,
  decided_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at    timestamptz,

  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (object_id, source, external_id)
);

CREATE INDEX IF NOT EXISTS object_siblings_object_idx ON public.object_siblings(object_id);
CREATE INDEX IF NOT EXISTS object_siblings_tenant_idx ON public.object_siblings(tenant_id);
CREATE INDEX IF NOT EXISTS object_siblings_statut_idx ON public.object_siblings(statut);

-- Rattachement automatique à l'organisation de l'utilisateur (comme les autres tables).
DROP TRIGGER IF EXISTS trg_set_tenant ON public.object_siblings;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.object_siblings
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

ALTER TABLE public.object_siblings ENABLE ROW LEVEL SECURITY;

-- Le public ne voit que les correspondances VALIDÉES, et seulement si l'objet
-- est publié et l'organisation approuvée.
DROP POLICY IF EXISTS object_siblings_public_read ON public.object_siblings;
CREATE POLICY object_siblings_public_read ON public.object_siblings FOR SELECT
  USING (
    statut = 'valide'
    AND public.tenant_is_public(tenant_id)
    AND EXISTS (SELECT 1 FROM public.objects o WHERE o.id = object_id AND o.published = true)
  );

-- Le personnel gère uniquement les correspondances de SON organisation.
DROP POLICY IF EXISTS object_siblings_staff_all ON public.object_siblings;
CREATE POLICY object_siblings_staff_all ON public.object_siblings FOR ALL
  USING (public.can_manage_tenant(tenant_id))
  WITH CHECK (public.can_manage_tenant(tenant_id));

COMMENT ON TABLE public.object_siblings IS
  'Objets apparentés retrouvés dans les collections mondiales, proposés par appariement automatique puis validés par un conservateur.';
COMMENT ON COLUMN public.object_siblings.methode IS
  'Méthode d''appariement : lexical (référence de base) | semantique (plongements) | manuel.';
