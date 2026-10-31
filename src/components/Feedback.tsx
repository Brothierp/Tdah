import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '@/lib/data';
import { useAppTheme } from '@/lib/useAppTheme';

/**
 * Retours visuels communs :
 *  - toast : message court, avec un bouton « Annuler » optionnel (droit à l'erreur) ;
 *  - celebrate : petite pluie d'étoiles quand une tâche est faite (désactivée en mode calme).
 */

interface ToastState {
  id: number;
  message: string;
  undo?: () => void;
}

interface FeedbackValue {
  toast: (message: string, undo?: () => void) => void;
  celebrate: () => void;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);
const useNativeDriver = Platform.OS !== 'web';

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { colors, radius, reduceMotion } = useAppTheme();
  const { settings } = useData();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<ToastState | null>(null);
  const [burst, setBurst] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback<FeedbackValue['toast']>((message, undo) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setCurrent({ id, message, undo });
    // Assez long pour lire et réagir, surtout avec un bouton Annuler.
    timer.current = setTimeout(() => setCurrent((c) => (c?.id === id ? null : c)), undo ? 5000 : 2500);
  }, []);

  const celebrate = useCallback(() => {
    if (settings.hapticsEnabled && Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    if (!reduceMotion) setBurst((b) => b + 1);
  }, [settings.hapticsEnabled, reduceMotion]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => ({ toast, celebrate }), [toast, celebrate]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {burst > 0 && <Burst key={burst} />}
      {current && (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            { bottom: insets.bottom + 80, backgroundColor: colors.text, borderRadius: radius },
          ]}
        >
          <Text style={[styles.toastText, { color: colors.background }]}>{current.message}</Text>
          {current.undo && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Annuler"
              hitSlop={10}
              onPress={() => {
                current.undo?.();
                setCurrent(null);
              }}
              style={[styles.undo, { borderColor: colors.background }]}
            >
              <Text style={[styles.undoText, { color: colors.background }]}>Annuler</Text>
            </Pressable>
          )}
        </View>
      )}
    </FeedbackContext.Provider>
  );
}

const PIECES = ['⭐', '✨', '🎉', '⭐', '💫', '✨', '⭐', '🎊', '✨', '⭐'];

/** Petite pluie d'étoiles, 1 seconde. */
function Burst() {
  const [progress] = useState(() => new Animated.Value(0));
  const [pieces] = useState(() =>
    PIECES.map((emoji, i) => ({ emoji, x: (i / (PIECES.length - 1) - 0.5) * 280 + (Math.random() - 0.5) * 40, rise: 160 + Math.random() * 160 })),
  );
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver }).start();
  }, [progress]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Animated.Text
          key={i}
          style={{
            position: 'absolute',
            bottom: 140,
            left: '50%',
            fontSize: 28,
            opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.x] }) },
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -p.rise] }) },
              { scale: progress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.2, 1] }) },
            ],
          }}
        >
          {p.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

export function useFeedback(): FeedbackValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback doit être utilisé dans <FeedbackProvider>.');
  return ctx;
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    maxWidth: 560,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  toastText: { flex: 1, fontSize: 17, fontWeight: '700' },
  undo: { borderWidth: 2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  undoText: { fontSize: 16, fontWeight: '800' },
});
