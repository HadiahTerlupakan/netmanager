import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("migration job safety", () => {
  it("classifies optional backfill steps explicitly and supports strict mode", () => {
    const migrationJob = readFileSync(
      resolve(process.cwd(), "k8s", "migration-job.yaml"),
      "utf8",
    );

    expect(migrationJob).toContain("run_optional_step()");
    expect(migrationJob).toContain("FAIL_ON_OPTIONAL_MIGRATION_ERRORS");
    expect(migrationJob).toContain(
      "OPTIONAL_FAILURES=$((OPTIONAL_FAILURES + 1))",
    );
    expect(migrationJob).toContain("Optional migration steps completed with");
  });

  it("applies tenant schema baselines before resolving them on existing databases", () => {
    const migrationJob = readFileSync(
      resolve(process.cwd(), "k8s", "migration-job.yaml"),
      "utf8",
    );

    const mainApply =
      'psql "$DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -f prisma/migrations/20260314015651_init_tenant_schema/migration.sql';
    const mainResolve =
      "prisma migrate resolve --applied 20260314015651_init_tenant_schema 2>&1 || true";
    const radiusApply =
      'psql "$RADIUS_DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -f prisma/radius_migrations/20260314015652_init_tenant_schema/migration.sql';
    const radiusResolve =
      "prisma migrate resolve --applied 20260314015652_init_tenant_schema --config=prisma.radius.config.ts 2>&1 || true";
    const billingApply =
      'psql "$DATABASE_URL_BILLING_PSQL" -v ON_ERROR_STOP=1 -f prisma/billing_migrations/20260314015654_init_tenant_schema/migration.sql';
    const billingResolve =
      "prisma migrate resolve --applied 20260314015654_init_tenant_schema --config=prisma.billing.config.ts 2>&1 || true";
    const mitraApply =
      'psql "$DATABASE_URL_MITRA_PSQL" -v ON_ERROR_STOP=1 -f prisma/mitra_migrations/20260314015655_init_tenant_schema/migration.sql';
    const mitraResolve =
      "prisma migrate resolve --applied 20260314015655_init_tenant_schema --config=prisma.mitra.config.ts 2>&1 || true";

    expect(migrationJob).toContain(mainApply);
    expect(migrationJob.indexOf(mainApply)).toBeLessThan(
      migrationJob.indexOf(mainResolve),
    );
    expect(migrationJob).toContain(radiusApply);
    expect(migrationJob.indexOf(radiusApply)).toBeLessThan(
      migrationJob.indexOf(radiusResolve),
    );
    expect(migrationJob).toContain(billingApply);
    expect(migrationJob.indexOf(billingApply)).toBeLessThan(
      migrationJob.indexOf(billingResolve),
    );
    expect(migrationJob).toContain(mitraApply);
    expect(migrationJob.indexOf(mitraApply)).toBeLessThan(
      migrationJob.indexOf(mitraResolve),
    );
  });

  it("sanitizes Prisma-specific query parameters before using psql database URLs", () => {
    const migrationJob = readFileSync(
      resolve(process.cwd(), "k8s", "migration-job.yaml"),
      "utf8",
    );

    expect(migrationJob).toContain("sanitize_psql_url()");
    expect(migrationJob).toContain(
      '["schema", "connection_limit", "pool_timeout"].forEach((name) => url.searchParams.delete(name))',
    );
    expect(migrationJob).toContain(
      'DATABASE_URL_PSQL=$(sanitize_psql_url "$DATABASE_URL")',
    );
    expect(migrationJob).toContain(
      'RADIUS_DATABASE_URL_PSQL=$(sanitize_psql_url "$RADIUS_DATABASE_URL")',
    );
    expect(migrationJob).toContain(
      'DATABASE_URL_BILLING_PSQL=$(sanitize_psql_url "$DATABASE_URL_BILLING")',
    );
    expect(migrationJob).toContain(
      'DATABASE_URL_MITRA_PSQL=$(sanitize_psql_url "$DATABASE_URL_MITRA")',
    );
    expect(migrationJob).toContain(
      'psql "$DATABASE_URL_PSQL" -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = \'User\')"',
    );
    expect(migrationJob).toContain(
      'psql "$RADIUS_DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -f prisma/radius_migrations/20260314015652_init_tenant_schema/migration.sql',
    );
    expect(migrationJob).toContain(
      'psql "$DATABASE_URL_BILLING_PSQL" -v ON_ERROR_STOP=1 -f prisma/billing_migrations/20260314015654_init_tenant_schema/migration.sql',
    );
    expect(migrationJob).toContain(
      'psql "$DATABASE_URL_MITRA_PSQL" -v ON_ERROR_STOP=1 -f prisma/mitra_migrations/20260314015655_init_tenant_schema/migration.sql',
    );
    expect(migrationJob).not.toContain(
      'psql "$DATABASE_URL_BILLING" -v ON_ERROR_STOP=1 -f prisma/billing_migrations/20260314015654_init_tenant_schema/migration.sql',
    );
    expect(migrationJob).not.toContain(
      'psql "$DATABASE_URL_MITRA" -v ON_ERROR_STOP=1 -f prisma/mitra_migrations/20260314015655_init_tenant_schema/migration.sql',
    );
  });

  it("fails fast when the partial sync schema fix cannot be applied", () => {
    const migrationJob = readFileSync(
      resolve(process.cwd(), "k8s", "migration-job.yaml"),
      "utf8",
    );

    expect(migrationJob).toContain(
      'psql "$DATABASE_URL_PSQL" -v ON_ERROR_STOP=1 -f /app/scripts/fix-partial-sync-schema.sql 2>&1',
    );
    expect(migrationJob).not.toContain(
      'psql "$DATABASE_URL_PSQL" -f /app/scripts/fix-partial-sync-schema.sql 2>&1 || true',
    );
  });

  it("fails the job when optional migration steps report failures", () => {
    const migrationJob = readFileSync(
      resolve(process.cwd(), "k8s", "migration-job.yaml"),
      "utf8",
    );

    expect(migrationJob).toContain('if [ "$OPTIONAL_FAILURES" -gt 0 ]; then');
    expect(migrationJob).toContain("exit 1");
    expect(migrationJob).not.toContain(
      "Optional migration steps completed with 0 failure(s)",
    );
  });

  it("does not force success exit codes from tenant optional migration scripts", () => {
    const backfillTenant = readFileSync(
      resolve(process.cwd(), "scripts", "backfill-tenant.ts"),
      "utf8",
    );
    const migrateLegacyTenant = readFileSync(
      resolve(process.cwd(), "scripts", "migrate-legacy-tenant.ts"),
      "utf8",
    );
    const fixTenantProvision = readFileSync(
      resolve(process.cwd(), "scripts", "fix-tenant-provision.ts"),
      "utf8",
    );

    expect(backfillTenant).not.toContain("process.exit(0)");
    expect(migrateLegacyTenant).not.toContain("process.exit(0)");
    expect(fixTenantProvision).not.toContain("process.exit(0)");
  });

  it("fails fix-tenant-provision when users cannot be re-assigned to any tenant role", () => {
    const fixTenantProvision = readFileSync(
      resolve(process.cwd(), "scripts", "fix-tenant-provision.ts"),
      "utf8",
    );

    expect(fixTenantProvision).toContain(
      'console.log(`  ❌ No suitable role found for user "${user.name}"`)',
    );
    expect(fixTenantProvision).toContain("optionalFailureCount");
    expect(fixTenantProvision).toContain("process.exitCode = 1");
  });

  it("backfills only models whose tenantId can actually be null", () => {
    const backfillTenant = readFileSync(
      resolve(process.cwd(), "scripts", "backfill-tenant.ts"),
      "utf8",
    );

    expect(backfillTenant).toContain(
      'field.name === "tenantId" && !field.isRequired',
    );
    expect(backfillTenant).not.toContain(
      'model.fields.some((f) => f.name === "tenantId")',
    );
  });

  it("manages its own Prisma pool lifecycle so the backfill process can exit cleanly", () => {
    const backfillTenant = readFileSync(
      resolve(process.cwd(), "scripts", "backfill-tenant.ts"),
      "utf8",
    );

    expect(backfillTenant).toContain(
      'import { PrismaPg } from "@prisma/adapter-pg"',
    );
    expect(backfillTenant).toContain('import { Pool } from "pg"');
    expect(backfillTenant).toContain("await pool.end()");
    expect(backfillTenant).not.toContain(
      'import { prismaAuth as prisma } from "../lib/prisma"',
    );
  });

  it("skips models whose tenant backfill can collide with tenant-scoped unique constraints", () => {
    const backfillTenant = readFileSync(
      resolve(process.cwd(), "scripts", "backfill-tenant.ts"),
      "utf8",
    );

    expect(backfillTenant).toContain(
      "const uniqueFields = model.uniqueFields ?? []",
    );
    expect(backfillTenant).toContain(
      'uniqueFields.some((fields) => fields.includes("tenantId"))',
    );
    expect(backfillTenant).not.toContain("model.uniqueFields.some");
    expect(backfillTenant).not.toContain("const modelsWithTenantId");
  });

  it("aligns Jenkins migration wait budget with the Job deadline and captures richer diagnostics on failure", () => {
    const jenkinsfile = readFileSync(
      resolve(process.cwd(), "Jenkinsfile"),
      "utf8",
    );

    expect(jenkinsfile).toContain("MAX_WAIT_SECONDS=1800");
    expect(jenkinsfile).toContain("POLL_INTERVAL=10");
    expect(jenkinsfile).toContain(
      "MAX_ATTEMPTS=\\$((MAX_WAIT_SECONDS / POLL_INTERVAL))",
    );
    expect(jenkinsfile).not.toContain("for i in $(seq 1 60)");
    expect(jenkinsfile).not.toContain("⚠️ Job timeout (10 menit).");
    expect(jenkinsfile).toContain(
      "kubectl describe job netmanager-migration-job --namespace=${NAMESPACE} || true",
    );
    expect(jenkinsfile).toContain("-l job-name=netmanager-migration-job");
    expect(jenkinsfile).toContain(
      'kubectl describe pod "\\$POD_NAME" --namespace=${NAMESPACE} || true',
    );
    expect(jenkinsfile).toContain(
      'kubectl logs "\\$POD_NAME" --namespace=${NAMESPACE} --tail=100 || true',
    );
  });
});
