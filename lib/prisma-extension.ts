import { getTenantIdFromContext } from './tenant-context'
export function withTenantIsolation(ignoreModels: string[] = []) {
  return {
    name: 'tenantIsolation',
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ model, operation, args, query }: { model?: string, operation: string, args: any, query: any }) {
          if (model && ignoreModels.includes(model)) {
            return query(args)
          }

          if (process.env.IS_SEEDING === 'true') {
            return query(args)
          }

          let ctx: { tenantId: string | null; isSuperAdmin: boolean }
          try {
            ctx = await getTenantIdFromContext()
          } catch (err) {
            throw new Error(`Tenant context not available: ${err}`)
          }

          const { tenantId, isSuperAdmin } = ctx

          // PROTECTIVE FALLBACK:
          // If we are NOT a superadmin and NO tenantId was detected from context,
          // this means the request is missing proper tenant identity.
          // Rather than silently scoping to an impossible ID, throw early.
          if (!isSuperAdmin && !tenantId) {
            throw new Error('Tenant context is missing: tenantId could not be resolved. Ensure the request is made in a valid tenant context.')
          }
          const effectiveTenantId = tenantId

          if (effectiveTenantId && !isSuperAdmin) {
            const isWhereOp = [
              'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 
              'findMany', 'count', 'update', 'updateMany', 'delete', 'deleteMany',
              'groupBy', 'aggregate'
            ].includes(operation)
            
            if (isWhereOp) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ;(args as any).where = { ...(args as any).where, tenantId: effectiveTenantId };
            } else if (operation === 'create') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ;(args as any).data = { ...(args as any).data, tenantId: effectiveTenantId };
            } else if (operation === 'createMany') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if (Array.isArray((args as any).data)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ;(args as any).data = (args as any).data.map((d: Record<string, unknown>) => ({ ...d, tenantId: effectiveTenantId }));
              } else {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ;(args as any).data = { ...(args as any).data, tenantId: effectiveTenantId };
              }
            } else if (operation === 'upsert') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ;(args as any).where = { ...(args as any).where, tenantId: effectiveTenantId };
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ;(args as any).create = { ...(args as any).create, tenantId: effectiveTenantId };
            }
          }
          
          return query(args)
        }
      }
    }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}
