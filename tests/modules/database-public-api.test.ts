import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const databasePublicApiSource = readFileSync(
  join(process.cwd(), "modules/database/index.ts"),
  "utf8",
);

describe("database module public API", () => {
  it("exposes every shared Prisma client through the module boundary", () => {
    expect(databasePublicApiSource).toContain("prismaRadius");
    expect(databasePublicApiSource).toContain("prismaRadiusAuth");
  });
});
