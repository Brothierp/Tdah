import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './auth';
import { initNotifications, syncReminders } from './notifications';
import { backend } from './backend';
import {
  clearDoneIn,
  createTask,
  deleteTaskIn,
  moveTaskIn,
  postponeTaskIn,
  resetDailyTasks,
  toggleStepIn,
  toggleTaskIn,
  updateTaskIn,
  type TaskInput,
} from './taskOps';
import { applyCompletion } from './rewards';
import { DEFAULT_SETTINGS, type Settings, type Task } from './types';

export type { TaskInput };

interface DataContextValue {
  ready: boolean;
  refresh: () => Promise<void>;
  tasks: Task[];
  settings: Settings;
  addTask: (input: TaskInput) => Promise<Task>;
  /** Ajoute plusieurs tâches d'un coup (modèles de routines). */
  addTasks: (inputs: TaskInput[]) => Promise<void>;
  updateTask: (id: string, input: TaskInput) => Promise<void>;
  toggleTask: (id: string) => Promise<boolean>;
  /** Coche/décoche une étape. Renvoie true si la tâche entière vient d'être terminée. */
  toggleStep: (taskId: string, stepId: string) => Promise<boolean>;
  deleteTask: (id: string) => Promise<void>;
  /** Remet une tâche supprimée à sa place (bouton « Annuler »). */
  restoreTask: (task: Task, index: number) => Promise<void>;
  /** « Plus tard » : la tâche passe en fin de liste. */
  postponeTask: (id: string) => Promise<void>;
  clearDone: () => Promise<void>;
  moveTask: (id: string, direction: -1 | 1) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

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
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    initNotifications();
  }, []);

  const saveTasks = useCallback(
    async (updater: (prev: Task[]) => Task[]) => {
      if (!userId) return;
      const prev = tasksRef.current;
      const next = updater(prev);
      if (next === prev) return;
      tasksRef.current = next;
      setTasks(next);
      await backend.saveTasks(userId, prev, next);
    },
    [userId],
  );

  const fetchData = useCallback(
    async () => (userId ? Promise.all([backend.loadTasks(userId), backend.loadSettings(userId)]) : null),
    [userId],
  );

  const apply = useCallback(
    async (data: [Task[], Settings] | null) => {
      if (!data) return;
      const [stored, storedSettings] = data;
      tasksRef.current = stored;
      setTasks(stored);
      settingsRef.current = storedSettings;
      setSettings(storedSettings);
      setReady(true);
      // Les routines quotidiennes redeviennent « à faire » chaque nouveau jour.
      const reset = resetDailyTasks(stored);
      if (reset !== stored) await saveTasks(() => reset);
    },
    [saveTasks],
  );

  /** Recharge les données : au retour dans l'app et sur « tirer pour actualiser ». */
  const refresh = useCallback(async () => apply(await fetchData()), [apply, fetchData]);

  useEffect(() => {
    let cancelled = false;
    fetchData()
      .then((data) => (cancelled ? undefined : apply(data)))
      .catch((e) => {
        console.warn('Chargement :', e);
        // On n'empêche jamais d'utiliser l'app : écran vide plutôt qu'un chargement infini.
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchData, apply]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh().catch(() => {});
    });
    return () => sub.remove();
  }, [refresh]);

  // Reprogramme les rappels quand les tâches ou les réglages de rappel changent (avec un petit délai).
  const { remindersEnabled, dailySummaryEnabled, dailySummaryHour, dailySummaryMinute, nudgeDelayMin } = settings;
  useEffect(() => {
    if (!ready || !user) return;
    const timeout = setTimeout(() => {
      syncReminders(user, tasks, settingsRef.current).catch((e) => console.warn('Rappels :', e));
    }, 600);
    return () => clearTimeout(timeout);
  }, [ready, user, tasks, remindersEnabled, dailySummaryEnabled, dailySummaryHour, dailySummaryMinute, nudgeDelayMin]);

  const updateSettings = useCallback<DataContextValue['updateSettings']>(
    async (patch) => {
      if (!userId) return;
      const next = { ...settingsRef.current, ...patch };
      settingsRef.current = next;
      setSettings(next);
      await backend.saveSettings(userId, next);
    },
    [userId],
  );

  /** Étoiles et série : +1 par tâche qui passe à « faite », -1 si on la décoche. */
  const saveWithRewards = useCallback(
    async (updater: (prev: Task[]) => Task[]) => {
      const before = new Map(tasksRef.current.map((t) => [t.id, t.done]));
      await saveTasks(updater);
      let stats = settingsRef.current;
      for (const t of tasksRef.current) {
        const was = before.get(t.id);
        if (was === undefined || was === t.done) continue;
        stats = { ...stats, ...applyCompletion(stats, t.done ? 1 : -1) };
      }
      if (stats !== settingsRef.current) {
        await updateSettings({ stars: stats.stars, streak: stats.streak, lastDoneDay: stats.lastDoneDay });
      }
    },
    [saveTasks, updateSettings],
  );

  const addTask = useCallback<DataContextValue['addTask']>(
    async (input) => {
      const task = createTask(input);
      await saveTasks((prev) => [...prev, task]);
      return task;
    },
    [saveTasks],
  );

  const addTasks = useCallback<DataContextValue['addTasks']>(
    (inputs) => saveTasks((prev) => [...prev, ...inputs.map((input) => createTask(input))]),
    [saveTasks],
  );

  const updateTask = useCallback<DataContextValue['updateTask']>(
    (id, input) => saveTasks((prev) => updateTaskIn(prev, id, input)),
    [saveTasks],
  );

  const toggleTask = useCallback<DataContextValue['toggleTask']>(
    async (id) => {
      let nowDone = false;
      await saveWithRewards((prev) => {
        const result = toggleTaskIn(prev, id);
        nowDone = result.nowDone;
        return result.tasks;
      });
      return nowDone;
    },
    [saveWithRewards],
  );

  const toggleStep = useCallback<DataContextValue['toggleStep']>(
    async (taskId, stepId) => {
      const wasDone = tasksRef.current.find((t) => t.id === taskId)?.done ?? false;
      await saveWithRewards((prev) => toggleStepIn(prev, taskId, stepId));
      return !wasDone && (tasksRef.current.find((t) => t.id === taskId)?.done ?? false);
    },
    [saveWithRewards],
  );

  const deleteTask = useCallback((id: string) => saveTasks((prev) => deleteTaskIn(prev, id)), [saveTasks]);

  const restoreTask = useCallback<DataContextValue['restoreTask']>(
    (task, index) =>
      saveTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [...prev.slice(0, index), task, ...prev.slice(index)])),
    [saveTasks],
  );

  const postponeTask = useCallback((id: string) => saveTasks((prev) => postponeTaskIn(prev, id)), [saveTasks]);

  const clearDone = useCallback(() => saveTasks(clearDoneIn), [saveTasks]);

  const moveTask = useCallback<DataContextValue['moveTask']>(
    (id, direction) => saveTasks((prev) => moveTaskIn(prev, id, direction)),
    [saveTasks],
  );

  const value = useMemo(
    () => ({
      ready,
      refresh,
      tasks,
      settings,
      addTask,
      addTasks,
      updateTask,
      toggleTask,
      toggleStep,
      deleteTask,
      restoreTask,
      postponeTask,
      clearDone,
      moveTask,
      updateSettings,
    }),
    [
      ready,
      refresh,
      tasks,
      settings,
      addTask,
      addTasks,
      updateTask,
      toggleTask,
      toggleStep,
      deleteTask,
      restoreTask,
      postponeTask,
      clearDone,
      moveTask,
      updateSettings,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData doit être utilisé dans <DataProvider>.');
  return ctx;
}
