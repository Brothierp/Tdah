import { useAuth } from './auth';
import { useTheme, type Theme } from './theme';

/** Thème adapté à l'âge du compte connecté. */
export function useAppTheme(): Theme {
  const { user } = useAuth();
  return useTheme(user?.ageGroup ?? 'adulte');
}
