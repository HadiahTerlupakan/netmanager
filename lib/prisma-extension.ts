import { getTenantIdFromContext } from './tenant-context'

/**
 * Prisma Extension for Multi-tenancy isolation.
 * Based on Prisma 7 best practices (2025/2026).
 */
export function withTenantIsolation(ignoreModels: string[] = []) {
  return {
    name: 'tenantIsolation',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }: { model?: string, operation: string, args: Record<string, unknown>, query: (args: unknown) => Promise<unknown> }) {
          // 1. Check for ignored models (system tables)
          if (model && ignoreModels.includes(model)) {
            return query(args)
          }

          // 2. Bypass for seeding or critical internal tasks
          if (process.env.IS_SEEDING === 'true') {
            return query(args)
          }

          // 3. Resolve Tenant Context
          let ctx: { tenantId: string | null; isSuperAdmin: boolean }
          try {
            ctx = await getTenantIdFromContext()
          } catch (err) {
            // High security: fail closed if context resolution errors out
            throw new Error(`Critical: Failed to resolve tenant context: ${err}`)
          }

          const { tenantId, isSuperAdmin } = ctx

          // 4. Security Enforcement: If not superadmin and no tenant resolved, reject request
          if (!isSuperAdmin && !tenantId) {
            throw new Error('Security Breach: Attempted data access without valid tenant context.')
          }

          // 5. Automatic Filter Injection (Bypassed for Super Admin)
          if (tenantId && !isSuperAdmin) {
            const isReadOp = [
              'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 
              'findMany', 'count', 'groupBy', 'aggregate'
            ].includes(operation)
            
            const isWriteOp = ['update', 'updateMany', 'delete', 'deleteMany'].includes(operation)

            if (isReadOp || isWriteOp) {
              // Inject tenantId filter to ensure user only sees/touches their own data
              args.where = { ...(args.where as Record<string, unknown>), tenantId };
            }

            if (operation === 'create') {
              // Ensure newly created data belongs to the correct tenant
              args.data = { ...(args.data as Record<string, unknown>), tenant: { connect: { id: tenantId } } };
            } else if (operation === 'createMany') {
              if (Array.isArray(args.data)) {
                args.data = (args.data as Record<string, unknown>[]).map((d) => ({ ...d, tenantId }));
              } else {
                args.data = { ...(args.data as Record<string, unknown>), tenantId };
              }
            } else if (operation === 'upsert') {
              args.where = { ...(args.where as Record<string, unknown>), tenantId };
              args.create = { ...(args.create as Record<string, unknown>), tenant: { connect: { id: tenantId } } };
              // Protection: Do NOT allow updating tenantId in upsert
              const updateArgs = args.update as Record<string, unknown> | undefined;
              if (updateArgs) {
                delete updateArgs.tenantId;
              }
            }

            // 6. Immutability Protection: Mencegah perubahan tenantId pada operasi update
            if (operation === 'update' || operation === 'updateMany') {
              const dataArgs = args.data as Record<string, unknown> | undefined;
              if (dataArgs && dataArgs.tenantId !== undefined) {
                // Hapus upaya pengubahan tenantId jika bukan superadmin
                delete dataArgs.tenantId;
                // Kita juga bisa melempar error jika ingin lebih ketat:
                // throw new Error('Action Denied: tenantId is immutable and cannot be changed.');
              }
            }
          }
          
          return query(args)
        }
      }
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}
