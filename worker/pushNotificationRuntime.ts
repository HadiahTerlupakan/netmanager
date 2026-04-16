const DEFAULT_TITLE = "NetManager";
const DEFAULT_BODY = "You have a new notification";
const DEFAULT_ICON = "/icons/icon-192x192.png";
const DEFAULT_BADGE = "/icons/icon-72x72.png";
const DEFAULT_FALLBACK_URL = "/";

export type PushNotificationPayloadInput = Record<string, unknown>;

export type NormalizedPushNotificationPayload = {
  title: string;
  body: string;
  icon: string;
  badge: string;
  data: Record<string, unknown>;
};

export type NotificationClickClient = {
  url: string;
  visibilityState?: "hidden" | "visible" | "prerender";
  navigate?: (url: string) => Promise<unknown> | unknown;
  focus?: () => Promise<unknown> | unknown;
};

export type NotificationClickContext = {
  clients: readonly NotificationClickClient[];
  notificationData: { url?: string };
  openWindow?: (url: string) => Promise<unknown> | unknown;
};

export type PushEventDataLike = {
  json: () => unknown;
  text: () => string;
};

export type NotificationClickActionContext = NotificationClickContext & {
  action?: string;
};

/** Resolve and normalize payload data from a push event data payload. */
export function resolvePushNotificationPayloadFromEventData(
  eventData: PushEventDataLike | null | undefined,
): NormalizedPushNotificationPayload {
  if (!eventData) {
    return normalizePushNotificationPayload({});
  }

  try {
    return normalizePushNotificationPayload(
      eventData.json() as PushNotificationPayloadInput,
    );
  } catch {
    return normalizePushNotificationPayload({ body: eventData.text() });
  }
}

/** Normalize push payloads from browser push and nested notification shapes. */
export function normalizePushNotificationPayload(
  input: PushNotificationPayloadInput,
): NormalizedPushNotificationPayload {
  const notification = readRecord(input.notification);
  const data = readRecord(input.data);

  const title =
    readString(input.title) ??
    readString(notification.title) ??
    readString(data.title) ??
    DEFAULT_TITLE;
  const body =
    readString(input.body) ??
    readString(notification.body) ??
    readString(data.body) ??
    readString(data.message) ??
    DEFAULT_BODY;
  const icon =
    readString(input.icon) ?? readString(notification.icon) ?? DEFAULT_ICON;
  const badge =
    readString(input.badge) ?? readString(notification.badge) ?? DEFAULT_BADGE;
  const payloadData =
    Object.keys(data).length > 0 ? data : readRecord(input.data);

  return {
    title,
    body,
    icon,
    badge,
    data: payloadData,
  };
}

/** Apply the notification click behavior for the worker background path. */
export async function handleNotificationClickAction({
  action,
  clients,
  notificationData,
  openWindow,
}: NotificationClickActionContext): Promise<void> {
  if (action && action !== "open") {
    return;
  }

  await applyNotificationClick({ clients, notificationData, openWindow });
}

/** Apply the notification click behavior for the worker background path. */
export async function applyNotificationClick({
  clients,
  notificationData,
  openWindow,
}: NotificationClickContext): Promise<void> {
  const targetUrl = notificationData.url ?? DEFAULT_FALLBACK_URL;
  const routeFamily = notificationData.url
    ? getRouteFamily(notificationData.url)
    : null;
  const client = selectReusableClient(clients, routeFamily);

  if (client) {
    if (notificationData.url) {
      await client.navigate?.(targetUrl);
    }

    await client.focus?.();
    return;
  }

  await openWindow?.(targetUrl);
}

function selectReusableClient(
  clients: readonly NotificationClickClient[],
  routeFamily: "/admin" | "/employee" | null,
): NotificationClickClient | undefined {
  if (routeFamily) {
    return (
      clients.find(
        (client) =>
          client.visibilityState === "visible" &&
          getRouteFamily(client.url) === routeFamily,
      ) ?? clients.find((client) => getRouteFamily(client.url) === routeFamily)
    );
  }

  return (
    clients.find((client) => client.visibilityState === "visible") ?? clients[0]
  );
}

function getRouteFamily(url: string): "/admin" | "/employee" | null {
  try {
    const path = new URL(url, "https://example.com").pathname;

    if (path.startsWith("/admin")) {
      return "/admin";
    }

    if (path.startsWith("/employee")) {
      return "/employee";
    }
  } catch {
    if (url.startsWith("/admin")) {
      return "/admin";
    }

    if (url.startsWith("/employee")) {
      return "/employee";
    }
  }

  return null;
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
