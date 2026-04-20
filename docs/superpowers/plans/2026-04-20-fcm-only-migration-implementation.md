# FCM-Only Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghapus total jalur web-push legacy dan menstandardisasi notifikasi web ke FCM-only untuk browser registration dan Firebase Admin delivery.

**Architecture:** Implementasi dibagi menjadi empat unit: kontrak browser FCM-only, cleanup delivery/service legacy, cleanup worker+schema legacy, dan sinkronisasi deployment build-time vs runtime env. Browser registration dipusatkan ke `useFCM` dengan state eksplisit untuk UI onboarding, sedangkan backend delivery hanya menyisakan FCM Admin, Expo, dan websocket tanpa `PushSubscriptions`, route subscribe legacy, atau retry web-push.

**Tech Stack:** TypeScript, Next.js 16, React 19, Firebase Web Messaging, Firebase Admin SDK, Prisma, Vitest, Jenkins, Kubernetes.

---

## File Structure

- Modify: `hooks/useFCM.ts`
  - Jadikan kontrak FCM browser eksplisit: support state, permission state, registration state, dan action enable.
- Modify: `lib/firebase/config.ts`
  - Ekspos guard konfigurasi browser Firebase/FCM supaya UI bisa disabled tanpa fallback legacy.
- Modify: `components/notifications/PushNotificationManager.tsx`
  - Migrasi onboarding admin dari `/api/notifications/subscribe` ke `useFCM`.
- Modify: `components/karyawan/KaryawanPushNotification.tsx`
  - Migrasi onboarding karyawan dari `PushManager.subscribe` ke `useFCM`.
- Modify: `components/layout/Navbar.tsx`
  - Hapus auto-registration FCM global agar prompt izin tidak muncul diam-diam di luar onboarding.
- Create: `tests/contracts/fcm-browser-contract.test.ts`
  - Mengunci bahwa browser flow hanya memakai `useFCM` dan `/api/user/fcm-token`.
- Modify: `modules/notification/services/NotificationService.ts`
  - Hapus fan-out `push_subscriptions` dan fungsi subscribe/unsubscribe legacy.
- Modify: `modules/notification/services/PushRetryQueue.ts`
  - Hapus retry path web-push; sisakan expo-only retry.
- Modify: `modules/notification/index.ts`
  - Hapus export service legacy yang sudah dihapus.
- Modify: `lib/event-bus/queues.ts`
  - Hapus `web_push` dan payload `subscription` dari kontrak queue notification.
- Modify: `lib/event-bus/workers.ts`
  - Hapus worker branch `case "web_push"`.
- Delete: `modules/notification/services/PushNotificationService.ts`
  - Service web-push legacy dihapus total.
- Delete: `modules/notification/repositories/PushSubscriptionRepository.ts`
  - Repository `push_subscriptions` dihapus total.
- Delete: `app/api/notifications/subscribe/route.ts`
  - Route legacy GET/POST/DELETE dihapus total.
- Create: `tests/contracts/fcm-delivery-contract.test.ts`
  - Mengunci tidak ada lagi `web_push`, `PushNotificationService`, atau route subscribe legacy.
- Modify: `tests/modules/notification/NotificationService.test.ts`
  - Kunci bahwa createNotification tidak lagi query `pushSubscriptions`.
- Modify: `tests/modules/notification/PushRetryQueue.test.ts`
  - Kunci bahwa retry queue hanya mengandalkan branch expo.
- Modify: `worker/index.ts`
  - Hapus `PUSH_CONFIG` dan `pushsubscriptionchange`; sisakan runtime push/click/close handler.
- Delete: `worker/pushSubscriptionRecovery.ts`
  - Recovery helper legacy dihapus total.
- Modify: `tests/worker/admin-push-worker-contract.test.ts`
  - Kunci bahwa worker tidak lagi contain `pushsubscriptionchange`/`recoverPushSubscription`.
- Delete: `tests/worker/pushSubscriptionRecovery.test.ts`
  - Test helper recovery legacy dihapus.
- Delete: `tests/api/notifications-subscribe-route.test.ts`
  - Test route subscribe legacy dihapus.
- Delete: `tests/modules/notification/PushNotificationService.test.ts`
  - Test service web-push legacy dihapus.
- Modify: `prisma/schema.prisma`
  - Hapus model `PushSubscriptions` dan relasinya dari `User`/`Tenant`.
- Create: `prisma/migrations/20260420123000_drop_push_subscriptions/migration.sql`
  - Hapus data dan tabel `push_subscriptions`.
- Create: `tests/prisma/push-subscriptions-schema-contract.test.ts`
  - Kunci bahwa schema Prisma tidak lagi mendefinisikan `PushSubscriptions`.
- Modify: `Jenkinsfile`
  - Inject `NEXT_PUBLIC_FIREBASE_*` dan `NEXT_PUBLIC_VAPID_PUBLIC_KEY` ke `docker build` sebagai build args.
- Modify: `Dockerfile`
  - Tambah `ARG/ENV` untuk seluruh public Firebase config yang dibundle browser.
- Modify: `.env.production.example`
  - Ganti section web-push legacy dengan FCM browser config + Firebase Admin runtime config.
- Modify: `deploy.sh`
  - Hapus instruksi generate VAPID private key/subject legacy.
- Create: `tests/contracts/fcm-deployment-contract.test.ts`
  - Kunci build-time env injection dan runtime secret contract.

## Task 1: Migrasikan browser onboarding ke kontrak FCM-only

**Files:**
- Create: `tests/contracts/fcm-browser-contract.test.ts`
- Modify: `hooks/useFCM.ts`
- Modify: `lib/firebase/config.ts`
- Modify: `components/notifications/PushNotificationManager.tsx`
- Modify: `components/karyawan/KaryawanPushNotification.tsx`
- Modify: `components/layout/Navbar.tsx`

- [ ] **Step 1: Write the failing contract test**

Buat `tests/contracts/fcm-browser-contract.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(testDir, "..", "..");
const readSource = (relativePath: string) =>
  readFileSync(join(projectRoot, relativePath), "utf8");

describe("FCM browser contract", () => {
  it("routes admin and employee onboarding through useFCM without the legacy subscribe route", () => {
    const adminManager = readSource(
      "components/notifications/PushNotificationManager.tsx",
    );
    const employeeManager = readSource(
      "components/karyawan/KaryawanPushNotification.tsx",
    );

    expect(adminManager).toContain("@/hooks/useFCM");
    expect(employeeManager).toContain("@/hooks/useFCM");

    expect(adminManager).not.toContain("/api/notifications/subscribe");
    expect(employeeManager).not.toContain("/api/notifications/subscribe");

    expect(adminManager).not.toContain("pushManager.subscribe");
    expect(employeeManager).not.toContain("pushManager.subscribe");

    expect(adminManager).not.toContain("PUSH_CONFIG");
    expect(employeeManager).not.toContain("PUSH_CONFIG");
  });

  it("keeps FCM token registration in useFCM and removes navbar auto-registration", () => {
    const useFcm = readSource("hooks/useFCM.ts");
    const navbar = readSource("components/layout/Navbar.tsx");

    expect(useFcm).toContain("getToken(messaging");
    expect(useFcm).toContain('fetch("/api/user/fcm-token"');
    expect(useFcm).toContain("enableNotifications");

    expect(navbar).not.toContain("useFCM();");
  });

  it("exposes an explicit browser Firebase guard", () => {
    const firebaseConfig = readSource("lib/firebase/config.ts");

    expect(firebaseConfig).toContain("export const isFirebaseMessagingConfigured");
    expect(firebaseConfig).toContain("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- tests/contracts/fcm-browser-contract.test.ts
```

Expected:
- FAIL karena onboarding masih fetch `/api/notifications/subscribe`.
- FAIL karena `Navbar.tsx` masih memanggil `useFCM();`.
- FAIL karena `lib/firebase/config.ts` belum mengekspor guard konfigurasi eksplisit.

- [ ] **Step 3: Write the minimal implementation**

Update `lib/firebase/config.ts`:

```ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";
import type { Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseMessagingConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
);

const app = isFirebaseMessagingConfigured
  ? !getApps().length
    ? initializeApp(firebaseConfig)
    : getApp()
  : undefined;

let messaging: Messaging | undefined;

if (app && typeof window !== "undefined" && "Notification" in window) {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.error("Firebase Messaging Initialization Error:", error);
  }
}

export { app, messaging };
```

Replace `hooks/useFCM.ts` with an explicit contract:

```ts
import { useCallback, useEffect, useMemo, useState } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { toast } from "react-hot-toast";
import {
  isFirebaseMessagingConfigured,
  messaging,
} from "@/lib/firebase/config";
import { normalizeForegroundNotificationPayload } from "@/lib/notifications/normalizeForegroundNotificationPayload";

type FcmPermissionState = NotificationPermission | "unsupported";

async function persistFcmToken(token: string) {
  await fetch("/api/user/fcm-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fcmToken: token, action: "add" }),
  });
}

export function useFCM() {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<FcmPermissionState>(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported",
  );

  const isSupported = useMemo(
    () => Boolean(messaging && isFirebaseMessagingConfigured),
    [],
  );

  const syncExistingToken = useCallback(async () => {
    if (!messaging || !isFirebaseMessagingConfigured) {
      return false;
    }

    if (Notification.permission !== "granted") {
      return false;
    }

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    });

    if (!token) {
      return false;
    }

    setFcmToken(token);
    await persistFcmToken(token);
    return true;
  }, []);

  const enableNotifications = useCallback(async () => {
    if (!messaging || !isFirebaseMessagingConfigured) {
      setPermission("unsupported");
      return false;
    }

    setIsLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        return false;
      }

      return await syncExistingToken();
    } catch (error) {
      console.error("An error occurred while enabling FCM.", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [syncExistingToken]);

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    void syncExistingToken();

    const unsubscribe = onMessage(messaging, (payload) => {
      const message = normalizeForegroundNotificationPayload({
        notification: payload.notification,
        data: payload.data,
      });

      if (message) {
        toast.success(`${message.title}: ${message.body}`, { duration: 5000 });
      }
    });

    return () => unsubscribe();
  }, [isSupported, syncExistingToken]);

  return {
    fcmToken,
    permission,
    isSupported,
    isLoading,
    isRegistered: Boolean(fcmToken),
    enableNotifications,
  };
}
```

Update `components/notifications/PushNotificationManager.tsx`:

```tsx
"use client";

import { HiBell, HiBellSlash, HiXMark } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { useFCM } from "@/hooks/useFCM";

interface PushNotificationManagerProps {
  className?: string;
}

export function PushNotificationManager({
  className,
}: PushNotificationManagerProps) {
  const { permission, isSupported, isRegistered, isLoading, enableNotifications } =
    useFCM();

  if (!isSupported) {
    return null;
  }

  if (isRegistered) {
    return (
      <div
        className={`flex items-center gap-2 text-sm text-green-600 dark:text-green-400 ${className}`}
      >
        <HiBell className="h-4 w-4" />
        <span>Notifikasi aktif</span>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div
        className={`flex items-center gap-2 text-sm text-gray-500 ${className}`}
      >
        <HiBellSlash className="h-4 w-4" />
        <span>Notifikasi diblokir</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-900/20 ${className}`}
    >
      <div className="flex items-start gap-3">
        <HiBell className="h-6 w-6 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 dark:text-white">
            Aktifkan Notifikasi
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Dapatkan pemberitahuan langsung saat ada Work Order baru atau update penting.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Button onClick={() => void enableNotifications()} disabled={isLoading}>
              {isLoading ? "Mengaktifkan..." : "Aktifkan Notifikasi"}
            </Button>
            <Button>
              <HiXMark className="h-5 w-5 text-gray-500" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Update `components/karyawan/KaryawanPushNotification.tsx` dengan pola yang sama:

```tsx
"use client";

import { MdNotifications, MdNotificationsOff } from "react-icons/md";
import { Button } from "@/components/ui/Button";
import { useFCM } from "@/hooks/useFCM";

export function KaryawanPushNotification() {
  const { permission, isSupported, isRegistered, isLoading, enableNotifications } =
    useFCM();

  if (!isSupported) {
    return null;
  }

  if (isRegistered) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-100 px-3 py-2 text-green-700 dark:bg-green-900/30 dark:text-green-300">
        <MdNotifications className="text-lg" />
        <span className="text-sm font-medium">Notifikasi aktif</span>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-gray-500 dark:bg-gray-800">
        <MdNotificationsOff className="text-lg" />
        <span className="text-sm">Notifikasi diblokir</span>
      </div>
    );
  }

  return (
    <Button onClick={() => void enableNotifications()} disabled={isLoading}>
      <MdNotifications className="text-lg" />
      <span className="text-sm font-medium">
        {isLoading ? "Mengaktifkan..." : "Aktifkan Notifikasi"}
      </span>
    </Button>
  );
}
```

Update `components/layout/Navbar.tsx` dengan menghapus import dan invocation berikut:

```tsx
-import { useFCM } from "@/hooks/useFCM";
...
-  useFCM();
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:run -- tests/contracts/fcm-browser-contract.test.ts tests/api/admin-notification-contract.test.ts
```

Expected:
- PASS.
- `PushNotificationManager.tsx` dan `KaryawanPushNotification.tsx` tidak lagi menyentuh `/api/notifications/subscribe`.
- `Navbar.tsx` tidak lagi memicu permission prompt secara global.

- [ ] **Step 5: Commit**

```bash
git add tests/contracts/fcm-browser-contract.test.ts hooks/useFCM.ts lib/firebase/config.ts components/notifications/PushNotificationManager.tsx components/karyawan/KaryawanPushNotification.tsx components/layout/Navbar.tsx tests/api/admin-notification-contract.test.ts
git commit -m "feat: migrate browser notification onboarding to fcm only"
```

## Task 2: Hapus delivery dan queue legacy web-push dari backend

**Files:**
- Create: `tests/contracts/fcm-delivery-contract.test.ts`
- Modify: `tests/modules/notification/NotificationService.test.ts`
- Modify: `tests/modules/notification/PushRetryQueue.test.ts`
- Modify: `modules/notification/services/NotificationService.ts`
- Modify: `modules/notification/services/PushRetryQueue.ts`
- Modify: `modules/notification/index.ts`
- Modify: `lib/event-bus/queues.ts`
- Modify: `lib/event-bus/workers.ts`
- Delete: `modules/notification/services/PushNotificationService.ts`
- Delete: `modules/notification/repositories/PushSubscriptionRepository.ts`
- Delete: `app/api/notifications/subscribe/route.ts`

- [ ] **Step 1: Write the failing tests**

Buat `tests/contracts/fcm-delivery-contract.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(testDir, "..", "..");
const readSource = (relativePath: string) =>
  readFileSync(join(projectRoot, relativePath), "utf8");

describe("FCM delivery contract", () => {
  it("removes web-push route, service, and repository files", () => {
    expect(
      existsSync(join(projectRoot, "app/api/notifications/subscribe/route.ts")),
    ).toBe(false);
    expect(
      existsSync(
        join(
          projectRoot,
          "modules/notification/services/PushNotificationService.ts",
        ),
      ),
    ).toBe(false);
    expect(
      existsSync(
        join(
          projectRoot,
          "modules/notification/repositories/PushSubscriptionRepository.ts",
        ),
      ),
    ).toBe(false);
  });

  it("removes web_push contracts from queue and worker layers", () => {
    const queues = readSource("lib/event-bus/queues.ts");
    const workers = readSource("lib/event-bus/workers.ts");

    expect(queues).not.toContain('"web_push"');
    expect(queues).not.toContain("subscription?: {");
    expect(workers).not.toContain('case "web_push"');
    expect(workers).not.toContain("PushNotificationService");
  });
});
```

Update `tests/modules/notification/NotificationService.test.ts`:

```ts
it("does not query legacy push subscriptions for direct notifications", async () => {
  prismaMock.notifications.create.mockResolvedValueOnce({
    id: "notif-fcm-only-1",
    type: "SYSTEM",
    priority: "NORMAL",
    title: "Firebase Title",
    message: "Firebase Body",
    link: "/admin/notifications",
    sourceType: "SYSTEM",
    sourceId: "src-fcm-only-1",
    createdAt: new Date("2026-03-08T12:20:00.000Z"),
  } as Notifications);
  prismaMock.user.findUnique.mockResolvedValueOnce({
    id: "user-fcm-1",
    fcmTokens: ["fcm-token-1", "fcm-token-2"],
  });

  await createNotification({
    type: "SYSTEM",
    title: "Firebase Title",
    message: "Firebase Body",
    userId: "user-fcm-1",
    link: "/admin/notifications",
    sourceType: "SYSTEM",
    sourceId: "src-fcm-only-1",
    skipExpoPush: true,
  });

  expect(prismaMock.pushSubscriptions.findMany).not.toHaveBeenCalled();
  expect(sendFCMNotification).toHaveBeenCalledWith(
    ["fcm-token-1", "fcm-token-2"],
    "Firebase Title",
    "Firebase Body",
    expect.objectContaining({ notificationId: "notif-fcm-only-1" }),
  );
});
```

Update `tests/modules/notification/PushRetryQueue.test.ts`:

```ts
it("drops malformed non-expo retry items instead of attempting web-push fallback", async () => {
  redisQueueMock.llen.mockResolvedValueOnce(1);
  redisQueueMock.rpoplpush.mockResolvedValueOnce(
    JSON.stringify({
      id: "retry-1",
      type: "web",
      userId: "user-1",
      title: "Legacy",
      body: "Legacy body",
      retryCount: 0,
      createdAt: Date.now(),
    }),
  );

  const { processRetryQueue } =
    await import("@/modules/notification/services/PushRetryQueue");

  await expect(processRetryQueue()).resolves.toEqual({
    processed: 1,
    succeeded: 0,
    dropped: 1,
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm run test:run -- tests/contracts/fcm-delivery-contract.test.ts tests/modules/notification/NotificationService.test.ts tests/modules/notification/PushRetryQueue.test.ts
```

Expected:
- FAIL karena file route/service/repository legacy masih ada.
- FAIL karena `NotificationService.ts` masih query `pushSubscriptions`.
- FAIL karena queue/worker masih punya kontrak `web_push`.

- [ ] **Step 3: Write the minimal implementation**

Update `modules/notification/services/NotificationService.ts` dengan menghapus seluruh branch browser push legacy:

```ts
import {
  sendPushNotification as sendExpoPush,
  sendPushToDepartment as sendExpoPushToDepartment,
} from "./ExpoPushService";
import { NotificationRepository } from "../repositories/NotificationRepository";
import { UserRepository } from "@/modules/users";
import { Prisma } from "@prisma/client";
import { socketEmitter } from "@/lib/websocket/emitter";
import { getAdminTokens, sendFCMNotification } from "@/lib/firebase/messaging";
...
const notificationRepo = new NotificationRepository();
const userRepo = new UserRepository();
...
export async function createNotification(data: CreateNotificationData) {
  const notification = await notificationRepo.createFull({
    id: crypto.randomUUID(),
    type: data.type,
    priority: data.priority || "NORMAL",
    title: data.title,
    message: data.message,
    link: data.link || null,
    userId: data.userId || null,
    departmentId: data.departmentId || null,
    siteId: data.siteId || null,
    sourceType: data.sourceType || null,
    sourceId: data.sourceId || null,
    tenantId: data.tenantId || null,
  });

  const wsPayload = {
    id: notification.id,
    type: notification.type,
    priority: notification.priority,
    title: notification.title,
    message: notification.message,
    link: notification.link || undefined,
    createdAt: notification.createdAt.toISOString(),
  };

  if (data.userId) {
    socketEmitter.notifyUser(data.userId, wsPayload);

    const directRecipient = await userRepo.findByIdWithPushToken(data.userId);
    if (directRecipient?.fcmTokens?.length) {
      sendFCMNotification(directRecipient.fcmTokens, data.title, data.message, {
        notificationId: notification.id,
        url: data.link || "/employee/notifications",
        sourceType: data.sourceType || "",
        sourceId: data.sourceId || "",
      }).catch((err) => console.error("[FCM Push] Error:", err));
    }

    if (!data.skipExpoPush) {
      sendExpoPush(data.userId, data.title, data.message, {
        link: data.link || undefined,
        sourceType: data.sourceType || undefined,
        sourceId: data.sourceId || undefined,
      }).catch((err) => console.error("[Expo Push] Error:", err));
    }
  }

  if (data.departmentId) {
    socketEmitter.notifyDepartment(data.departmentId, wsPayload);

    const departmentRecipients =
      await userRepo.findManyActiveWithPushTokenAndSite(
        data.departmentId,
        data.siteId,
      );
    const departmentFcmTokens = departmentRecipients.flatMap(
      (recipient) => recipient.fcmTokens ?? [],
    );

    if (departmentFcmTokens.length > 0) {
      sendFCMNotification(departmentFcmTokens, data.title, data.message, {
        notificationId: notification.id,
        url: data.link || "/employee/notifications",
        sourceType: data.sourceType || "",
        sourceId: data.sourceId || "",
      }).catch((err) => console.error("[FCM Push Dept] Error:", err));
    }

    if (!data.skipExpoPush) {
      sendExpoPushToDepartment(data.departmentId, data.title, data.message, {
        link: data.link || undefined,
        sourceType: data.sourceType || undefined,
        sourceId: data.sourceId || undefined,
      }).catch((err) => console.error("[Expo Push Dept] Error:", err));
    }
  }

  if (
    data.priority === "HIGH" ||
    data.priority === "URGENT" ||
    data.type === "ALERT"
  ) {
    socketEmitter.notifyAdmins(wsPayload, data.siteId);

    const adminTokens = await getAdminTokens();
    if (adminTokens.length > 0) {
      sendFCMNotification(adminTokens, data.title, data.message, {
        notificationId: notification.id,
        url: data.link || "/employee/notifications",
        sourceType: data.sourceType || "",
        sourceId: data.sourceId || "",
      }).catch((err) => console.error("[FCM Push Admin] Error:", err));
    }
  }

  return notification;
}
```

Update `modules/notification/services/PushRetryQueue.ts` ke expo-only:

```ts
interface PushRetryItem {
  id: string;
  type: "expo";
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  retryCount: number;
  createdAt: number;
  lastAttemptAt?: number;
  pushToken?: string;
}
...
      try {
        if (item.type === "expo" && item.pushToken) {
          success = await retryExpoPush(item);
        } else {
          stats.dropped++;
          await redis.lrem(RETRY_PROCESSING_KEY, 1, raw);
          continue;
        }
      } catch (error) {
        console.error(
          `[PushRetry] Retry attempt ${item.retryCount} failed for ${item.userId}:`,
          error,
        );
      }
...
```

Update `lib/event-bus/queues.ts`:

```ts
export interface NotificationJobData {
  type: "expo_push" | "websocket";
  userId?: string;
  departmentId?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  pushToken?: string;
  room?: string;
  event?: string;
}
```

Update `lib/event-bus/workers.ts` dengan menghapus branch berikut sepenuhnya:

```ts
-    case "web_push": {
-      if (!data.subscription) break;
-      try {
-        const { sendPushNotification } =
-          await import("@/modules/notification/services/PushNotificationService");
-        await sendPushNotification(
-          {
-            endpoint: data.subscription.endpoint,
-            keys: {
-              p256dh: data.subscription.p256dh,
-              auth: data.subscription.auth,
-            },
-          },
-          { title: data.title, body: data.body, data: data.data },
-        );
-      } catch (error) {
-        console.error("[Worker] Web push failed:", error);
-        throw error;
-      }
-      break;
-    }
```

Update `modules/notification/index.ts`:

```ts
export * from "./services/NotificationService";
export * from "./services/ExpoPushService";
export * from "./services/PushRetryQueue";
```

Delete legacy files:

```bash
rm app/api/notifications/subscribe/route.ts
rm modules/notification/services/PushNotificationService.ts
rm modules/notification/repositories/PushSubscriptionRepository.ts
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm run test:run -- tests/contracts/fcm-delivery-contract.test.ts tests/modules/notification/NotificationService.test.ts tests/modules/notification/PushRetryQueue.test.ts
```

Expected:
- PASS.
- `createNotification` tidak lagi query `pushSubscriptions`.
- Queue/worker contract tidak lagi mengenal `web_push`.

- [ ] **Step 5: Commit**

```bash
git add tests/contracts/fcm-delivery-contract.test.ts tests/modules/notification/NotificationService.test.ts tests/modules/notification/PushRetryQueue.test.ts modules/notification/services/NotificationService.ts modules/notification/services/PushRetryQueue.ts modules/notification/index.ts lib/event-bus/queues.ts lib/event-bus/workers.ts
git rm app/api/notifications/subscribe/route.ts modules/notification/services/PushNotificationService.ts modules/notification/repositories/PushSubscriptionRepository.ts
git commit -m "refactor: remove legacy web push delivery path"
```

## Task 3: Hapus worker recovery legacy dan cleanup schema `push_subscriptions`

**Files:**
- Modify: `tests/worker/admin-push-worker-contract.test.ts`
- Create: `tests/prisma/push-subscriptions-schema-contract.test.ts`
- Modify: `worker/index.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260420123000_drop_push_subscriptions/migration.sql`
- Delete: `worker/pushSubscriptionRecovery.ts`
- Delete: `tests/worker/pushSubscriptionRecovery.test.ts`
- Delete: `tests/api/notifications-subscribe-route.test.ts`
- Delete: `tests/modules/notification/PushNotificationService.test.ts`

- [ ] **Step 1: Write the failing tests**

Update `tests/worker/admin-push-worker-contract.test.ts`:

```ts
it("removes push subscription recovery wiring from the worker", () => {
  const workerSource = readWorkerSource();

  expect(workerSource).not.toContain(
    'self.addEventListener("pushsubscriptionchange"',
  );
  expect(workerSource).not.toContain("recoverPushSubscription");
  expect(workerSource).not.toContain("PUSH_CONFIG");
});
```

Buat `tests/prisma/push-subscriptions-schema-contract.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(testDir, "..", "..");
const schema = readFileSync(join(projectRoot, "prisma/schema.prisma"), "utf8");

describe("push subscriptions schema contract", () => {
  it("does not define the PushSubscriptions model anymore", () => {
    expect(schema).not.toContain("model PushSubscriptions {");
    expect(schema).not.toContain("@@map(\"push_subscriptions\")");
  });

  it("removes push subscription relations from User and Tenant", () => {
    expect(schema).not.toContain("push_subscriptions                         PushSubscriptions[]");
    expect(schema).not.toContain("pushSubscriptions       PushSubscriptions[]");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm run test:run -- tests/worker/admin-push-worker-contract.test.ts tests/prisma/push-subscriptions-schema-contract.test.ts
```

Expected:
- FAIL karena worker masih punya `pushsubscriptionchange` dan `recoverPushSubscription`.
- FAIL karena `schema.prisma` masih punya model `PushSubscriptions` dan relasi turunannya.

- [ ] **Step 3: Write the minimal implementation**

Update `worker/index.ts` agar hanya menyisakan handler runtime push/click/close:

```ts
/// <reference lib="webworker" />

import {
  handleNotificationClickAction,
  resolvePushNotificationPayloadFromEventData,
} from "./pushNotificationRuntime";

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("push", (event: PushEvent) => {
  const notificationData = resolvePushNotificationPayloadFromEventData(
    event.data,
  );

  const options: NotificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    data: notificationData.data,
    tag: (notificationData.data as { tag?: string }).tag || "default",
    requireInteraction:
      (notificationData.data as { requireInteraction?: boolean })
        .requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  const data = event.notification.data as { url?: string };

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) =>
        handleNotificationClickAction({
          action: event.action,
          clients: clientList,
          notificationData: { url: data?.url },
          openWindow: self.clients.openWindow?.bind(self.clients),
        }),
      ),
  );
});

self.addEventListener("notificationclose", (event: NotificationEvent) => {
  console.log("[SW] Notification closed:", event.notification.tag);
});

export {};
```

Update `prisma/schema.prisma` dengan menghapus relasi berikut:

```prisma
-  push_subscriptions                         PushSubscriptions[]
```

```prisma
-  pushSubscriptions       PushSubscriptions[]
```

Hapus model berikut sepenuhnya:

```prisma
model PushSubscriptions {
  id         String    @id
  userId     String
  endpoint   String    @unique
  p256dh     String
  auth       String
  userAgent  String?
  isActive   Boolean   @default(true)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime
  lastUsedAt DateTime?
  tenantId   String?
  tenant     Tenant?   @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([isActive])
  @@index([userId])
  @@index([tenantId])
  @@map("push_subscriptions")
}
```

Buat `prisma/migrations/20260420123000_drop_push_subscriptions/migration.sql`:

```sql
DELETE FROM "push_subscriptions";
DROP TABLE "push_subscriptions";
```

Delete legacy runtime/test files:

```bash
rm worker/pushSubscriptionRecovery.ts
rm tests/worker/pushSubscriptionRecovery.test.ts
rm tests/api/notifications-subscribe-route.test.ts
rm tests/modules/notification/PushNotificationService.test.ts
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
npm run prisma:generate
npm run test:run -- tests/worker/admin-push-worker-contract.test.ts tests/prisma/push-subscriptions-schema-contract.test.ts
```

Expected:
- Prisma client regenerate tanpa error model `PushSubscriptions`.
- PASS.
- Worker tidak lagi punya recovery legacy.

- [ ] **Step 5: Commit**

```bash
git add tests/worker/admin-push-worker-contract.test.ts tests/prisma/push-subscriptions-schema-contract.test.ts worker/index.ts prisma/schema.prisma prisma/migrations/20260420123000_drop_push_subscriptions/migration.sql
git rm worker/pushSubscriptionRecovery.ts tests/worker/pushSubscriptionRecovery.test.ts tests/api/notifications-subscribe-route.test.ts tests/modules/notification/PushNotificationService.test.ts
git commit -m "refactor: drop legacy push subscription schema and worker recovery"
```

## Task 4: Selaraskan build-time Jenkins/Docker dan runtime secret FCM-only

**Files:**
- Create: `tests/contracts/fcm-deployment-contract.test.ts`
- Modify: `Jenkinsfile`
- Modify: `Dockerfile`
- Modify: `.env.production.example`
- Modify: `deploy.sh`

- [ ] **Step 1: Write the failing contract test**

Buat `tests/contracts/fcm-deployment-contract.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(testDir, "..", "..");
const readSource = (relativePath: string) =>
  readFileSync(join(projectRoot, relativePath), "utf8");

describe("FCM deployment contract", () => {
  it("passes public Firebase envs as Docker build args in Jenkins", () => {
    const jenkinsfile = readSource("Jenkinsfile");

    expect(jenkinsfile).toContain("--build-arg NEXT_PUBLIC_FIREBASE_API_KEY");
    expect(jenkinsfile).toContain("--build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
    expect(jenkinsfile).toContain("--build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    expect(jenkinsfile).toContain("--build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
    expect(jenkinsfile).toContain("--build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
    expect(jenkinsfile).toContain("--build-arg NEXT_PUBLIC_FIREBASE_APP_ID");
    expect(jenkinsfile).toContain("--build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  });

  it("defines browser Firebase build args in the Dockerfile", () => {
    const dockerfile = readSource("Dockerfile");

    expect(dockerfile).toContain("ARG NEXT_PUBLIC_FIREBASE_API_KEY");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_FIREBASE_APP_ID");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  });

  it("removes legacy VAPID private runtime guidance and keeps runtime Firebase Admin secrets only", () => {
    const envExample = readSource(".env.production.example");
    const deployScript = readSource("deploy.sh");
    const stagingSecrets = readSource("k8s/staging/secrets.yaml");
    const productionSecrets = readSource("k8s/production/secrets.yaml");

    expect(envExample).toContain("NEXT_PUBLIC_FIREBASE_API_KEY=");
    expect(envExample).toContain("NEXT_PUBLIC_VAPID_PUBLIC_KEY=");
    expect(envExample).not.toContain("VAPID_PRIVATE_KEY=");
    expect(envExample).not.toContain("VAPID_SUBJECT=");

    expect(deployScript).not.toContain("web-push generate-vapid-keys");
    expect(deployScript).not.toContain("VAPID_PRIVATE_KEY");
    expect(deployScript).not.toContain("VAPID_SUBJECT");

    expect(stagingSecrets).toContain("FIREBASE_PROJECT_ID");
    expect(stagingSecrets).not.toContain("VAPID_PRIVATE_KEY");
    expect(stagingSecrets).not.toContain("VAPID_SUBJECT");
    expect(productionSecrets).toContain("FIREBASE_PROJECT_ID");
    expect(productionSecrets).not.toContain("VAPID_PRIVATE_KEY");
    expect(productionSecrets).not.toContain("VAPID_SUBJECT");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- tests/contracts/fcm-deployment-contract.test.ts
```

Expected:
- FAIL karena `Jenkinsfile` belum inject build args public Firebase.
- FAIL karena `Dockerfile` belum mendefinisikan ARG public Firebase.
- FAIL karena `.env.production.example` dan `deploy.sh` masih memuat guidance VAPID legacy.

- [ ] **Step 3: Write the minimal implementation**

Update `Jenkinsfile` build stage:

```groovy
                        docker build -t ${env.APP_IMAGE_REF} -t ${env.APP_IMAGE_ENV_REF} \
                            --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="${env.NEXT_PUBLIC_FIREBASE_API_KEY}" \
                            --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}" \
                            --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}" \
                            --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}" \
                            --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}" \
                            --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="${env.NEXT_PUBLIC_FIREBASE_APP_ID}" \
                            --build-arg NEXT_PUBLIC_VAPID_PUBLIC_KEY="${env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}" \
                            --secret id=NEXTAUTH_SECRET,src=.secrets/nextauth_secret.txt \
                            --secret id=AUTH_SECRET,src=.secrets/auth_secret.txt \
                            --secret id=OAUTH_ENCRYPTION_KEY,src=.secrets/oauth_key.txt \
                            .
```

Update `Dockerfile` build args:

```dockerfile
ARG NEXT_PUBLIC_FIREBASE_API_KEY=""
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=""
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID=""
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=""
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=""
ARG NEXT_PUBLIC_FIREBASE_APP_ID=""
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""

ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
```

Update `.env.production.example` section notifikasi:

```dotenv
# ------------------------------------------------------------------------------
# FIREBASE WEB MESSAGING (Build-time browser config)
# ------------------------------------------------------------------------------
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=

# ------------------------------------------------------------------------------
# FIREBASE ADMIN (Runtime server config)
# ------------------------------------------------------------------------------
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_DATABASE_URL=
```

Update `deploy.sh` dengan mengganti blok VAPID legacy menjadi checklist FCM browser/runtime:

```bash
    echo "============================================"
    log_info "Untuk Firebase Web Messaging, isi .env dengan config berikut:"
    echo ""
    echo "  NEXT_PUBLIC_FIREBASE_API_KEY=..."
    echo "  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=..."
    echo "  NEXT_PUBLIC_FIREBASE_PROJECT_ID=..."
    echo "  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=..."
    echo "  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=..."
    echo "  NEXT_PUBLIC_FIREBASE_APP_ID=..."
    echo "  NEXT_PUBLIC_VAPID_PUBLIC_KEY=..."
    echo ""
    log_info "Untuk Firebase Admin runtime, isi secret berikut di environment deployment:"
    echo "  FIREBASE_PROJECT_ID=..."
    echo "  FIREBASE_CLIENT_EMAIL=..."
    echo "  FIREBASE_PRIVATE_KEY=..."
    echo "  FIREBASE_DATABASE_URL=..."
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:run -- tests/contracts/fcm-deployment-contract.test.ts
```

Expected:
- PASS.
- Jenkins build sudah punya build args browser Firebase.
- Docker build sudah mengenal seluruh ARG public Firebase.
- Tidak ada lagi guidance `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`.

- [ ] **Step 5: Commit**

```bash
git add tests/contracts/fcm-deployment-contract.test.ts Jenkinsfile Dockerfile .env.production.example deploy.sh
git commit -m "build: inject firebase web config at image build time"
```

## Task 5: Jalankan verifikasi akhir dan cleanup referensi legacy

**Files:**
- Modify: `tests/contracts/fcm-browser-contract.test.ts`
- Modify: `tests/contracts/fcm-delivery-contract.test.ts`
- Modify: `tests/contracts/fcm-deployment-contract.test.ts`
- Modify: `tests/worker/admin-push-worker-contract.test.ts`
- Modify: `tests/prisma/push-subscriptions-schema-contract.test.ts`

- [ ] **Step 1: Run the focused regression suite**

Run:
```bash
npm run test:run -- tests/contracts/fcm-browser-contract.test.ts tests/contracts/fcm-delivery-contract.test.ts tests/contracts/fcm-deployment-contract.test.ts tests/api/admin-notification-contract.test.ts tests/modules/notification/NotificationService.test.ts tests/modules/notification/PushRetryQueue.test.ts tests/worker/admin-push-worker-contract.test.ts tests/prisma/push-subscriptions-schema-contract.test.ts
```

Expected:
- Semua test PASS.
- Tidak ada kontrak yang masih menyebut route `/api/notifications/subscribe`, `PushNotificationService`, `pushsubscriptionchange`, atau `PushSubscriptions`.

- [ ] **Step 2: Run targeted source verification**

Run:
```bash
grep -R "/api/notifications/subscribe\|PushSubscriptions\|pushsubscriptionchange\|recoverPushSubscription\|PushNotificationService\|PushSubscriptionRepository\|VAPID_PRIVATE_KEY\|VAPID_SUBJECT" app components hooks lib modules prisma tests worker k8s Jenkinsfile Dockerfile .env.production.example deploy.sh -n
```

Expected:
- Tidak ada hasil untuk route/service/repository/worker/schema legacy.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` masih boleh muncul pada `hooks/useFCM.ts`, `lib/firebase/config.ts`, `Jenkinsfile`, `Dockerfile`, dan `.env.production.example`.

- [ ] **Step 3: Run build-level verification**

Run:
```bash
npm run typecheck && npm run test:run -- tests/contracts/fcm-browser-contract.test.ts tests/contracts/fcm-delivery-contract.test.ts tests/contracts/fcm-deployment-contract.test.ts tests/worker/admin-push-worker-contract.test.ts tests/prisma/push-subscriptions-schema-contract.test.ts
```

Expected:
- PASS.
- Tidak ada import rusak setelah file legacy dihapus.

- [ ] **Step 4: Review final diff**

Run:
```bash
git diff -- hooks/useFCM.ts lib/firebase/config.ts components/notifications/PushNotificationManager.tsx components/karyawan/KaryawanPushNotification.tsx components/layout/Navbar.tsx modules/notification/services/NotificationService.ts modules/notification/services/PushRetryQueue.ts modules/notification/index.ts lib/event-bus/queues.ts lib/event-bus/workers.ts worker/index.ts prisma/schema.prisma prisma/migrations/20260420123000_drop_push_subscriptions/migration.sql Jenkinsfile Dockerfile .env.production.example deploy.sh tests/contracts/fcm-browser-contract.test.ts tests/contracts/fcm-delivery-contract.test.ts tests/contracts/fcm-deployment-contract.test.ts tests/api/admin-notification-contract.test.ts tests/modules/notification/NotificationService.test.ts tests/modules/notification/PushRetryQueue.test.ts tests/worker/admin-push-worker-contract.test.ts tests/prisma/push-subscriptions-schema-contract.test.ts
```

Expected:
- Diff hanya berisi migrasi FCM-only, cleanup legacy web-push, dan sinkronisasi env build/runtime.

- [ ] **Step 5: Commit**

```bash
git add hooks/useFCM.ts lib/firebase/config.ts components/notifications/PushNotificationManager.tsx components/karyawan/KaryawanPushNotification.tsx components/layout/Navbar.tsx modules/notification/services/NotificationService.ts modules/notification/services/PushRetryQueue.ts modules/notification/index.ts lib/event-bus/queues.ts lib/event-bus/workers.ts worker/index.ts prisma/schema.prisma prisma/migrations/20260420123000_drop_push_subscriptions/migration.sql Jenkinsfile Dockerfile .env.production.example deploy.sh tests/contracts/fcm-browser-contract.test.ts tests/contracts/fcm-delivery-contract.test.ts tests/contracts/fcm-deployment-contract.test.ts tests/api/admin-notification-contract.test.ts tests/modules/notification/NotificationService.test.ts tests/modules/notification/PushRetryQueue.test.ts tests/worker/admin-push-worker-contract.test.ts tests/prisma/push-subscriptions-schema-contract.test.ts
git commit -m "refactor: complete fcm only notification migration"
```

## Self-Review

- Spec coverage:
  - Browser registration FCM-only tercakup di Task 1.
  - Hapus route/service/repository legacy tercakup di Task 2.
  - Hapus worker recovery dan schema `push_subscriptions` tercakup di Task 3.
  - Build-time vs runtime env Jenkins/Docker/deploy tercakup di Task 4.
  - Verifikasi statis + regression suite tercakup di Task 5.
- Placeholder scan:
  - Tidak ada `TODO`, `TBD`, atau langkah “sesuaikan seperlunya”.
  - File delete, file modify, command, dan contract test disebut eksplisit.
- Type consistency:
  - Browser path konsisten memakai `useFCM`, `/api/user/fcm-token`, `sendFCMNotification`, dan `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
  - Delivery queue konsisten menyisakan `expo_push` dan `websocket` saja.
  - Runtime deployment konsisten menyisakan Firebase Admin env; VAPID private/subjek dihapus.
