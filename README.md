# Focus — l'app TDAH « une chose à la fois »

Application mobile (iOS / Android, et web pour tester) pour aider les personnes TDAH —
enfants, ados et adultes — à s'organiser.

## Fonctionnalités

- **To-do list** : tâches avec emoji, durée estimée et **petites étapes** à cocher ; progression du
  jour et encouragements ; routines quotidiennes qui reviennent chaque matin.
- **Timer** : durées courtes en un geste, anneau visuel, pause / +1 min, lancement depuis une tâche,
  alerte de fin même app fermée.
- **Rappels activables** : interrupteur général, rappel par tâche (une fois ou chaque jour),
  **relance** si la tâche n'est pas cochée, résumé du jour.
- **Comptes** et **espace parents** : un parent crée le compte de son enfant (ou relie le compte d'un
  ado avec un code), voit sa progression, lui ajoute des tâches et des rappels, réinitialise son mot
  de passe. L'enfant voit toujours que son compte est suivi.
- **Adapté à l'âge** : Enfant / Ado / Adulte change la taille du texte, les formes et le ton.
- **Hors ligne** : tout reste utilisable sans réseau ; les modifications partent dès qu'il revient.

## Deux modes de fonctionnement

| | Mode local | Mode cloud (Supabase) |
| --- | --- | --- |
| Activation | par défaut (pas de `.env`) | `.env` rempli (voir `.env.example`) |
| Données | sur l'appareil uniquement | en ligne + cache sur l'appareil |
| Connexion | identifiant | e-mail (adultes, ados) ou identifiant (enfants) |
| Espace parents | sur le même appareil | entre appareils différents |

## Démarrer

```bash
npm install
npx expo start            # QR code pour Expo Go, ou « w » pour le web
```

Pour le mode cloud en local (nécessite Docker) :

```bash
npx supabase start        # base, auth, API et fonction « family » en local
# puis dans .env : EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 et la clé « anon » affichée
```

## Vérifications

```bash
npm run typecheck         # TypeScript
npx expo lint             # ESLint
npm test                  # tests unitaires (jest)
npm run test:backend      # tests d'intégration du backend (stack Supabase locale démarrée)
```

La CI GitHub Actions (`.github/workflows/ci.yml`) lance tout cela à chaque push.

## Publier

Tout est décrit pas à pas dans **[docs/MISE_EN_PRODUCTION.md](docs/MISE_EN_PRODUCTION.md)**
(projet Supabase, builds EAS, fiches des stores, points RGPD / enfants).
Politique de confidentialité : [docs/CONFIDENTIALITE.md](docs/CONFIDENTIALITE.md).

## Organisation du code

```
src/
  app/                      écrans (Expo Router : chaque fichier = un écran)
    (auth)/                 choix du profil, connexion, inscription
    (tabs)/                 Tâches, Timer, Famille (adultes), Réglages
    task/[id].tsx           créer / modifier une tâche (?owner=<enfant> pour un parent)
    family/                 ajouter un enfant, suivi d'un enfant
    privacy.tsx             politique de confidentialité
  components/               boutons, champs, carte de tâche, anneau du timer
  lib/
    backend/                interface Backend + implémentations local.ts et cloud.ts
    auth.tsx                compte connecté et famille
    data.tsx                tâches et réglages du compte connecté
    childData.ts            tâches d'un enfant vues par son parent
    taskOps.ts              opérations pures sur les tâches (testées)
    notifications.ts        programmation des rappels et du timer
    timer.tsx               état du timer (fiable en arrière-plan)
supabase/
  migrations/               schéma SQL + règles de sécurité (RLS)
  functions/family/         fonction serveur : comptes enfants, suppression de compte
  tests/                    tests d'intégration du backend
```

## Choix techniques

- **Sécurité** : chaque compte ne lit que ses données ; un parent lit et modifie celles de ses
  enfants. C'est garanti par la base de données (Row Level Security), pas seulement par l'app, et
  testé (`supabase/tests`). Les actions sensibles (créer un compte enfant, changer son mot de
  passe, supprimer un compte) passent par une fonction serveur qui vérifie l'appelant.
- **Hors ligne** : lectures depuis un cache local ; écritures dans une file d'attente persistée,
  rejouée au retour du réseau. Seules les tâches modifiées sont envoyées.
- **Rappels** : programmés sur le téléphone (pas de serveur de notifications). À chaque changement,
  l'app reprogramme les rappels du compte ; les routines sont planifiées sur 3 jours glissants.
  Une tâche ajoutée par un parent depuis un autre appareil est programmée sur le téléphone de
  l'enfant à sa prochaine ouverture de l'app.
