# ✉️ Connexion par code e-mail (sans mot de passe) — 1 réglage Supabase

La connexion **sans mot de passe** est **codée et vérifiée** : sur `/site/compte`, le visiteur saisit son e-mail → reçoit un **code à 6 chiffres** → le saisit → connecté (rôle `visitor`). **Aucune console externe** (pas de Google Cloud).

Vérifié en preview : le clic « Recevoir un code » est accepté par Supabase et l'écran passe bien à la saisie du code. Il reste **un seul réglage** pour que l'e-mail contienne le **code** (par défaut, Supabase envoie un lien, pas un code).

---

## Le réglage (2 min, dans Supabase uniquement)

1. Va sur **Authentication → Emails → Templates** :
   `https://supabase.com/dashboard/project/dvwwwlqrwwzfwxukyoxz/auth/templates`
2. Ouvre le template **« Magic Link »** et assure-toi que le corps contient le **jeton** `{{ .Token }}`. Exemple simple :
   ```html
   <h2>Votre code de connexion MUSÉA</h2>
   <p>Saisissez ce code pour vous connecter :</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>Ce code expire dans 1 heure.</p>
   ```
3. Fais **la même chose** dans le template **« Confirm signup »** (utilisé pour un tout **nouveau** visiteur) :
   ```html
   <h2>Bienvenue sur MUSÉA</h2>
   <p>Votre code de connexion :</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   ```
4. **Save** sur chaque template.

> Pourquoi les deux ? Un visiteur **déjà inscrit** reçoit l'e-mail « Magic Link » ; un **nouveau** visiteur reçoit « Confirm signup ». Mettre `{{ .Token }}` dans les deux garantit que le code arrive dans tous les cas.

---

## Tester

1. `http://localhost:5173/site/compte`
2. Section du bas → saisis **ton vrai e-mail** → **« Recevoir un code par e-mail »**
3. Ouvre l'e-mail (regarde aussi les **spams**), copie le **code à 6 chiffres**, colle-le → **« Valider le code »** → connecté.

---

## ⚠️ Important : l'envoi d'e-mails

- L'e-mail intégré de Supabase est **fortement limité** (~2 à 4 e-mails/heure) et **réservé aux tests**. Si tu ne reçois plus rien, c'est la limite de débit — attends, ou configure un SMTP.
- **Pour la production** : configure un **SMTP personnalisé** (gratuit/faible coût : Resend, Brevo, Mailgun, SendGrid…) dans *Authentication → Emails → SMTP Settings*. Sans ça, les vrais visiteurs ne recevront pas leurs codes de façon fiable.
- Pense aussi à retirer le trigger de dev `dev_autoconfirm` avant la prod (voir `HANDOFF.md`).

---

## Ce que fait le code (déjà en place)

| Fichier | Rôle |
|---|---|
| `src/stores/useAuthStore.js` → `sendEmailOtp(email)` / `verifyEmailOtp(email, token)` | Envoi du code (`signInWithOtp`) puis vérification (`verifyOtp`, type `email`). |
| `src/views/public/PublicAccount.vue` | Bloc « connexion par code » (saisie e-mail → code → validation), remplace l'ancien bouton Google. |
| Trigger `handle_new_user` (DB) | Crée le profil `visitor` (full_name / name / email). |

> Le bouton **Google** reste disponible côté **espace pro (staff)** et pourra être réactivé côté visiteurs plus tard via `GOOGLE_AUTH_SETUP.md` — mais il n'est **plus requis** pour se connecter.
