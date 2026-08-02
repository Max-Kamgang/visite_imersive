import { createI18n } from 'vue-i18n'
import fr from './fr'
import en from './en'

export const SUPPORTED = ['fr', 'en']
const KEY = 'musea-lang'

function detectLocale() {
  const saved = localStorage.getItem(KEY)
  if (saved && SUPPORTED.includes(saved)) return saved
  const nav = (navigator.language || 'fr').slice(0, 2).toLowerCase()
  return SUPPORTED.includes(nav) ? nav : 'fr'
}

const i18n = createI18n({
  legacy: false, // API Composition (useI18n / $t)
  globalInjection: true, // $t, $d… disponibles dans tous les templates
  locale: detectLocale(),
  fallbackLocale: 'fr',
  messages: { fr, en },
})

// Change la langue, la mémorise et met à jour l'attribut <html lang>.
export function setLocale(locale) {
  if (!SUPPORTED.includes(locale)) return
  i18n.global.locale.value = locale
  localStorage.setItem(KEY, locale)
  document.documentElement.setAttribute('lang', locale)
}

// Applique la langue détectée au <html> dès le chargement.
document.documentElement.setAttribute('lang', i18n.global.locale.value)

export default i18n
