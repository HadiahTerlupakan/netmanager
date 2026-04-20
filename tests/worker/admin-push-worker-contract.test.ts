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
  it("delegates push payload parsing to the runtime helper", () => {
    const workerSource = readWorkerSource();

    expect(workerSource).toContain(
      "resolvePushNotificationPayloadFromEventData",
    );
    expect(workerSource).not.toContain("event.data.json()");
    expect(workerSource).not.toContain("event.data.text()");
  });

  it("delegates notification click actions to the runtime helper", () => {
    const workerSource = readWorkerSource();

    expect(workerSource).toContain("handleNotificationClickAction");
    expect(workerSource).not.toContain('event.action === "open"');
  });

  it("removes legacy push subscription recovery wiring", () => {
    const workerSource = readWorkerSource();

    expect(workerSource).not.toContain(
      'self.addEventListener("pushsubscriptionchange"',
    );
    expect(workerSource).not.toContain("recoverPushSubscription");
    expect(workerSource).not.toContain("PUSH_CONFIG");
  });
});
