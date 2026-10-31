# Focus — l'app TDAH « une chose à la fois »

Application mobile (iOS / Android, et web pour tester) pour aider les personnes TDAH —
enfants, ados et adultes — à s'organiser.

## Fonctionnalités

Pensée pour les personnes **TDAH** et **TSA** : peu de choix à la fois, une journée prévisible,
des transitions annoncées, une motivation immédiate et un confort sensoriel réglable.

- **🎯 Une chose à la fois** : l'écran d'accueil peut n'afficher que la prochaine tâche, avec une
  seule étape à la fois et trois gros boutons (Commencer, C'est fait, Plus tard). La tâche suivante
  est annoncée pour éviter les surprises.
- **📋 Ma journée** : emploi du temps visuel par moments (☀️ matin, 🍽️ midi, 🌤️ après-midi,
  🌙 soir, 🕐 quand je veux), le moment actuel est mis en avant.
- **Ajout en une ligne** pour capturer une idée tout de suite, ou **tâche détaillée** (emoji,
  moment, durée, petites étapes, routine quotidienne, rappel).
- **💡 Routines toutes prêtes** : matin, soir, devoirs, ranger sa chambre, démarrer sa journée,
  maison, prendre soin de soi — ajoutées en un geste, étapes comprises.
- **⏳ Timer visuel** : lancement en un geste, heure de fin affichée, étape en cours visible,
  **avertissement 1 minute avant la fin** (aide aux transitions), pause proposée à la fin.
- **⭐ Motivation** : une étoile par tâche, série de jours 🔥, objectif de récompense 🎁,
  petite célébration (désactivable).
- **Droit à l'erreur** : bouton **Annuler** après avoir coché ou supprimé une tâche.
- **🔔 Rappels activables** : interrupteur général, rappel par tâche, relance si pas fait,
  résumé du jour.
- **🌿 Confort** : taille du texte (normal, grand, très grand), **mode calme** (couleurs douces,
  aucune animation), vibrations, respect du réglage « réduire les animations » du téléphone.
- **Accueil guidé** au premier lancement (4 écrans courts, on peut passer).
- **👨‍👩‍👧 Espace parents** : un parent crée le compte de son enfant (ou relie le compte d'un ado
  avec un code), voit sa progression et ses étoiles, lui ajoute des tâches ou des routines,
  réinitialise son mot de passe. L'enfant voit toujours que son compte est suivi.
- **Adapté à l'âge** : Enfant / Ado / Adulte change la taille du texte, les formes, le ton et
  l'écran d'accueil par défaut.
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
    (tabs)/                 Aujourd'hui, Timer, Famille (adultes), Réglages
    welcome.tsx             accueil guidé (premier lancement)
    templates.tsx           routines toutes prêtes (?owner=<enfant> pour un parent)
    task/[id].tsx           créer / modifier une tâche (?owner=<enfant> pour un parent)
    family/                 ajouter un enfant, suivi d'un enfant
    privacy.tsx             politique de confidentialité
  components/               UI commune, carte « une à la fois », barre de récompenses,
                            retours (Annuler, célébration), carte de tâche, anneau du timer
  lib/
    backend/                interface Backend + implémentations local.ts et cloud.ts
    auth.tsx                compte connecté et famille
    data.tsx                tâches et réglages du compte connecté
    childData.ts            tâches d'un enfant vues par son parent
    taskOps.ts              opérations pures sur les tâches (testées)
    moments.ts              moments de la journée, « que faire maintenant »
    rewards.ts              étoiles, série de jours, objectif de récompense
    templates.ts            contenu des routines toutes prêtes
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
