<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/stores/useAuthStore'

// « Mes visiteurs » — le public propre à l'organisation (V2 Phase 1).
// S'appuie sur la RPC tenant_audience() : la base vérifie can_manage_tenant(),
// un admin ne voit donc jamais les adhérents d'une autre organisation.

const { t, locale } = useI18n()
const toast = useToast()
const auth = useAuthStore()

const rows = ref([])
const loading = ref(false)
const search = ref('')

onMounted(load)

async function load() {
  const id = auth.tenantId
  if (id == null) { rows.value = []; return }
  loading.value = true
  const { data, error } = await supabase.rpc('tenant_audience', { p_tenant_id: id })
  if (error) toast.add({ severity: 'error', summary: t('admin.audience.failed'), detail: error.message, life: 3500 })
  rows.value = (data || []).map((r) => ({
    id: r.member_id, userId: r.user_id, email: r.email, nom: r.nom_affiche,
    role: r.role, statut: r.statut, accepteEmails: r.accepte_emails,
    source: r.source, createdAt: r.created_at, derniereVisite: r.derniere_visite
  }))
  loading.value = false
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((r) =>
    (r.email || '').toLowerCase().includes(q) || (r.nom || '').toLowerCase().includes(q))
})
const optedIn = computed(() => rows.value.filter((r) => r.accepteEmails && r.statut === 'actif').length)

function fmt(d) {
  return d ? new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'medium' }).format(new Date(d)) : '—'
}

// Export CSV : sert dès aujourd'hui, et alimentera les campagnes (Phase 4).
function exportCsv() {
  const head = ['email', 'nom', 'role', 'statut', 'accepte_emails', 'source', 'inscrit_le', 'derniere_visite']
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const body = filtered.value.map((r) =>
    [r.email, r.nom, r.role, r.statut, r.accepteEmails, r.source, r.createdAt, r.derniereVisite].map(esc).join(','))
  const csv = [head.join(','), ...body].join('\n')
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `visiteurs-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="vi-page">
    <div class="vi-page__header">
      <div>
        <h1 class="vi-page__title">{{ $t('admin.audience.title') }}</h1>
        <p class="vi-page__subtitle">{{ $t('admin.audience.subtitle', { n: rows.length, o: optedIn }) }}</p>
      </div>
      <Button :label="$t('admin.audience.export')" icon="pi pi-download" severity="secondary" outlined
              :disabled="!filtered.length" @click="exportCsv" />
    </div>

    <div class="vi-stats">
      <div class="vi-stat"><span class="vi-stat__label">{{ $t('admin.audience.statTotal') }}</span><strong>{{ rows.length }}</strong></div>
      <div class="vi-stat"><span class="vi-stat__label">{{ $t('admin.audience.statOptin') }}</span><strong>{{ optedIn }}</strong></div>
    </div>

    <div class="vi-toolbar">
      <InputText v-model="search" :placeholder="$t('admin.audience.search')" />
      <Button icon="pi pi-refresh" text rounded :aria-label="$t('admin.common.refresh')" @click="load" />
    </div>

    <DataTable :value="filtered" data-key="id" striped-rows paginator :rows="15" :loading="loading">
      <template #empty>
        <div class="vi-empty">
          <i class="pi pi-users" />
          <strong>{{ $t('admin.audience.emptyTitle') }}</strong>
          <p>{{ $t('admin.audience.empty') }}</p>
        </div>
      </template>
      <Column field="email" :header="$t('admin.audience.colEmail')" sortable />
      <Column field="nom" :header="$t('admin.audience.colName')" sortable>
        <template #body="{ data }">{{ data.nom || '—' }}</template>
      </Column>
      <Column :header="$t('admin.audience.colStatus')" style="width:9rem">
        <template #body="{ data }">
          <Tag :value="data.statut" :severity="data.statut === 'actif' ? 'success' : 'secondary'" />
        </template>
      </Column>
      <Column :header="$t('admin.audience.colEmails')" style="width:9rem">
        <template #body="{ data }">
          <Tag :value="data.accepteEmails ? $t('admin.audience.optinYes') : $t('admin.audience.optinNo')"
               :severity="data.accepteEmails ? 'info' : 'warn'" />
        </template>
      </Column>
      <Column field="source" :header="$t('admin.audience.colSource')" style="width:8rem">
        <template #body="{ data }">{{ data.source || '—' }}</template>
      </Column>
      <Column :header="$t('admin.audience.colSince')" style="width:10rem">
        <template #body="{ data }">{{ fmt(data.createdAt) }}</template>
      </Column>
      <Column :header="$t('admin.audience.colLastSeen')" style="width:10rem">
        <template #body="{ data }">{{ fmt(data.derniereVisite) }}</template>
      </Column>
    </DataTable>
  </div>
</template>
