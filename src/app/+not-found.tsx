import { Redirect } from 'expo-router';

/** Adresse inconnue (lien ancien, page web ouverte ailleurs qu'à la racine) : retour à l'accueil. */
export default function NotFound() {
  return <Redirect href="/" />;
}
