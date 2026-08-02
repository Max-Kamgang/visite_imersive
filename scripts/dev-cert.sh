#!/usr/bin/env bash
# Certificat de développement pour tester la RÉALITÉ AUGMENTÉE sur téléphone.
#
# Pourquoi c'est nécessaire : WebXR n'existe que dans un « contexte sécurisé ».
# Sur http://192.168.x.x:5173, `navigator.xr` est absent et le bouton AR ne
# s'affiche jamais. Il faut donc du HTTPS, même en développement.
#
# À relancer à CHAQUE changement de réseau : l'adresse IP du poste change, et
# elle doit figurer dans le certificat pour que le téléphone l'accepte.
#
#   bash scripts/dev-cert.sh
#   npm run dev:phone
#
# `npm run dev` reste en HTTP simple : le certificat auto-signé ne doit jamais
# gêner le travail quotidien.
#
# Aucune dépendance installée : openssl est fourni avec Git pour Windows.

set -e
cd "$(dirname "$0")/.."
mkdir -p certs

# Adresses IPv4 locales du poste, VPN et adaptateurs virtuels exclus : c'est
# celle du Wi-Fi que le téléphone doit joindre.
IPS=$(node -e "
const o = require('os').networkInterfaces()
const out = []
for (const [nom, liste] of Object.entries(o)) {
  if (/vmware|virtualbox|hyper-v|tun|tap|loopback/i.test(nom)) continue
  for (const i of liste) if (i.family === 'IPv4' && !i.internal) out.push(i.address)
}
console.log(out.join(' '))
")

SAN="DNS:localhost,IP:127.0.0.1"
for ip in $IPS; do SAN="$SAN,IP:$ip"; done

echo "Adresses incluses dans le certificat : localhost 127.0.0.1 $IPS"

# MSYS_NO_PATHCONV : sans lui, Git Bash prend « /CN=… » pour un chemin absolu
# et le transforme en « C:/Program Files/Git/CN=… ». openssl refuse alors le sujet.
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout certs/dev-key.pem -out certs/dev-cert.pem \
  -subj "/CN=MUSEA developpement" \
  -addext "subjectAltName=$SAN" 2>/dev/null

echo
echo "Certificat écrit dans certs/. Lancez maintenant :"
echo "   npm run dev:phone"
echo
for ip in $IPS; do echo "   Depuis le téléphone : https://$ip:5173/site/ar/demo"; done
echo
echo "Le téléphone affichera un avertissement de sécurité (certificat auto-signé)."
echo "C'est attendu : « Paramètres avancés » puis « Continuer »."
