import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testFileDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(testFileDirectory, "..", "..");

const readSource = (relativePath: string) =>
  readFileSync(join(projectRoot, relativePath), "utf8");

describe("push subscriptions schema contract", () => {
  it("removes PushSubscriptions relations and model from the Prisma schema", () => {
    const schema = readSource("prisma/schema.prisma");

    expect(schema).not.toContain(
      "push_subscriptions                         PushSubscriptions[]",
    );
    expect(schema).not.toContain("pushSubscriptions       PushSubscriptions[]");
    expect(schema).not.toContain("model PushSubscriptions {");
    expect(schema).not.toContain('@@map("push_subscriptions")');
  });

  it("adds a migration that drops legacy push_subscriptions storage", () => {
    const migrationPath = join(
      projectRoot,
      "prisma/migrations/20260420123000_drop_push_subscriptions/migration.sql",
    );

    expect(existsSync(migrationPath)).toBe(true);

    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain('DROP TABLE IF EXISTS "push_subscriptions"');
    expect(migration).not.toContain('DELETE FROM "push_subscriptions"');
  });
});
