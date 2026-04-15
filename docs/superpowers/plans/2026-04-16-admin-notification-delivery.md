# Admin Notification Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memulihkan notifikasi admin web agar notifikasi admin umum kembali muncul di foreground dan background tanpa memindahkan registrasi notif ke bell individual.

**Architecture:** Perbaikan dibagi menjadi dua boundary yang memang bertanggung jawab atas delivery. Boundary pertama adalah shell admin untuk browser-push onboarding agar background path benar-benar aktif. Boundary kedua adalah foreground FCM parser agar payload admin yang datang sebagai `notification` maupun `data` sama-sama dipresentasikan di web admin. Kontrak existing untuk `useFCM()` di navbar, scope `WORK_ORDER`, dan namespace realtime admin tetap dipertahankan.

**Tech Stack:** Next.js App Router, React 19, Firebase Messaging (web FCM), Service Worker web push, Vitest

---

## File map

### Files to create
- `lib/notifications/normalizeForegroundNotificationPayload.ts`
  - Helper pure untuk menormalkan payload foreground FCM menjadi `{ title, body }` atau `null`.
- `tests/lib/notifications/normalizeForegroundNotificationPayload.test.ts`
  - Unit test untuk payload `notification`, payload `data`, dan payload tidak lengkap.
- `tests/worker/admin-push-worker-contract.test.ts`
  - Regression-only contract test yang mengunci event `push`, `notificationclick`, dan `pushsubscriptionchange` di service worker.

### Files to modify
- `app/admin/layout.tsx:1-52`
  - Mount `PushNotificationManager` di shell admin, bukan di bell individual.
- `hooks/useFCM.ts:1-53`
  - Delegasikan parsing payload foreground ke helper baru.
- `tests/api/admin-notification-contract.test.ts:12-89`
  - Tambah contract test untuk admin shell push onboarding dan penggunaan helper foreground FCM.

### Existing tests to reuse
- `tests/api/admin-notification-contract.test.ts`
- `tests/worker/pushSubscriptionRecovery.test.ts`

## Task 1: Surface browser-push onboarding in the admin shell

**Files:**
- Modify: `app/admin/layout.tsx:1-52`
- Modify: `tests/api/admin-notification-contract.test.ts:12-89`
- Reference: `components/notifications/PushNotificationManager.tsx:24-197`

- [ ] **Step 1: Write the failing contract test**

Add this test to `tests/api/admin-notification-contract.test.ts` after the existing navbar contract assertions:

```ts
  it("mounts browser push onboarding in the admin shell", () => {
    const adminLayout = readSource("app/admin/layout.tsx");

    expect(adminLayout).toContain(
      "@/components/notifications/PushNotificationManager",
    );
    expect(adminLayout).toContain("<PushNotificationManager");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/api/admin-notification-contract.test.ts`

Expected: FAIL with an assertion showing `app/admin/layout.tsx` does not contain `@/components/notifications/PushNotificationManager` or `<PushNotificationManager`.

- [ ] **Step 3: Write minimal implementation**

Update `app/admin/layout.tsx` so the admin shell mounts the existing onboarding banner once, above the navbar.

```tsx
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import RealtimeProviderWrapper from "@/components/providers/RealtimeProviderWrapper";
import { ToastProvider } from "@/components/ui/Toast";
import ErrorBoundary from "@/components/common/ErrorBoundary";
import AnnouncementBanner from "@/components/announcement/AnnouncementBanner";
import ForceLogoutListener from "@/components/auth/ForceLogoutListener";
import { PushNotificationManager } from "@/components/notifications/PushNotificationManager";

import { ensureAdminAccess } from "@/lib/server-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await ensureAdminAccess();

  return (
    <RealtimeProviderWrapper>
      <ToastProvider>
        <ForceLogoutListener />
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <AnnouncementBanner portal="admin" />
            <div className="px-6 pt-4">
              <PushNotificationManager />
            </div>
            <Navbar />
            <main className="flex-1 overflow-y-auto">
              <div className="p-6">
                <ErrorBoundary>{children}</ErrorBoundary>
              </div>
            </main>
            <Footer />
          </div>
        </div>
      </ToastProvider>
    </RealtimeProviderWrapper>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/api/admin-notification-contract.test.ts`

Expected: PASS. The new contract and all existing admin notification contracts stay green.

- [ ] **Step 5: Commit**

```bash
git add tests/api/admin-notification-contract.test.ts app/admin/layout.tsx
git commit -m "fix: mount admin push onboarding shell"
```

## Task 2: Normalize foreground FCM payloads for admin notifications

**Files:**
- Create: `lib/notifications/normalizeForegroundNotificationPayload.ts`
- Create: `tests/lib/notifications/normalizeForegroundNotificationPayload.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/notifications/normalizeForegroundNotificationPayload.test.ts` with this content:

```ts
import { describe, expect, it } from "vitest";
import { normalizeForegroundNotificationPayload } from "@/lib/notifications/normalizeForegroundNotificationPayload";

describe("normalizeForegroundNotificationPayload", () => {
  it("prefers notification copy when notification fields are present", () => {
    expect(
      normalizeForegroundNotificationPayload({
        notification: {
          title: "Admin Alert",
          body: "Ticket baru masuk",
        },
        data: {
          title: "Ignored Title",
          body: "Ignored Body",
        },
      }),
    ).toEqual({
      title: "Admin Alert",
      body: "Ticket baru masuk",
    });
  });

  it("falls back to data-only payloads for admin foreground delivery", () => {
    expect(
      normalizeForegroundNotificationPayload({
        data: {
          title: "Work Order Baru",
          body: "WO-2026-001 menunggu tindak lanjut",
        },
      }),
    ).toEqual({
      title: "Work Order Baru",
      body: "WO-2026-001 menunggu tindak lanjut",
    });
  });

  it("returns null when title or body is missing", () => {
    expect(
      normalizeForegroundNotificationPayload({
        data: {
          title: "Title without body",
        },
      }),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/lib/notifications/normalizeForegroundNotificationPayload.test.ts`

Expected: FAIL with `Cannot find module '@/lib/notifications/normalizeForegroundNotificationPayload'`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/notifications/normalizeForegroundNotificationPayload.ts` with this content:

```ts
type ForegroundPayloadSource = {
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
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Returns a user-visible foreground title/body pair for web FCM payloads. */
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
  const dataBody = normalizeCopy(payload.data?.body);

  if (dataTitle && dataBody) {
    return {
      title: dataTitle,
      body: dataBody,
    };
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/lib/notifications/normalizeForegroundNotificationPayload.test.ts`

Expected: PASS with 3 passing assertions.

- [ ] **Step 5: Commit**

```bash
git add lib/notifications/normalizeForegroundNotificationPayload.ts tests/lib/notifications/normalizeForegroundNotificationPayload.test.ts
git commit -m "fix: normalize admin foreground fcm payloads"
```

## Task 3: Wire the foreground helper into the navbar FCM boundary

**Files:**
- Modify: `hooks/useFCM.ts:1-53`
- Modify: `tests/api/admin-notification-contract.test.ts:12-89`
- Create: `lib/notifications/normalizeForegroundNotificationPayload.ts`

- [ ] **Step 1: Write the failing contract test**

Add this test to `tests/api/admin-notification-contract.test.ts`:

```ts
  it("normalizes admin foreground FCM payloads through the shared helper", () => {
    const useFcm = readSource("hooks/useFCM.ts");

    expect(useFcm).toContain(
      "@/lib/notifications/normalizeForegroundNotificationPayload",
    );
    expect(useFcm).toContain("normalizeForegroundNotificationPayload({");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/api/admin-notification-contract.test.ts`

Expected: FAIL because `hooks/useFCM.ts` still parses `payload.notification || payload.data` inline and does not import the shared helper.

- [ ] **Step 3: Write minimal implementation**

Update `hooks/useFCM.ts` so the navbar-level FCM listener delegates payload parsing to the helper instead of destructuring the payload inline.

```ts
import { useEffect, useState } from 'react';
import { getToken, onMessage } from 'firebase/messaging';
import { toast } from 'sonner';

import { messaging } from '@/lib/firebase/client';
import { normalizeForegroundNotificationPayload } from '@/lib/notifications/normalizeForegroundNotificationPayload';

export const useFCM = () => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  useEffect(() => {
    const requestPermission = async () => {
      try {
        if (!messaging) return;
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const token = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          });
          if (token) {
            setFcmToken(token);
            await fetch('/api/user/fcm-token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ fcmToken: token, action: 'add' }),
            });
          }
        }
      } catch (error) {
        console.error('An error occurred while retrieving FCM token. ', error);
      }
    };

    requestPermission();

    if (messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('Firebase Message received in foreground.', payload);

        const foregroundMessage = normalizeForegroundNotificationPayload({
          notification: payload.notification,
          data: payload.data,
        });

        if (foregroundMessage) {
          toast.success(
            `${foregroundMessage.title}: ${foregroundMessage.body}`,
            { duration: 5000 },
          );
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, []);

  return { fcmToken };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- tests/api/admin-notification-contract.test.ts tests/lib/notifications/normalizeForegroundNotificationPayload.test.ts`

Expected: PASS. The shared helper contract and payload normalization unit tests are both green.

- [ ] **Step 5: Commit**

```bash
git add hooks/useFCM.ts tests/api/admin-notification-contract.test.ts lib/notifications/normalizeForegroundNotificationPayload.ts tests/lib/notifications/normalizeForegroundNotificationPayload.test.ts
git commit -m "fix: harden admin foreground notification delivery"
```

## Task 4: Lock the service-worker background contract

**Files:**
- Create: `tests/worker/admin-push-worker-contract.test.ts`
- Reference: `worker/index.ts:1-113`
- Reference: `worker/pushSubscriptionRecovery.ts:33-58`

- [ ] **Step 1: Write the regression-only worker contract test**

Create `tests/worker/admin-push-worker-contract.test.ts` with this content:

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readWorkerSource() {
  return readFileSync(join(__dirname, "../../worker/index.ts"), "utf8");
}

describe("admin push worker contract", () => {
  it("keeps the push event wired to browser notifications", () => {
    const workerSource = readWorkerSource();

    expect(workerSource).toContain("self.addEventListener('push'");
    expect(workerSource).toContain("self.registration.showNotification");
  });

  it("keeps click navigation wired for browser notifications", () => {
    const workerSource = readWorkerSource();

    expect(workerSource).toContain("self.addEventListener('notificationclick'");
    expect(workerSource).toContain("self.clients.matchAll");
    expect(workerSource).toContain("self.clients.openWindow");
  });

  it("keeps push subscription recovery wired", () => {
    const workerSource = readWorkerSource();

    expect(workerSource).toContain(
      "self.addEventListener('pushsubscriptionchange'",
    );
    expect(workerSource).toContain("recoverPushSubscription");
  });
});
```

- [ ] **Step 2: Run the worker contract test**

Run: `npm run test:run -- tests/worker/admin-push-worker-contract.test.ts`

Expected: PASS. This task adds regression coverage only; no production code should be needed if the worker contract is still intact.

- [ ] **Step 3: Run the existing recovery helper test alongside it**

Run: `npm run test:run -- tests/worker/admin-push-worker-contract.test.ts tests/worker/pushSubscriptionRecovery.test.ts`

Expected: PASS. The contract test and the recovery helper test should both stay green.

- [ ] **Step 4: Commit**

```bash
git add tests/worker/admin-push-worker-contract.test.ts
git commit -m "test: lock admin push worker contract"
```

## Verification

### Targeted test suite
Run this exact suite after Task 4:

```bash
npm run test:run -- tests/api/admin-notification-contract.test.ts tests/lib/notifications/normalizeForegroundNotificationPayload.test.ts tests/worker/admin-push-worker-contract.test.ts tests/worker/pushSubscriptionRecovery.test.ts
```

Expected: PASS with zero failing tests.

### Browser smoke path
Run the admin app and verify the user-visible path:

```bash
npm run dev
```

Then verify this exact checklist in a browser:
1. Login ke portal admin.
2. Pastikan banner/status dari `PushNotificationManager` muncul di shell admin bila browser belum subscribe, atau menampilkan status aktif bila subscription sudah ada.
3. Terima satu notifikasi admin foreground dengan payload `notification.title` + `notification.body`; pastikan toast foreground tampil.
4. Terima satu notifikasi admin foreground data-only dengan `data.title` + `data.body`; pastikan toast foreground tetap tampil.
5. Pindahkan tab ke background lalu kirim satu notifikasi admin; pastikan browser notification muncul dari service worker.
6. Klik browser notification; pastikan window yang ada difokuskan atau browser membuka URL target yang benar.

### Rollback rule
Jika salah satu targeted test atau smoke path gagal, jangan lanjut ke task berikutnya. Perbaiki task yang sedang dikerjakan sampai test dan smoke path untuk task itu green kembali.
