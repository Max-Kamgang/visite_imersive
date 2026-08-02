<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import GenealogyTree from '@/components/genealogy/GenealogyTree.vue'
import GuideInline from '@/components/public/GuideInline.vue'
import { pubPersonnage, pubPersonnageObjects, pubAllPersonnages, pubMigrations } from '@/services/publicApi'
import { useSiteLink } from '@/composables/useSiteLink'
import { normalise } from '@/services/genealogy'

// Liens internes : reste sur le site consulte (/site ou /c/<slug>)
const { to } = useSiteLink()

const { t } = useI18n()
const route = useRoute()
const person = ref(null)
const objets = ref([])
const all = ref([])
const migrations = ref([])
const loading = ref(true)

async function load() {
  loading.value = true
  const id = Number(route.params.id)
  person.value = await pubPersonnage(id)
  if (person.value) {
    ;[objets.value, all.value, migrations.value] = await Promise.all([
      pubPersonnageObjects(id), pubAllPersonnages(), pubMigrations(id)
    ])
  }
  loading.value = false
}
onMounted(load)
watch(() => route.params.id, load)

const byId = computed(() => new Map(all.value.map((p) => [p.id, p])))
const pere = computed(() => byId.value.get(person.value?.pere_id))
const mere = computed(() => byId.value.get(person.value?.mere_id))
const enfants = computed(() =>
  all.value.filter((p) => p.pere_id === person.value?.id || p.mere_id === person.value?.id)
)

function fullName(p) { return p ? (p.prenom ? `${p.prenom} ${p.nom}` : p.nom) : '' }
function vie(p) {
  if (!p) return ''
  if (p.regne_debut) return t('personnage.reignLabel', { from: p.regne_debut, to: p.regne_fin ?? t('personnage.today') })
  return [p.date_naissance, p.date_deces].filter(Boolean).join(' – ')
}

// Arbre ascendant construit à partir des personnages publiés (pere_id / mere_id)
function nodeOf(p) {
  return {
    id: p.id,
    nom: p.prenom ? `${p.nom}, ${p.prenom}` : p.nom,
    titre: p.titre,
    vie: p.regne_debut ? t('personnage.reignShort', { from: p.regne_debut, to: p.regne_fin ?? '…' }) : [p.date_naissance, p.date_deces].filter(Boolean).join('–'),
    photo: p.portrait || '',
    children: []
  }
}
function buildTree(id, depth = 0) {
  const p = byId.value.get(id)
  if (!p) return null
  const n = nodeOf(p)
  if (depth < 5) {
    for (const pid of [p.pere_id, p.mere_id]) {
      if (pid) {
        const c = buildTree(pid, depth + 1)
        if (c) n.children.push(c)
      }
    }
  }
  return n
}
const arbre = computed(() => (person.value ? buildTree(person.value.id) : null))
// L'arbre s'affiche dès qu'il y a un lien de filiation dans un sens OU l'autre :
// un chef sans ascendant connu mais avec des successeurs a bien une lignée.
const personnes = computed(() => normalise(all.value))
const hasTree = computed(() =>
  !!person.value && ((arbre.value && arbre.value.children.length) || enfants.value.length)
)
</script>

<template>
  <div>
    <p v-if="loading" class="wrap muted">{{ $t('common.loading') }}</p>
    <template v-else-if="person">
      <!-- Bandeau identité -->
      <section class="p-hero">
        <div class="p-hero__in">
          <router-link :to="to('/musees')" class="back"><i class="pi pi-arrow-left" /> {{ $t('common.back') }}</router-link>
          <div class="p-id">
            <img v-if="person.portrait" :src="person.portrait" :alt="fullName(person)" class="p-id__img" />
            <div v-else class="p-id__img p-id__img--ph"><i class="pi pi-user" /></div>
            <div>
              <span v-if="person.titre" class="p-id__titre">{{ person.titre }}</span>
              <h1>{{ fullName(person) }}</h1>
              <p class="p-id__meta">
                <span v-if="person.chefferie"><i class="pi pi-map-marker" /> {{ person.chefferie }}</span>
                <span v-if="vie(person)"><i class="pi pi-calendar" /> {{ vie(person) }}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <div class="wrap">
        <!-- Histoire -->
        <section v-if="person.biographie || person.accomplissements || person.anecdotes" class="block">
          <h2 class="sec-title">{{ $t('personnage.story') }}</h2>
          <p v-if="person.biographie" class="prose">{{ person.biographie }}</p>
          <p v-if="person.accomplissements" class="prose">{{ person.accomplissements }}</p>
          <p v-if="person.anecdotes" class="prose">{{ person.anecdotes }}</p>
        </section>

        <!-- Règne & décès -->
        <section v-if="person.regne_debut || person.date_deces" class="block facts">
          <div v-if="person.regne_debut" class="fact">
            <i class="pi pi-crown" v-if="false" /><i class="pi pi-star" />
            <div><strong>{{ $t('personnage.reign') }}</strong><span>{{ person.regne_debut }} – {{ person.regne_fin ?? $t('personnage.today') }}</span>
              <span v-if="person.rang_dynastique">{{ person.rang_dynastique }}</span></div>
          </div>
          <div v-if="person.date_deces" class="fact">
            <i class="pi pi-moon" />
            <div><strong>{{ $t('personnage.death') }}</strong><span>{{ person.date_deces }}</span>
              <span v-if="person.lieu_sepulture">{{ $t('personnage.burial', { place: person.lieu_sepulture }) }}</span></div>
          </div>
          <div v-if="pere || mere" class="fact">
            <i class="pi pi-users" />
            <div><strong>{{ $t('personnage.filiation') }}</strong>
              <router-link v-if="pere" :to="to(`/personnages/${pere.id}`)" class="fact__link">{{ $t('personnage.father', { name: fullName(pere) }) }}</router-link>
              <router-link v-if="mere" :to="to(`/personnages/${mere.id}`)" class="fact__link">{{ $t('personnage.mother', { name: fullName(mere) }) }}</router-link>
            </div>
          </div>
          <div v-if="enfants.length" class="fact">
            <i class="pi pi-heart" />
            <div><strong>{{ $t('personnage.descendants') }}</strong>
              <router-link v-for="e in enfants" :key="e.id" :to="to(`/personnages/${e.id}`)" class="fact__link">{{ fullName(e) }}</router-link>
            </div>
          </div>
        </section>

        <!-- Histoire liée aux objets -->
        <section class="block">
          <h2 class="sec-title">{{ $t('personnage.throughWorks') }}</h2>
          <div v-if="objets.length" class="pobjs">
            <router-link v-for="o in objets" :key="o.id" :to="to(`/objets/${o.id}`)" class="pobj">
              <div class="pobj__img">
                <img v-if="o.photo" :src="o.photo" :alt="o.nom" />
                <div v-else class="ph"><i class="pi pi-box" /></div>
              </div>
              <div class="pobj__b">
                <span class="pobj__rel">{{ $t('personnage.objectRel', { rel: o.relation }) }}</span>
                <strong>{{ o.nom }}</strong>
                <p v-if="o.description">{{ o.description }}</p>
              </div>
            </router-link>
          </div>
          <p v-else class="muted">{{ $t('personnage.noWorks') }}</p>
        </section>

        <!-- Migrations : le déplacement de la lignée fait partie de son histoire -->
        <section v-if="migrations.length" class="block">
          <h2 class="sec-title">{{ $t('personnage.migrations') }}</h2>
          <ol class="migs">
            <li v-for="m in migrations" :key="m.id" class="mig">
              <span class="mig__pin"><i class="pi pi-directions" /></span>
              <div class="mig__b">
                <strong>
                  {{ m.lieuDepart || $t('personnage.migUnknown') }}
                  <i class="pi pi-arrow-right" />
                  {{ m.lieuArrivee || $t('personnage.migUnknown') }}
                </strong>
                <span v-if="m.date" class="mig__date">{{ m.date }}</span>
                <p v-if="m.recit">{{ m.recit }}</p>
              </div>
            </li>
          </ol>
        </section>

        <!-- Arbre généalogique -->
        <section v-if="hasTree" class="block">
          <h2 class="sec-title">{{ $t('personnage.tree') }}</h2>
          <GenealogyTree
            :people="personnes"
            :focus-id="person.id"
            :height="440"
            variant="public"
            @focus="$router.push(to(`/personnages/${$event}`))"
            @open="$router.push(to(`/personnages/${$event}`))"
          />
          <router-link :to="to(`/genealogie?p=${person.id}`)" class="ps-link tree-more">
            {{ $t('personnage.exploreAll') }} <i class="pi pi-arrow-right" />
          </router-link>
        </section>

        <!-- Guide contextuel -->
        <section class="block">
          <GuideInline
            :title="$t('personnage.guideTitle')"
            :context="fullName(person)"
            :suggestions="[$t('personnage.guideSug1', { name: person.nom }), $t('personnage.guideSug2')]"
          />
        </section>
      </div>
    </template>
    <div v-else class="wrap muted">{{ $t('personnage.notFound') }}</div>
  </div>
</template>

<style scoped>
/* ---- migrations ---- */
.migs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.7rem; }
.mig { display: flex; gap: 0.9rem; align-items: flex-start; }
.mig__pin {
  width: 34px; height: 34px; flex: 0 0 34px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--site-primary, #0e6f5c) 12%, #fff);
  color: var(--site-primary, #0e6f5c);
}
.mig__b { min-width: 0; }
.mig__b strong { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; font-size: 0.98rem; color: #101210; }
.mig__b strong i { color: var(--gold, #c9a227); font-size: 0.8rem; }
.mig__date { display: block; font-size: 0.78rem; color: #7c817b; font-variant-numeric: tabular-nums; }
.mig__b p { margin: 0.35rem 0 0; color: #3c403c; line-height: 1.65; font-size: 0.92rem; }
.tree-more { margin-top: 0.9rem; }

.wrap { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }
.muted { color: #897f70; padding: 2rem 0; }
.block { margin-top: 2.25rem; }
.sec-title { font-family: 'Fraunces', Georgia, serif; font-size: 1.5rem; margin: 0 0 1rem; }
.prose { line-height: 1.75; color: #4b4034; font-size: 1.02rem; max-width: 76ch; }

.p-hero { background: radial-gradient(120% 130% at 85% 10%, #4a3117, #17110b); color: #f4ead4; }
.p-hero__in { max-width: 1100px; margin: 0 auto; padding: 2.5rem 1.5rem 2.75rem; }
.back { color: #e0c9a6; font-size: 0.85rem; }
.p-id { display: flex; align-items: center; gap: 1.5rem; margin-top: 1.25rem; }
.p-id__img { width: 130px; height: 130px; border-radius: 18px; object-fit: cover; flex: 0 0 130px; box-shadow: 0 20px 50px -18px rgba(0,0,0,0.7), 0 0 0 1px rgba(205,162,78,0.35); }
.p-id__img--ph { display: flex; align-items: center; justify-content: center; background: #2a1c0f; color: #6b573a; font-size: 2.6rem; }
.p-id__titre { text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.72rem; color: var(--gold, #cda24e); font-weight: 700; }
.p-id h1 { font-family: 'Fraunces', Georgia, serif; font-size: clamp(1.8rem, 4vw, 2.7rem); margin: 0.2rem 0; color: #fff; }
.p-id__meta { display: flex; gap: 1.25rem; flex-wrap: wrap; margin: 0.3rem 0 0; color: #d8c8a8; font-size: 0.9rem; }
.p-id__meta i { margin-right: 0.3rem; color: var(--gold, #cda24e); }

.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 1rem; }
.fact { display: flex; gap: 0.8rem; background: #fff; border: 1px solid #e7ddcf; border-radius: 14px; padding: 1rem 1.1rem; }
.fact > i { color: var(--gold, #cda24e); font-size: 1.2rem; margin-top: 0.15rem; }
.fact strong { display: block; font-family: 'Fraunces', Georgia, serif; margin-bottom: 0.2rem; }
.fact span { display: block; color: #6b6052; font-size: 0.9rem; }
.fact__link { display: block; color: var(--site-primary, #a86b2d); font-weight: 600; font-size: 0.9rem; padding: 0.1rem 0; }
.fact__link:hover { color: var(--gold, #cda24e); }

.pobjs { display: flex; flex-direction: column; gap: 1rem; }
.pobj { display: grid; grid-template-columns: 150px 1fr; background: #fff; border: 1px solid #e7ddcf; border-radius: 16px; overflow: hidden; transition: 0.15s; }
.pobj:hover { transform: translateY(-3px); box-shadow: 0 18px 40px -20px rgba(62,42,22,0.35); border-color: var(--gold, #cda24e); }
.pobj__img { background: #f3ede3; min-height: 120px; }
.pobj__img img { width: 100%; height: 100%; object-fit: cover; }
.pobj__b { padding: 0.9rem 1.1rem; }
.pobj__rel { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold, #cda24e); font-weight: 700; }
.pobj__b strong { display: block; font-family: 'Fraunces', Georgia, serif; font-size: 1.15rem; margin: 0.15rem 0; }
.pobj__b p { margin: 0; color: #6b6052; font-size: 0.88rem; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #b3a695; font-size: 2rem; }
@media (max-width: 640px) { .pobj { grid-template-columns: 1fr; } .p-id { flex-direction: column; align-items: flex-start; } }
</style>
