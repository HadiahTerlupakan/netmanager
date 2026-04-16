export type ForegroundPayloadSource = {
  notification?: {
    title?: string | null;
    body?: string | null;
  } | null;
  data?: Record<string, string | undefined> | null;
};

export interface NormalizedForegroundNotificationPayload {
  title: string;
  body: string;
}

function normalizeCopy(value?: string | null) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : null;
}

/**
 * Normalizes foreground notification payload.
 */
export function normalizeForegroundNotificationPayload(
  payload: ForegroundPayloadSource,
): NormalizedForegroundNotificationPayload | null {
  const notificationTitle = normalizeCopy(payload.notification?.title);
  const notificationBody = normalizeCopy(payload.notification?.body);

  if (notificationTitle && notificationBody) {
    return {
      title: notificationTitle,
      body: notificationBody,
    };
  }

  const dataTitle = normalizeCopy(payload.data?.title);
  const dataBody =
    normalizeCopy(payload.data?.body) ?? normalizeCopy(payload.data?.message);

  if (dataTitle && dataBody) {
    return {
      title: dataTitle,
      body: dataBody,
    };
  }

  return null;
}
