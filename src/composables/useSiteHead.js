// Applique les métadonnées SEO (title, description, mots-clés, Open Graph, favicon)
// et injecte Google Analytics à partir des réglages du site.
// Idempotent : réutilise/actualise les mêmes balises à chaque appel.

function setMeta(attr, key, content) {
  if (!content) return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setFavicon(href) {
  if (!href) return
  let el = document.head.querySelector('link[rel="icon"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'icon')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

let analyticsLoaded = false
function injectAnalytics(id) {
  if (!id || analyticsLoaded) return
  analyticsLoaded = true
  const s = document.createElement('script')
  s.async = true
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
  document.head.appendChild(s)
  const inline = document.createElement('script')
  inline.textContent =
    `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`
  document.head.appendChild(inline)
}

export function applySiteHead(s) {
  if (!s) return
  const title = s.seoTitre || s.nomEntite
  if (title) document.title = title
  setMeta('name', 'description', s.seoDescription)
  setMeta('name', 'keywords', s.seoMotsCles)
  // Open Graph (partage réseaux sociaux / WhatsApp)
  setMeta('property', 'og:title', title)
  setMeta('property', 'og:description', s.seoDescription)
  setMeta('property', 'og:type', 'website')
  setMeta('property', 'og:image', s.seoImage || s.imageFond)
  setMeta('name', 'twitter:card', s.seoImage || s.imageFond ? 'summary_large_image' : 'summary')
  setFavicon(s.favicon)
  injectAnalytics(s.analyticsId)
}
