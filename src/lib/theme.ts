import { useColorScheme } from 'react-native';
import type { AgeGroup } from './types';

const light = {
  background: '#F7F5FF',
  card: '#FFFFFF',
  text: '#1E1B2E',
  textMuted: '#6B6880',
  primary: '#6C5CE7',
  primaryText: '#FFFFFF',
  primarySoft: '#E9E5FF',
  success: '#00B894',
  successSoft: '#D5F5EC',
  warning: '#FDCB6E',
  danger: '#E05656',
  border: '#E3E0F0',
};

const dark: typeof light = {
  background: '#14121F',
  card: '#221F33',
  text: '#F3F1FF',
  textMuted: '#A9A5C2',
  primary: '#8E80FF',
  primaryText: '#14121F',
  primarySoft: '#2F2A4F',
  success: '#2ED3A6',
  successSoft: '#163A32',
  warning: '#FDCB6E',
  danger: '#FF7A7A',
  border: '#36324D',
};

export type Colors = typeof light;

export interface Theme {
  colors: Colors;
  /** Multiplicateur de taille de texte : plus grand pour les enfants. */
  fontScale: number;
  /** Rayon des coins : plus arrondi pour les enfants. */
  radius: number;
  /** Afficher plus d'emojis et d'encouragements. */
  playful: boolean;
}

export function useTheme(ageGroup: AgeGroup = 'adulte'): Theme {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? dark : light;
  switch (ageGroup) {
    case 'enfant':
      return { colors, fontScale: 1.15, radius: 22, playful: true };
    case 'ado':
      return { colors, fontScale: 1.05, radius: 18, playful: true };
    default:
      return { colors, fontScale: 1, radius: 14, playful: false };
  }
}

export const AVATARS = ['🦊', '🐼', '🐯', '🐸', '🦄', '🐙', '🚀', '⚽', '🎸', '🌈', '🌻', '😎'];

export const TASK_EMOJIS = [
  '📝', '🦷', '🛏️', '🎒', '📚', '🧹', '🍽️', '🚿', '👕', '💊',
  '🐶', '🛒', '💻', '📞', '🏃', '🎨', '🎮', '💧', '🧺', '⭐',
];

export const AGE_GROUPS: { value: AgeGroup; label: string; emoji: string }[] = [
  { value: 'enfant', label: 'Enfant', emoji: '🧒' },
  { value: 'ado', label: 'Ado', emoji: '🧑' },
  { value: 'adulte', label: 'Adulte', emoji: '🧑‍💼' },
];

const CHEERS: Record<AgeGroup, string[]> = {
  enfant: ['Bravo ! 🎉', 'Super champion ! 🏆', 'Trop fort ! ⭐', 'Génial, une de moins ! 🚀'],
  ado: ['Bien joué 🔥', 'Une de moins 💪', 'Carré ✅', 'Tu gères 😎'],
  adulte: ['Tâche terminée ✅', 'Bien joué.', 'Une de moins !', 'Bon travail.'],
};

export function randomCheer(ageGroup: AgeGroup): string {
  const list = CHEERS[ageGroup];
  return list[Math.floor(Math.random() * list.length)];
}
