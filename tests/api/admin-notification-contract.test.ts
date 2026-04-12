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
