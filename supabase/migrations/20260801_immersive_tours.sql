-- ============================================================================
-- PHASE 6 — VISITE IMMERSIVE : parcours 360, scènes et points chauds
-- ----------------------------------------------------------------------------
-- À exécuter dans l'éditeur SQL de Supabase (ou via `supabase db push`).
--
-- Modèle : un MUSÉE porte une ou plusieurs VISITES (`tours`). Une visite est une
-- suite de SCÈNES (`tour_scenes`), chacune rattachée à un secteur (salle) réel.
-- Sur une scène, des POINTS CHAUDS (`scene_hotspots`) mènent à un objet, à un
-- personnage, ou à une autre scène — c'est ce qui rend le fil narratif
-- « objet → chef → chefferie → généalogie » parcourable depuis la visite.
--
-- Publication en cascade : une visite n'est visible que si le musée ET la visite
-- sont publiés (même règle que musée → secteur → objet).
-- ============================================================================

-- ---------------------------------------------------------------- tours -----
CREATE TABLE IF NOT EXISTS public.tours (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id   bigint REFERENCES public.tenants(id) ON DELETE CASCADE,
  museum_id   bigint NOT NULL REFERENCES public.museums(id) ON DELETE CASCADE,

  titre       text NOT NULL,
  description text,
  couverture  text,                      -- image d'affiche du parcours
  duree_min   integer,                   -- durée indicative, en minutes
  published   boolean NOT NULL DEFAULT false,

  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tours_museum_idx ON public.tours(museum_id);
CREATE INDEX IF NOT EXISTS tours_tenant_idx ON public.tours(tenant_id);

-- ---------------------------------------------------------- tour_scenes -----
CREATE TABLE IF NOT EXISTS public.tour_scenes (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id  bigint REFERENCES public.tenants(id) ON DELETE CASCADE,
  tour_id    bigint NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
  sector_id  bigint REFERENCES public.sectors(id) ON DELETE SET NULL,

  titre      text NOT NULL,
  type       text NOT NULL DEFAULT 'photo360'
             CHECK (type IN ('photo360', 'video360', 'image')),
  media_url  text,                        -- vide ⇒ panorama de démonstration généré
  ordre      integer NOT NULL DEFAULT 0,

  -- Orientation à l'arrivée dans la salle : {"yaw": 0, "pitch": 0, "fov": 75}
  position_initiale jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tour_scenes_tour_idx   ON public.tour_scenes(tour_id, ordre);
CREATE INDEX IF NOT EXISTS tour_scenes_tenant_idx ON public.tour_scenes(tenant_id);

-- ------------------------------------------------------- scene_hotspots -----
CREATE TABLE IF NOT EXISTS public.scene_hotspots (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id     bigint REFERENCES public.tenants(id) ON DELETE CASCADE,
  scene_id      bigint NOT NULL REFERENCES public.tour_scenes(id) ON DELETE CASCADE,

  -- Cibles possibles — une seule est renseignée selon le `type`
  object_id     bigint REFERENCES public.objects(id) ON DELETE CASCADE,
  personnage_id bigint REFERENCES public.personnages(id) ON DELETE CASCADE,
  scene_cible_id bigint REFERENCES public.tour_scenes(id) ON DELETE CASCADE,

  type          text NOT NULL DEFAULT 'objet'
                CHECK (type IN ('objet', 'personnage', 'navigation', 'info')),
  libelle       text,
  texte         text,                     -- pour type 'info' : la note affichée

  -- Ancrage. Sur une scène 360 : x = azimut (yaw) en degrés (-180..180),
  -- y = élévation (pitch) en degrés (-90..90). Sur une scène 'image' plate :
  -- x et y sont des fractions 0..1 de la largeur et de la hauteur.
  -- z est réservé (profondeur d'une future scène volumétrique) et vaut 0.
  x             double precision NOT NULL DEFAULT 0,
  y             double precision NOT NULL DEFAULT 0,
  z             double precision NOT NULL DEFAULT 0,

  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scene_hotspots_scene_idx  ON public.scene_hotspots(scene_id);
CREATE INDEX IF NOT EXISTS scene_hotspots_tenant_idx ON public.scene_hotspots(tenant_id);

-- ============================================================================
-- Rattachement automatique à l'organisation (même trigger que les autres tables)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_set_tenant ON public.tours;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.tours
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS trg_set_tenant ON public.tour_scenes;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.tour_scenes
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

DROP TRIGGER IF EXISTS trg_set_tenant ON public.scene_hotspots;
CREATE TRIGGER trg_set_tenant BEFORE INSERT ON public.scene_hotspots
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id();

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.tours          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tour_scenes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scene_hotspots ENABLE ROW LEVEL SECURITY;

-- Visite : visible du public si l'organisation est publique, la visite publiée
-- ET le musée publié (cascade).
DROP POLICY IF EXISTS tours_public_read ON public.tours;
CREATE POLICY tours_public_read ON public.tours FOR SELECT
  USING (
    published = true
    AND public.tenant_is_public(tenant_id)
    AND EXISTS (SELECT 1 FROM public.museums m WHERE m.id = museum_id AND m.published = true)
  );

DROP POLICY IF EXISTS tours_staff_all ON public.tours;
CREATE POLICY tours_staff_all ON public.tours FOR ALL
  USING (public.can_manage_tenant(tenant_id))
  WITH CHECK (public.can_manage_tenant(tenant_id));

-- Scène : visible si sa visite l'est. On ne réplique pas la condition, on la
-- délègue à la politique de `tours` via un EXISTS (une seule vérité).
DROP POLICY IF EXISTS tour_scenes_public_read ON public.tour_scenes;
CREATE POLICY tour_scenes_public_read ON public.tour_scenes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.tours t WHERE t.id = tour_id));

DROP POLICY IF EXISTS tour_scenes_staff_all ON public.tour_scenes;
CREATE POLICY tour_scenes_staff_all ON public.tour_scenes FOR ALL
  USING (public.can_manage_tenant(tenant_id))
  WITH CHECK (public.can_manage_tenant(tenant_id));

-- Point chaud : visible si sa scène l'est.
DROP POLICY IF EXISTS scene_hotspots_public_read ON public.scene_hotspots;
CREATE POLICY scene_hotspots_public_read ON public.scene_hotspots FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.tour_scenes s WHERE s.id = scene_id));

DROP POLICY IF EXISTS scene_hotspots_staff_all ON public.scene_hotspots;
CREATE POLICY scene_hotspots_staff_all ON public.scene_hotspots FOR ALL
  USING (public.can_manage_tenant(tenant_id))
  WITH CHECK (public.can_manage_tenant(tenant_id));

-- ============================================================================
-- Commentaires
-- ============================================================================
COMMENT ON TABLE public.tours IS
  'Parcours de visite immersive d''un musée : suite de scènes 360 reliées entre elles.';
COMMENT ON TABLE public.tour_scenes IS
  'Une salle du parcours. media_url vide ⇒ panorama de démonstration généré côté client.';
COMMENT ON TABLE public.scene_hotspots IS
  'Point chaud ancré dans une scène : mène à un objet, un personnage, une autre salle, ou affiche une note.';
COMMENT ON COLUMN public.scene_hotspots.x IS
  'Scène 360 : azimut en degrés (-180..180). Scène image : fraction 0..1 de la largeur.';
COMMENT ON COLUMN public.scene_hotspots.y IS
  'Scène 360 : élévation en degrés (-90..90). Scène image : fraction 0..1 de la hauteur.';
