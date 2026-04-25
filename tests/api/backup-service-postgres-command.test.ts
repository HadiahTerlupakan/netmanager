import { describe, expect, it } from "vitest";

import {
  buildPgDumpCommand,
  buildPsqlCommand,
  getPostgresClient,
} from "@/modules/settings/services/backupService";

const dbConfig = {
  host: "localhost",
  port: "5434",
  user: "netmgr",
  password: "netmgr",
  database: "billing",
};

describe("backup postgres command selection", () => {
  it("uses Docker psql when local psql is unavailable for a local compose database", () => {
    const client = getPostgresClient("billing", false, true);

    expect(buildPsqlCommand(client, dbConfig)).toBe(
      "docker exec -e PGPASSWORD='netmgr' -i 'netmanager-postgres-billing' psql -h 'localhost' -p '5432' -U 'netmgr' -d 'billing'",
    );
  });

  it("uses Docker pg_dump when local pg_dump is unavailable for a local compose database", () => {
    const client = getPostgresClient("billing", false, true);

    expect(buildPgDumpCommand(client, dbConfig)).toBe(
      "docker exec -e PGPASSWORD='netmgr' -i 'netmanager-postgres-billing' pg_dump -h 'localhost' -p '5432' -U 'netmgr' -d 'billing'",
    );
  });
});
