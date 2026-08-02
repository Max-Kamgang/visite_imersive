<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Rating from 'primevue/rating'
import ToggleSwitch from 'primevue/toggleswitch'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useEventStore } from '@/stores/useEventStore'
import { useReviewStore } from '@/stores/useReviewStore'
import { useMuseumStore } from '@/stores/useMuseumStore'
import EventFormDialog from '@/components/events/EventFormDialog.vue'

const { t } = useI18n()
const events = useEventStore()
const reviews = useReviewStore()
const museumStore = useMuseumStore()
const confirm = useConfirm()
const toast = useToast()
const dialog = ref(false)
const editing = ref(null)
const activeTab = ref('0')

onMounted(() => {
  events.load()
  reviews.load()
  if (!museumStore.items.length) museumStore.load()
})

function museumName(id) { return id == null ? t('admin.events.allMuseums') : museumStore.items.find((m) => m.id === id)?.nom || '—' }
function dateFmt(d) { return d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' }
function dateTimeFmt(d) { return d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—' }

const pendingCount = computed(() => reviews.pending.length)

function openCreate() { editing.value = null; dialog.value = true }
function openEdit(e) { editing.value = e; dialog.value = true }

async function toggleEvent(e) {
  try { await events.togglePublished(e) }
  catch (err) { toast.add({ severity: 'error', summary: t('admin.events.failed'), detail: err.message, life: 3000 }) }
}
function removeEvent(e) {
  confirm.require({
    message: t('admin.events.deleteConfirm', { name: e.titre }),
    header: t('admin.events.confirm'), icon: 'pi pi-exclamation-triangle',
    rejectLabel: t('admin.common.cancel'), acceptLabel: t('admin.common.delete'), acceptClass: 'p-button-danger',
    accept: async () => {
      try { await events.remove(e.id); toast.add({ severity: 'info', summary: t('admin.events.deleted'), life: 2000 }) }
      catch (err) { toast.add({ severity: 'error', summary: t('admin.events.failed'), detail: err.message, life: 3000 }) }
    }
  })
}

async function moderate(r, published) {
  try {
    await reviews.setPublished(r.id, published)
    toast.add({ severity: 'success', summary: published ? t('admin.reviews.approved') : t('admin.reviews.hidden'), life: 1800 })
  } catch (e) {
    toast.add({ severity: 'error', summary: t('admin.reviews.failed'), detail: e.message, life: 3000 })
  }
}
function removeReview(r) {
  confirm.require({
    message: t('admin.reviews.deleteConfirm', { name: r.nom }),
    header: t('admin.events.confirm'), icon: 'pi pi-exclamation-triangle',
    rejectLabel: t('admin.common.cancel'), acceptLabel: t('admin.common.delete'), acceptClass: 'p-button-danger',
    accept: async () => {
      try { await reviews.remove(r.id); toast.add({ severity: 'info', summary: t('admin.reviews.deleted'), life: 2000 }) }
      catch (e) { toast.add({ severity: 'error', summary: t('admin.reviews.failed'), detail: e.message, life: 3000 }) }
    }
  })
}
</script>

<template>
  <div class="vi-page">
    <div class="vi-page__header">
      <div>
        <h1 class="vi-page__title">{{ $t('admin.events.title') }}</h1>
        <p class="vi-page__subtitle">{{ $t('admin.events.subtitle', { n: events.items.length, r: pendingCount }) }}</p>
      </div>
      <Button v-if="activeTab === '0'" :label="$t('admin.events.new')" icon="pi pi-plus" @click="openCreate" />
    </div>

    <Tabs v-model:value="activeTab">
      <TabList>
        <Tab value="0"><i class="pi pi-calendar" /> {{ $t('admin.events.tabEvents') }}</Tab>
        <Tab value="1">
          <i class="pi pi-comments" /> {{ $t('admin.events.tabReviews') }}
          <Tag v-if="pendingCount" :value="pendingCount" severity="warn" style="margin-left:.4rem" />
        </Tab>
      </TabList>

      <TabPanels>
        <!-- Événements -->
        <TabPanel value="0">
          <DataTable :value="events.items" data-key="id" striped-rows paginator :rows="10" :loading="events.loading">
            <template #empty>
              <div class="vi-empty"><i class="pi pi-calendar" /><strong>{{ $t('admin.events.emptyTitle') }}</strong><p>{{ $t('admin.events.empty') }}</p></div>
            </template>
            <Column :header="$t('admin.events.colImage')" style="width:5.5rem">
              <template #body="{ data }">
                <img v-if="data.image" :src="data.image" :alt="data.titre" class="ethumb" />
                <div v-else class="ethumb ethumb--ph"><i class="pi pi-image" /></div>
              </template>
            </Column>
            <Column field="titre" :header="$t('admin.events.colTitle')" sortable />
            <Column :header="$t('admin.events.colMuseum')" style="width:15rem">
              <template #body="{ data }">{{ museumName(data.museumId) }}</template>
            </Column>
            <Column :header="$t('admin.events.colDates')" style="width:15rem">
              <template #body="{ data }">
                <span v-if="data.dateDebut">{{ dateFmt(data.dateDebut) }}<template v-if="data.dateFin"> → {{ dateFmt(data.dateFin) }}</template></span>
                <span v-else>—</span>
              </template>
            </Column>
            <Column :header="$t('admin.events.colPublished')" style="width:7rem">
              <template #body="{ data }"><ToggleSwitch :model-value="data.published" @update:model-value="toggleEvent(data)" /></template>
            </Column>
            <Column header="" style="width:7rem">
              <template #body="{ data }">
                <div class="row-actions">
                  <Button icon="pi pi-pencil" text rounded @click="openEdit(data)" />
                  <Button icon="pi pi-trash" text rounded severity="danger" @click="removeEvent(data)" />
                </div>
              </template>
            </Column>
          </DataTable>
        </TabPanel>

        <!-- Modération du livre d'or -->
        <TabPanel value="1">
          <DataTable :value="reviews.items" data-key="id" striped-rows paginator :rows="10" :loading="reviews.loading">
            <template #empty>
              <div class="vi-empty"><i class="pi pi-comments" /><strong>{{ $t('admin.reviews.emptyTitle') }}</strong><p>{{ $t('admin.reviews.empty') }}</p></div>
            </template>
            <Column field="nom" :header="$t('admin.reviews.colName')" sortable style="width:12rem" />
            <Column :header="$t('admin.reviews.colMessage')">
              <template #body="{ data }"><p class="rmsg">{{ data.message }}</p></template>
            </Column>
            <Column :header="$t('admin.reviews.colRating')" style="width:9rem">
              <template #body="{ data }">
                <Rating v-if="data.note" :model-value="data.note" readonly />
                <span v-else>—</span>
              </template>
            </Column>
            <Column :header="$t('admin.reviews.colMuseum')" style="width:13rem">
              <template #body="{ data }">{{ museumName(data.museumId) }}</template>
            </Column>
            <Column :header="$t('admin.reviews.colDate')" style="width:11rem">
              <template #body="{ data }">{{ dateTimeFmt(data.createdAt) }}</template>
            </Column>
            <Column :header="$t('admin.reviews.colStatus')" style="width:9rem">
              <template #body="{ data }">
                <Tag :value="data.published ? $t('admin.reviews.stPublished') : $t('admin.reviews.stPending')"
                  :severity="data.published ? 'success' : 'warn'" />
              </template>
            </Column>
            <Column header="" style="width:9rem">
              <template #body="{ data }">
                <div class="row-actions">
                  <Button v-if="!data.published" icon="pi pi-check" text rounded severity="success"
                    v-tooltip.top="$t('admin.reviews.approve')" @click="moderate(data, true)" />
                  <Button v-else icon="pi pi-eye-slash" text rounded severity="secondary"
                    v-tooltip.top="$t('admin.reviews.hide')" @click="moderate(data, false)" />
                  <Button icon="pi pi-trash" text rounded severity="danger" @click="removeReview(data)" />
                </div>
              </template>
            </Column>
          </DataTable>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <EventFormDialog v-model:visible="dialog" :event="editing" />
  </div>
</template>

<style scoped>
.ethumb { width: 46px; height: 46px; border-radius: 8px; object-fit: cover; display: block; }
.ethumb--ph { display: flex; align-items: center; justify-content: center; background: var(--vi-bg); color: var(--vi-muted); }
.rmsg { margin: 0; font-size: 0.88rem; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
