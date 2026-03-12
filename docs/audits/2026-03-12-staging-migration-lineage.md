# Staging Migration Lineage Verification

## Execution Context

- Workspace: `.worktrees/staging-migration-audit`
- Cluster access: `KUBECONFIG=$HOME/.kube/config-staging`
- In-cluster execution target: `deploy/netmanager-app` in namespace `netmanager-staging`

## Database Mapping

Sanitized values from `netmanager-secrets`:

- `DATABASE_URL` -> `db-netmanager:5432/netmanager`
- `RADIUS_DATABASE_URL` -> `db-radius:5432/radius`
- `DATABASE_URL_BILLING` -> `db-billing:5432/billing`
- `DATABASE_URL_MITRA` -> `db-mitra:5432/mitra`

Each logical Prisma config points to a distinct Postgres service.

## Prisma View Of Migration History

`prisma migrate status` from inside the app pod reports:

- main: 73 pending migrations (`20251105130408_init` through `20260309143830_add_invoice_fields_to_expense`)
- radius: 1 pending migration (`20260221234443_init`)
- billing: 1 pending migration (`20260306060000_init`)
- mitra: 2 pending migrations (`20260306060000_init`, `202603081309_add_mitra_version_tracking`)

## `_prisma_migrations` Reality

The metadata table is missing in every staging database.

- main: `_prisma_migrations` absent
- radius: `_prisma_migrations` absent
- billing: `_prisma_migrations` absent
- mitra: `_prisma_migrations` absent

This is a history-absence problem, not a partially populated migration ledger.

## Live Schema Summary

- main (`netmanager`)
  - `public_tables = 117`
  - split tables absent: `Mitra`, `Invoice`, `radacct`
- radius (`radius`)
  - `public_tables = 9`
  - representative table present: `radacct`
- billing (`billing`)
  - `public_tables = 12`
  - representative table present: `Invoice`
- mitra (`mitra`)
  - `public_tables = 5`
  - representative table present: `Mitra`

## Representative Data Counts

- radius: `radacct = 0`
- billing: `Invoice = 0`
- mitra: `Mitra = 2`

Main no longer contains the split tables at all.

## Prisma Drift Check

Using Prisma 7 syntax from inside the app pod:

- `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`
- `npx prisma migrate diff --config=prisma.radius.config.ts --from-config-datasource --to-schema prisma/schema.radius.prisma --exit-code`
- `npx prisma migrate diff --config=prisma.billing.config.ts --from-config-datasource --to-schema prisma/billing.prisma --exit-code`
- `npx prisma migrate diff --config=prisma.mitra.config.ts --from-config-datasource --to-schema prisma/mitra.prisma --exit-code`

All four returned `No difference detected.`

## Conclusion

Staging databases already match the current Prisma datamodels, but Prisma migration history was never initialized or was lost later. The immediate repair path is controlled migration-history reconciliation (`migrate resolve --applied` / baseline), not executing destructive historical migrations.

## Remediation Executed

Applied migration-history baseline from inside `deploy/netmanager-app`:

- main: marked 73 migrations as applied
- radius: marked 1 migration as applied
- billing: marked 1 migration as applied
- mitra: marked 2 migrations as applied

## Post-Fix Verification

- `prisma migrate status` now reports `Database schema is up to date!` for all four databases.
- `_prisma_migrations` counts now match filesystem history:
  - main: `73`
  - radius: `1`
  - billing: `1`
  - mitra: `2`
- `prisma migrate deploy` now reports `No pending migrations to apply.` for all four databases.
- `prisma migrate diff --from-config-datasource --to-schema ... --exit-code` still reports `No difference detected.` for all four databases.
