import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const apiRoutes = [
  "app/api/admin/holidays/route.ts",
  "app/api/admin/leave-balance/route.ts",
  "app/api/mobile/holidays/route.ts",
];

const readProjectFile = (filePath: string) =>
  readFileSync(join(process.cwd(), filePath), "utf8");

describe("api thin controller boundaries", () => {
  it.each(apiRoutes)("does not import repositories in %s", (routePath) => {
    const routeSource = readProjectFile(routePath);

    expect(routeSource).not.toMatch(/^import .*Repository.* from /m);
  });
});
