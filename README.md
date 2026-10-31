# Focus — l'app TDAH « une chose à la fois »

Application mobile (iOS / Android, et web pour tester) pour aider les personnes TDAH,
enfants, ados et adultes, à s'organiser :

- **To-do list** : tâches avec un emoji, une durée estimée et des **petites étapes** à cocher
  (découper une grosse tâche aide à démarrer). Barre de progression et encouragements.
- **Timer** : durées courtes en un geste (1 à 25 min), anneau visuel qui « se vide »,
  pause / +1 min, lancement direct depuis une tâche, puis « J'ai fini la tâche » à la fin.
  Une notification prévient même si l'app est en arrière-plan.
- **Rappels automatiques, activables ou non** :
  - interrupteur général dans les Réglages ;
  - rappel par tâche (une fois, ou **chaque jour** pour les routines) ;
  - **relance** si la tâche n'est pas cochée (délai réglable : 5 à 30 min) ;
  - **résumé du jour** optionnel (« 3 tâches t'attendent »).
- **Comptes** : chaque personne a son compte (prénom, identifiant, mot de passe, avatar) et
  ses propres tâches/réglages. L'écran d'accueil affiche les profils de l'appareil
  (pratique pour une tablette familiale).
- **Espace parents (onglet Famille)** : un compte adulte peut créer le compte de son enfant,
  ou relier un compte Enfant/Ado existant (avec le mot de passe de l'enfant). Le parent voit
  la progression du jour, ajoute ou modifie des tâches et des rappels, réinitialise un mot de
  passe oublié, arrête le suivi ou supprime le compte. L'enfant voit « Compte suivi par … »
  dans ses Réglages et les tâches ajoutées par son parent sont marquées « de Maman ».
  Un compte suivi ne peut pas se supprimer seul.
- **Adapté à l'âge** : le profil Enfant / Ado / Adulte ajuste la taille du texte, les
  arrondis et le ton des messages.

## Démarrer

```bash
npm install
npx expo start        # puis scanner le QR code avec l'app Expo Go, ou touche w pour le web
```

Vérifications :

```bash
npm run typecheck
npx expo lint
```

Pour publier sur les stores : `npx eas-cli@latest build` (voir la doc EAS).

## Organisation du code

```
src/
  app/                    écrans (Expo Router : chaque fichier = un écran)
    (auth)/               accueil / choix du profil, connexion, inscription
    (tabs)/               Tâches, Timer, Famille (adultes), Réglages
    task/[id].tsx         créer (id = "new") ou modifier une tâche (?owner=<enfant> pour un parent)
    family/               ajouter un enfant, suivi d'un enfant
  components/             boutons, champs, carte de tâche, anneau du timer
  lib/
    auth.tsx              comptes (mots de passe hachés SHA-256 + sel)
    data.tsx              tâches et réglages du compte connecté
    childData.ts          tâches d'un enfant, vues et modifiées par son parent
    taskOps.ts            opérations sur les tâches, partagées par les deux
    notifications.ts      programmation des rappels et de l'alerte du timer
    timer.tsx             état du timer (basé sur l'heure de fin : fiable en arrière-plan)
    theme.ts              couleurs (clair/sombre) et adaptation à l'âge
```

## Choix techniques et limites actuelles

- **Stockage local** (AsyncStorage) : les comptes et les données restent sur l'appareil,
  isolés par compte. Il n'y a pas encore de synchronisation entre appareils : pour ça, il
  faudra un backend (Supabase ou Firebase, par exemple). `lib/auth.tsx` et `lib/data.tsx` sont
  les deux seuls fichiers à remplacer.
- **Rappels** : à chaque changement, l'app annule puis reprogramme les rappels du compte.
  Les routines quotidiennes sont programmées sur 3 jours glissants (pour sauter le jour
  où elles sont déjà faites) et sont reprogrammées à chaque ouverture de l'app.
- Les rappels d'un compte continuent d'arriver après une déconnexion (utile sur une
  tablette partagée) ; ils sont supprimés avec le compte.
- **Espace parents sur le même appareil uniquement** pour l'instant (stockage local). Pour
  qu'un parent suive son enfant depuis son propre téléphone, il faudra le backend évoqué
  ci-dessus.
- Sur le web, les notifications ne sont pas disponibles.
