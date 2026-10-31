# Mise en production de Focus

Ce guide liste, dans l'ordre, ce qu'il reste à faire **avec tes propres comptes** pour publier
l'app. Tout le code et la configuration sont prêts : il s'agit surtout de créer les comptes et de
lancer quelques commandes. Compte environ une demi-journée, plus les délais de validation des stores.

## 0. Ce qu'il faut créer (gratuit sauf mention)

| Service | Pour quoi | Coût |
| --- | --- | --- |
| [Supabase](https://supabase.com) | Comptes et données en ligne | Gratuit pour démarrer (offre Pro ~25 $/mois ensuite) |
| [Expo / EAS](https://expo.dev) | Compiler l'app iOS et Android dans le cloud | Gratuit (files d'attente plus longues) |
| Apple Developer Program | Publier sur l'App Store | 99 $/an |
| Google Play Console | Publier sur le Play Store | 25 $ une fois |

## 1. Supabase (le serveur)

1. Crée un projet sur supabase.com. **Choisis une région dans l'Union européenne** (par exemple
   Paris `eu-west-3`) : la politique de confidentialité l'annonce, et c'est préférable pour le RGPD.
2. Installe la CLI et relie le dépôt au projet :
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-du-projet>
   ```
3. Envoie le schéma de base de données (tables, sécurité, fonctions SQL) :
   ```bash
   npx supabase db push
   ```
4. Déploie la fonction serveur (comptes enfants, suppression de compte) :
   ```bash
   npx supabase functions deploy family --no-verify-jwt
   ```
   (`--no-verify-jwt` est normal : la fonction vérifie elle-même l'identité de l'appelant.)
5. Dans le tableau de bord Supabase, **Authentication** :
   - *Sign In / Providers › Email* : laisse « Confirm email » **activé** (l'app gère l'écran
     « Vérifie ta boîte mail ») et mets la longueur minimale du mot de passe à 6 ou plus.
   - *Emails › SMTP Settings* : branche un vrai service d'envoi (Brevo, Resend, Postmark…). L'envoi
     intégré de Supabase est limité à quelques e-mails par heure et ne convient pas en production.
   - *Emails › Templates* : traduis les e-mails en français (confirmation, mot de passe oublié).
6. **Project Settings › API** : copie l'URL du projet et la clé publique (« publishable » ou
   « anon »). Ne copie **jamais** la clé secrète / service_role dans l'app.

## 2. Brancher l'app sur Supabase

```bash
cp .env.example .env     # puis colle l'URL et la clé publique
npx expo start           # l'app passe automatiquement en mode « cloud »
```

Sans `.env`, l'app reste en **mode local** (tout sur l'appareil) : pratique pour développer.

Pour les builds EAS, déclare les deux mêmes variables dans le projet Expo
(`npx eas-cli@latest env:create` ou expo.dev › Project › Environment variables), pour les
environnements `preview` et `production`.

## 3. Compiler et tester sur de vrais téléphones

```bash
npx eas-cli@latest login
npx eas-cli@latest init                          # crée le projet EAS et ajoute son id à app.json
npx eas-cli@latest build --profile preview --platform android   # APK installable directement
npx eas-cli@latest build --profile preview --platform ios       # nécessite le compte Apple
```

À vérifier à la main sur téléphone (impossible à tester dans un navigateur) :

- [ ] l'autorisation des notifications est demandée au premier rappel ;
- [ ] un rappel arrive à l'heure, app fermée ; la relance arrive si la tâche n'est pas cochée ;
- [ ] la fin du timer sonne / vibre app en arrière-plan ;
- [ ] toucher une notification ouvre l'app sur le bon écran ;
- [ ] une routine quotidienne cochée ne sonne plus le jour même, mais le lendemain ;
- [ ] un parent ajoute une tâche avec rappel : le rappel est programmé sur le téléphone de
      l'enfant à sa prochaine ouverture de l'app.

## 4. Publier

```bash
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --platform ios
npx eas-cli@latest submit --platform android
```

### Avant d'envoyer aux stores

- [ ] Remplacer `EDITOR` et `CONTACT` dans `src/lib/privacy.ts` **et** dans `docs/CONFIDENTIALITE.md`.
- [ ] Publier `docs/CONFIDENTIALITE.md` à une adresse web publique (GitHub Pages, Notion, site perso)
      et la renseigner dans les deux stores.
- [ ] Vérifier/changer l'identifiant d'app `com.brothier.focustdah` dans `app.json` (définitif après
      la première publication).

### Points d'attention propres aux apps utilisées par des enfants

- **App Store** : ne coche **pas** la catégorie « Enfants » (Kids Category) sans en accepter les
  règles strictes (aucun lien externe, contrôle parental avant tout achat ou lien…). Une catégorie
  « Productivité » ou « Éducation » avec une classification 4+ convient.
- **Google Play** : remplis le questionnaire « Public cible et contenu ». Si tu indiques que l'app vise
  aussi les moins de 13 ans, la règle « Familles » s'applique : pas de publicité ni de SDK de suivi
  (c'est déjà le cas), politique de confidentialité obligatoire.
- **Section « Sécurité des données » (Google) / « Confidentialité de l'app » (Apple)** : déclare
  nom, adresse e-mail, identifiant utilisateur et contenu créé par l'utilisateur (les tâches),
  collectés pour le fonctionnement de l'app, non partagés, non utilisés pour le suivi,
  chiffrés en transit, suppressibles par l'utilisateur.
- **Suppression de compte** : l'app permet de supprimer son compte (Réglages). Google exige en plus une
  page web expliquant comment demander la suppression : une section de ta page de confidentialité
  suffit (« écris à CONTACT » ou « Réglages › Supprimer mon compte »).
- **RGPD (France)** : en dessous de 15 ans, le consentement parental est requis. C'est pour cela qu'un
  compte « Enfant » en ligne ne peut être créé que par un parent depuis son espace Famille.

## 5. Ensuite

- Surveiller Supabase (Database › Reports) et activer les sauvegardes (offre Pro : quotidiennes).
- Idées d'évolution : notification au parent quand l'enfant a tout fini (notifications push via
  Expo), mise à jour en temps réel de l'espace Famille (Supabase Realtime), statistiques
  hebdomadaires, récompenses / badges pour les plus jeunes.
