/**
 * Politique de confidentialité affichée dans l'app (et reprise dans docs/CONFIDENTIALITE.md,
 * à publier à une adresse web publique pour les fiches App Store / Google Play).
 *
 * ⚠️ Avant publication : remplacer EDITOR et CONTACT par les informations réelles.
 */
export const EDITOR = '[Nom de l’éditeur de l’application]';
export const CONTACT = '[adresse e-mail de contact]';
export const PRIVACY_UPDATED = '31 octobre 2026';

export const PRIVACY_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Qui sommes-nous ?',
    body: `Focus est édité par ${EDITOR}. Pour toute question sur tes données : ${CONTACT}.`,
  },
  {
    title: 'Quelles données ?',
    body:
      'Uniquement ce qui est nécessaire au fonctionnement : prénom, avatar, tranche d’âge (Enfant / Ado / Adulte), ' +
      'e-mail (comptes adultes et ados) ou identifiant (comptes enfants), mot de passe (stocké chiffré, jamais lisible), ' +
      'tes tâches, étapes, rappels et réglages. Pas de géolocalisation, pas de contacts, pas de photos, pas de publicité, ' +
      'pas de traceurs ni d’outils de mesure d’audience.',
  },
  {
    title: 'Pourquoi ?',
    body:
      'Pour te permettre d’organiser tes tâches, de recevoir tes rappels et de retrouver ton compte sur tes appareils. ' +
      'Base légale : l’exécution du service que tu demandes en créant un compte. Les données ne sont jamais vendues ni ' +
      'utilisées à des fins publicitaires.',
  },
  {
    title: 'Comptes enfants et suivi parental',
    body:
      'Un compte Enfant est créé par un parent depuis son propre compte, ce qui vaut consentement parental. Un compte Ado ' +
      'peut être relié à un parent uniquement avec un code généré par l’ado lui-même. Le parent peut alors voir et modifier ' +
      'les tâches de l’enfant, changer son mot de passe et supprimer son compte. L’enfant voit toujours dans ses Réglages ' +
      'que son compte est suivi, et par qui.',
  },
  {
    title: 'Où sont stockées les données ?',
    body:
      'Sur ton appareil, et — si l’app est connectée à un serveur — chez notre hébergeur Supabase (serveurs situés dans ' +
      'l’Union européenne), avec un accès protégé : chaque compte ne peut lire que ses propres données, et un parent ' +
      'celles de ses enfants. Les notifications de rappel sont programmées sur ton téléphone.',
  },
  {
    title: 'Combien de temps ?',
    body:
      'Tant que ton compte existe. Quand tu supprimes ton compte (Réglages › Supprimer mon compte), toutes tes données ' +
      'sont effacées immédiatement et définitivement. Les comptes enfants sont supprimés par leur parent.',
  },
  {
    title: 'Tes droits',
    body:
      'Tu peux à tout moment consulter, corriger (Réglages) ou supprimer tes données, et demander une copie en écrivant à ' +
      `${CONTACT}. Tu peux aussi déposer une réclamation auprès de la CNIL (cnil.fr).`,
  },
];
