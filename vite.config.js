import { fileURLToPath, URL } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// HTTPS de développement — SUR DEMANDE UNIQUEMENT, jamais par défaut.
//
//   npm run dev         → http://localhost:5173, comme toujours
//   npm run dev:phone   → https://<ip-du-poste>:5173, pour tester la RA
//
// Pourquoi ce second mode existe : WebXR n'est disponible que dans un contexte
// sécurisé. Sur http://192.168.x.x, `navigator.xr` n'existe pas et le bouton de
// réalité augmentée ne peut pas s'afficher.
//
// Pourquoi il n'est PAS automatique : un certificat auto-signé fait échouer tout
// ce qui parle au serveur sans exception de sécurité — navigateur intégré,
// outils, extensions. Le mode normal doit rester le mode normal.
//
// Le certificat se génère avec `bash scripts/dev-cert.sh`, à relancer à chaque
// changement de réseau (l'adresse IP du poste doit y figurer).
function certificatDev() {
  const key = fileURLToPath(new URL('./certs/dev-key.pem', import.meta.url))
  const cert = fileURLToPath(new URL('./certs/dev-cert.pem', import.meta.url))
  if (!existsSync(key) || !existsSync(cert)) {
    console.warn(
      '\n[dev:phone] Aucun certificat dans certs/. Lancez d\'abord :\n' +
      '   bash scripts/dev-cert.sh\n' +
      'Démarrage en HTTP simple — la réalité augmentée ne pourra pas se lancer.\n'
    )
    return undefined
  }
  return { key: readFileSync(key), cert: readFileSync(cert) }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const pourTelephone = mode === 'phone'
  const https = pourTelephone ? certificatDev() : undefined

  return {
    plugins: [
      vue({
        template: {
          compilerOptions: {
            // <model-viewer> est un web component (Google) : on dit au compilateur
            // Vue de ne pas le traiter comme un composant Vue.
            isCustomElement: (tag) => tag === 'model-viewer'
          }
        }
      })
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      // Honore le port assigné par l'outil de preview (variable PORT), sinon 5173.
      port: Number(process.env.PORT) || 5173,
      https,
      // En mode téléphone on écoute aussi sur le réseau local : c'est tout
      // l'intérêt, l'appareil doit pouvoir joindre le poste.
      host: pourTelephone ? true : undefined
    }
  }
})
