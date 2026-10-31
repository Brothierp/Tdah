import { useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { useData } from '@/lib/data';
import { rewardProgress } from '@/lib/rewards';
import { randomCheer } from '@/lib/theme';
import type { Step, Task } from '@/lib/types';
import { useFeedback } from './Feedback';

/** Actions sur une tâche avec retour immédiat : célébration, encouragement, bouton « Annuler ». */
export function useTaskActions() {
  const { tasks, settings, toggleTask, toggleStep, deleteTask, restoreTask, postponeTask } = useData();
  const { user } = useAuth();
  const { toast, celebrate } = useFeedback();
  const ageGroup = user?.ageGroup ?? 'adulte';

  const onCompleted = useCallback(
    (task: Task) => {
      celebrate();
      // L'objectif de récompense vient d'être atteint ?
      const before = rewardProgress(settings);
      const after = rewardProgress({ ...settings, stars: settings.stars + 1 });
      const message =
        !before.reached && after.reached
          ? `🎁 Objectif atteint : ${settings.rewardLabel || 'ta récompense'} !`
          : `${randomCheer(ageGroup)} ⭐ +1`;
      toast(message, () => toggleTask(task.id));
    },
    [celebrate, settings, ageGroup, toast, toggleTask],
  );

  const toggle = useCallback(
    async (task: Task) => {
      if (await toggleTask(task.id)) onCompleted(task);
    },
    [toggleTask, onCompleted],
  );

  const completeStep = useCallback(
    async (task: Task, step: Step) => {
      if (await toggleStep(task.id, step.id)) onCompleted(task);
    },
    [toggleStep, onCompleted],
  );

  const remove = useCallback(
    async (task: Task) => {
      const index = tasks.findIndex((t) => t.id === task.id);
      await deleteTask(task.id);
      toast('Tâche supprimée', () => restoreTask(task, index));
    },
    [tasks, deleteTask, restoreTask, toast],
  );

  const postpone = useCallback(
    async (task: Task) => {
      await postponeTask(task.id);
      toast('OK, on la garde pour plus tard 👍');
    },
    [postponeTask, toast],
  );

  return { toggle, completeStep, remove, postpone };
}
