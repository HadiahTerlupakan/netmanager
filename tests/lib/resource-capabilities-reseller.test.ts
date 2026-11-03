import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  getResourceCapabilities,
  RESOURCE_CAPABILITIES,
} from "@/lib/resource-capabilities";

function collectRouteFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory()
      ? collectRouteFiles(path)
      : entry === "route.ts"
        ? [path]
        : [];
  });
}

describe("katalog permission reseller", () => {
  it("reseller punya entri eksplisit tanpa pembatasan site/departemen", () => {
    expect(RESOURCE_CAPABILITIES.reseller?.actions).toEqual([
      "read",
      "create",
      "update",
      "delete",
    ]);
    expect(getResourceCapabilities("reseller")).not.toContain("site_only");
    expect(getResourceCapabilities("reseller")).not.toContain(
      "department_only",
    );
  });

  it("setiap aksi reseller yang dipakai route tersedia di matriks role", () => {
    const usedActions = new Set(
      collectRouteFiles("app/api/admin/resellers").flatMap((file) =>
        [...readFileSync(file, "utf8").matchAll(/"reseller:([a-z_]+)"/g)].map(
          (match) => match[1],
        ),
      ),
    );

    expect(usedActions.size).toBeGreaterThan(0);
    for (const action of usedActions) {
      expect(getResourceCapabilities("reseller")).toContain(action);
    }
  });
});
