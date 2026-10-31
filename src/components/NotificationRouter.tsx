import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { notificationsSupported } from '@/lib/notifications';

/** Toucher une notification ouvre le bon écran (timer ou liste des tâches). */
function NativeNotificationRouter() {
  const response = Notifications.useLastNotificationResponse();
  const { user } = useAuth();

  useEffect(() => {
    if (!response || !user) return;
    const data = response.notification.request.content.data as { userId?: string; kind?: string } | undefined;
    // Notification d'un autre compte de l'appareil : on reste sur l'écran de connexion.
    if (data?.userId !== user.id) return;
    router.navigate(data.kind === 'timer' ? '/timer' : '/');
  }, [response, user]);

  return null;
}

export const NotificationRouter = notificationsSupported ? NativeNotificationRouter : () => null;
