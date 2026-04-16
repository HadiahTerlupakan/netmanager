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

  it("keeps WORK_ORDER in the admin bell realtime notification scope", () => {
    const adminNotificationBell = readSource(
      "components/notifications/AdminNotificationBell.tsx",
    );

    expect(adminNotificationBell).not.toContain(
      "useRealtimeNotifications({ limit: 5, excludeTypes: ['WORK_ORDER'] })",
    );
  });

  it("registers web FCM once from the navbar notification shell", () => {
    const navbar = readSource("components/layout/Navbar.tsx");
    const adminNotificationBell = readSource(
      "components/notifications/AdminNotificationBell.tsx",
    );
    const paymentApprovalBell = readSource(
      "components/notifications/PaymentApprovalBell.tsx",
    );

    expect(navbar).toContain("@/hooks/useFCM");
    expect(navbar).toContain("useFCM();");
    expect(adminNotificationBell).not.toContain("@/hooks/useFCM");
    expect(adminNotificationBell).not.toContain("useFCM();");
    expect(paymentApprovalBell).not.toContain("@/hooks/useFCM");
    expect(paymentApprovalBell).not.toContain("useFCM()");
  });

  it("normalizes admin foreground FCM payloads through the shared helper", () => {
    const useFcm = readSource("hooks/useFCM.ts");

    expect(useFcm).toContain(
      "@/lib/notifications/normalizeForegroundNotificationPayload",
    );
    expect(useFcm).toContain("normalizeForegroundNotificationPayload({");
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
