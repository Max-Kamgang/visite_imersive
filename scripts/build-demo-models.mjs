// Écrit les modèles 3D de démonstration dans public/modeles/.
//
//   node scripts/build-demo-models.mjs
//
// Pourquoi des fichiers plutôt qu'une génération à la volée : sur Android sans
// WebXR, model-viewer passe la main à Scene Viewer, une application distincte
// qui TÉLÉCHARGE le modèle par son adresse. Une URL « blob: » n'existe que dans
// l'onglet du navigateur : Scene Viewer ne peut pas la lire, et la démo
// échouerait sur une partie du parc une fois le site déployé.
//
// Ces fichiers sont versionnés : la commande n'est à relancer que si l'on
// modifie les profils dans src/services/glb.js.

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildDemoGlb, demoModelInfo, DEMO_VARIANTS } from '../src/services/glb.js'

const racine = join(dirname(fileURLToPath(import.meta.url)), '..')
const dossier = join(racine, 'public', 'modeles')
mkdirSync(dossier, { recursive: true })

for (const variante of DEMO_VARIANTS) {
  const buf = buildDemoGlb(variante)
  const chemin = join(dossier, `${variante}.glb`)
  writeFileSync(chemin, Buffer.from(buf))
  const info = demoModelInfo(variante)
  console.log(
    `${variante}.glb — ${info.nom}, ${Math.round(info.hauteur * 100)} cm, ` +
    `${(buf.byteLength / 1024).toFixed(1)} Ko`
  )
}
console.log(`\nÉcrit dans ${dossier}`)
