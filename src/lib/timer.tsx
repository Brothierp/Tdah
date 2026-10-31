import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useAuth } from './auth';
import { useData } from './data';
import { cancelTimerEnd, scheduleTimerEnd, TIMER_WARNING_MIN_TOTAL, TIMER_WARNING_SEC } from './notifications';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

interface TimerState {
  status: TimerStatus;
  totalSec: number;
  /** Horodatage de fin quand le timer tourne (résiste à la mise en arrière-plan). */
  endAt: number | null;
  /** Secondes restantes quand le timer est en pause. */
  pausedRemaining: number;
  taskId: string | null;
  label: string;
}

interface TimerContextValue extends TimerState {
  remainingSec: number;
  /** La fin approche (dernière minute) : moment de se préparer à la suite. */
  warning: boolean;
  start: (minutes: number, label: string, taskId?: string | null) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  addMinutes: (minutes: number) => void;
}

const IDLE: TimerState = { status: 'idle', totalSec: 0, endAt: null, pausedRemaining: 0, taskId: null, label: '' };
const KEEP_AWAKE_TAG = 'focus-timer';

const TimerContext = createContext<TimerContextValue | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { settings } = useData();
  const userId = user?.id ?? null;
  const [state, setState] = useState<TimerState>(IDLE);
  const [now, setNow] = useState(() => Date.now());
  const warnedRef = useRef(false);
  const warnEnabled = settings.timerWarning;

  // À la déconnexion (le provider est démonté), on annule l'alerte de fin du timer.
  useEffect(
    () => () => {
      if (userId) cancelTimerEnd(userId);
    },
    [userId],
  );

  // Tic-tac : met à jour l'affichage et détecte la fin du timer.
  const { status, endAt } = state;
  const { hapticsEnabled } = settings;
  const canWarn = warnEnabled && state.totalSec >= TIMER_WARNING_MIN_TOTAL;
  useEffect(() => {
    if (status !== 'running' || !endAt) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (canWarn && !warnedRef.current && endAt - t <= TIMER_WARNING_SEC * 1000 && t < endAt) {
        warnedRef.current = true;
        if (hapticsEnabled && Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        }
      }
      if (t >= endAt) {
        setState((s) => ({ ...s, status: 'finished', endAt: null }));
        if (hapticsEnabled && Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [status, endAt, hapticsEnabled, canWarn]);

  const remainingSec =
    state.status === 'running' && state.endAt
      ? Math.max(0, Math.ceil((state.endAt - now) / 1000))
      : state.status === 'paused'
        ? state.pausedRemaining
        : 0;

  // Garder l'écran allumé pendant le timer (option).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (state.status === 'running' && settings.keepScreenAwake) {
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
      return () => {
        deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      };
    }
  }, [state.status, settings.keepScreenAwake]);

  const run = useCallback(
    (seconds: number, base: Omit<TimerState, 'status' | 'endAt' | 'pausedRemaining'>) => {
      const t = Date.now();
      setNow(t);
      warnedRef.current = seconds <= TIMER_WARNING_SEC;
      setState({ ...base, status: 'running', endAt: t + seconds * 1000, pausedRemaining: 0 });
      if (userId) {
        const warn = warnEnabled && base.totalSec >= TIMER_WARNING_MIN_TOTAL;
        cancelTimerEnd(userId).then(() => scheduleTimerEnd(userId, seconds, base.label || 'Ton timer est terminé.', warn));
      }
    },
    [userId, warnEnabled],
  );

  const start = useCallback<TimerContextValue['start']>(
    (minutes, label, taskId = null) => {
      const totalSec = Math.round(minutes * 60);
      run(totalSec, { totalSec, label, taskId });
    },
    [run],
  );

  const pause = useCallback(() => {
    if (state.status !== 'running') return;
    setState((s) => ({ ...s, status: 'paused', endAt: null, pausedRemaining: remainingSec }));
    if (userId) cancelTimerEnd(userId);
  }, [state.status, remainingSec, userId]);

  const resume = useCallback(() => {
    if (state.status !== 'paused') return;
    run(state.pausedRemaining, state);
  }, [state, run]);

  const reset = useCallback(() => {
    setState(IDLE);
    if (userId) cancelTimerEnd(userId);
  }, [userId]);

  const addMinutes = useCallback(
    (minutes: number) => {
      const extra = minutes * 60;
      if (state.status === 'running') run(remainingSec + extra, { ...state, totalSec: state.totalSec + extra });
      else if (state.status === 'paused')
        setState((s) => ({ ...s, totalSec: s.totalSec + extra, pausedRemaining: s.pausedRemaining + extra }));
      else if (state.status === 'finished') run(extra, { ...state, totalSec: extra });
    },
    [state, remainingSec, run],
  );

  const warning = canWarn && state.status === 'running' && remainingSec > 0 && remainingSec <= TIMER_WARNING_SEC;

  const value = useMemo(
    () => ({ ...state, remainingSec, warning, start, pause, resume, reset, addMinutes }),
    [state, remainingSec, warning, start, pause, resume, reset, addMinutes],
  );
  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer doit être utilisé dans <TimerProvider>.');
  return ctx;
}

export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
