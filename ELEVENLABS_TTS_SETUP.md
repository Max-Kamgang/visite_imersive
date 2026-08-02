# 🎙️ Voix IA ElevenLabs (assistant vocal) — activation

L'assistant vocal fonctionne **déjà** avec la voix du navigateur (gratuit, sans clé). Pour une voix **IA ultra-naturelle**, on branche **ElevenLabs**. Tout est **prêt** : Edge Function déployée + service frontend avec repli automatique. Il reste **3 étapes**, une seule fois.

> Principe de sécurité : la clé ElevenLabs reste **100 % côté serveur** (secret Supabase). Elle n'est **jamais** dans le frontend ni le dépôt.

---

## Ce qui est déjà en place ✅
- **Edge Function `tts`** déployée sur Supabase (`/functions/v1/tts`) — appelle ElevenLabs et renvoie le MP3. Testée : sans clé, elle répond `503 no_api_key`.
- **Service `src/services/tts.js`** — si `VITE_TTS_PROVIDER=elevenlabs`, il appelle la fonction ; en cas d'échec (pas de clé, quota, réseau) il **retombe sur la voix du navigateur**. Aucun changement d'UI : le bouton « Écouter » et l'audioguide utilisent la même API.

---

## Étape 1 — Récupérer une clé ElevenLabs
1. Crée un compte sur **https://elevenlabs.io**.
2. **Profile → API Keys → Create API Key** → copie la clé (`sk_...`).
3. (Optionnel) Repère l'ID d'une voix dans **Voices** (ex. une voix multilingue). Défaut utilisé : `EXAVITQu4vr4xnSDxMaL` (« Sarah »).

## Étape 2 — Poser le secret côté Supabase (jamais dans le frontend)
Dans le Dashboard : **Project Settings → Edge Functions → Secrets** (ou *Edge Functions → Manage secrets*) :
`https://supabase.com/dashboard/project/dvwwwlqrwwzfwxukyoxz/settings/functions`
- Ajoute : `ELEVENLABS_API_KEY` = ta clé `sk_...`
- (Optionnel) `ELEVENLABS_VOICE_ID` = l'ID d'une voix précise
- (Optionnel) `ELEVENLABS_MODEL_ID` = `eleven_multilingual_v2` (défaut)

> Alternative CLI : `supabase secrets set ELEVENLABS_API_KEY=sk_xxx --project-ref dvwwwlqrwwzfwxukyoxz`

## Étape 3 — Activer le provider côté frontend
Dans ton fichier **`.env`** :
```
VITE_TTS_PROVIDER=elevenlabs
```
Puis redémarre `npm run dev` (les variables Vite sont lues au démarrage).

---

## Tester
1. ERP → *Assistant vocal* → éditer un assistant → onglet **Source & voix** → **Écouter** → tu dois entendre la voix **ElevenLabs** (plus naturelle).
2. Si tu n'entends rien / erreur : le service retombe sur la voix du navigateur (donc ça parle quand même). Vérifie alors le secret et les logs de la fonction :
   `https://supabase.com/dashboard/project/dvwwwlqrwwzfwxukyoxz/functions/tts/logs`

---

## ⚠️ Avant la production (protéger le quota)
La fonction est ouverte (`verify_jwt=false`) pour que l'audioguide marche pour les visiteurs. Avant le lancement, **durcir** pour éviter l'abus de crédits ElevenLabs :
- limiter le débit (rate-limit par IP/utilisateur),
- vérifier l'**accès payant** (`user_access`) côté serveur pour l'audioguide,
- éventuellement mettre en cache les MP3 générés (Supabase Storage) par (texte + voix).

## Fichiers concernés
| Fichier | Rôle |
|---|---|
| `supabase/functions/tts/index.ts` | Edge Function ElevenLabs (clé serveur). |
| `src/services/tts.js` | Choix du moteur + repli navigateur (`useTts()`). |
| `.env` (`VITE_TTS_PROVIDER`) | Bascule browser ↔ elevenlabs. |
