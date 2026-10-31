import * as Crypto from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './auth';
import { initNotifications, syncReminders } from './notifications';
import { keys, readJSON, writeJSON } from './storage';
import { DEFAULT_SETTINGS, type Settings, type Step, type Task } from './types';

export type TaskInput = Pick<Task, 'title' | 'emoji' | 'durationMin' | 'reminder'> & { steps: string[] };

interface DataContextValue {
  ready: boolean;
  tasks: Task[];
  settings: Settings;
  addTask: (input: TaskInput) => Promise<Task>;
  updateTask: (id: string, input: TaskInput) => Promise<void>;
  toggleTask: (id: string) => Promise<boolean>;
  toggleStep: (taskId: string, stepId: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  clearDone: () => Promise<void>;
  moveTask: (id: string, direction: -1 | 1) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

function isToday(iso: string | null) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

/** Les routines quotidiennes redeviennent « à faire » chaque nouveau jour. */
function resetDailyTasks(tasks: Task[]): Task[] {
  let changed = false;
  const next = tasks.map((t) => {
    if (t.reminder.repeat === 'daily' && t.done && !isToday(t.doneAt)) {
      changed = true;
      return { ...t, done: false, doneAt: null, steps: t.steps.map((s) => ({ ...s, done: false })) };
    }
    return t;
  });
  return changed ? next : tasks;
}

function buildSteps(titles: string[], previous: Step[] = []): Step[] {
  return titles
    .map((t) => t.trim())
    .filter(Boolean)
    .map((title) => {
      const existing = previous.find((s) => s.title === title);
      return existing ?? { id: Crypto.randomUUID(), title, done: false };
    });
}

/** Le store est remonté à chaque changement de compte : aucun état ne fuit d'un compte à l'autre. */
export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <DataStore key={user?.id ?? 'guest'} userId={user?.id ?? null}>
      {children}
    </DataStore>
  );
}

function DataStore({ userId, children }: { userId: string | null; children: ReactNode }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const tasksRef = useRef<Task[]>([]);

  useEffect(() => {
    initNotifications();
  }, []);

  // Chargement des données du compte connecté.
  useEffect(() => {
    let cancelled = false;
    if (!userId) return;
    (async () => {
      const [storedTasks, storedSettings] = await Promise.all([
        readJSON<Task[]>(keys.tasks(userId), []),
        readJSON<Partial<Settings>>(keys.settings(userId), {}),
      ]);
      if (cancelled) return;
      const resetTasks = resetDailyTasks(storedTasks);
      if (resetTasks !== storedTasks) await writeJSON(keys.tasks(userId), resetTasks);
      tasksRef.current = resetTasks;
      setTasks(resetTasks);
      setSettings({ ...DEFAULT_SETTINGS, ...storedSettings });
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const saveTasks = useCallback(
    async (updater: (prev: Task[]) => Task[]) => {
      if (!userId) return;
      const next = updater(tasksRef.current);
      tasksRef.current = next;
      setTasks(next);
      await writeJSON(keys.tasks(userId), next);
    },
    [userId],
  );

  // Au retour dans l'app : réinitialise les routines si on a changé de jour.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && ready) {
        const reset = resetDailyTasks(tasksRef.current);
        if (reset !== tasksRef.current) saveTasks(() => reset);
      }
    });
    return () => sub.remove();
  }, [ready, saveTasks]);

  // Reprogramme les rappels quand quelque chose change (avec un petit délai).
  useEffect(() => {
    if (!ready || !user) return;
    const timeout = setTimeout(() => {
      syncReminders(user, tasks, settings).catch((e) => console.warn('Rappels :', e));
    }, 600);
    return () => clearTimeout(timeout);
  }, [ready, user, tasks, settings]);

  const addTask = useCallback<DataContextValue['addTask']>(
    async ({ steps, ...input }) => {
      const task: Task = {
        ...input,
        title: input.title.trim(),
        id: Crypto.randomUUID(),
        done: false,
        doneAt: null,
        createdAt: new Date().toISOString(),
        steps: buildSteps(steps),
      };
      await saveTasks((prev) => [...prev, task]);
      return task;
    },
    [saveTasks],
  );

  const updateTask = useCallback<DataContextValue['updateTask']>(
    (id, { steps, ...input }) =>
      saveTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...input, title: input.title.trim(), steps: buildSteps(steps, t.steps) } : t)),
      ),
    [saveTasks],
  );

  const toggleTask = useCallback<DataContextValue['toggleTask']>(
    async (id) => {
      let nowDone = false;
      await saveTasks((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          nowDone = !t.done;
          return {
            ...t,
            done: nowDone,
            doneAt: nowDone ? new Date().toISOString() : null,
            steps: nowDone ? t.steps.map((s) => ({ ...s, done: true })) : t.steps,
          };
        }),
      );
      return nowDone;
    },
    [saveTasks],
  );

  const toggleStep = useCallback<DataContextValue['toggleStep']>(
    (taskId, stepId) =>
      saveTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          const steps = t.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s));
          const allDone = steps.length > 0 && steps.every((s) => s.done);
          return { ...t, steps, done: allDone, doneAt: allDone ? (t.doneAt ?? new Date().toISOString()) : null };
        }),
      ),
    [saveTasks],
  );

  const deleteTask = useCallback((id: string) => saveTasks((prev) => prev.filter((t) => t.id !== id)), [saveTasks]);

  const clearDone = useCallback(
    // Les routines quotidiennes sont conservées : elles reviendront demain.
    () => saveTasks((prev) => prev.filter((t) => !t.done || t.reminder.repeat === 'daily')),
    [saveTasks],
  );

  const moveTask = useCallback<DataContextValue['moveTask']>(
    (id, direction) =>
      saveTasks((prev) => {
        const index = prev.findIndex((t) => t.id === id);
        if (index < 0) return prev;
        // On échange avec la tâche voisine visible dans la même liste (à faire / faites).
        let target = index + direction;
        while (target >= 0 && target < prev.length && prev[target].done !== prev[index].done) target += direction;
        if (target < 0 || target >= prev.length) return prev;
        const next = [...prev];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      }),
    [saveTasks],
  );

  const updateSettings = useCallback<DataContextValue['updateSettings']>(
    async (patch) => {
      if (!userId) return;
      const next = { ...settings, ...patch };
      setSettings(next);
      await writeJSON(keys.settings(userId), next);
    },
    [userId, settings],
  );

  const value = useMemo(
    () => ({
      ready,
      tasks,
      settings,
      addTask,
      updateTask,
      toggleTask,
      toggleStep,
      deleteTask,
      clearDone,
      moveTask,
      updateSettings,
    }),
    [ready, tasks, settings, addTask, updateTask, toggleTask, toggleStep, deleteTask, clearDone, moveTask, updateSettings],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData doit être utilisé dans <DataProvider>.');
  return ctx;
}
