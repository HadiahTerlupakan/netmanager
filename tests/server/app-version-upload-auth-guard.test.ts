import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readServerSource = () =>
  readFileSync(resolve(process.cwd(), "server.ts"), "utf8");

describe("custom server app version upload auth guard", () => {
  it("uses canonical super admin helper instead of hardcoded role comparison", () => {
    const source = readServerSource();

    expect(source).toContain("isSuperAdminRole(userRole)");
    expect(source).not.toContain('userRole.toUpperCase() === "SUPER_ADMIN"');
  });
});
