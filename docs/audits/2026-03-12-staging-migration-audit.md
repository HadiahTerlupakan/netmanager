# Staging Migration Failure Audit

## Scope

Audit the Jenkins deployment failure that stops in the Kubernetes migration job with:

`Pipeline dihentikan: destructive migration detected in unapplied migrations!`

## What Is Confirmed

1. The failure does not come from checkout, tests, typecheck, image build, or K3s image import.
2. The failure happens inside the migration job defined in `netmanager/k8s/migration-job.yaml`.
3. The job runs a Node-based safe-guard before any `prisma migrate deploy` command.
4. The safe-guard reads pending migrations from `prisma migrate status` across four databases:
   - `DATABASE_URL` (main)
   - `RADIUS_DATABASE_URL`
   - `DATABASE_URL_BILLING`
   - `DATABASE_URL_MITRA`
5. If any pending migration contains SQL that matches the destructive-pattern regex, the job exits with status 1 and Jenkins fails the deployment.

## Root-Cause Model

The most likely root cause is migration-history drift across a split multi-database setup.

- The repository contains historical destructive migrations in `prisma/migrations/` for the main database.
- The staging environment appears to have schema state that does not fully match Prisma migration history.
- `radius`, `billing`, and `mitra` also show pending init/history from Prisma's perspective.
- Because the job blocks before applying anything, the failure is a preventive safety stop, not a partially applied migration.

## Evidence

### 1. The guard intentionally stops deployment

`netmanager/k8s/migration-job.yaml` writes and runs `/tmp/safe-guard.js` before `prisma migrate deploy`.

The guard:

- calls `prisma migrate status`
- extracts unapplied migration names
- reads `migration.sql` files
- matches destructive patterns like `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, and generic `ALTER TABLE ... ALTER COLUMN`
- exits with code 1 if any pending migration matches

### 2. Historical migrations include real destructive SQL

Confirmed examples in `prisma/migrations/`:

- `20260227050955_add_rab_approval`
- `20260305054548_sync_schema_fcm_tokens`

These files drop real tables, columns, enums, and foreign keys. The guard is not inventing risk here.

### 3. The repo contains drift-producing operational paths

Confirmed drift vectors:

- `netmanager/deploy.sh`
  - fallback uses `prisma db push --accept-data-loss`
  - then loops `prisma migrate resolve --applied` over migration folders
- `netmanager/app/api/settings/backup/import/route.ts`
  - drops and recreates schema
  - restores SQL dump
  - runs `prisma db push --accept-data-loss`
- `netmanager/app/api/settings/backup/reset/route.ts`
  - drops and recreates schema
  - runs `prisma db push --accept-data-loss`

These flows can leave the schema present while `_prisma_migrations` is incomplete, synthetic, or missing.

### 4. Guard precision is conservative, not exact

The guard can over-report risk in some cases:

- commented `DROP ...` text in migration warnings can still match
- benign `ALTER COLUMN` changes can still match the broad regex

This matters, but it does not overturn the main diagnosis because genuinely destructive pending migrations also exist.

## What Is Not Yet Proven

The audit does not yet prove which of these is true for staging:

1. The database is already schema-equivalent and only migration history is missing.
2. The database is partially migrated and genuinely unsafe for destructive apply.
3. One or more logical DB configs point to the wrong physical database.
4. A restore/reset path recently recreated schema without preserving `_prisma_migrations`.

## Safe Conclusions

1. Do not disable the guard first.
2. Do not use `prisma migrate resolve --applied` blindly.
3. Do not assume build/test success says anything about database correctness.
4. Reconciliation must be done per database, not globally.

## Required Next Validation

Before any fix is applied, the team must verify:

1. exact database target mapping for all four Prisma configs
2. live contents of `_prisma_migrations` in each database
3. whether split databases are empty, live, or already schema-equivalent
4. whether main-db tables targeted by destructive migrations have already been safely moved
5. whether `prisma migrate diff` shows zero schema drift before any baseline action

## Read-Only Verification Run Result

The planned read-only verification has now been executed against staging from inside `deploy/netmanager-app` using `KUBECONFIG=$HOME/.kube/config-staging`.

Confirmed result:

1. all four logical Prisma configs point to distinct physical databases
2. all four staging databases are schema-aligned with the current Prisma datamodels (`No difference detected`)
3. all four staging databases are missing `_prisma_migrations`
4. main no longer contains split-domain tables like `Mitra`, `Invoice`, or `radacct`
5. representative split-db data exists at least in `mitra`, while `radius` and `billing` are structurally present but empty on the sampled tables

This narrows the safest remediation path to migration-history reconciliation, not execution of pending historical migrations.

## Recommended Fix Direction

Use the implementation plan in `netmanager/docs/plans/2026-03-12-prisma-migration-reconciliation.md`.

That plan intentionally starts with read-only verification and only allows `resolve --applied` after schema equivalence is proven.

## Remediation Status

The fix has now been executed in staging.

- Prisma migration history was baselined with `migrate resolve --applied` against the already-matching live schemas.
- All four databases now have `_prisma_migrations` entries aligned with their filesystem migration history.
- `prisma migrate status` is clean in all four databases.
- `prisma migrate deploy` is now a no-op in all four databases.

Operationally, this specific Jenkins failure condition is resolved.
