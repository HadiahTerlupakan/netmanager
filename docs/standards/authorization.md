# Authorization & Multi-Tenant Guide

## Single Source of Truth

- Authorization logic HANYA di `lib/rbac.ts` dan `modules/roles`
- Service layer TIDAK boleh ada authorization logic
- API route call `hasPermission()` sebelum call service
- Repository layer handle data isolation via `tenantId` filter

## Authorization Pattern

```typescript
// API Route (authorization layer)
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  // 1. Check permission
  if (!(await hasPermission("invoices:create"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses untuk membuat invoice");
  }

  // 2. Check site restriction (multi-tenant isolation)
  const { isRestricted, primarySiteId } = checkSiteRestriction(ctx.session, "invoices");
  
  // 3. Build execution context
  const execContext: ExecutionContext = {
    userId: ctx.session.user.id,
    tenantId: ctx.session.user.tenantId,
    siteId: isRestricted ? primarySiteId : body.siteId,
    permissions: ctx.session.user.permissions
  };
  
  // 4. Call service (no auth logic here)
  const result = await service.createInvoice(body, execContext);

  if (!result.success) {
    return ApiErrors.badRequest(result.error);
  }

  return apiSuccess(result.data);
});

// Service (pure business logic, no auth)
async function createInvoice(
  data: CreateInvoiceInput,
  context: ExecutionContext
): Promise<Result<Invoice>> {
  // Business logic only - context already validated by API layer
  return await repository.create({
    ...data,
    tenantId: context.tenantId,
    siteId: context.siteId,
    createdBy: context.userId
  });
}
```

## Multi-Tenant Isolation

- Repository layer WAJIB filter by `tenantId` di semua query
- Gunakan Prisma middleware untuk auto-inject `tenantId` filter (optional)
- Audit log untuk cross-tenant access attempts
- Never trust client-provided `tenantId` - always use from session

## ExecutionContext Pattern

```typescript
// Execution context type
type ExecutionContext = {
  userId: string;
  tenantId: string;
  siteId?: string | null;
  permissions: string[];
  metadata?: Record<string, unknown>;
};

// API route builds context once
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const context: ExecutionContext = {
    userId: ctx.session.user.id,
    tenantId: ctx.session.user.tenantId,
    siteId: ctx.session.user.siteId,
    permissions: ctx.session.user.permissions
  };

  const result = await service.createInvoice(body, context);
  return apiSuccess(result.data);
});

// Service receives context
async function createInvoice(
  data: CreateInvoiceInput,
  context: ExecutionContext
): Promise<Result<Invoice>> {
  // Auto-inject tenantId from context
  const invoice = await repository.create({
    ...data,
    tenantId: context.tenantId,
    createdBy: context.userId
  });

  // Pass context to other services
  await notificationService.sendInvoiceCreated(invoice, context);

  return { success: true, data: invoice };
}
```

## Prisma Middleware (Alternative)

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Auto-inject tenantId di semua query
prisma.$use(async (params, next) => {
  const tenantId = getCurrentTenantId(); // From AsyncLocalStorage or context

  if (!tenantId) {
    throw new Error("tenantId is required for all database operations");
  }

  // Inject tenantId untuk create/update
  if (params.action === 'create' || params.action === 'update') {
    if (!params.args.data.tenantId) {
      params.args.data.tenantId = tenantId;
    }
  }

  // Inject tenantId filter untuk read operations
  if (['findMany', 'findFirst', 'findUnique', 'count'].includes(params.action)) {
    params.args.where = { ...params.args.where, tenantId };
  }

  return next(params);
});

export { prisma };
```
