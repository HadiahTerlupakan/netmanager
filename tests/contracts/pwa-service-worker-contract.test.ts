import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("pwa service worker contract", () => {
  it("gates service worker registration behind a non-development runtime check", () => {
    const hookSource = readProjectFile("lib/hooks/usePWA.ts");

    expect(hookSource).toContain("const canRegisterServiceWorker =");
    expect(hookSource).toContain("process.env.NODE_ENV !== 'development'");
    expect(hookSource).toContain("if (canRegisterServiceWorker)");
    expect(hookSource).toContain(".register('/sw.js')");
    expect(hookSource).not.toContain(
      "if ('serviceWorker' in navigator && !isLoginPage)",
    );
  });

  it("does not keep debug console.log statements in the PWA hook", () => {
    const hookSource = readProjectFile("lib/hooks/usePWA.ts");

    expect(hookSource).not.toContain("console.log(");
  });

  it("keeps the source worker free from legacy push subscription recovery wiring", () => {
    const workerSource = readProjectFile("worker/index.ts");

    expect(workerSource).not.toContain("pushsubscriptionchange");
    expect(workerSource).not.toContain("PUSH_CONFIG");
    expect(workerSource).not.toContain("/api/notifications/subscribe");
  });
});
