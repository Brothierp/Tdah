# Mettre en place le cloud (Supabase), pas à pas

Le cloud permet à chacun d'avoir son compte sur **son propre téléphone**, et à un parent de suivre
ses enfants **à distance**. Compte environ 20 minutes. Tout est gratuit pour la phase de test.

## Ce qu'il te faut

- Un ordinateur (Mac, Windows ou Linux) avec :
  - **Node.js** version LTS : <https://nodejs.org> ;
  - **Git** : <https://git-scm.com> (sous Windows, il installe aussi « Git Bash », utile plus bas).
- Le projet sur ton ordinateur :
  ```bash
  git clone https://github.com/Brothierp/Tdah.git
  cd Tdah
  git checkout claude/adhd-mobile-app-todo-6u71hs
  npm install
  ```

## Étape 1 — Créer le projet Supabase (5 min, dans le navigateur)

1. Va sur <https://supabase.com>, clique sur **Start your project** et crée un compte (GitHub ou e-mail).
2. Clique sur **New project** :
   - **Name** : `focus` ;
   - **Database Password** : clique sur *Generate a password*, puis **note-le** dans un endroit sûr
     (gestionnaire de mots de passe). Le script te le demandera ;
   - **Region** : **West EU (Paris)** (données en Europe, RGPD) ;
   - offre **Free**.
3. Attends 1 à 2 minutes que le projet soit prêt.

## Étape 2 — Lancer le script (5 min, dans le terminal)

Dans le dossier `Tdah` :

- **Mac / Linux** : ouvre le Terminal et tape `bash scripts/setup-cloud.sh`
- **Windows** : clic droit dans le dossier › *Open Git Bash here*, puis `bash scripts/setup-cloud.sh`

Le script te guide :

| Il demande… | Tu fais… |
| --- | --- |
| Une connexion à Supabase | Une page s'ouvre : clique sur *Authorize*. |
| La « REFERENCE ID » | Copie-la depuis la liste affichée (20 lettres et chiffres, colonne *REFERENCE ID*). |
| Le mot de passe de la base | Colle celui noté à l'étape 1. |
| Enregistrer dans Expo ? | Réponds **o** seulement si tu as déjà fait `npx eas-cli@latest init` (voir étape 5). Sinon **N** : tu pourras relancer le script plus tard. |

À la fin, un fichier `.env` est créé : l'app est en **mode cloud**.

<details>
<summary>Le script ne marche pas chez moi : faire les commandes à la main</summary>

```bash
npx supabase login
npx supabase link --project-ref TA_REFERENCE
npx supabase db push
npx supabase functions deploy family --no-verify-jwt --use-api --project-ref TA_REFERENCE
```

Puis crée un fichier `.env` à la racine du projet (copie de `.env.example`) :

```
EXPO_PUBLIC_SUPABASE_URL=https://TA_REFERENCE.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=la clé « Publishable » (ou « anon »)
```

La clé se trouve dans Supabase › *Project Settings* › *API Keys*. Prends la clé **publishable** ou
**anon**, **jamais** la clé *secret* ou *service_role*.
</details>

## Étape 3 — Deux réglages dans Supabase (2 min)

Dans le tableau de bord du projet, menu **Authentication** :

1. **Sign In / Providers › Email** : pendant la phase de test, **désactive « Confirm email »**.
   Sinon chaque adulte doit cliquer sur un lien reçu par e-mail, et l'envoi d'e-mails gratuit de
   Supabase est limité à quelques messages par heure. Les comptes enfants n'ont pas d'e-mail, ils ne
   sont pas concernés. Réactive-le avant une publication publique, avec un vrai service d'envoi
   (voir `MISE_EN_PRODUCTION.md`).
2. **URL Configuration › Site URL** : mets par exemple `https://expo.dev` (ou l'adresse de ta page de
   confidentialité, plus tard).

## Étape 4 — Vérifier que tout marche (3 min)

```bash
npx expo start
```

Appuie sur **w** pour ouvrir l'app dans le navigateur, ou scanne le QR code avec Expo Go.

1. Crée un compte adulte (avec un e-mail) : l'écran d'inscription demande bien un **e-mail**,
   c'est le signe que le mode cloud est actif.
2. Dans Supabase › **Table Editor › profiles**, une ligne avec ton prénom apparaît.
3. Onglet **Famille** › *Ajouter un enfant* › crée un compte de test. Il apparaît aussi dans `profiles`.

## Étape 5 — Faire l'APK pour les testeurs

```bash
npx eas-cli@latest login
npx eas-cli@latest init
bash scripts/setup-cloud.sh    # relance-le et réponds « o » à la question Expo
npx eas-cli@latest build --profile preview --platform android
```

Tu reçois un lien et un QR code vers l'APK à partager. Détails et iPhone : `MISE_EN_PRODUCTION.md`.

## Bon à savoir

- **Offre gratuite** : 500 Mo de base de données (largement assez pour des milliers de tâches) et
  50 000 utilisateurs actifs par mois.
- ⚠️ **Un projet gratuit est mis en pause après 7 jours sans aucune utilisation.** Avec des testeurs
  quotidiens, ça n'arrive pas. Sinon, va dans le tableau de bord et clique sur *Restore*.
- **Sauvegardes** : pas de sauvegarde quotidienne en gratuit. Pour un usage réel durable, prévois
  l'offre Pro (environ 25 $/mois).
- **Sécurité** : la clé dans `.env` est publique par nature (elle est dans l'app). La protection des
  données est assurée par les règles de la base de données : chacun ne voit que ses données, et un
  parent celles de ses enfants. C'est testé automatiquement (`supabase/tests`).
- **Mettre à jour le serveur** plus tard : relance simplement `bash scripts/setup-cloud.sh`. Il
  applique les nouvelles migrations et redéploie la fonction, sans effacer les données.

## En cas de problème

| Message | Solution |
| --- | --- |
| `command not found: npx` | Installe Node.js (LTS), puis rouvre le terminal. |
| `failed to connect to postgres` / mot de passe refusé | Supabase › *Project Settings* › *Database* › *Reset database password*, puis relance le script. |
| « Un compte existe déjà avec cet e-mail » | Normal si tu as déjà testé : connecte-toi, ou supprime l'utilisateur dans *Authentication › Users*. |
| « Confirme d'abord ton e-mail » | Désactive « Confirm email » (étape 3), ou clique sur le lien reçu. |
| Créer un enfant affiche une erreur | Vérifie que la fonction est déployée : *Edge Functions* › `family` doit apparaître. Sinon relance le script. |
| L'app reste en mode local (identifiant au lieu d'e-mail) | Le `.env` n'est pas pris en compte : arrête `npx expo start`, puis relance `npx expo start --clear`. |
