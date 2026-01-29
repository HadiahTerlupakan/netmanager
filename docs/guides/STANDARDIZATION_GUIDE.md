# NetManager API Standardization Guide

## Overview

This guide documents the standardized patterns for API development in NetManager. These patterns address the Priority 1 (CRITICAL) issues identified in the comprehensive application audit.

## Table of Contents

1. [Middleware Stack](#middleware-stack)
2. [Authentication Patterns](#authentication-patterns)
3. [Permission Checking](#permission-checking)
4. [RBAC Filtering](#rbac-filtering)
5. [Validation](#validation)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Response Formats](#response-formats)
9. [Migration Guide](#migration-guide)
10. [Best Practices](#best-practices)

---

## Middleware Stack

All new middleware is located in `lib/middleware/`:

```typescript
import {
  // Authentication
  withAuth,
  withAdminAuth,
  withEmployeeAuth,
  withOptionalAuth,

  // Permissions
  withPermission,
  withAnyPermission,
  withAllPermissions,

  // RBAC Filtering
  applySiteRestriction,
  applyDepartmentRestriction,
  applyRBACRestrictions,

  // Error Handling
  withErrorHandler,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,

  // Rate Limiting
  withRateLimit,
  withAuthRateLimit,
  RateLimits,
} from "@/lib/middleware";
```

---

## Authentication Patterns

### ❌ OLD Pattern (Inconsistent)

```typescript
// Multiple different patterns across codebase
import { requireAdmin } from "@/lib/auth-helpers";
import { getServerSession } from "next-auth";
import { verifyAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  // Pattern 1: requireAdmin
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) {
    return session;
  }

  // Pattern 2: getServerSession
  const session = await getServerSession(authOptions);
  if (!session) {
    return ApiErrors.unauthorized();
  }

  // Pattern 3: verifyAuth
  const user = await verifyAuth(request);
  if (!user) {
    return ApiErrors.unauthorized();
  }

  // Business logic...
}
```

### ✅ NEW Pattern (Standardized)

```typescript
import { withAuth, withErrorHandler } from "@/lib/middleware";
import { apiSuccess } from "@/lib/api-response";

export const GET = withErrorHandler(
  withAuth(async ({ user, request }) => {
    // user is guaranteed to be authenticated
    // Supports both web (NextAuth) and mobile (Bearer token)

    // Business logic...
    return apiSuccess({ userId: user.id, data });
  }),
);
```

### Admin Panel Access

```typescript
import { withAdminAuth, withErrorHandler } from "@/lib/middleware";

export const GET = withErrorHandler(
  withAdminAuth(async ({ user, request }) => {
    // user has admin panel access
    return apiSuccess(data);
  }),
);
```

### Optional Authentication

```typescript
import { withOptionalAuth, withErrorHandler } from "@/lib/middleware";

export const GET = withErrorHandler(
  withOptionalAuth(async ({ user, request }) => {
    if (user) {
      // Authenticated behavior
      return apiSuccess({ personalized: true, userId: user.id });
    } else {
      // Anonymous behavior
      return apiSuccess({ personalized: false });
    }
  }),
);
```

---

## Permission Checking

### ❌ OLD Pattern

```typescript
export async function GET(request: NextRequest) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) return session;

  // Permission check after auth
  if (!(await hasPermission("attendance:read"))) {
    return ApiErrors.forbidden("Anda tidak memiliki akses...");
  }

  // Business logic...
}
```

### ✅ NEW Pattern

```typescript
import { withAuth, withPermission, withErrorHandler } from "@/lib/middleware";

export const GET = withErrorHandler(
  withAuth(
    withPermission("attendance:read", async ({ user, request }) => {
      // user is authenticated AND has permission
      return apiSuccess(data);
    }),
  ),
);
```

### Multiple Permission Options

```typescript
// Require ANY of the permissions
export const GET = withErrorHandler(
  withAuth(
    withAnyPermission(
      ["attendance:read", "attendance:admin"],
      async ({ user }) => {
        return apiSuccess(data);
      },
    ),
  ),
);

// Require ALL permissions
export const GET = withErrorHandler(
  withAuth(
    withAllPermissions(
      ["attendance:read", "attendance:export"],
      async ({ user }) => {
        return apiSuccess(data);
      },
    ),
  ),
);
```

---

## RBAC Filtering

### ❌ OLD Pattern (Manual Filtering)

```typescript
export async function GET(request: NextRequest) {
  const session = await requireAdmin(request);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(request.url);
  let siteId = searchParams.get("siteId") || undefined;
  let departmentId = searchParams.get("departmentId") || undefined;

  // Manual RBAC filtering
  const user = session.user as any;
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  if (user.permissions?.includes("attendance:site_only") && !isSuperAdmin) {
    siteId = user.siteId;
  }
  if (
    user.permissions?.includes("attendance:department_only") &&
    !isSuperAdmin
  ) {
    departmentId = user.departmentId;
  }

  // Build where clause...
  const where: any = {};
  if (siteId || departmentId) {
    where.user = {
      ...(siteId && { siteId }),
      ...(departmentId && { departmentId }),
    };
  }
}
```

### ✅ NEW Pattern (Automatic Filtering)

```typescript
import {
  withAuth,
  applyRBACRestrictions,
  withErrorHandler,
} from "@/lib/middleware";

export const GET = withErrorHandler(
  withAuth(
    applyRBACRestrictions(
      {
        sitePermission: "attendance:site_only",
        departmentPermission: "attendance:department_only",
      },
      async ({ user, filters, request }) => {
        // filters.siteId and filters.departmentId are auto-set
        // SUPER_ADMIN bypass is automatic

        const where = createUserRelationFilter(filters, [
          "siteId",
          "departmentId",
        ]);
        const data = await prisma.attendance.findMany({ where });

        return apiSuccess(data);
      },
    ),
  ),
);
```

---

## Validation

### ❌ OLD Pattern (Inconsistent or Missing)

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // No validation or manual parsing
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");

  // No validation of date range
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
}
```

### ✅ NEW Pattern (Standardized with Zod)

```typescript
import {
  validateQueryParams,
  paginatedFilterSchema,
} from "@/lib/validations/common";
import { ValidationError } from "@/lib/middleware";

export const GET = withErrorHandler(
  withAuth(async ({ user, request }) => {
    // Validate query parameters
    const params = validateQueryParams(request, paginatedFilterSchema);
    if (!params.success) {
      throw new ValidationError("Invalid parameters", params.error);
    }

    const { page, limit, startDate, endDate, siteId, status } = params.data;

    // All parameters are validated and typed
    // Business logic...
  }),
);
```

### Available Validation Schemas

```typescript
import {
  paginationSchema, // { page, limit }
  dateRangeSchema, // { startDate, endDate }
  searchSchema, // { search, query }
  siteFilterSchema, // { siteId, departmentId }
  paginatedDateRangeSchema, // pagination + date range
  paginatedSearchSchema, // pagination + search
  paginatedFilterSchema, // pagination + all filters
  completeQuerySchema, // Everything including sort
  idSchema, // UUID validation
  emailSchema, // Email validation
  phoneSchema, // Phone number validation (Indonesian)
  coordinateSchema, // Lat/long validation
} from "@/lib/validations/common";
```

---

## Error Handling

### ❌ OLD Pattern

```typescript
export async function GET(request: NextRequest) {
  try {
    // Business logic...

    if (!data) {
      return ApiErrors.notFound("Data");
    }

    return apiSuccess(data);
  } catch (error: any) {
    console.error("Error:", error);
    return ApiErrors.internalError("Failed to fetch data");
  }
}
```

### ✅ NEW Pattern

```typescript
import {
  withErrorHandler,
  NotFoundError,
  ValidationError,
  ForbiddenError,
} from "@/lib/middleware";

export const GET = withErrorHandler(
  withAuth(async ({ user, request }) => {
    // Simply throw errors - withErrorHandler catches them
    if (!data) {
      throw new NotFoundError("Data");
    }

    if (!isValid) {
      throw new ValidationError("Invalid input", { field: "value" });
    }

    if (!hasAccess) {
      throw new ForbiddenError("Access denied");
    }

    return apiSuccess(data);
  }),
);
```

### Available Error Classes

```typescript
// All errors are automatically formatted by withErrorHandler

throw new ValidationError("message", details); // 400
throw new UnauthorizedError("message"); // 401
throw new ForbiddenError("message"); // 403
throw new NotFoundError("Resource"); // 404
throw new ConflictError("message"); // 409
throw new AppError("message", code, status); // Custom
```

---

## Rate Limiting

### Basic Rate Limiting

```typescript
import { withRateLimit, RateLimits } from "@/lib/middleware";

// Limit to 10 requests per minute
export const POST = withRateLimit(RateLimits.STRICT, async (request) => {
  return apiSuccess({ message: "Success" });
});

// Custom rate limit
export const POST = withRateLimit(
  { limit: 5, window: 300 }, // 5 requests per 5 minutes
  async (request) => {
    return apiSuccess({ message: "Success" });
  },
);
```

### Authenticated Rate Limiting

```typescript
import { withAuth, withAuthRateLimit } from "@/lib/middleware";

export const POST = withErrorHandler(
  withAuth(
    withAuthRateLimit(
      RateLimits.RELAXED, // 100 requests per minute per user
      async ({ user, request }) => {
        return apiSuccess(data);
      },
    ),
  ),
);
```

### Predefined Rate Limits

```typescript
RateLimits.STRICT; // 10 requests/minute
RateLimits.STANDARD; // 60 requests/minute
RateLimits.RELAXED; // 100 requests/minute
RateLimits.HOURLY; // 1000 requests/hour
RateLimits.LOGIN; // 5 attempts per 5 minutes
RateLimits.EXPORT; // 3 exports per 10 minutes
```

---

## Response Formats

### ❌ OLD Pattern (Inconsistent)

```typescript
// Pattern 1: Using headers
return apiSuccess(
  { attendances, summary },
  {
    headers: {
      "X-Total-Count": total.toString(),
      "X-Page": page.toString(),
      "X-Limit": limit.toString(),
    },
  },
);

// Pattern 2: Using nested object
return apiSuccess({
  data: result.data,
  summary: result.summary,
  pagination: { page, limit, total, totalPages },
});
```

### ✅ NEW Pattern (Standardized)

```typescript
import { apiPaginated, apiPaginatedWithSummary } from "@/lib/api-response";

// Simple pagination
return apiPaginated(data, {
  page,
  limit,
  total,
  message: "Data retrieved successfully",
});

// Pagination with summary/aggregations
return apiPaginatedWithSummary(attendances, {
  page,
  limit,
  total,
  summary: {
    totalPresent: 150,
    totalAbsent: 10,
    totalLate: 5,
  },
});
```

### Standard Response Formats

```typescript
// Success response
{
  "success": true,
  "data": [...],
  "message": "Optional message"
}

// Paginated response
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}

// Paginated with summary
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  },
  "summary": {
    "totalPresent": 150,
    "totalAbsent": 10
  }
}

// Error response
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

---

## Migration Guide

### Step-by-Step Migration Process

#### 1. **Identify Current Pattern**

Review the endpoint and identify:

- Authentication method (requireAdmin, getServerSession, verifyAuth)
- Permission checks (manual hasPermission calls)
- RBAC filtering (manual site/department filtering)
- Validation (manual or Zod)
- Error handling (try/catch)

#### 2. **Choose Middleware Stack**

Determine which middleware to use:

```typescript
// Basic authenticated endpoint
withErrorHandler + withAuth;

// With permission check
withErrorHandler + withAuth + withPermission;

// With RBAC filtering
withErrorHandler + withAuth + applyRBACRestrictions;

// With rate limiting
withErrorHandler + withAuth + withAuthRateLimit;
```

#### 3. **Add Validation**

Replace manual parameter parsing with validation schemas:

```typescript
const params = validateQueryParams(request, paginatedFilterSchema);
if (!params.success) {
  throw new ValidationError("Invalid parameters", params.error);
}
```

#### 4. **Update Response Format**

Use standardized response helpers:

```typescript
// Before
return NextResponse.json(
  { data, total },
  {
    headers: { "X-Total-Count": total.toString() },
  },
);

// After
return apiPaginated(data, { page, limit, total });
```

#### 5. **Test Endpoint**

- Verify authentication works (web and mobile)
- Test permission checks
- Verify RBAC filtering
- Test error scenarios
- Check response format consistency

---

## Complete Migration Examples

### Example 1: Simple List Endpoint

#### Before

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { hasPermission } from "@/lib/rbac";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin(request);
    if (session instanceof NextResponse) {
      return session;
    }

    if (!(await hasPermission("lembur:read"))) {
      return ApiErrors.forbidden("No access");
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");

    const data = await prisma.overtime.findMany({
      skip: (page - 1) * limit,
      take: limit,
    });

    return apiSuccess({ data, page, limit });
  } catch (error: any) {
    console.error("Error:", error);
    return ApiErrors.internalError("Failed");
  }
}
```

#### After

```typescript
import { NextRequest } from "next/server";
import { withAuth, withPermission, withErrorHandler } from "@/lib/middleware";
import {
  validateQueryParams,
  paginationSchema,
} from "@/lib/validations/common";
import { apiPaginated } from "@/lib/api-response";
import { ValidationError } from "@/lib/middleware";
import { prisma } from "@/lib/prisma";

export const GET = withErrorHandler(
  withAuth(
    withPermission("lembur:read", async ({ user, request }) => {
      const params = validateQueryParams(request, paginationSchema);
      if (!params.success) {
        throw new ValidationError("Invalid parameters", params.error);
      }

      const { page, limit } = params.data;
      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        prisma.overtime.findMany({ skip, take: limit }),
        prisma.overtime.count(),
      ]);

      return apiPaginated(data, { page, limit, total });
    }),
  ),
);
```

### Example 2: Endpoint with RBAC Filtering

#### Before

```typescript
export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin(request);
    if (session instanceof NextResponse) return session;

    if (!(await hasPermission("attendance:read"))) {
      return ApiErrors.forbidden();
    }

    const { searchParams } = new URL(request.url);
    let siteId = searchParams.get("siteId") || undefined;
    let departmentId = searchParams.get("departmentId") || undefined;

    // Manual RBAC
    const user = session.user as any;
    const isSuperAdmin = user.role === "SUPER_ADMIN";

    if (user.permissions?.includes("attendance:site_only") && !isSuperAdmin) {
      siteId = user.siteId;
    }
    if (
      user.permissions?.includes("attendance:department_only") &&
      !isSuperAdmin
    ) {
      departmentId = user.departmentId;
    }

    const where: any = {};
    if (siteId || departmentId) {
      where.user = {
        ...(siteId && { siteId }),
        ...(departmentId && { departmentId }),
      };
    }

    const data = await prisma.attendance.findMany({ where });
    return apiSuccess(data);
  } catch (error: any) {
    return ApiErrors.internalError();
  }
}
```

#### After

```typescript
import {
  withAuth,
  withPermission,
  applyRBACRestrictions,
  withErrorHandler,
  createUserRelationFilter,
} from "@/lib/middleware";
import { apiPaginated } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export const GET = withErrorHandler(
  withAuth(
    withPermission(
      "attendance:read",
      applyRBACRestrictions(
        {
          sitePermission: "attendance:site_only",
          departmentPermission: "attendance:department_only",
        },
        async ({ user, filters, request }) => {
          const where = createUserRelationFilter(filters, [
            "siteId",
            "departmentId",
          ]);

          const data = await prisma.attendance.findMany({ where });

          return apiPaginated(data, {
            page: 1,
            limit: 100,
            total: data.length,
          });
        },
      ),
    ),
  ),
);
```

---

## Best Practices

### ✅ DO

1. **Always use `withErrorHandler`** as the outermost wrapper
2. **Use validation schemas** for all query parameters and request bodies
3. **Throw errors** instead of returning error responses manually
4. **Use standardized response helpers** (`apiSuccess`, `apiPaginated`, `apiPaginatedWithSummary`)
5. **Compose middleware** from outer to inner: error handler → auth → permission → rate limit → business logic
6. **Leverage RBAC middleware** instead of manual filtering
7. **Document custom permissions** in `lib/permission-config.ts`
8. **Use TypeScript types** from middleware for type safety

### ❌ DON'T

1. **Don't mix old and new patterns** in the same endpoint
2. **Don't manually check authentication** - use middleware
3. **Don't return `NextResponse` directly** for errors - throw error classes
4. **Don't parse query params manually** - use validation schemas
5. **Don't create custom response formats** - use standardized helpers
6. **Don't bypass SUPER_ADMIN checks** - middleware handles it
7. **Don't skip error handling** - always wrap with `withErrorHandler`
8. **Don't forget to update tests** when migrating endpoints

---

## Checklist for New Endpoints

```markdown
- [ ] Uses `withErrorHandler` as outermost wrapper
- [ ] Uses appropriate auth middleware (`withAuth`, `withAdminAuth`, etc.)
- [ ] Uses `withPermission` or `withAnyPermission` for access control
- [ ] Validates query parameters with Zod schemas
- [ ] Validates request body with Zod schemas (for POST/PUT/PATCH)
- [ ] Applies RBAC filtering if needed
- [ ] Uses standardized response helpers
- [ ] Throws error classes instead of returning error responses
- [ ] Has proper TypeScript types
- [ ] Includes JSDoc comments
- [ ] Is tested (unit and integration)
```

---

## Common Patterns Cheat Sheet

```typescript
// 1. Simple authenticated endpoint
export const GET = withErrorHandler(
  withAuth(async ({ user, request }) => {
    return apiSuccess(data);
  }),
);

// 2. With permission
export const GET = withErrorHandler(
  withAuth(
    withPermission("resource:read", async ({ user, request }) => {
      return apiSuccess(data);
    }),
  ),
);

// 3. With validation
export const GET = withErrorHandler(
  withAuth(async ({ user, request }) => {
    const params = validateQueryParams(request, paginationSchema);
    if (!params.success) {
      throw new ValidationError("Invalid params", params.error);
    }
    return apiPaginated(data, params.data);
  }),
);

// 4. With RBAC filtering
export const GET = withErrorHandler(
  withAuth(
    withPermission(
      "resource:read",
      applyRBACRestrictions(
        { sitePermission: "resource:site_only" },
        async ({ user, filters }) => {
          return apiSuccess(data);
        },
      ),
    ),
  ),
);

// 5. With rate limiting
export const POST = withErrorHandler(
  withAuth(
    withAuthRateLimit(RateLimits.STANDARD, async ({ user }) => {
      return apiSuccess(data);
    }),
  ),
);

// 6. Complete example
export const GET = withErrorHandler(
  withAuth(
    withPermission(
      "resource:read",
      withAuthRateLimit(
        RateLimits.RELAXED,
        applyRBACRestrictions(
          { sitePermission: "resource:site_only" },
          async ({ user, filters, request }) => {
            const params = validateQueryParams(request, paginatedFilterSchema);
            if (!params.success) {
              throw new ValidationError("Invalid params", params.error);
            }

            const { page, limit } = params.data;
            const where = { ...filters, ...createUserRelationFilter(filters) };

            const [data, total] = await Promise.all([
              prisma.resource.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
              }),
              prisma.resource.count({ where }),
            ]);

            return apiPaginated(data, { page, limit, total });
          },
        ),
      ),
    ),
  ),
);
```

---

## Support & Questions

For questions or issues with the standardization:

1. Review this guide
2. Check existing migrated endpoints as examples
3. Review the middleware source code in `lib/middleware/`
4. Consult the comprehensive application audit: `plans/comprehensive-application-audit.md`

---

## Version History

- **v1.0.0** (2026-01-28): Initial standardization guide
  - Created all middleware infrastructure
  - Documented migration patterns
  - Established best practices

---

**Last Updated**: 2026-01-28  
**Author**: NetManager Development Team  
**Status**: Active - Phase 1 Complete
