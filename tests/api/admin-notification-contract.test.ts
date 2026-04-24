import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testFileDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(testFileDirectory, "..", "..");

const readSource = (relativePath: string) =>
  readFileSync(join(projectRoot, relativePath), "utf8");

describe("admin notification contract", () => {
  it("exposes WORK_ORDER and ANNOUNCEMENT in the admin notification filter contract", () => {
    const notificationsClient = readSource(
      "app/admin/notifications/NotificationsClient.tsx",
    );

    expect(notificationsClient).toContain("type FilterType =");
    expect(notificationsClient).toContain('| "WORK_ORDER"');
    expect(notificationsClient).toContain('| "ANNOUNCEMENT"');
    expect(notificationsClient).toContain('"WORK_ORDER",');
    expect(notificationsClient).toContain('"ANNOUNCEMENT",');
    expect(notificationsClient).toContain("as FilterType[]");
  });

  it("excludes WORK_ORDER from the admin bell realtime notification scope", () => {
    const adminNotificationBell = readSource(
      "components/notifications/AdminNotificationBell.tsx",
    );

    expect(adminNotificationBell).toContain(
      'useRealtimeNotifications({ limit: 5, excludeTypes: ["WORK_ORDER"] })',
    );
  });

  it("mounts FCM onboarding through dedicated managers instead of the navbar shell", () => {
    const navbar = readSource("components/layout/Navbar.tsx");
    const pushNotificationManager = readSource(
      "components/notifications/PushNotificationManager.tsx",
    );
    const karyawanPushNotification = readSource(
      "components/karyawan/KaryawanPushNotification.tsx",
    );

    expect(navbar).not.toContain("@/hooks/useFCM");
    expect(navbar).not.toContain("useFCM();");
    expect(pushNotificationManager).toContain("@/hooks/useFCM");
    expect(pushNotificationManager).toContain("enableNotifications");
    expect(pushNotificationManager).not.toContain(
      "/api/notifications/subscribe",
    );
    expect(karyawanPushNotification).toContain("@/hooks/useFCM");
    expect(karyawanPushNotification).toContain("enableNotifications");
    expect(karyawanPushNotification).not.toContain(
      "/api/notifications/subscribe",
    );
  });

  it("normalizes admin foreground FCM payloads through the shared helper", () => {
    const useFcm = readSource("hooks/useFCM.ts");

    expect(useFcm).toContain(
      "@/lib/notifications/normalizeForegroundNotificationPayload",
    );
    expect(useFcm).toContain("normalizeForegroundNotificationPayload({");
    expect(useFcm).toContain("enableNotifications");
    expect(useFcm).toContain("isRegistered: Boolean(fcmToken)");
  });

  it("mounts browser push onboarding in the admin shell", () => {
    const adminLayout = readSource("app/admin/layout.tsx");

    expect(adminLayout).toContain(
      "@/components/notifications/PushNotificationManager",
    );
    expect(adminLayout).toContain("<PushNotificationManager");
  });

  it("uses the realtime notification hook from the firebase realtime namespace", () => {
    const adminNotificationBell = readSource(
      "components/notifications/AdminNotificationBell.tsx",
    );
    const notificationBell = readSource(
      "components/notifications/NotificationBell.tsx",
    );
    const karyawanNotificationBell = readSource(
      "components/karyawan/KaryawanNotificationBell.tsx",
    );

    expect(adminNotificationBell).toContain(
      "@/lib/realtime/hooks/useRealtimeNotifications",
    );
    expect(notificationBell).toContain(
      "@/lib/realtime/hooks/useRealtimeNotifications",
    );
    expect(karyawanNotificationBell).toContain(
      "@/lib/realtime/hooks/useRealtimeNotifications",
    );
    expect(adminNotificationBell).not.toContain(
      "@/lib/websocket/hooks/useRealtimeNotifications",
    );
  });

  it("sets loading before retrying admin bell notification refresh", () => {
    const realtimeHook = readSource(
      "lib/websocket/hooks/useRealtimeNotifications.ts",
    );

    expect(realtimeHook).toContain("setLoading(true);");
    expect(realtimeHook.indexOf("setLoading(true);")).toBeLessThan(
      realtimeHook.indexOf("setError(null);"),
    );
  });

  it("keeps unread-count aligned with the same admin visibility scope as the list route", () => {
    const notificationsRoute = readSource("app/api/notifications/route.ts");
    const unreadCountRoute = readSource(
      "app/api/notifications/unread-count/route.ts",
    );

    expect(notificationsRoute).toContain("departmentId");
    expect(unreadCountRoute).toContain("departmentId");
    expect(unreadCountRoute).toContain("siteId");
    expect(unreadCountRoute).toContain("departmentId");
  });
});
