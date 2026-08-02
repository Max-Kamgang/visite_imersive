/* Service worker MUSÉA — écrit à la main (sans dépendance).
 * Stratégies :
 *  - Navigations (pages)  : réseau d'abord, repli cache si hors-ligne.
 *  - Assets statiques (js/css/polices/images) : cache d'abord, réseau en secours.
 *  - Jamais de cache pour Supabase (données fraîches + auth).
 * Incrémenter VERSION invalide tous les anciens caches au prochain chargement.
 */
const VERSION = 'musea-v1'
const RUNTIME = `${VERSION}-runtime`
const CORE = ['/site', '/manifest.webmanifest', '/pwa-192.png', '/pwa-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(RUNTIME).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Données dynamiques (Supabase, APIs) : toujours le réseau, jamais de cache.
  if (url.hostname.endsWith('supabase.co')) return

  // Pages : réseau d'abord (contenu frais), cache en secours (hors-ligne).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(RUNTIME).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/site')))
    )
    return
  }

  // Assets : cache d'abord, réseau en secours (et mise en cache au passage).
  const cacheable = ['script', 'style', 'image', 'font'].includes(req.destination)
  if (cacheable || url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && (res.type === 'basic' || res.type === 'cors')) {
              const copy = res.clone()
              caches.open(RUNTIME).then((c) => c.put(req, copy))
            }
            return res
          })
      )
    )
  }
})
