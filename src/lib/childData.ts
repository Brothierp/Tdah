import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useAuth } from './auth';
import { syncReminders } from './notifications';
import { backend } from './backend';
import { createTask, deleteTaskIn, resetDailyTasks, updateTaskIn, type TaskInput } from './taskOps';
import { DEFAULT_SETTINGS, type PublicUser, type Settings, type Task } from './types';

export interface ChildData {
  child: PublicUser | null;
  ready: boolean;
  tasks: Task[];
  settings: Settings;
  addTask: (input: TaskInput) => Promise<Task>;
  updateTask: (id: string, input: TaskInput) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  reload: () => Promise<void>;
}

/**
 * Données d'un enfant suivi par le compte connecté (espace parents).
 * Renvoie un état vide si childId est null ou n'est pas un enfant du compte connecté.
 * Les données sont rechargées à chaque fois que l'écran revient au premier plan.
 */
export function useChildData(childId: string | null): ChildData {
  const { user, children } = useAuth();
  const child = (childId && children.find((c) => c.id === childId)) || null;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  const tasksRef = useRef<Task[]>([]);
  const settingsRef = useRef<Settings>(DEFAULT_SETTINGS);
  const childKey = child?.id ?? null;

  const reload = useCallback(async () => {
    if (!childKey) return;
    const [stored, storedSettings] = await Promise.all([backend.loadTasks(childKey), backend.loadSettings(childKey)]);
    const reset = resetDailyTasks(stored);
    tasksRef.current = reset;
    settingsRef.current = storedSettings;
    setTasks(reset);
    setSettings(settingsRef.current);
    setReady(true);
  }, [childKey]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const save = useCallback(
    async (next: Task[]) => {
      if (!child) throw new Error("Ce compte ne fait pas partie de ta famille.");
      const prev = tasksRef.current;
      tasksRef.current = next;
      setTasks(next);
      await backend.saveTasks(child.id, prev, next);
      // Mode local (même appareil) : on reprogramme tout de suite les rappels de l'enfant.
      // Mode cloud : son téléphone les reprogramme à la prochaine ouverture de l'app.
      if (backend.mode === 'local') {
        syncReminders(child, next, settingsRef.current).catch((e) => console.warn('Rappels enfant :', e));
      }
    },
    [child],
  );

  const addTask = useCallback(
    async (input: TaskInput) => {
      const task = createTask(input, user?.id ?? null);
      await save([...tasksRef.current, task]);
      return task;
    },
    [save, user?.id],
  );

  const updateTask = useCallback(
    (id: string, input: TaskInput) => save(updateTaskIn(tasksRef.current, id, input)),
    [save],
  );

  const deleteTask = useCallback((id: string) => save(deleteTaskIn(tasksRef.current, id)), [save]);

  return { child, ready, tasks, settings, addTask, updateTask, deleteTask, reload };
}
