<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useFaqStore } from '@/stores/useFaqStore'
import FaqFormDialog from '@/components/faq/FaqFormDialog.vue'

const { t } = useI18n()
const store = useFaqStore()
const confirm = useConfirm()
const toast = useToast()
const dialog = ref(false)
const editing = ref(null)

onMounted(() => store.load())

function openCreate() { editing.value = null; dialog.value = true }
function openEdit(f) { editing.value = f; dialog.value = true }

async function toggle(f) {
  try { await store.toggleVisible(f) } catch (e) { toast.add({ severity: 'error', summary: t('admin.faq.failed'), detail: e.message, life: 3000 }) }
}
function remove(f) {
  confirm.require({
    message: t('admin.faq.deleteConfirm', { q: f.question }),
    header: t('admin.faq.confirm'), icon: 'pi pi-exclamation-triangle',
    rejectLabel: t('admin.common.cancel'), acceptLabel: t('admin.common.delete'), acceptClass: 'p-button-danger',
    accept: async () => {
      try { await store.remove(f.id); toast.add({ severity: 'info', summary: t('admin.faq.deleted'), life: 2000 }) }
      catch (e) { toast.add({ severity: 'error', summary: t('admin.faq.failed'), detail: e.message, life: 3000 }) }
    }
  })
}
</script>

<template>
  <div class="vi-page">
    <div class="vi-page__header">
      <div>
        <h1 class="vi-page__title">{{ $t('admin.faq.title') }}</h1>
        <p class="vi-page__subtitle">{{ $t('admin.faq.subtitle', { n: store.items.length }) }}</p>
      </div>
      <Button :label="$t('admin.faq.new')" icon="pi pi-plus" @click="openCreate" />
    </div>

    <DataTable :value="store.items" data-key="id" striped-rows>
      <template #empty><div class="vi-empty"><i class="pi pi-question-circle" /><strong>{{ $t('admin.faq.emptyTitle') }}</strong><p>{{ $t('admin.faq.empty') }}</p></div></template>
      <Column field="ordre" header="#" sortable style="width: 4rem" />
      <Column field="question" :header="$t('admin.faq.colQuestion')" sortable />
      <Column :header="$t('admin.faq.colCategory')" style="width: 12rem">
        <template #body="{ data }"><Tag v-if="data.categorie" :value="data.categorie" severity="info" /><span v-else>—</span></template>
      </Column>
      <Column :header="$t('admin.faq.colVisible')" style="width: 7rem">
        <template #body="{ data }"><ToggleSwitch :model-value="data.visible" @update:model-value="toggle(data)" /></template>
      </Column>
      <Column header="" style="width: 7rem">
        <template #body="{ data }">
          <div class="row-actions">
            <Button icon="pi pi-pencil" text rounded @click="openEdit(data)" />
            <Button icon="pi pi-trash" text rounded severity="danger" @click="remove(data)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <FaqFormDialog v-model:visible="dialog" :faq="editing" />
  </div>
</template>
