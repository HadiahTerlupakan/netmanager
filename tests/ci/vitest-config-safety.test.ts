import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Vitest config safety", () => {
  it("aliases node-cron to the CommonJS bundle to avoid broken upstream ESM sourcemap warnings in tests", () => {
    const vitestConfig = readFileSync(
      resolve(process.cwd(), "vitest.config.ts"),
      "utf8",
    );

    expect(vitestConfig).toContain('"node-cron": path.resolve(');
    expect(vitestConfig).toContain(
      '"./node_modules/node-cron/dist/cjs/node-cron.js"',
    );
    expect(vitestConfig).not.toContain(
      '"node-cron": path.resolve(__dirname, "./node_modules/node-cron/dist/esm/node-cron.js")',
    );
  });
});
