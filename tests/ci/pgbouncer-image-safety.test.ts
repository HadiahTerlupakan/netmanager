import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const EXPECTED_PGBOUNCER_IMAGE = "bitnamilegacy/pgbouncer:1.24.1-debian-12-r10";

function readProductionPgbouncerManifest(): string {
  return readFileSync(
    resolve(process.cwd(), "k8s/production/pgbouncer-deployment.yaml"),
    "utf8",
  );
}

function readProductionComposeFile(): string {
  return readFileSync(
    resolve(process.cwd(), "docker-compose.production.yml"),
    "utf8",
  );
}

describe("PgBouncer production image safety", () => {
  it("pins all production PgBouncer definitions to a pullable image tag", () => {
    const manifest = readProductionPgbouncerManifest();
    const composeFile = readProductionComposeFile();

    expect(manifest).toContain(`image: ${EXPECTED_PGBOUNCER_IMAGE}`);
    expect(composeFile).toContain(`image: ${EXPECTED_PGBOUNCER_IMAGE}`);
    expect(manifest).not.toContain("bitnami/pgbouncer:1");
    expect(composeFile).not.toContain("bitnami/pgbouncer:1");
  });
});
