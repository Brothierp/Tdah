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
  resetDailyTasks,
  toggleStepIn,
  toggleTaskIn,
  updateTaskIn,
  type TaskInput,
} from './taskOps';
import { DEFAULT_SETTINGS, type Settings, type Task } from './types';

export type { TaskInput };

interface DataContextValue {
  ready: boolean;
  refresh: () => Promise<void>;
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
      .catch((e) => console.warn('Chargement :', e));
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

  // Reprogramme les rappels quand quelque chose change (avec un petit délai).
  useEffect(() => {
    if (!ready || !user) return;
    const timeout = setTimeout(() => {
      syncReminders(user, tasks, settings).catch((e) => console.warn('Rappels :', e));
    }, 600);
    return () => clearTimeout(timeout);
  }, [ready, user, tasks, settings]);

  const addTask = useCallback<DataContextValue['addTask']>(
    async (input) => {
      const task = createTask(input);
      await saveTasks((prev) => [...prev, task]);
      return task;
    },
    [saveTasks],
  );

  const updateTask = useCallback<DataContextValue['updateTask']>(
    (id, input) => saveTasks((prev) => updateTaskIn(prev, id, input)),
    [saveTasks],
  );

  const toggleTask = useCallback<DataContextValue['toggleTask']>(
    async (id) => {
      let nowDone = false;
      await saveTasks((prev) => {
        const result = toggleTaskIn(prev, id);
        nowDone = result.nowDone;
        return result.tasks;
      });
      return nowDone;
    },
    [saveTasks],
  );

  const toggleStep = useCallback<DataContextValue['toggleStep']>(
    (taskId, stepId) => saveTasks((prev) => toggleStepIn(prev, taskId, stepId)),
    [saveTasks],
  );

  const deleteTask = useCallback((id: string) => saveTasks((prev) => deleteTaskIn(prev, id)), [saveTasks]);

  const clearDone = useCallback(() => saveTasks(clearDoneIn), [saveTasks]);

  const moveTask = useCallback<DataContextValue['moveTask']>(
    (id, direction) => saveTasks((prev) => moveTaskIn(prev, id, direction)),
    [saveTasks],
  );

  const updateSettings = useCallback<DataContextValue['updateSettings']>(
    async (patch) => {
      if (!userId) return;
      const next = { ...settings, ...patch };
      setSettings(next);
      await backend.saveSettings(userId, next);
    },
    [userId, settings],
  );

  const value = useMemo(
    () => ({
      ready,
      refresh,
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
    [ready, refresh, tasks, settings, addTask, updateTask, toggleTask, toggleStep, deleteTask, clearDone, moveTask, updateSettings],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData doit être utilisé dans <DataProvider>.');
  return ctx;
}
