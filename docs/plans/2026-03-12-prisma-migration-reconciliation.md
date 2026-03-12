# Prisma Migration Reconciliation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Safely reconcile Prisma migration history and database state in staging so the Jenkins migration gate can pass without risking destructive changes on the wrong schema.

**Architecture:** Start with read-only verification of database targets, schema contents, and `_prisma_migrations` lineage for `main`, `radius`, `billing`, and `mitra`. Use that evidence to choose the least-destructive reconciliation path per database, then re-run the migration gate in validation mode before any real deployment.

**Tech Stack:** Jenkins, Kubernetes Jobs, Prisma Migrate, PostgreSQL, Next.js admin routes, shell tooling

---

### Task 1: Verify Database Mapping Per Logical Service

**Files:**
- Read: `netmanager/k8s/migration-job.yaml`
- Read: `netmanager/Jenkinsfile`
- Read: `netmanager/prisma.config.ts`
- Read: `netmanager/prisma.radius.config.ts`
- Read: `netmanager/prisma.billing.config.ts`
- Read: `netmanager/prisma.mitra.config.ts`
- Read: cluster secrets/configmaps that provide `DATABASE_URL` values

**Step 1: Capture the effective connection target for each logical DB**

Run:

```bash
kubectl get configmap netmanager-config -n netmanager-staging -o yaml
kubectl get secret -n netmanager-staging
```

Expected: you can identify which secret/config source populates `main`, `radius`, `billing`, and `mitra` database URLs.

**Step 2: Confirm Prisma config-to-database mapping**

Run:

```bash
npx prisma migrate status
npx prisma migrate status --config=prisma.radius.config.ts
npx prisma migrate status --config=prisma.billing.config.ts
npx prisma migrate status --config=prisma.mitra.config.ts
```

Expected: each command points to the intended physical database, not the same database reused accidentally.

**Step 3: Record results**

Save a short audit note listing logical DB -> actual host/database/schema mapping.

### Task 2: Snapshot Read-Only Migration Lineage

**Files:**
- Read: `netmanager/prisma/migrations/`
- Read: `netmanager/prisma/radius_migrations/`
- Read: `netmanager/prisma/billing_migrations/`
- Read: `netmanager/prisma/mitra_migrations/`
- Create: `docs/audits/2026-03-12-staging-migration-lineage.md`

**Step 1: Dump `_prisma_migrations` for every database**

Run:

```bash
psql "$DATABASE_URL" -c 'select migration_name, finished_at, rolled_back_at from "_prisma_migrations" order by migration_name;'
psql "$RADIUS_DATABASE_URL" -c 'select migration_name, finished_at, rolled_back_at from "_prisma_migrations" order by migration_name;'
psql "$DATABASE_URL_BILLING" -c 'select migration_name, finished_at, rolled_back_at from "_prisma_migrations" order by migration_name;'
psql "$DATABASE_URL_MITRA" -c 'select migration_name, finished_at, rolled_back_at from "_prisma_migrations" order by migration_name;'
```

Expected: exact migration history for each DB, or proof that the table is missing.

**Step 2: Capture Prisma's own view of pending history**

Run:

```bash
npx prisma migrate status || true
npx prisma migrate status --config=prisma.radius.config.ts || true
npx prisma migrate status --config=prisma.billing.config.ts || true
npx prisma migrate status --config=prisma.mitra.config.ts || true
```

Expected: a list of pending migrations that can be compared directly with `_prisma_migrations` contents.

**Step 3: Save the audit artifact**

Write the pending-vs-applied comparison to `docs/audits/2026-03-12-staging-migration-lineage.md`.

### Task 3: Determine Whether Each Split Database Is Empty, Live, or Drifted

**Files:**
- Read: `netmanager/prisma/radius_migrations/20260221234443_init/migration.sql`
- Read: `netmanager/prisma/billing_migrations/20260306060000_init/migration.sql`
- Read: `netmanager/prisma/mitra_migrations/20260306060000_init/migration.sql`
- Read: `netmanager/prisma/mitra_migrations/202603081309_add_mitra_version_tracking/migration.sql`

**Step 1: Inspect object existence in each split DB**

Run:

```bash
psql "$RADIUS_DATABASE_URL" -c "select tablename from pg_tables where schemaname='public' order by tablename;"
psql "$DATABASE_URL_BILLING" -c "select tablename from pg_tables where schemaname='public' order by tablename;"
psql "$DATABASE_URL_MITRA" -c "select tablename from pg_tables where schemaname='public' order by tablename;"
```

Expected: classify each DB as empty, initialized, or partially initialized.

**Step 2: Inspect row counts for representative tables**

Run:

```bash
psql "$RADIUS_DATABASE_URL" -c 'select count(*) from radacct;'
psql "$DATABASE_URL_BILLING" -c 'select count(*) from "Invoice";'
psql "$DATABASE_URL_MITRA" -c 'select count(*) from "Mitra";'
```

Expected: determine whether these databases already contain live data.

**Step 3: Compare live schema to expected Prisma end state before any baseline**

Run:

```bash
npx prisma migrate diff --config=prisma.radius.config.ts --from-config-datasource --to-schema prisma/schema.radius.prisma --exit-code
npx prisma migrate diff --config=prisma.billing.config.ts --from-config-datasource --to-schema prisma/billing.prisma --exit-code
npx prisma migrate diff --config=prisma.mitra.config.ts --from-config-datasource --to-schema prisma/mitra.prisma --exit-code
```

Expected: exit code `0` / `No difference detected.` or an explicit schema diff that must be reconciled first.

**Step 4: Make a per-DB decision**

- Empty DB: init migration may be safe to apply normally.
- Non-empty DB with matching schema: baseline or `migrate resolve --applied` may be appropriate.
- Non-empty DB with mismatched schema: stop and reconcile manually before any migration action.

### Task 4: Validate Main-DB Destructive Migration Preconditions

**Files:**
- Read: `netmanager/prisma/migrations/20260227050955_add_rab_approval/migration.sql`
- Read: `netmanager/prisma/migrations/20260305054548_sync_schema_fcm_tokens/migration.sql`
- Read: application modules that now use billing/mitra/radius Prisma clients

**Step 1: Confirm the data has actually moved off `main`**

Run representative checks:

```bash
psql "$DATABASE_URL" -c 'select to_regclass('"'"'public."Mitra"'"'"'), to_regclass('"'"'public."Invoice"'"'"'), to_regclass('"'"'public.radacct'"'"');'
psql "$DATABASE_URL_MITRA" -c 'select count(*) from "Mitra";'
psql "$DATABASE_URL_BILLING" -c 'select count(*) from "Invoice";'
psql "$RADIUS_DATABASE_URL" -c 'select count(*) from radacct;'
```

Expected: evidence that dropped tables in `main` are either already absent there for the right reason, or that their data is safely present in target databases.

**Step 2: Refuse destructive apply if evidence is incomplete**

Expected: if any target DB is empty or mismatched while `main` still holds live tables, do not unblock destructive `main` migrations.

**Step 3: Compare main-db schema to expected Prisma state before any baseline choice**

Run:

```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```

Expected: exit code `0` / `No difference detected.` or an explicit schema diff that proves `main` still needs real reconciliation work.

### Task 5: Choose the Correct Reconciliation Path Per Database

**Files:**
- Modify later if needed: `netmanager/k8s/migration-job.yaml`
- Modify later if needed: `netmanager/deploy.sh`
- Modify later if needed: `netmanager/app/api/settings/backup/import/route.ts`
- Modify later if needed: `netmanager/app/api/settings/backup/reset/route.ts`

**Step 1: Pick one of three paths for each DB**

- Path A: truly empty -> run `prisma migrate deploy` normally.
- Path B: non-empty but schema-equivalent and confirmed by `prisma migrate diff` -> mark historical migrations as applied with `prisma migrate resolve --applied <name>`.
- Path C: non-empty and not schema-equivalent -> stop deployment work and do a dedicated reconciliation project.

**Step 2: Document the decision and proof**

For every DB, record the chosen path and the exact evidence used.

### Task 6: Audit Guard False Positives Separately From Real Risk

**Files:**
- Read: `netmanager/k8s/migration-job.yaml`
- Read: `netmanager/prisma/migrations/20260111142908_add_composite_indexes_inventory/migration.sql`
- Read: `netmanager/prisma/migrations/20251230000000_catchup_user_table/migration.sql`

**Step 1: Confirm whether comment text or benign ALTERs are being flagged**

Expected: identify whether false positives exist in addition to the real destructive migrations.

**Step 2: Defer guard changes until after lineage is reconciled**

Expected: do not weaken the guard first, because real destructive migrations are still present in pending history.

### Task 7: Re-run Validation Before Any Real Fix Deployment

**Files:**
- Read: `netmanager/k8s/migration-job.yaml`
- Test: staging migration job logs

**Step 1: Re-run `prisma migrate status` for all DBs after reconciliation**

Run:

```bash
npx prisma migrate status
npx prisma migrate status --config=prisma.radius.config.ts
npx prisma migrate status --config=prisma.billing.config.ts
npx prisma migrate status --config=prisma.mitra.config.ts
```

Expected: pending history is now explainable and limited to migrations that are truly safe to apply.

**Step 2: Re-run the Jenkins migration gate or equivalent K8s Job in a validation-first cycle**

Expected: the gate passes without bypassing safety checks.

### Task 8: Prevent Drift From Reappearing

**Files:**
- Modify: `netmanager/deploy.sh`
- Modify: `netmanager/app/api/settings/backup/import/route.ts`
- Modify: `netmanager/app/api/settings/backup/reset/route.ts`
- Modify: `netmanager/docs/deployment/` docs if needed

**Step 1: Remove or constrain production-like `db push` flows**

Expected: operational paths stop creating schema without migration history.

**Step 2: Replace ad-hoc reconciliation with explicit, auditable procedures**

Expected: future restores/resets either preserve `_prisma_migrations` or explicitly baseline afterward.
