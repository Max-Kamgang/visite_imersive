<script setup>
import { reactive, ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useAuthStore } from '@/stores/useAuthStore'
import ImageUploader from '@/components/common/ImageUploader.vue'

const { t } = useI18n()
const router = useRouter()
const store = useSettingsStore()
const toast = useToast()
const saving = ref(false)

// Ouvre, dans un nouvel onglet, la page exacte que voient les visiteurs en maintenance.
// On enregistre d'abord pour que le message affiché soit bien le dernier saisi.
// L'aperçu doit viser MON organisation : /site afficherait celle du premier inscrit.
async function previewMaintenance() {
  try { await store.save(form) } catch { /* on prévisualise quand même */ }
  const auth = useAuthStore()
  const chemin = auth.tenant?.slug ? `/c/${auth.tenant.slug}` : '/site'
  const href = router.resolve({ path: chemin, query: { preview: 'maintenance' } }).href
  window.open(href, '_blank')
}

const form = reactive({
  nomEntite: '', logo: '', favicon: '', imageFond: '',
  marque: '', marqueInitiale: '', heroImage: '',
  loginImage: '', loginTitre: '', loginSousTitre: '',
  couleurPrimaire: '#a86b2d', couleurSecondaire: '#ffffff', accroche: '',
  contactEmail: '', contactTel: '', adresse: '',
  reseaux: { facebook: '', instagram: '', youtube: '', tiktok: '', twitter: '', linkedin: '', whatsapp: '' },
  langues: ['fr', 'en'], langueDefaut: 'fr',
  authGoogle: true, authEmail: true,
  mentionsLegales: '', confidentialite: '',
  // SEO & partage
  seoTitre: '', seoDescription: '', seoMotsCles: '', seoImage: '', analyticsId: '',
  // Bandeau d'annonce
  bandeauActif: false, bandeauTexte: '', bandeauCouleur: '#a86b2d', bandeauLien: '',
  // Accueil / Hero
  heroTitre: '', heroSousTitre: '', heroCtaTexte: '', heroCtaLien: '',
  // Infos pratiques
  horaires: '', joursFermeture: '', tarifEntree: '', mapsUrl: '',
  // Maintenance
  maintenanceActif: false, maintenanceMessage: '',
  // Pied de page
  footerTexte: '', footerLiens: [],
  // Blocs de l'accueil personnalisables (vides = textes par défaut)
  badges: [], bandeGenealogie: { over: '', titre: '', lead: '', cta: '' },
  blocPwa: { eyebrow: '', titre: '', lead: '', perks: [] }
})

const BADGE_ICONS = [
  'pi-verified', 'pi-box', 'pi-sitemap', 'pi-star', 'pi-shield', 'pi-globe',
  'pi-heart', 'pi-microphone', 'pi-map-marker', 'pi-clock'
]
function addBadge() {
  if (form.badges.length >= 4) return
  form.badges.push({ icon: 'pi-verified', titre: '', sous_titre: '' })
}
function removeBadge(i) { form.badges.splice(i, 1) }
function addPerk() { if (form.blocPwa.perks.length < 5) form.blocPwa.perks.push('') }
function removePerk(i) { form.blocPwa.perks.splice(i, 1) }

onMounted(async () => {
  await store.load()
  const s = store.settings
  if (s) Object.assign(form, {
    ...s,
    reseaux: { facebook: '', instagram: '', youtube: '', tiktok: '', twitter: '', linkedin: '', whatsapp: '', ...(s.reseaux || {}) },
    footerLiens: Array.isArray(s.footerLiens) ? s.footerLiens.map((l) => ({ ...l })) : [],
    // JSONB : null en base = « textes par défaut » → on repart de structures vides.
    badges: Array.isArray(s.badges) ? s.badges.map((b) => ({ ...b })) : [],
    bandeGenealogie: { over: '', titre: '', lead: '', cta: '', ...(s.bandeGenealogie || {}) },
    blocPwa: {
      eyebrow: '', titre: '', lead: '',
      ...(s.blocPwa || {}),
      perks: Array.isArray(s.blocPwa?.perks) ? [...s.blocPwa.perks] : []
    }
  })
})

function addFooterLink() { form.footerLiens.push({ label: '', url: '' }) }
function removeFooterLink(i) { form.footerLiens.splice(i, 1) }

// Quand l'admin active la maintenance, on lui montre aussitôt la page visiteur.
const mounted = ref(false)
onMounted(() => { mounted.value = true })
watch(() => form.maintenanceActif, (on, was) => {
  if (mounted.value && on && !was) previewMaintenance()
})

const languesText = computed({
  get: () => form.langues.join(', '),
  set: (v) => { form.langues = v.split(',').map((x) => x.trim()).filter(Boolean) }
})

// Un bloc laissé vide est enregistré à NULL : le site reprend alors les textes
// par défaut (traductions) au lieu d'afficher des rubriques vides.
function blocOuNull(obj, champs) {
  return champs.some((c) => String(obj?.[c] || '').trim()) ? obj : null
}

async function save() {
  saving.value = true
  try {
    const badges = form.badges.filter((b) => String(b.titre || '').trim())
    const perks = form.blocPwa.perks.filter((p) => String(p || '').trim())
    await store.save({
      ...form,
      badges: badges.length ? badges : null,
      bandeGenealogie: blocOuNull(form.bandeGenealogie, ['over', 'titre', 'lead', 'cta']),
      blocPwa: (perks.length || blocOuNull(form.blocPwa, ['eyebrow', 'titre', 'lead']))
        ? { ...form.blocPwa, perks }
        : null
    })
    toast.add({ severity: 'success', summary: t('admin.settings.saved'), detail: t('admin.settings.savedDetail'), life: 2500 })
  } catch (e) {
    toast.add({ severity: 'error', summary: t('admin.settings.failed'), detail: e.message, life: 3500 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="vi-page">
    <div class="vi-page__header">
      <div>
        <h1 class="vi-page__title">{{ $t('admin.settings.title') }}</h1>
        <p class="vi-page__subtitle">{{ $t('admin.settings.subtitle') }}</p>
      </div>
      <Button :label="$t('admin.settings.save')" icon="pi pi-check" :loading="saving" @click="save" />
    </div>

    <div class="settings">
      <section class="scard">
        <h2>{{ $t('admin.settings.brand') }}</h2>
        <p class="scard__hint">{{ $t('admin.settings.brandHint') }}</p>
        <div class="vi-row">
          <div class="vi-field">
            <label>{{ $t('admin.settings.brandName') }}</label>
            <InputText v-model="form.marque" :placeholder="form.nomEntite || 'MUSÉA'" />
            <small>{{ $t('admin.settings.brandNameHint') }}</small>
          </div>
          <div class="vi-field" style="flex:0 1 150px">
            <label>{{ $t('admin.settings.brandInitial') }}</label>
            <InputText v-model="form.marqueInitiale" maxlength="3" placeholder="M" />
            <small>{{ $t('admin.settings.brandInitialHint') }}</small>
          </div>
        </div>
        <div class="vi-field">
          <label>{{ $t('admin.settings.heroImage') }}</label>
          <ImageUploader v-model="form.heroImage" :label="$t('admin.settings.heroImageUploader')" height="150px" />
          <small>{{ $t('admin.settings.heroImageHint') }}</small>
        </div>
      </section>

      <section class="scard">
        <h2>{{ $t('admin.settings.loginPage') }}</h2>
        <p class="scard__hint">{{ $t('admin.settings.loginPageHint') }}</p>
        <div class="vi-field">
          <label>{{ $t('admin.settings.loginImage') }}</label>
          <ImageUploader v-model="form.loginImage" :label="$t('admin.settings.loginImageUploader')" height="150px" />
        </div>
        <div class="vi-field">
          <label>{{ $t('admin.settings.loginTitle') }}</label>
          <InputText v-model="form.loginTitre" :placeholder="$t('admin.settings.loginTitlePlaceholder')" />
        </div>
        <div class="vi-field">
          <label>{{ $t('admin.settings.loginSubtitle') }}</label>
          <InputText v-model="form.loginSousTitre" :placeholder="$t('admin.settings.loginSubtitlePlaceholder')" />
        </div>
      </section>

      <!-- Blocs de la page d'accueil : personnalisables par organisation -->
      <section class="scard">
        <h2>{{ $t('admin.settings.blocksTitle') }}</h2>
        <p class="scard__hint">{{ $t('admin.settings.blocksHint') }}</p>

        <h3 class="sblock">{{ $t('admin.settings.badgesTitle') }}</h3>
        <div v-for="(b, i) in form.badges" :key="i" class="brow">
          <Select v-model="b.icon" :options="BADGE_ICONS" class="brow__ic">
            <template #value="{ value }"><i :class="`pi ${value}`" /></template>
            <template #option="{ option }"><i :class="`pi ${option}`" /> <span class="brow__icname">{{ option.replace('pi-', '') }}</span></template>
          </Select>
          <InputText v-model="b.titre" :placeholder="$t('admin.settings.badgeTitlePlaceholder')" />
          <InputText v-model="b.sous_titre" :placeholder="$t('admin.settings.badgeSubPlaceholder')" />
          <Button icon="pi pi-trash" text rounded severity="danger" :aria-label="$t('admin.common.delete')" @click="removeBadge(i)" />
        </div>
        <Button v-if="form.badges.length < 4" :label="$t('admin.settings.addBadge')" icon="pi pi-plus"
                text size="small" @click="addBadge" />

        <h3 class="sblock">{{ $t('admin.settings.bandTitle') }}</h3>
        <div class="vi-row">
          <div class="vi-field">
            <label>{{ $t('admin.settings.bandOver') }}</label>
            <InputText v-model="form.bandeGenealogie.over" :placeholder="$t('admin.settings.defaultPlaceholder')" />
          </div>
          <div class="vi-field">
            <label>{{ $t('admin.settings.bandCta') }}</label>
            <InputText v-model="form.bandeGenealogie.cta" :placeholder="$t('admin.settings.defaultPlaceholder')" />
          </div>
        </div>
        <div class="vi-field">
          <label>{{ $t('admin.settings.bandHeading') }}</label>
          <InputText v-model="form.bandeGenealogie.titre" :placeholder="$t('admin.settings.defaultPlaceholder')" />
        </div>
        <div class="vi-field">
          <label>{{ $t('admin.settings.bandLead') }}</label>
          <Textarea v-model="form.bandeGenealogie.lead" rows="2" auto-resize :placeholder="$t('admin.settings.defaultPlaceholder')" />
        </div>

        <h3 class="sblock">{{ $t('admin.settings.pwaTitle') }}</h3>
        <div class="vi-row">
          <div class="vi-field">
            <label>{{ $t('admin.settings.pwaEyebrow') }}</label>
            <InputText v-model="form.blocPwa.eyebrow" :placeholder="$t('admin.settings.defaultPlaceholder')" />
          </div>
          <div class="vi-field">
            <label>{{ $t('admin.settings.pwaHeading') }}</label>
            <InputText v-model="form.blocPwa.titre" :placeholder="$t('admin.settings.defaultPlaceholder')" />
          </div>
        </div>
        <div class="vi-field">
          <label>{{ $t('admin.settings.pwaLead') }}</label>
          <Textarea v-model="form.blocPwa.lead" rows="2" auto-resize :placeholder="$t('admin.settings.defaultPlaceholder')" />
        </div>
        <label class="sublbl">{{ $t('admin.settings.pwaPerks') }}</label>
        <div v-for="(p, i) in form.blocPwa.perks" :key="i" class="brow brow--perk">
          <InputText v-model="form.blocPwa.perks[i]" :placeholder="$t('admin.settings.pwaPerkPlaceholder')" />
          <Button icon="pi pi-trash" text rounded severity="danger" :aria-label="$t('admin.common.delete')" @click="removePerk(i)" />
        </div>
        <Button v-if="form.blocPwa.perks.length < 5" :label="$t('admin.settings.addPerk')" icon="pi pi-plus"
                text size="small" @click="addPerk" />
      </section>

      <section class="scard">
        <h2>{{ $t('admin.settings.identity') }}</h2>
        <div class="vi-field">
          <label>{{ $t('admin.settings.entityName') }}</label>
          <InputText v-model="form.nomEntite" />
        </div>
        <div class="vi-field">
          <label>{{ $t('admin.settings.tagline') }}</label>
          <InputText v-model="form.accroche" :placeholder="$t('admin.settings.taglinePlaceholder')" />
        </div>
        <div class="vi-row">
          <div class="vi-field"><label>{{ $t('admin.settings.logo') }}</label><ImageUploader v-model="form.logo" :label="$t('admin.settings.logoUploader')" height="120px" /></div>
          <div class="vi-field"><label>{{ $t('admin.settings.favicon') }}</label><ImageUploader v-model="form.favicon" :label="$t('admin.settings.faviconUploader')" height="120px" /></div>
        </div>
        <div class="vi-field"><label>{{ $t('admin.settings.background') }}</label><ImageUploader v-model="form.imageFond" :label="$t('admin.settings.backgroundUploader')" height="150px" /></div>
        <div class="vi-row">
          <div class="vi-field">
            <label>{{ $t('admin.settings.primaryColor') }}</label>
            <div class="color-row"><span class="swatch" :style="{ background: form.couleurPrimaire }" /><InputText v-model="form.couleurPrimaire" placeholder="#a86b2d" /></div>
          </div>
          <div class="vi-field">
            <label>{{ $t('admin.settings.secondaryColor') }}</label>
            <div class="color-row"><span class="swatch" :style="{ background: form.couleurSecondaire }" /><InputText v-model="form.couleurSecondaire" placeholder="#ffffff" /></div>
          </div>
        </div>
      </section>

      <section class="scard">
        <h2>{{ $t('admin.settings.contact') }}</h2>
        <div class="vi-row">
          <div class="vi-field"><label>{{ $t('admin.settings.email') }}</label><InputText v-model="form.contactEmail" /></div>
          <div class="vi-field"><label>{{ $t('admin.settings.phone') }}</label><InputText v-model="form.contactTel" /></div>
        </div>
        <div class="vi-field"><label>{{ $t('admin.settings.address') }}</label><InputText v-model="form.adresse" /></div>
        <div class="vi-row">
          <div class="vi-field"><label>Facebook</label><InputText v-model="form.reseaux.facebook" placeholder="https://…" /></div>
          <div class="vi-field"><label>Instagram</label><InputText v-model="form.reseaux.instagram" placeholder="https://…" /></div>
          <div class="vi-field"><label>YouTube</label><InputText v-model="form.reseaux.youtube" placeholder="https://…" /></div>
        </div>
        <div class="vi-row">
          <div class="vi-field"><label>TikTok</label><InputText v-model="form.reseaux.tiktok" placeholder="https://…" /></div>
          <div class="vi-field"><label>X / Twitter</label><InputText v-model="form.reseaux.twitter" placeholder="https://…" /></div>
          <div class="vi-field"><label>LinkedIn</label><InputText v-model="form.reseaux.linkedin" placeholder="https://…" /></div>
          <div class="vi-field"><label>WhatsApp</label><InputText v-model="form.reseaux.whatsapp" placeholder="https://wa.me/…" /></div>
        </div>
      </section>

      <section class="scard">
        <h2>{{ $t('admin.settings.langAuth') }}</h2>
        <div class="vi-row">
          <div class="vi-field"><label>{{ $t('admin.settings.langs') }}</label><InputText v-model="languesText" placeholder="fr, en" /></div>
          <div class="vi-field" style="flex:0 1 160px"><label>{{ $t('admin.settings.defaultLang') }}</label><Select v-model="form.langueDefaut" :options="form.langues" /></div>
        </div>
        <div class="auth-toggles">
          <div class="auth-toggle"><ToggleSwitch v-model="form.authGoogle" input-id="ag" /><label for="ag">{{ $t('admin.settings.authGoogle') }}</label></div>
          <div class="auth-toggle"><ToggleSwitch v-model="form.authEmail" input-id="ae" /><label for="ae">{{ $t('admin.settings.authEmail') }}</label></div>
        </div>
        <Message severity="secondary" :closable="false">{{ $t('admin.settings.authNote') }}</Message>
      </section>

      <section class="scard">
        <h2>{{ $t('admin.settings.seo') }}</h2>
        <div class="vi-field"><label>{{ $t('admin.settings.seoTitle') }}</label><InputText v-model="form.seoTitre" :placeholder="$t('admin.settings.seoTitlePlaceholder')" /></div>
        <div class="vi-field"><label>{{ $t('admin.settings.seoDesc') }}</label><Textarea v-model="form.seoDescription" rows="2" auto-resize :placeholder="$t('admin.settings.seoDescPlaceholder')" /></div>
        <div class="vi-field"><label>{{ $t('admin.settings.seoKeywords') }}</label><InputText v-model="form.seoMotsCles" placeholder="musée, art, Cameroun…" /></div>
        <div class="vi-field"><label>{{ $t('admin.settings.seoImage') }}</label><ImageUploader v-model="form.seoImage" :label="$t('admin.settings.seoImageUploader')" height="130px" /></div>
        <div class="vi-field"><label>{{ $t('admin.settings.analytics') }}</label><InputText v-model="form.analyticsId" placeholder="G-XXXXXXXXXX" /><small>{{ $t('admin.settings.analyticsHint') }}</small></div>
      </section>

      <section class="scard">
        <h2>{{ $t('admin.settings.banner') }}</h2>
        <div class="auth-toggle"><ToggleSwitch v-model="form.bandeauActif" input-id="bnr" /><label for="bnr">{{ $t('admin.settings.bannerEnable') }}</label></div>
        <div class="vi-field"><label>{{ $t('admin.settings.bannerText') }}</label><InputText v-model="form.bandeauTexte" :placeholder="$t('admin.settings.bannerTextPlaceholder')" /></div>
        <div class="vi-row">
          <div class="vi-field"><label>{{ $t('admin.settings.bannerLink') }}</label><InputText v-model="form.bandeauLien" placeholder="/site/musees" /></div>
          <div class="vi-field" style="flex:0 1 200px">
            <label>{{ $t('admin.settings.bannerColor') }}</label>
            <div class="color-row"><span class="swatch" :style="{ background: form.bandeauCouleur }" /><InputText v-model="form.bandeauCouleur" placeholder="#a86b2d" /></div>
          </div>
        </div>
      </section>

      <section class="scard">
        <h2>{{ $t('admin.settings.hero') }}</h2>
        <p class="scard__hint">{{ $t('admin.settings.heroHint') }}</p>
        <div class="vi-field"><label>{{ $t('admin.settings.heroTitle') }}</label><InputText v-model="form.heroTitre" :placeholder="$t('admin.settings.heroTitlePlaceholder')" /></div>
        <div class="vi-field"><label>{{ $t('admin.settings.heroSubtitle') }}</label><Textarea v-model="form.heroSousTitre" rows="2" auto-resize /></div>
        <div class="vi-row">
          <div class="vi-field"><label>{{ $t('admin.settings.heroCtaText') }}</label><InputText v-model="form.heroCtaTexte" :placeholder="$t('admin.settings.heroCtaTextPlaceholder')" /></div>
          <div class="vi-field"><label>{{ $t('admin.settings.heroCtaLink') }}</label><InputText v-model="form.heroCtaLien" placeholder="/site/musees" /></div>
        </div>
      </section>

      <section class="scard">
        <h2>{{ $t('admin.settings.practical') }}</h2>
        <div class="vi-field"><label>{{ $t('admin.settings.hours') }}</label><Textarea v-model="form.horaires" rows="2" auto-resize :placeholder="$t('admin.settings.hoursPlaceholder')" /></div>
        <div class="vi-row">
          <div class="vi-field"><label>{{ $t('admin.settings.closingDays') }}</label><InputText v-model="form.joursFermeture" :placeholder="$t('admin.settings.closingDaysPlaceholder')" /></div>
          <div class="vi-field"><label>{{ $t('admin.settings.entryFee') }}</label><InputText v-model="form.tarifEntree" :placeholder="$t('admin.settings.entryFeePlaceholder')" /></div>
        </div>
        <div class="vi-field"><label>{{ $t('admin.settings.maps') }}</label><InputText v-model="form.mapsUrl" placeholder="https://maps.google.com/…" /></div>
      </section>

      <section class="scard">
        <h2>{{ $t('admin.settings.footer') }}</h2>
        <div class="vi-field"><label>{{ $t('admin.settings.footerText') }}</label><Textarea v-model="form.footerTexte" rows="2" auto-resize /></div>
        <label>{{ $t('admin.settings.footerLinks') }}</label>
        <div v-for="(lnk, i) in form.footerLiens" :key="i" class="link-row">
          <InputText v-model="lnk.label" :placeholder="$t('admin.settings.footerLinkLabel')" />
          <InputText v-model="lnk.url" placeholder="https://… /site/…" />
          <Button icon="pi pi-trash" severity="danger" text @click="removeFooterLink(i)" />
        </div>
        <Button :label="$t('admin.settings.footerAddLink')" icon="pi pi-plus" text size="small" @click="addFooterLink" />
      </section>

      <section class="scard scard--warn">
        <h2>{{ $t('admin.settings.maintenance') }}</h2>
        <div class="auth-toggle"><ToggleSwitch v-model="form.maintenanceActif" input-id="mnt" /><label for="mnt">{{ $t('admin.settings.maintenanceEnable') }}</label></div>
        <div class="vi-field"><label>{{ $t('admin.settings.maintenanceMessage') }}</label><Textarea v-model="form.maintenanceMessage" rows="2" auto-resize :placeholder="$t('admin.settings.maintenanceMessagePlaceholder')" /></div>
        <Button :label="$t('admin.settings.maintenancePreview')" icon="pi pi-eye" severity="secondary" outlined size="small" @click="previewMaintenance" />
        <Message v-if="form.maintenanceActif" severity="warn" :closable="false">{{ $t('admin.settings.maintenanceWarn') }}</Message>
      </section>

      <section class="scard">
        <h2>{{ $t('admin.settings.legal') }}</h2>
        <div class="vi-field"><label>{{ $t('admin.settings.legalNotice') }}</label><Textarea v-model="form.mentionsLegales" rows="3" auto-resize /></div>
        <div class="vi-field"><label>{{ $t('admin.settings.privacy') }}</label><Textarea v-model="form.confidentialite" rows="3" auto-resize /></div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1.25rem; align-items: start; }
.scard { background: var(--vi-surface); border: 1px solid var(--vi-border); border-radius: 16px; padding: 1.1rem 1.25rem 1.3rem; box-shadow: var(--vi-shadow-sm); }
.scard h2 { font-family: var(--vi-serif); font-size: 1.1rem; margin: 0 0 1rem; }
.color-row { display: flex; align-items: center; gap: 0.5rem; }
.swatch { width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--vi-border); flex: 0 0 34px; }
.auth-toggles { display: flex; flex-direction: column; gap: 0.6rem; margin: 0.5rem 0 1rem; }
.auth-toggle { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 0.7rem; }
.scard__hint { margin: -0.4rem 0 0.9rem; font-size: 0.85rem; color: var(--vi-muted); }
.sblock { font-size: 0.72rem; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; color: var(--p-primary-color); margin: 1.5rem 0 0.8rem; padding-top: 1rem; border-top: 1px solid var(--vi-border, #E9EDF2); }
.sblock:first-of-type { margin-top: 0.2rem; padding-top: 0; border-top: none; }
.sublbl { display: block; font-size: 0.8rem; font-weight: 600; color: var(--vi-muted); margin: 0.9rem 0 0.5rem; }
.brow { display: grid; grid-template-columns: 5.5rem 1fr 1fr auto; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; }
.brow--perk { grid-template-columns: 1fr auto; }
.brow__icname { margin-left: 0.4rem; font-size: 0.82rem; }
@media (max-width: 640px) { .brow { grid-template-columns: 1fr auto; } .brow__ic { grid-column: 1 / -1; } }
.scard--warn { border-color: #e6b800; }
.link-row { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; }
.link-row :deep(input) { flex: 1; }
</style>
