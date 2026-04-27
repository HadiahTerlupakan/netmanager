import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const routeFiles = [
  "app/api/admin/attendance/[id]/route.ts",
  "app/api/acs/devices/route.ts",
  "app/api/acs/devices/[id]/route.ts",
  "app/api/acs/devices/[id]/tasks/route.ts",
  "app/api/acs/devices/[id]/wan/route.ts",
  "app/api/marketing/canvasing/summary/route.ts",
  "app/api/mobile/topology/route.ts",
  "app/api/network/backups/route.ts",
  "app/api/network/backups/[id]/route.ts",
  "app/api/network/backups/[id]/restore/route.ts",
];

describe("api route boundaries", () => {
  it.each(routeFiles)("keeps Prisma/database access out of %s", (routeFile) => {
    const source = readFileSync(routeFile, "utf8");

    expect(source).not.toMatch(/@\/modules\/database|@\/lib\/prisma/);
    expect(source).not.toMatch(/\bprisma\b/);
  });
});
