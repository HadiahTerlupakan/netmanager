import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// PgBouncer sudah dicabut dari produksi (2026-11-13): app, worker, dan
// FreeRADIUS terhubung langsung ke PostgreSQL. Image bitnamilegacy/pgbouncer
// tidak lagi dirawat dan PgBouncer < 1.26.0 rentan CVE-2026-19888 /
// CVE-2026-6669. Tes ini menjaga agar pooler versi lama tidak kembali lewat
// manifes k8s yang di-apply otomatis oleh netmanager-deploy.
const root = process.cwd();

describe("PgBouncer removed from production", () => {
  it("does not ship a PgBouncer manifest in k8s/production", () => {
    expect(
      existsSync(resolve(root, "k8s/production/pgbouncer-deployment.yaml")),
    ).toBe(false);
  });

  it("does not reference the unmaintained Bitnami PgBouncer image", () => {
    const composeFile = readFileSync(
      resolve(root, "docker-compose.production.yml"),
      "utf8",
    );
    const secretsTemplate = readFileSync(
      resolve(root, "k8s/production/secrets.yaml"),
      "utf8",
    );

    expect(composeFile).not.toMatch(/bitnami(legacy)?\/pgbouncer/);
    expect(secretsTemplate).not.toContain("pgbouncer-");
  });
});
