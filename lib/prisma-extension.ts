/**
 * Prisma Extension for Multi-tenancy isolation.
 * Based on Prisma 7 best practices (2025/2026).
 */

/**
 * Error class internal yang menandakan kegagalan resolusi tenant context atau
 * upaya akses data tanpa konteks valid. Why: pesan error mentah seperti
 * "Security Breach: ..." dapat ter-bubble ke client dan membocorkan mekanisme
 * isolasi internal kepada attacker. Class ini ditangkap di centralized
 * handleError (lib/api/handler.ts) dan diterjemahkan ke 401/403 generik —
 * detail hanya masuk ke logger.
 *
 * How to apply: throw `TenantContextError` daripada `new Error(...)` di
 * jalur isolasi tenant. Lihat handleError untuk integrasi response.
 */
export class TenantContextError extends Error {
  readonly kind: "missing-context" | "resolution-failed";

  constructor(
    kind: "missing-context" | "resolution-failed",
    detail: string,
    options?: { cause?: unknown },
  ) {
    super(detail);
    this.name = "TenantContextError";
    this.kind = kind;
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

const READ_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "groupBy",
  "aggregate",
]);

const WRITE_OPERATIONS = new Set([
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

const GLOBAL_REFERENCE_MODELS = new Set(["Role", "Departments", "Sites"]);

function buildTenantReadWhere(
  model: string | undefined,
  where: Record<string, unknown> | undefined,
  tenantId: string,
  operation?: string,
) {
  if (model && GLOBAL_REFERENCE_MODELS.has(model)) {
    const isUniqueOp =
      operation === "findUnique" || operation === "findUniqueOrThrow";

    if (isUniqueOp) {
      return {
        ...(where ?? {}),
        OR: [{ tenantId }, { tenantId: null }],
      };
    }

    return {
      AND: [
        where ?? {},
        {
          OR: [{ tenantId }, { tenantId: null }],
        },
      ],
    };
  }

  return {
    ...(where ?? {}),
    tenantId,
  };
}

function applyTenantToCreateData(
  data: Record<string, unknown> | undefined,
  tenantId: string,
) {
  if (!data) {
    return data;
  }

  const nextData = { ...data };
  delete nextData.tenantId;
  delete nextData.tenant;

  return {
    ...nextData,
    tenantId,
  };
}

function removeTenantMutationFields(data: Record<string, unknown> | undefined) {
  if (!data) {
    return data;
  }

  const nextData = { ...data };
  delete nextData.tenantId;
  delete nextData.tenant;
  return nextData;
}

function applyTenantToCreateManyData(
  data: Record<string, unknown> | Record<string, unknown>[] | undefined,
  tenantId: string,
) {
  if (!data) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => {
      const nextItem = { ...item };
      delete nextItem.tenant;
      return { ...nextItem, tenantId };
    });
  }

  const nextItem = { ...data };
  delete nextItem.tenant;
  return { ...nextItem, tenantId };
}

function buildTenantUpsertWhere(
  where: Record<string, unknown> | undefined,
  tenantId: string,
) {
  return {
    ...(where ?? {}),
    tenantId,
  };
}

function buildTenantWriteWhere(
  where: Record<string, unknown> | undefined,
  tenantId: string,
) {
  return {
    ...(where ?? {}),
    tenantId,
  };
}

function isNonSuperAdminTenant(
  tenantId: string | null,
  isSuperAdmin: boolean,
): tenantId is string {
  return Boolean(tenantId) && !isSuperAdmin;
}

export function withTenantIsolation(ignoreModels: string[] = []) {
  return {
    name: "tenantIsolation",
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model?: string;
          operation: string;
          args: Record<string, unknown>;
          query: (args: unknown) => Promise<unknown>;
        }) {
          // 1. Check for ignored models (system tables)
          if (model && ignoreModels.includes(model)) {
            return query(args);
          }

          // 2. Bypass for seeding or critical internal tasks.
          // IS_SEEDING dimaksudkan hanya untuk script seed lokal/CI yang
          // mem-bootstrap data lintas tenant. Jika flag ini aktif di
          // NODE_ENV=production, itu indikasi misconfiguration berbahaya
          // (env bocor ke pod produksi) — fail loudly sebelum menyentuh data.
          if (process.env.IS_SEEDING === "true") {
            if (process.env.NODE_ENV === "production") {
              throw new TenantContextError(
                "missing-context",
                "IS_SEEDING=true is forbidden in production. This flag is for seed scripts only.",
              );
            }
            return query(args);
          }

          // 3. Resolve Tenant Context
          let ctx: { tenantId: string | null; isSuperAdmin: boolean };
          try {
            const { getTenantIdFromContext } = await import("./tenant-context");
            ctx = await getTenantIdFromContext();
          } catch (err) {
            // High security: fail closed if context resolution errors out.
            // Detail tidak boleh ter-bubble ke client; pakai TenantContextError
            // agar handleError menerjemahkannya ke 500 generik.
            throw new TenantContextError(
              "resolution-failed",
              `Failed to resolve tenant context for ${model ?? "unknown"}.${operation}`,
              { cause: err },
            );
          }

          const { tenantId, isSuperAdmin } = ctx;

          // 4. Security Enforcement: If not superadmin and no tenant resolved, reject request
          if (!isSuperAdmin && !tenantId) {
            throw new TenantContextError(
              "missing-context",
              `Attempted data access without valid tenant context: ${model ?? "unknown"}.${operation}`,
            );
          }

          // 5. Automatic Filter Injection
          if (tenantId) {
            const isReadOp = READ_OPERATIONS.has(operation);
            const isWriteOp = WRITE_OPERATIONS.has(operation);

            if (isNonSuperAdminTenant(tenantId, isSuperAdmin)) {
              if (isReadOp) {
                args.where = buildTenantReadWhere(
                  model,
                  args.where as Record<string, unknown> | undefined,
                  tenantId,
                  operation,
                );
              } else if (isWriteOp) {
                args.where = buildTenantWriteWhere(
                  args.where as Record<string, unknown> | undefined,
                  tenantId,
                );
              }

              if (operation === "upsert") {
                args.where = buildTenantUpsertWhere(
                  args.where as Record<string, unknown> | undefined,
                  tenantId,
                );
              }

              if (operation === "update" || operation === "updateMany") {
                args.data = removeTenantMutationFields(
                  args.data as Record<string, unknown> | undefined,
                );
              }

              if (operation === "create") {
                args.data = applyTenantToCreateData(
                  args.data as Record<string, unknown> | undefined,
                  tenantId,
                );
              } else if (operation === "createMany") {
                args.data = applyTenantToCreateManyData(
                  args.data as
                    | Record<string, unknown>
                    | Record<string, unknown>[]
                    | undefined,
                  tenantId,
                );
              } else if (operation === "upsert") {
                args.create = applyTenantToCreateData(
                  args.create as Record<string, unknown> | undefined,
                  tenantId,
                );
                args.update = removeTenantMutationFields(
                  args.update as Record<string, unknown> | undefined,
                );
              }
            } else if (operation === "create") {
              const dataArgs = args.data as Record<string, unknown> | undefined;
              if (
                dataArgs &&
                dataArgs.tenantId === undefined &&
                dataArgs.tenant === undefined
              ) {
                args.data = { ...dataArgs, tenantId };
              }
            } else if (operation === "createMany") {
              if (Array.isArray(args.data)) {
                args.data = (args.data as Record<string, unknown>[]).map((d) =>
                  d.tenantId === undefined ? { ...d, tenantId } : d,
                );
              } else {
                const dataArgs = args.data as
                  | Record<string, unknown>
                  | undefined;
                if (dataArgs && dataArgs.tenantId === undefined) {
                  args.data = { ...dataArgs, tenantId };
                }
              }
            } else if (operation === "upsert") {
              const createArgs = args.create as
                | Record<string, unknown>
                | undefined;
              if (
                createArgs &&
                createArgs.tenantId === undefined &&
                createArgs.tenant === undefined
              ) {
                args.create = { ...createArgs, tenantId };
              }

              if (!isSuperAdmin) {
                args.update = removeTenantMutationFields(
                  args.update as Record<string, unknown> | undefined,
                );
              }
            }
          }

          return query(args);
        },
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}
