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
