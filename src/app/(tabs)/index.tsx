import { Redirect, useIsFocused } from 'expo-router';
import { currentTab } from '@/lib/moments';

/**
 * Point d'entrée : ouvre l'onglet du moment (matin, journée ou soir).
 * Seulement quand cet écran est affiché : il reste monté en arrière-plan des onglets,
 * et ne doit pas détourner une navigation vers le timer ou la famille.
 */
export default function Home() {
  const focused = useIsFocused();
  if (!focused) return null;
  return <Redirect href={`/${currentTab()}`} />;
}
