import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("legacy attendance cron safety", () => {
  it("does not schedule the removed legacy attendance cron route in vercel.json", () => {
    const vercelConfig = readFileSync(
      resolve(process.cwd(), "vercel.json"),
      "utf8",
    );

    expect(vercelConfig).not.toContain('"path": "/api/cron/attendance"');
  });

  it("does not leave the removed legacy attendance cron directory in app routes", () => {
    expect(existsSync(resolve(process.cwd(), "app/api/cron/attendance"))).toBe(
      false,
    );
  });

  it("uses one minutely cron entrypoint for attendance scheduling in cron container", () => {
    const cronEntrypoint = readFileSync(
      resolve(process.cwd(), "cron/entrypoint.sh"),
      "utf8",
    );

    expect(cronEntrypoint).toContain(
      '* * * * * curl -s -H "Authorization: Bearer \\$CRON_SECRET" "\\$APP_URL/api/cron/attendance-orchestrator"',
    );
    expect(cronEntrypoint).not.toContain(
      "/api/cron/attendance-alert?type=auto",
    );
    expect(cronEntrypoint).not.toContain(
      "/api/cron/attendance-alert?type=process",
    );
    expect(cronEntrypoint).not.toContain("/api/cron/process-absence");
    expect(cronEntrypoint).not.toContain("/api/cron/auto-checkout");
  });
});
