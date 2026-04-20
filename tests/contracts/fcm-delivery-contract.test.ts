import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testFileDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(testFileDirectory, "..", "..");

const readSource = (relativePath: string) =>
  readFileSync(join(projectRoot, relativePath), "utf8");

describe("fcm delivery contract", () => {
  it("removes the legacy subscribe route and web-push service exports", () => {
    const notificationIndex = readSource("modules/notification/index.ts");
    const notificationService = readSource(
      "modules/notification/services/NotificationService.ts",
    );

    expect(notificationIndex).not.toContain("PushNotificationService");
    expect(notificationService).not.toContain("PushSubscriptionRepository");
    expect(notificationService).not.toContain("sendBrowserPushNotifications");
    expect(notificationService).not.toContain("subscribeDevice(");
    expect(notificationService).not.toContain("unsubscribeDevice(");
  });

  it("keeps queue delivery contracts limited to expo and websocket", () => {
    const queueSource = readSource("lib/event-bus/queues.ts");
    const workerSource = readSource("lib/event-bus/workers.ts");
    const retryQueueSource = readSource(
      "modules/notification/services/PushRetryQueue.ts",
    );

    expect(queueSource).toContain('type: "expo_push" | "websocket"');
    expect(queueSource).not.toContain("web_push");
    expect(workerSource).not.toContain('case "web_push"');
    expect(workerSource).not.toContain("PushNotificationService");
    expect(retryQueueSource).toContain('type: "expo"');
    expect(retryQueueSource).not.toContain('type: "expo" | "web"');
    expect(retryQueueSource).not.toContain("retryWebPush");
  });

  it("drops the legacy subscribe route source file", () => {
    expect(
      existsSync(join(projectRoot, "app/api/notifications/subscribe/route.ts")),
    ).toBe(false);
  });
});
