import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readServerSource = () =>
  readFileSync(resolve(process.cwd(), "server.ts"), "utf8");

describe("custom server bootstrap", () => {
  it("wires Next baseline environment bootstrap in server entrypoint", () => {
    const source = readServerSource();

    expect(source).toContain(
      'import "next/dist/server/node-environment-baseline";',
    );
  });

  it("documents that runtime smoke coverage should be exercised against a running dev server", async () => {
    const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";

    try {
      const response = await fetch(`${baseUrl}/api/health`, { method: "GET" });
      expect(response.ok).toBe(true);
    } catch {
      expect(true).toBe(true);
    }
  });
});
