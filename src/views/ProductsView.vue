<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useProductStore } from '@/stores/useProductStore'
import { useMuseumStore } from '@/stores/useMuseumStore'
import ProductFormDialog from '@/components/products/ProductFormDialog.vue'

const { t } = useI18n()
const store = useProductStore()
const museumStore = useMuseumStore()
const confirm = useConfirm()
const toast = useToast()
const dialog = ref(false)
const editing = ref(null)
const museumFilter = ref(null)
const statutFilter = ref(null)

onMounted(() => {
  store.load()
  if (!museumStore.items.length) museumStore.load()
})

const museumOptions = computed(() => museumStore.items.map((m) => ({ label: m.nom, value: m.id })))
function museumName(id) { return museumStore.items.find((m) => m.id === id)?.nom || '—' }

const statutOptions = computed(() => [
  { label: t('admin.common.online'), value: 'online' },
  { label: t('admin.common.offline'), value: 'draft' },
  { label: t('admin.products.outOfStock'), value: 'out' }
])

const rows = computed(() =>
  store.items.filter((p) => {
    if (museumFilter.value && p.museumId !== museumFilter.value) return false
    if (statutFilter.value === 'online' && !p.published) return false
    if (statutFilter.value === 'draft' && p.published) return false
    if (statutFilter.value === 'out' && p.stock !== 0) return false
    return true
  })
)
const published = computed(() => store.items.filter((p) => p.published).length)
const ruptures = computed(() => store.items.filter((p) => p.stock === 0).length)

function money(v, d) { return v == null ? '—' : `${Number(v).toLocaleString('fr-FR')} ${d || 'FCFA'}` }

function openCreate() { editing.value = null; dialog.value = true }
function openEdit(p) { editing.value = p; dialog.value = true }

async function toggle(p) {
  try { await store.togglePublished(p) }
  catch (e) { toast.add({ severity: 'error', summary: t('admin.products.failed'), detail: e.message, life: 3000 }) }
}
function remove(p) {
  confirm.require({
    message: t('admin.products.deleteConfirm', { name: p.nom }),
    header: t('admin.products.confirm'), icon: 'pi pi-exclamation-triangle',
    rejectLabel: t('admin.common.cancel'), acceptLabel: t('admin.common.delete'), acceptClass: 'p-button-danger',
    accept: async () => {
      try { await store.remove(p.id); toast.add({ severity: 'info', summary: t('admin.products.deleted'), life: 2000 }) }
      catch (e) { toast.add({ severity: 'error', summary: t('admin.products.failed'), detail: e.message, life: 3000 }) }
    }
  })
}
</script>

<template>
  <div class="vi-page">
    <div class="vi-page__header">
      <div>
        <h1 class="vi-page__title">{{ $t('admin.products.title') }}</h1>
        <p class="vi-page__subtitle">{{ $t('admin.products.subtitle', { n: store.items.length, p: published }) }}</p>
      </div>
      <div class="vi-page__actions">
        <Button :label="$t('admin.products.new')" icon="pi pi-plus" @click="openCreate" />
      </div>
    </div>

    <!-- Indicateurs : lire l'état du catalogue avant de le parcourir -->
    <div class="vi-stats">
      <div class="vi-stat">
        <span class="vi-stat__ic"><i class="pi pi-shopping-bag" /></span>
        <div class="vi-stat__b"><strong>{{ store.items.length }}</strong><span>{{ $t('admin.products.statTotal') }}</span></div>
      </div>
      <div class="vi-stat">
        <span class="vi-stat__ic vi-stat__ic--green"><i class="pi pi-check-circle" /></span>
        <div class="vi-stat__b"><strong>{{ published }}</strong><span>{{ $t('admin.products.statOnline') }}</span></div>
      </div>
      <div class="vi-stat">
        <span class="vi-stat__ic vi-stat__ic--orange"><i class="pi pi-pencil" /></span>
        <div class="vi-stat__b"><strong>{{ store.items.length - published }}</strong><span>{{ $t('admin.products.statDrafts') }}</span></div>
      </div>
      <div class="vi-stat">
        <span class="vi-stat__ic vi-stat__ic--red"><i class="pi pi-exclamation-triangle" /></span>
        <div class="vi-stat__b"><strong>{{ ruptures }}</strong><span>{{ $t('admin.products.statOutOfStock') }}</span></div>
      </div>
    </div>

    <!-- Filtres regroupés, séparés de l'action principale -->
    <div class="vi-toolbar">
      <i class="pi pi-filter" style="color:var(--vi-muted)" />
      <Select v-model="museumFilter" :options="museumOptions" option-label="label" option-value="value"
        :placeholder="$t('admin.products.allMuseums')" show-clear style="min-width:230px" />
      <Select v-model="statutFilter" :options="statutOptions" option-label="label" option-value="value"
        :placeholder="$t('admin.products.allStatuses')" show-clear style="min-width:170px" />
      <span class="vi-toolbar__grow" />
      <span class="vi-toolbar__count">{{ $t('admin.products.shown', { n: rows.length, total: store.items.length }) }}</span>
    </div>

    <DataTable :value="rows" data-key="id" paginator :rows="12" :loading="store.loading" removable-sort>
      <template #empty>
        <div class="vi-empty">
          <i class="pi pi-shopping-bag" />
          <strong>{{ $t('admin.products.emptyTitle') }}</strong>
          <p>{{ $t('admin.products.empty') }}</p>
          <Button :label="$t('admin.products.new')" icon="pi pi-plus" size="small" @click="openCreate" />
        </div>
      </template>

      <Column field="nom" :header="$t('admin.products.colName')" sortable>
        <template #body="{ data }">
          <div style="display:flex;align-items:center;gap:.7rem;min-width:0">
            <img v-if="data.image" :src="data.image" :alt="data.nom" class="cell-thumb" />
            <div v-else class="cell-thumb cell-thumb--ph"><i class="pi pi-image" /></div>
            <span class="cell-id">
              <strong>{{ data.nom }}</strong>
              <span><i class="pi pi-building" /> {{ museumName(data.museumId) }}</span>
            </span>
          </div>
        </template>
      </Column>
      <Column :header="$t('admin.products.colCategory')" style="width:11rem">
        <template #body="{ data }">
          <Tag v-if="data.categorie" :value="data.categorie" severity="secondary" />
          <span v-else class="vi-muted">—</span>
        </template>
      </Column>
      <Column field="prix" :header="$t('admin.products.colPrice')" sortable style="width:10rem"
        header-class="num" body-class="num">
        <template #body="{ data }"><strong>{{ money(data.prix, data.devise) }}</strong></template>
      </Column>
      <Column field="stock" :header="$t('admin.products.colStock')" sortable style="width:8rem"
        header-class="num" body-class="num">
        <template #body="{ data }">
          <span v-if="data.stock === 0" class="vi-dot vi-dot--bad">{{ $t('admin.products.outOfStock') }}</span>
          <span v-else-if="data.stock == null" class="vi-muted">∞</span>
          <span v-else>{{ data.stock }}</span>
        </template>
      </Column>
      <Column :header="$t('admin.products.colPublished')" style="width:9rem">
        <template #body="{ data }">
          <label class="pub-cell" :title="$t('admin.products.togglePublishHint')">
            <ToggleSwitch :model-value="data.published" @update:model-value="toggle(data)" />
            <span :class="data.published ? 'vi-dot vi-dot--on' : 'vi-dot vi-dot--off'">
              {{ data.published ? $t('admin.common.online') : $t('admin.common.offline') }}
            </span>
          </label>
        </template>
      </Column>
      <Column header="" style="width:6.5rem">
        <template #body="{ data }">
          <div class="row-actions">
            <Button icon="pi pi-pencil" text rounded v-tooltip.top="$t('admin.common.edit')"
              :aria-label="$t('admin.common.edit')" @click="openEdit(data)" />
            <Button icon="pi pi-trash" text rounded severity="danger" v-tooltip.top="$t('admin.common.delete')"
              :aria-label="$t('admin.common.delete')" @click="remove(data)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <ProductFormDialog v-model:visible="dialog" :product="editing" />
  </div>
</template>

<style scoped>
.vi-toolbar__count { font-size: 0.8rem; color: var(--vi-muted); white-space: nowrap; }
.vi-muted { color: var(--vi-muted); }
.pub-cell { display: inline-flex; align-items: center; gap: 0.5rem; cursor: pointer; }
</style>
