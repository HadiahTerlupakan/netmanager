import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guard di `k8s/migration-job.yaml` menghentikan job migrasi sebelum menyentuh
 * database bila ada migration destruktif yang belum diterapkan dan tidak
 * membawa komentar `-- @safe-guard-ack:`. Aturannya disalin ke sini supaya
 * ketahuan saat menulis migration, bukan setelah satu jam pipeline berjalan.
 */
const DESTRUCTIVE_SQL_PATTERN =
  /DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|ALTER\s+TABLE\s+".*"\s+ALTER\s+COLUMN/i;
const SAFE_GUARD_ACK_PREFIX = "-- @safe-guard-ack:";
const MIGRATION_DIRECTORIES = [
  "prisma/migrations",
  "prisma/billing_migrations",
  "prisma/mitra_migrations",
];
/**
 * Sudah diterapkan di produksi sebelum guard ini ada. Berkas migration yang
 * sudah dijalankan tidak boleh diedit: Prisma menyimpan checksum-nya dan
 * `migrate deploy` menolak berkas yang berubah. Guard sendiri hanya memeriksa
 * migration yang belum diterapkan, jadi berkas ini tidak pernah memblokir.
 */
const LEGACY_MIGRATIONS_WITHOUT_ACK = new Set([
  "20260720123000_make_chat_user_columns_nullable",
]);

function findDestructiveMigrationsWithoutAck(directory: string): string[] {
  const directoryPath = resolve(process.cwd(), directory);

  return readdirSync(directoryPath)
    .filter((migration) => !LEGACY_MIGRATIONS_WITHOUT_ACK.has(migration))
    .filter((migration) =>
      existsSync(join(directoryPath, migration, "migration.sql")),
    )
    .filter((migration) => {
      const sql = readFileSync(
        join(directoryPath, migration, "migration.sql"),
        "utf8",
      );
      return (
        DESTRUCTIVE_SQL_PATTERN.test(sql) &&
        !sql.startsWith(SAFE_GUARD_ACK_PREFIX)
      );
    })
    .map((migration) => `${directory}/${migration}`);
}

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

  it("applies tenant schema baselines before conditionally resolving them on existing databases", () => {
    const migrationJob = readFileSync(
      resolve(process.cwd(), "k8s", "migration-job.yaml"),
      "utf8",
    );

    const mainApply =
      'psql_quiet_idempotent_sql "$DATABASE_URL_PSQL" prisma/migrations/20260314015651_init_tenant_schema/migration.sql';
    const mainResolve =
      'resolve_migration_if_unapplied "$DATABASE_URL_PSQL" 20260314015651_init_tenant_schema';
    const radiusApply =
      'psql_quiet_idempotent_sql "$RADIUS_DATABASE_URL_PSQL" prisma/radius_migrations/20260314015652_init_tenant_schema/migration.sql';
    const radiusResolve =
      'resolve_migration_if_unapplied "$RADIUS_DATABASE_URL_PSQL" 20260314015652_init_tenant_schema --config=prisma.radius.config.ts';
    const billingApply =
      'psql_quiet_idempotent_sql "$DATABASE_URL_BILLING_PSQL" prisma/billing_migrations/20260314015654_init_tenant_schema/migration.sql';
    const billingResolve =
      'resolve_migration_if_unapplied "$DATABASE_URL_BILLING_PSQL" 20260314015654_init_tenant_schema --config=prisma.billing.config.ts';
    const mitraApply =
      'psql_quiet_idempotent_sql "$DATABASE_URL_MITRA_PSQL" prisma/mitra_migrations/20260314015655_init_tenant_schema/migration.sql';
    const mitraResolve =
      'resolve_migration_if_unapplied "$DATABASE_URL_MITRA_PSQL" 20260314015655_init_tenant_schema --config=prisma.mitra.config.ts';

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

  it("checks prisma migration records before resolving applied baselines to avoid noisy P3008 logs", () => {
    const migrationJob = readFileSync(
      resolve(process.cwd(), "k8s", "migration-job.yaml"),
      "utf8",
    );

    expect(migrationJob).toContain("has_prisma_migration_record()");
    expect(migrationJob).toContain("resolve_migration_if_unapplied()");
    expect(migrationJob).toContain("table_name = '_prisma_migrations'");
    expect(migrationJob).toContain("migration_name = '$migration_name'");
    expect(migrationJob).toContain(
      'if [ "$(has_prisma_migration_record "$database_url" "$migration_name")" = "t" ]; then',
    );
    expect(migrationJob).toContain(
      'echo "ℹ️ Migration already marked applied, skipping resolve: $migration_name"',
    );
    expect(migrationJob).toContain(
      'prisma migrate resolve --applied "$migration_name" "$@" 2>&1',
    );
    expect(migrationJob).not.toContain(
      "prisma migrate resolve --applied 20260313000000_init_squashed 2>&1 || true",
    );
    expect(migrationJob).not.toContain(
      "prisma migrate resolve --applied 20260313000000_init_squashed --config=prisma.radius.config.ts 2>&1 || true",
    );
    expect(migrationJob).not.toContain(
      "prisma migrate resolve --applied 20260313000000_init_squashed --config=prisma.billing.config.ts 2>&1 || true",
    );
    expect(migrationJob).toContain(
      'resolve_migration_if_unapplied "$DATABASE_URL_PSQL" 20260315020000_tenant_unique_constraints',
    );
    expect(migrationJob).toContain(
      'resolve_migration_if_unapplied "$DATABASE_URL_PSQL" 20260318064750_add_pelanggan_username_unique_index',
    );
    expect(migrationJob).toContain(
      'resolve_migration_if_unapplied "$DATABASE_URL_PSQL" 20260318065456_add_session_expires_index',
    );
    expect(migrationJob).toContain(
      'resolve_migration_if_unapplied "$DATABASE_URL_PSQL" 20260326004412_sync_schema_changes',
    );
    expect(migrationJob).not.toContain(
      "prisma migrate resolve --applied 20260313000000_init_squashed --config=prisma.mitra.config.ts 2>&1 || true",
    );
    expect(migrationJob).not.toContain(
      "prisma migrate resolve --applied 20260315020000_tenant_unique_constraints 2>&1 || true",
    );
    expect(migrationJob).not.toContain(
      "prisma migrate resolve --applied 20260318064750_add_pelanggan_username_unique_index 2>&1 || true",
    );
    expect(migrationJob).not.toContain(
      "prisma migrate resolve --applied 20260318065456_add_session_expires_index 2>&1 || true",
    );
    expect(migrationJob).not.toContain(
      "prisma migrate resolve --applied 20260326004412_sync_schema_changes 2>&1 || true",
    );
  });

  it("applies the partial sync schema repair before conditionally resolving that migration", () => {
    const migrationJob = readFileSync(
      resolve(process.cwd(), "k8s", "migration-job.yaml"),
      "utf8",
    );

    const syncSchemaFix =
      'psql_quiet_idempotent_sql "$DATABASE_URL_PSQL" /app/scripts/fix-partial-sync-schema.sql';
    const syncSchemaResolve =
      'resolve_migration_if_unapplied "$DATABASE_URL_PSQL" 20260326004412_sync_schema_changes';

    expect(migrationJob).toContain(syncSchemaFix);
    expect(migrationJob.indexOf(syncSchemaFix)).toBeLessThan(
      migrationJob.indexOf(syncSchemaResolve),
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
      'psql_quiet_idempotent_sql "$RADIUS_DATABASE_URL_PSQL" prisma/radius_migrations/20260314015652_init_tenant_schema/migration.sql',
    );
    expect(migrationJob).toContain(
      'psql_quiet_idempotent_sql "$DATABASE_URL_BILLING_PSQL" prisma/billing_migrations/20260314015654_init_tenant_schema/migration.sql',
    );
    expect(migrationJob).toContain(
      'psql_quiet_idempotent_sql "$DATABASE_URL_MITRA_PSQL" prisma/mitra_migrations/20260314015655_init_tenant_schema/migration.sql',
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
      'psql_quiet_idempotent_sql "$DATABASE_URL_PSQL" /app/scripts/fix-partial-sync-schema.sql',
    );
    expect(migrationJob).not.toContain(
      'psql "$DATABASE_URL_PSQL" -f /app/scripts/fix-partial-sync-schema.sql 2>&1 || true',
    );
  });

  it("repairs missing inventory actor columns in the partial sync schema fix", () => {
    const fixPartialSyncSchema = readFileSync(
      resolve(process.cwd(), "scripts", "fix-partial-sync-schema.sql"),
      "utf8",
    );

    expect(fixPartialSyncSchema).toContain(
      "WHERE table_name = 'barang_masuk' AND column_name = 'actorType'",
    );
    expect(fixPartialSyncSchema).toContain(
      'ALTER TABLE "barang_masuk" ADD COLUMN "actorType" TEXT;',
    );
    expect(fixPartialSyncSchema).toContain(
      "WHERE table_name = 'barang_masuk' AND column_name = 'actorId'",
    );
    expect(fixPartialSyncSchema).toContain(
      'ALTER TABLE "barang_masuk" ADD COLUMN "actorId" TEXT;',
    );
    expect(fixPartialSyncSchema).toContain(
      "WHERE table_name = 'barang_keluar' AND column_name = 'actorType'",
    );
    expect(fixPartialSyncSchema).toContain(
      'ALTER TABLE "barang_keluar" ADD COLUMN "actorType" TEXT;',
    );
    expect(fixPartialSyncSchema).toContain(
      "WHERE table_name = 'barang_keluar' AND column_name = 'actorId'",
    );
    expect(fixPartialSyncSchema).toContain(
      'ALTER TABLE "barang_keluar" ADD COLUMN "actorId" TEXT;',
    );
  });

  it("ships an idempotent dedicated migration for inventory actor columns", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "prisma",
        "migrations",
        "20260420054500_add_inventory_actor_columns",
        "migration.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      'ALTER TABLE "barang_masuk" ADD COLUMN IF NOT EXISTS "actorType" TEXT;',
    );
    expect(migration).toContain(
      'ALTER TABLE "barang_masuk" ADD COLUMN IF NOT EXISTS "actorId" TEXT;',
    );
    expect(migration).toContain(
      'ALTER TABLE "barang_keluar" ADD COLUMN IF NOT EXISTS "actorType" TEXT;',
    );
    expect(migration).toContain(
      'ALTER TABLE "barang_keluar" ADD COLUMN IF NOT EXISTS "actorId" TEXT;',
    );
  });

  it("ships an idempotent dedicated migration for system log actor columns", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "prisma",
        "migrations",
        "20260420131500_add_systemlog_actor_columns",
        "migration.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      'ALTER TABLE "SystemLog" ADD COLUMN IF NOT EXISTS "actorType" TEXT;',
    );
    expect(migration).toContain(
      'ALTER TABLE "SystemLog" ADD COLUMN IF NOT EXISTS "actorId" TEXT;',
    );
    expect(migration).toContain(
      'CREATE INDEX IF NOT EXISTS "SystemLog_actorType_actorId_idx" ON "SystemLog"("actorType", "actorId");',
    );
  });

  it("guards tenant schema replay when legacy push_subscriptions is already removed", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "prisma",
        "migrations",
        "20260314015651_init_tenant_schema",
        "migration.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      "IF to_regclass('public.\"push_subscriptions\"') IS NOT NULL THEN",
    );
    expect(migration).toContain(
      'ALTER TABLE "push_subscriptions" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;',
    );
    expect(migration).toContain(
      `EXECUTE 'CREATE INDEX IF NOT EXISTS "push_subscriptions_tenantId_idx" ON "push_subscriptions"("tenantId")';`,
    );
    expect(migration).toContain(
      `AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_tenantId_fkey') THEN`,
    );
    expect(migration).toContain(
      'ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;',
    );
  });

  it("suppresses PostgreSQL NOTICE spam only for idempotent SQL replays", () => {
    const migrationJob = readFileSync(
      resolve(process.cwd(), "k8s", "migration-job.yaml"),
      "utf8",
    );

    expect(migrationJob).toContain("psql_quiet_idempotent_sql()");
    expect(migrationJob).toContain('PGOPTIONS="--client-min-messages=warning"');
    expect(migrationJob).toContain(
      'psql_quiet_idempotent_sql "$RADIUS_DATABASE_URL_PSQL" prisma/radius_migrations/20260314015652_init_tenant_schema/migration.sql',
    );
    expect(migrationJob).toContain(
      'psql_quiet_idempotent_sql "$DATABASE_URL_BILLING_PSQL" prisma/billing_migrations/20260314015654_init_tenant_schema/migration.sql',
    );
    expect(migrationJob).toContain(
      'psql_quiet_idempotent_sql "$DATABASE_URL_MITRA_PSQL" prisma/mitra_migrations/20260314015655_init_tenant_schema/migration.sql',
    );
    expect(migrationJob).not.toContain(
      'PGOPTIONS="--client-min-messages=warning" prisma migrate deploy',
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

  it("requires every destructive migration to carry a safe-guard acknowledgement comment", () => {
    const withoutAcknowledgement = MIGRATION_DIRECTORIES.flatMap(
      findDestructiveMigrationsWithoutAck,
    );

    expect(withoutAcknowledgement).toEqual([]);
  });

  it("mirrors the destructive-SQL rule enforced by the migration job", () => {
    const migrationJob = readFileSync(
      resolve(process.cwd(), "k8s", "migration-job.yaml"),
      "utf8",
    );

    expect(migrationJob).toContain(DESTRUCTIVE_SQL_PATTERN.source);
    expect(migrationJob).toContain(SAFE_GUARD_ACK_PREFIX);
  });

  it("always skips optional tenant backfill steps (manual-only)", () => {
    const migrationJob = readFileSync(
      resolve(process.cwd(), "k8s", "migration-job.yaml"),
      "utf8",
    );

    expect(migrationJob).toContain(
      'if [ "${SKIP_OPTIONAL_BACKFILL:-false}" = "true" ]; then',
    );
    expect(migrationJob).toContain("name: SKIP_OPTIONAL_BACKFILL");
    expect(migrationJob).toContain('value: "true"');
    expect(migrationJob).not.toContain("{{SKIP_OPTIONAL_BACKFILL}}");
    expect(migrationJob).toContain(
      "⏭️ SKIP_OPTIONAL_BACKFILL=true, skipping optional tenant backfill and repair steps",
    );
    expect(migrationJob).toContain(
      "⏭️ Skipped optional step: multi-tenant data backfill",
    );
    expect(migrationJob).toContain(
      "⏭️ Skipped optional step: tenant provisioning fix",
    );
    expect(migrationJob).toContain(
      "⏭️ Skipped optional step: legacy data migration (NETMANAGER)",
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

  it("keeps migrate-legacy-tenant aligned with safe nullable tenant backfill rules", () => {
    const migrateLegacyTenant = readFileSync(
      resolve(process.cwd(), "scripts", "migrate-legacy-tenant.ts"),
      "utf8",
    );

    expect(migrateLegacyTenant).toContain(
      'field.name === "tenantId" && !field.isRequired',
    );
    expect(migrateLegacyTenant).toContain(
      "const uniqueFields = model.uniqueFields ?? []",
    );
    expect(migrateLegacyTenant).toContain(
      'uniqueFields.some((fields) => fields.includes("tenantId"))',
    );
    expect(migrateLegacyTenant).not.toContain(
      'model.fields.some((f) => f.name === "tenantId")',
    );
  });

  it("fails fix-tenant-provision when users cannot be re-assigned to any tenant role", () => {
    const fixTenantProvision = readFileSync(
      resolve(process.cwd(), "scripts", "fix-tenant-provision.ts"),
      "utf8",
    );

    expect(fixTenantProvision).toContain(
      'logger.info(`  ❌ No suitable role found for user "${user.name}"`)',
    );
    expect(fixTenantProvision).toContain("optionalFailureCount");
    expect(fixTenantProvision).toContain("process.exitCode = 1");
  });

  it("manages its own Prisma pool lifecycle so tenant provisioning fix can exit cleanly", () => {
    const fixTenantProvision = readFileSync(
      resolve(process.cwd(), "scripts", "fix-tenant-provision.ts"),
      "utf8",
    );

    expect(fixTenantProvision).toContain(
      'import { PrismaPg } from "@prisma/adapter-pg"',
    );
    expect(fixTenantProvision).toContain('import { Pool } from "pg"');
    expect(fixTenantProvision).toContain("await pool.end()");
    expect(fixTenantProvision).not.toContain(
      'import { prismaAuth } from "../lib/prisma"',
    );
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
    expect(backfillTenant).toContain(
      'model.name === "WorkOrderAssignments" || model.name === "WorkOrders"',
    );
    expect(backfillTenant).not.toContain("model.uniqueFields.some");
    expect(backfillTenant).not.toContain("const modelsWithTenantId");
  });

  it("skips legacy tenant migration models whose tenant backfill can collide with tenant-scoped unique constraints", () => {
    const migrateLegacyTenant = readFileSync(
      resolve(process.cwd(), "scripts", "migrate-legacy-tenant.ts"),
      "utf8",
    );

    expect(migrateLegacyTenant).toContain(
      "const uniqueFields = model.uniqueFields ?? []",
    );
    expect(migrateLegacyTenant).toContain(
      'uniqueFields.some((fields) => fields.includes("tenantId"))',
    );
    expect(migrateLegacyTenant).toContain(
      'model.name === "WorkOrderAssignments" || model.name === "WorkOrders"',
    );
  });

  it("skips legacy tenant migration models whose tenantId is now required in Prisma", () => {
    const migrateLegacyTenant = readFileSync(
      resolve(process.cwd(), "scripts", "migrate-legacy-tenant.ts"),
      "utf8",
    );

    expect(migrateLegacyTenant).toContain(
      "const prismaRequiredTenantModels = new Set([",
    );
    expect(migrateLegacyTenant).toContain('  "AttendanceEvaluation",');
    expect(migrateLegacyTenant).toContain('  "AttendanceEvaluationAudit",');
    expect(migrateLegacyTenant).toContain(
      "if (prismaRequiredTenantModels.has(model.name))",
    );
  });

  it("waits longer than the Job's own deadline so the Job decides the outcome", () => {
    // Jaminan ini dulu dijaga terhadap Jenkinsfile. Bentuknya sengaja diubah
    // dari mencocokkan angka menjadi memeriksa hubungan: kedua nilai pernah
    // berjalan sendiri-sendiri sampai batas tunggu CI justru lebih pendek
    // daripada deadline Job-nya.
    //
    // Bila CI menyerah lebih dulu, deploy dinyatakan gagal sementara Job masih
    // berjalan dan mungkin tetap menuntaskan migrasinya — basis data berubah
    // tanpa pipeline yang menyusul menerapkan manifes.
    const migrationJob = readFileSync(
      resolve(process.cwd(), "k8s", "migration-job.yaml"),
      "utf8",
    );
    const workflow = readFileSync(
      resolve(process.cwd(), ".gitea/workflows/deploy-production.yml"),
      "utf8",
    );

    const deadline = migrationJob.match(/activeDeadlineSeconds:\s*(\d+)/);
    const batasTunggu = workflow.match(
      /wait --for=condition=complete --timeout=(\d+)s job\/netmanager-migration-job/,
    );

    expect(deadline).not.toBeNull();
    expect(batasTunggu).not.toBeNull();
    expect(Number(batasTunggu![1])).toBeGreaterThan(Number(deadline![1]));
  });
});
