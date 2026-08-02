<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Select from 'primevue/select'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import { useGenealogyStore } from '@/stores/useGenealogyStore'
import { normalise } from '@/services/genealogy'
import GenealogyTree from '@/components/genealogy/GenealogyTree.vue'
import IndividuFormDialog from '@/components/genealogy/IndividuFormDialog.vue'

const router = useRouter()
const { t } = useI18n()
const store = useGenealogyStore()
const indDialog = ref(false)

const chefOptions = computed(() =>
  store.chefs().map((c) => ({ label: `${store.nomComplet(c)}${c.titre ? ` — ${c.titre}` : ''}`, value: c.id }))
)
const selectedChefId = ref(null)

onMounted(() => { if (!store.individus.length) store.load() })
watch(
  () => store.individus.length,
  () => {
    if (!selectedChefId.value) selectedChefId.value = store.chefs()[0]?.id ?? store.individus[0]?.id ?? null
  },
  { immediate: true }
)

// L'arbre prend désormais la population entière et la personne à centrer :
// il déduit lui-même ascendants ET descendants (services/genealogy.js).
const personnes = computed(() => normalise(store.individus))
const objetsLies = computed(() => (selectedChefId.value ? store.objetsLies(selectedChefId.value) : []))

const activeTab = ref('0')

function individuName(id) {
  return store.nomComplet(store.getIndividu(id))
}
</script>

<template>
  <div class="vi-page">
    <div class="vi-page__header">
      <div>
        <h1 class="vi-page__title">{{ $t('admin.genealogy.title') }}</h1>
        <p class="vi-page__subtitle">{{ $t('admin.genealogy.subtitle') }}</p>
      </div>
      <div class="gen-actions">
        <Select
          v-model="selectedChefId"
          :options="chefOptions"
          option-label="label"
          option-value="value"
          :placeholder="$t('admin.genealogy.chooseChef')"
          style="min-width: 16rem"
        />
        <Button :label="$t('admin.genealogy.newIndividu')" icon="pi pi-user-plus" @click="indDialog = true" />
      </div>
    </div>

    <Tabs v-model:value="activeTab">
      <TabList>
        <Tab value="0"><i class="pi pi-share-alt" /> {{ $t('admin.genealogy.tabTree') }}</Tab>
        <Tab value="1"><i class="pi pi-users" /> {{ $t('admin.genealogy.tabMembers') }}</Tab>
        <Tab value="2"><i class="pi pi-map" /> {{ $t('admin.genealogy.tabHistory') }}</Tab>
        <Tab value="3"><i class="pi pi-box" /> {{ $t('admin.genealogy.tabObjects') }}</Tab>
      </TabList>

      <TabPanels>
        <!-- ARBRE -->
        <TabPanel value="0">
          <GenealogyTree
            v-if="selectedChefId"
            :people="personnes"
            :focus-id="selectedChefId"
            @focus="selectedChefId = $event"
          />
          <div v-else class="vi-empty"><i class="pi pi-share-alt" /><p>{{ $t('admin.genealogy.selectChef') }}</p></div>
        </TabPanel>

        <!-- MEMBRES -->
        <TabPanel value="1">
          <DataTable :value="store.individus" data-key="id" striped-rows removable-sort>
            <Column :header="$t('admin.genealogy.colName')">
              <template #body="{ data }">{{ store.nomComplet(data) }}</template>
            </Column>
            <Column field="titre" :header="$t('admin.genealogy.colTitle')">
              <template #body="{ data }">
                <Tag v-if="data.titre" :value="data.titre" severity="warn" />
                <span v-else>—</span>
              </template>
            </Column>
            <Column :header="$t('admin.genealogy.colLife')">
              <template #body="{ data }">{{ store.vieOf(data) || '—' }}</template>
            </Column>
            <Column field="lieuOrigine" :header="$t('admin.genealogy.colOrigin')">
              <template #body="{ data }">{{ data.lieuOrigine || '—' }}</template>
            </Column>
          </DataTable>
        </TabPanel>

        <!-- HISTOIRE & MIGRATIONS -->
        <TabPanel value="2">
          <ul v-if="store.migrations.length" class="mig">
            <li v-for="m in store.migrations" :key="m.id">
              <span class="mig__dot" />
              <div class="mig__body">
                <div class="mig__route">
                  <strong>{{ m.lieuDepart }}</strong>
                  <i class="pi pi-arrow-right" />
                  <strong>{{ m.lieuArrivee }}</strong>
                  <Tag :value="m.dateMigration" severity="secondary" class="mig__date" />
                </div>
                <p class="mig__recit">{{ m.recit }}</p>
                <small class="mig__who"><i class="pi pi-user" /> {{ individuName(m.individuId) }}</small>
              </div>
            </li>
          </ul>
          <div v-else class="vi-empty"><i class="pi pi-map" /><p>{{ $t('admin.genealogy.noMigrations') }}</p></div>
        </TabPanel>

        <!-- OBJETS LIÉS -->
        <TabPanel value="3">
          <div v-if="objetsLies.length" class="vi-grid">
            <article v-for="o in objetsLies" :key="o.id" class="olink">
              <div class="olink__media">
                <img v-if="o.photo" :src="o.photo" :alt="o.nom" />
                <div v-else class="olink__ph"><i class="pi pi-box" /></div>
              </div>
              <div class="olink__body">
                <strong>{{ o.nom }}</strong>
                <Tag :value="o.relation" severity="info" class="olink__rel" />
                <Button :label="$t('admin.genealogy.seeSheet')" icon="pi pi-arrow-right" icon-pos="right" text size="small" @click="router.push('/objets/' + o.id)" />
              </div>
            </article>
          </div>
          <div v-else class="vi-empty"><i class="pi pi-box" /><p>{{ $t('admin.genealogy.noObjects') }}</p></div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <IndividuFormDialog v-model:visible="indDialog" />
  </div>
</template>

<style scoped>
.gen-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}
/* Migrations */
.mig { list-style: none; margin: 0.5rem 0 0; padding: 0; }
.mig li { position: relative; padding: 0 0 1.3rem 1.6rem; }
.mig li:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 0.6rem;
  bottom: -0.2rem;
  width: 2px;
  background: var(--vi-border);
}
.mig__dot {
  position: absolute;
  left: 0;
  top: 0.4rem;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--p-primary-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--p-primary-color) 22%, transparent);
}
.mig__route { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.mig__route i { color: var(--vi-muted); font-size: 0.8rem; }
.mig__date { margin-left: 0.25rem; }
.mig__recit { margin: 0.3rem 0 0.2rem; color: var(--vi-text); font-size: 0.9rem; }
.mig__who { color: var(--vi-muted); }
.mig__who i { margin-right: 0.25rem; font-size: 0.72rem; }

/* Objets liés */
.olink {
  display: flex;
  gap: 0.85rem;
  background: var(--vi-surface);
  border: 1px solid var(--vi-border);
  border-radius: 14px;
  padding: 0.7rem;
  box-shadow: var(--vi-shadow-sm);
}
.olink__media { width: 84px; height: 84px; border-radius: 10px; overflow: hidden; flex: 0 0 84px; background: var(--vi-surface-2); }
.olink__media img { width: 100%; height: 100%; object-fit: cover; }
.olink__ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--vi-muted); font-size: 1.6rem; }
.olink__body { display: flex; flex-direction: column; gap: 0.35rem; align-items: flex-start; justify-content: center; }
.olink__rel { align-self: flex-start; }
</style>
