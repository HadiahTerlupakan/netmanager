export interface RealtimeNotification {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPayloadInput {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  link?: string;
  createdAt: string;
}

export function addUnreadRealtimeNotification(
  notifications: RealtimeNotification[],
  payload: NotificationPayloadInput,
  limit: number,
): { notifications: RealtimeNotification[]; didAdd: boolean } {
  if (notifications.some((notification) => notification.id === payload.id)) {
    return { notifications, didAdd: false };
  }

  const notification: RealtimeNotification = {
    ...payload,
    isRead: false,
  };

  return {
    notifications: [notification, ...notifications.slice(0, limit - 1)],
    didAdd: true,
  };
}
