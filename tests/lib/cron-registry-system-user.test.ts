import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readCronRegistrySource = () =>
  readFileSync(resolve(process.cwd(), "lib/cron-registry.ts"), "utf8");

describe("Cron registry system user lookup", () => {
  it("uses canonical superadmin lookup for system user", () => {
    const source = readCronRegistrySource();

    expect(source).toContain("role: { isSuperAdmin: true }");
    expect(source).not.toContain('role: { name: "SUPER_ADMIN" }');
  });
});
