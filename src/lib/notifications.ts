import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import type { PublicUser, Settings, Task } from './types';

/**
 * Stratégie : à chaque modification des tâches ou des réglages, on annule toutes les
 * notifications de rappel de l'utilisateur, puis on reprogramme ce qui doit l'être.
 * C'est simple et ça évite les notifications « orphelines ».
 *
 * Les tâches quotidiennes sont programmées sur quelques jours glissants (et non avec
 * un déclencheur répétitif) pour pouvoir sauter le jour où la tâche est déjà faite.
 */

export const notificationsSupported = Platform.OS !== 'web';

const CHANNEL_ID = 'reminders';
const DAYS_AHEAD = 3;

type Kind = 'task' | 'nudge' | 'summary' | 'timer';

let initialized = false;

export async function initNotifications(): Promise<void> {
  if (!notificationsSupported || initialized) return;
  initialized = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Rappels et timer',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

/** Demande l'autorisation si besoin. Renvoie true si les notifications sont permises. */
export async function ensurePermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function scheduleAt(date: Date, title: string, body: string, data: Record<string, unknown>) {
  if (date.getTime() <= Date.now() + 1000) return;
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID },
  });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Prochaines dates de rappel d'une tâche (vide si aucun rappel à envoyer). */
export function reminderOccurrences(task: Task, now = new Date()): Date[] {
  const { reminder } = task;
  if (!reminder.enabled || !reminder.at) return [];
  const base = new Date(reminder.at);
  if (reminder.repeat === 'none') return task.done ? [] : [base];

  const doneToday = task.done && task.doneAt != null && isSameDay(new Date(task.doneAt), now);
  const dates: Date[] = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    d.setHours(base.getHours(), base.getMinutes(), 0, 0);
    if (i === 0 && doneToday) continue;
    dates.push(d);
  }
  return dates;
}

async function cancelUserReminders(userId: string) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => {
        const data = n.content.data as { userId?: string; kind?: Kind } | undefined;
        return data?.userId === userId && data.kind !== 'timer';
      })
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

export async function syncReminders(user: PublicUser, tasks: Task[], settings: Settings): Promise<void> {
  if (!notificationsSupported) return;
  await cancelUserReminders(user.id);
  if (!settings.remindersEnabled) return;

  const kid = user.ageGroup !== 'adulte';
  const prefix = `${user.avatar} ${user.name}`;

  for (const task of tasks) {
    for (const date of reminderOccurrences(task)) {
      const data = { userId: user.id, taskId: task.id };
      await scheduleAt(date, `${prefix} · C'est l'heure !`, `${task.emoji} ${task.title}`, { ...data, kind: 'task' });
      if (task.reminder.nudge) {
        const nudgeDate = new Date(date.getTime() + settings.nudgeDelayMin * 60_000);
        await scheduleAt(
          nudgeDate,
          `${prefix} · Petite relance ⏰`,
          kid ? `Tu as pensé à : ${task.emoji} ${task.title} ?` : `Pas encore fait : ${task.emoji} ${task.title}`,
          { ...data, kind: 'nudge' },
        );
      }
    }
  }

  if (settings.dailySummaryEnabled) {
    const now = new Date();
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      d.setHours(settings.dailySummaryHour, settings.dailySummaryMinute, 0, 0);
      // Aujourd'hui : tâches non faites. Jours suivants : on compte aussi les routines quotidiennes.
      const count = tasks.filter((t) => !t.done || (i > 0 && t.reminder.repeat === 'daily')).length;
      if (count === 0) continue;
      const body =
        count === 1 ? '1 tâche t’attend aujourd’hui. On commence ? 💪' : `${count} tâches t’attendent. On en fait une ? 💪`;
      await scheduleAt(d, `${prefix} · Ta journée`, body, { userId: user.id, kind: 'summary' });
    }
  }
}

export async function cancelAllForUser(userId: string): Promise<void> {
  if (!notificationsSupported) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => (n.content.data as { userId?: string } | undefined)?.userId === userId)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

const timerId = (userId: string) => `timer-${userId}`;

export async function scheduleTimerEnd(userId: string, seconds: number, label: string): Promise<void> {
  if (!notificationsSupported || seconds < 1) return;
  await Notifications.scheduleNotificationAsync({
    identifier: timerId(userId),
    content: { title: '⏰ Temps écoulé !', body: label, data: { userId, kind: 'timer' }, sound: true },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.round(seconds),
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelTimerEnd(userId: string): Promise<void> {
  if (!notificationsSupported) return;
  await Notifications.cancelScheduledNotificationAsync(timerId(userId)).catch(() => {});
}
