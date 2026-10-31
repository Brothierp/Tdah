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

/** Mode calme : couleurs moins saturées, contrastes doux (confort sensoriel, TSA). */
const calmLight: typeof light = {
  background: '#F5F4F0',
  card: '#FFFFFF',
  text: '#2B2A33',
  textMuted: '#6E6D78',
  primary: '#56679A',
  primaryText: '#FFFFFF',
  primarySoft: '#E5E8F1',
  success: '#4F8F74',
  successSoft: '#E1EEE7',
  warning: '#D9B66A',
  danger: '#B5524F',
  border: '#E2E0DA',
};

const calmDark: typeof light = {
  background: '#1A1A1E',
  card: '#25252B',
  text: '#ECEBE6',
  textMuted: '#A7A6AE',
  primary: '#9AA8D6',
  primaryText: '#1A1A1E',
  primarySoft: '#33384A',
  success: '#7DBB9F',
  successSoft: '#24352D',
  warning: '#D9B66A',
  danger: '#E08B88',
  border: '#3A3A42',
};

export type Colors = typeof light;

export interface Theme {
  colors: Colors;
  /** Multiplicateur de taille de texte : âge × réglage « taille du texte ». */
  fontScale: number;
  /** Rayon des coins : plus arrondi pour les enfants. */
  radius: number;
  /** Afficher plus d'emojis et d'encouragements. */
  playful: boolean;
  /** Pas d'animations ni de confettis (mode calme ou réglage du téléphone). */
  reduceMotion: boolean;
}

export interface ComfortOptions {
  textSize?: 'normal' | 'grand' | 'tres-grand';
  calmMode?: boolean;
  systemReduceMotion?: boolean;
}

const TEXT_SCALE = { normal: 1, grand: 1.2, 'tres-grand': 1.4 } as const;

export function useTheme(ageGroup: AgeGroup = 'adulte', comfort: ComfortOptions = {}): Theme {
  const scheme = useColorScheme();
  const calm = !!comfort.calmMode;
  const colors = scheme === 'dark' ? (calm ? calmDark : dark) : calm ? calmLight : light;
  const text = TEXT_SCALE[comfort.textSize ?? 'normal'];
  const reduceMotion = calm || !!comfort.systemReduceMotion;
  switch (ageGroup) {
    case 'enfant':
      return { colors, fontScale: 1.15 * text, radius: 22, playful: true, reduceMotion };
    case 'ado':
      return { colors, fontScale: 1.05 * text, radius: 18, playful: true, reduceMotion };
    default:
      return { colors, fontScale: text, radius: 14, playful: false, reduceMotion };
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
