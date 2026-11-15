import { useColorScheme } from 'react-native';
import type { AgeGroup } from './types';

/**
 * Palette pastel douce, pensée pour apaiser : fonds clairs légèrement teintés,
 * couleurs de remplissage pastel avec un texte foncé dessus (doux mais lisible).
 *
 *  - primary      : couleur d'accent pour le TEXTE, les liens et les icônes (assez foncée pour être lisible)
 *  - primaryFill  : fond pastel des boutons principaux, avec `onFill` comme couleur de texte
 *  - successFill  : fond pastel du bouton « Fait »
 *  - tints        : fond très léger de chaque moment (matin pêche, journée menthe, soir lavande)
 */
const light = {
  background: '#F8F7FB',
  card: '#FFFFFF',
  text: '#34344A',
  textMuted: '#77768A',
  primary: '#5B67B8',
  primaryText: '#2A2D52',
  primarySoft: '#ECEEFB',
  primaryFill: '#C3CAF5',
  onFill: '#2A2D52',
  success: '#7CC4A2',
  successSoft: '#E5F4EC',
  successFill: '#BFE6D2',
  warning: '#F6D7A7',
  danger: '#B85C5A',
  dangerSoft: '#F8E1E0',
  border: '#E8E6F0',
  tintMatin: '#FDF3E7',
  tintJournee: '#EDF7F2',
  tintSoir: '#F1EEFA',
};

const dark: typeof light = {
  background: '#1D1C26',
  card: '#282736',
  text: '#ECEAF5',
  textMuted: '#A6A4BA',
  primary: '#B5BEF5',
  primaryText: '#1D1C26',
  primarySoft: '#33354F',
  primaryFill: '#AEB8EF',
  onFill: '#1D1C26',
  success: '#8FD0B1',
  successSoft: '#22352D',
  successFill: '#9ED8BC',
  warning: '#E8C994',
  danger: '#EBA3A0',
  dangerSoft: '#3D2A2C',
  border: '#393849',
  tintMatin: '#29251F',
  tintJournee: '#1F2925',
  tintSoir: '#25232F',
};

/** Mode calme : encore moins de couleur (gris doux), pour les jours de surcharge sensorielle. */
const calmLight: typeof light = {
  ...light,
  background: '#F6F6F4',
  text: '#3A3A40',
  textMuted: '#7A7A80',
  primary: '#5E6A8A',
  primarySoft: '#ECEEF2',
  primaryFill: '#D3D9E6',
  onFill: '#2E3240',
  success: '#86AE9B',
  successSoft: '#E8F0EC',
  successFill: '#D2E4DA',
  tintMatin: '#F7F4EF',
  tintJournee: '#F1F5F3',
  tintSoir: '#F3F2F6',
};

const calmDark: typeof light = {
  ...dark,
  background: '#1C1C20',
  card: '#26262C',
  primary: '#AAB4CC',
  primaryFill: '#9AA4BC',
  successFill: '#93B8A6',
  tintMatin: '#24221F',
  tintJournee: '#1F2422',
  tintSoir: '#222128',
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
