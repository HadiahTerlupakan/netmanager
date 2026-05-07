import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readDepreciationCronSource = () =>
  readFileSync(
    resolve(
      process.cwd(),
      "modules/inventory/services/DepreciationCronService.ts",
    ),
    "utf8",
  );

describe("DepreciationCronService system user lookup", () => {
  it("uses canonical superadmin lookup for system user", () => {
    const source = readDepreciationCronSource();

    expect(source).toContain("role: { isSuperAdmin: true }");
    expect(source).not.toContain('role: { name: "SUPER_ADMIN" }');
  });
});
