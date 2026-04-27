/**
 * Prisma Extension for Multi-tenancy isolation.
 * Based on Prisma 7 best practices (2025/2026).
 */
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

          // 2. Bypass for seeding or critical internal tasks
          if (process.env.IS_SEEDING === "true") {
            return query(args);
          }

          // 3. Resolve Tenant Context
          let ctx: { tenantId: string | null; isSuperAdmin: boolean };
          try {
            const { getTenantIdFromContext } = await import("./tenant-context");
            ctx = await getTenantIdFromContext();
          } catch (err) {
            // High security: fail closed if context resolution errors out
            throw new Error(
              `Critical: Failed to resolve tenant context: ${err}`,
            );
          }

          const { tenantId, isSuperAdmin } = ctx;

          // 4. Security Enforcement: If not superadmin and no tenant resolved, reject request
          if (!isSuperAdmin && !tenantId) {
            throw new Error(
              "Security Breach: Attempted data access without valid tenant context.",
            );
          }

          // 5. Automatic Filter Injection
          if (tenantId) {
            const isReadOp = [
              "findUnique",
              "findUniqueOrThrow",
              "findFirst",
              "findFirstOrThrow",
              "findMany",
              "count",
              "groupBy",
              "aggregate",
            ].includes(operation);

            const isWriteOp = [
              "update",
              "updateMany",
              "delete",
              "deleteMany",
            ].includes(operation);

            // For reads and updates/deletes, ONLY filter if NOT superadmin.
            // SuperAdmins can read/write across all tenants.
            if (!isSuperAdmin) {
              if (isReadOp || isWriteOp) {
                // Inject tenantId filter to ensure user only sees/touches their own data
                args.where = {
                  ...(args.where as Record<string, unknown>),
                  tenantId,
                };
              }

              if (operation === "upsert") {
                args.where = {
                  ...(args.where as Record<string, unknown>),
                  tenantId,
                };
              }

              // 6. Immutability Protection: Mencegah perubahan tenantId pada operasi update
              if (operation === "update" || operation === "updateMany") {
                const dataArgs = args.data as
                  | Record<string, unknown>
                  | undefined;
                if (dataArgs && dataArgs.tenantId !== undefined) {
                  // Hapus upaya pengubahan tenantId jika bukan superadmin
                  delete dataArgs.tenantId;
                }
              }
            }

            // For creates, ALWAYS inject the tenantId if it's not explicitly provided,
            // even for SuperAdmins, so newly created records belong to their active tenant context.
            if (operation === "create") {
              const dataArgs = args.data as Record<string, unknown> | undefined;
              // Add tenant relation, unless they already provided tenant or tenantId
              if (
                dataArgs &&
                dataArgs.tenantId === undefined &&
                dataArgs.tenant === undefined
              ) {
                // Determine if we need to use relation syntax (CreateInput) or scalar flat syntax (UncheckedCreateInput)
                const hasRelationPayload = (
                  obj: Record<string, unknown> | null | undefined,
                ): boolean => {
                  if (!obj || typeof obj !== "object") return false;
                  for (const key in obj) {
                    if (obj[key] && typeof obj[key] === "object") {
                      if (
                        "connect" in obj[key] ||
                        "create" in obj[key] ||
                        "connectOrCreate" in obj[key]
                      ) {
                        return true;
                      }
                    }
                  }
                  return false;
                };

                if (hasRelationPayload(dataArgs)) {
                  args.data = {
                    ...dataArgs,
                    tenant: { connect: { id: tenantId } },
                  };
                } else {
                  args.data = { ...dataArgs, tenantId };
                }
              }
            } else if (operation === "createMany") {
              // createMany only takes scalars, so tenantId is strictly required here
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
                const hasRelationPayload = (
                  obj: Record<string, unknown> | null | undefined,
                ): boolean => {
                  if (!obj || typeof obj !== "object") return false;
                  for (const key in obj) {
                    if (obj[key] && typeof obj[key] === "object") {
                      if (
                        "connect" in obj[key] ||
                        "create" in obj[key] ||
                        "connectOrCreate" in obj[key]
                      ) {
                        return true;
                      }
                    }
                  }
                  return false;
                };
                if (hasRelationPayload(createArgs)) {
                  args.create = {
                    ...createArgs,
                    tenant: { connect: { id: tenantId } },
                  };
                } else {
                  args.create = { ...createArgs, tenantId };
                }
              }

              if (!isSuperAdmin) {
                const updateArgs = args.update as
                  | Record<string, unknown>
                  | undefined;
                if (updateArgs && updateArgs.tenantId !== undefined) {
                  delete updateArgs.tenantId;
                }
                if (updateArgs && updateArgs.tenant !== undefined) {
                  delete updateArgs.tenant;
                }
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
