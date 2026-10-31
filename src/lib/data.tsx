import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './auth';
import { initNotifications, syncReminders } from './notifications';
import { keys, readJSON, writeJSON } from './storage';
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
