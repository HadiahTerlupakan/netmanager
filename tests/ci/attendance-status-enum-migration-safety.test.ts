import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readAttendanceSchema(): string {
  return readFileSync(
    resolve(process.cwd(), "prisma", "schema.prisma"),
    "utf8",
  );
}

function readMigrationSqlFiles(): string[] {
  const migrationsDir = resolve(process.cwd(), "prisma", "migrations");

  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((directoryName) =>
      readFileSync(
        resolve(migrationsDir, directoryName, "migration.sql"),
        "utf8",
      ),
    );
}

describe("attendance status enum migration safety", () => {
  it("keeps the NO_CHECKOUT enum value backed by committed migration SQL", () => {
    const schema = readAttendanceSchema();
    const migrationSql = readMigrationSqlFiles().join("\n\n");

    expect(schema).toContain("enum AttendanceStatus {");
    expect(schema).toContain("  NO_CHECKOUT");
    expect(migrationSql).toContain(
      "CREATE TYPE \"AttendanceStatus\" AS ENUM ('ON_TIME', 'LATE', 'ABSENT', 'SICK', 'PERMIT', 'DAY_OFF', 'ALPHA'",
    );
    expect(migrationSql).toContain(
      "ALTER TYPE \"AttendanceStatus\" ADD VALUE 'NO_CHECKOUT'",
    );
  });
});
