import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "prisma/migrations",
);

/** The definition Postgres ends up with: the one in the newest migration. */
function latestBalanceTriggerSource() {
  const definitions = readdirSync(migrationsDir)
    .sort()
    .map((dir) => {
      try {
        return readFileSync(join(migrationsDir, dir, "migration.sql"), "utf8");
      } catch {
        return "";
      }
    })
    .filter((sql) => sql.includes("FUNCTION check_journal_balance()"));
  return (definitions.at(-1) ?? "").replace(/--.*$/gm, "");
}

describe("journal balance trigger contract", () => {
  // journal_lines has "entryId"; a trigger reading entry_id fails every
  // journal at commit, which kept production without a single journal.
  it("reads journal_lines by its real entryId column", () => {
    const source = latestBalanceTriggerSource();

    expect(source).toContain('NEW."entryId"');
    expect(source).toContain('WHERE "entryId" = ');
    expect(source).not.toMatch(/\bentry_id\b/);
  });
});
