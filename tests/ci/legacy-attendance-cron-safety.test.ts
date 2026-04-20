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
});
