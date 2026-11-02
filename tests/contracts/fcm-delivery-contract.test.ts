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

  it("keeps queue delivery contracts limited to websocket; Expo is gone", () => {
    const queueSource = readSource("lib/event-bus/queues.ts");
    const workerSource = readSource("lib/event-bus/workers.ts");
    const processorSource = readSource("lib/event-bus/worker-processors.ts");

    expect(queueSource).toContain('type: "websocket"');
    expect(queueSource).not.toContain("expo_push");
    expect(queueSource).not.toContain("web_push");
    expect(workerSource).not.toContain('case "web_push"');
    expect(workerSource).not.toContain("PushNotificationService");
    expect(processorSource).not.toContain('case "expo_push"');
    for (const removed of [
      "modules/notification/services/PushRetryQueue.ts",
      "modules/notification/services/ExpoPushService.ts",
      "lib/expo.ts",
      "app/api/mobile/push-token/route.ts",
    ]) {
      expect(existsSync(join(projectRoot, removed))).toBe(false);
    }
  });

  it("drops the legacy subscribe route source file", () => {
    expect(
      existsSync(join(projectRoot, "app/api/notifications/subscribe/route.ts")),
    ).toBe(false);
  });
});
