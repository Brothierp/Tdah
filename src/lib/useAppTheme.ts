import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useAuth } from './auth';
import { useData } from './data';
import { useTheme, type Theme } from './theme';

/** Suit le réglage « Réduire les animations » du téléphone. */
function useSystemReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduce)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** Thème adapté à l'âge et aux réglages de confort du compte connecté. */
export function useAppTheme(): Theme {
  const { user } = useAuth();
  const { settings } = useData();
  const systemReduceMotion = useSystemReduceMotion();
  return useTheme(user?.ageGroup ?? 'adulte', {
    textSize: settings.textSize,
    calmMode: settings.calmMode,
    systemReduceMotion,
  });
}
