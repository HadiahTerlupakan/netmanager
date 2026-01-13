# RBAC Security Audit Report

## NetManager Application

**Audit Date:** 2026-01-13  
**Auditor:** Senior Security Architect  
**Scope:** Role-Based Access Control (RBAC) Implementation  
**Risk Level:** HIGH

---

## Executive Summary

This audit identified **12 critical and high-severity security vulnerabilities** in the RBAC implementation, including authorization bypasses, insecure direct object references (IDOR), and inconsistent permission checks. The system has a fundamental architectural flaw where hardcoded role checks bypass the permission-based RBAC system, creating multiple attack vectors for privilege escalation.

**Key Findings:**

- 3 Critical vulnerabilities
- 5 High severity issues
- 4 Medium severity issues
- 0 Low severity issues

---

## Critical Vulnerabilities

### 🔴 CRITICAL-1: Role-Based Authorization Bypass

**Severity:** CRITICAL  
**CVSS Score:** 9.1 (Critical)  
**Location:** Multiple endpoints across the application

**Description:**
Multiple API endpoints implement hardcoded role checks (`session.user.role === 'ADMIN'`) that completely bypass the RBAC permission system. This creates a dual authorization model where users with the 'ADMIN' role can access resources regardless of their assigned permissions, while other users must pass through the permission system.

**Affected Endpoints:**

```typescript
// app/api/admin/holidays/route.ts:16
const isAdmin = session.user.role === 'ADMIN'
if (!hasAccess && !isAdmin) { ... }

// app/api/admin/holidays/route.ts:39
const isAdmin = session.user.role === 'ADMIN'
if (!hasAccess && !isAdmin) { ... }

// app/api/admin/holidays/[id]/route.ts:15
if (session.user.role !== 'ADMIN' && !await hasPermission('holiday:delete')) { ... }

// app/api/admin/holidays/[id]/route.ts:35
if (session.user.role !== 'ADMIN' && !await hasPermission('holiday:update')) { ... }
```

**Attack Scenario:**

1. Attacker gains access to an account with 'ADMIN' role (e.g., through credential theft, session hijacking, or social engineering)
2. Attacker can access ANY resource regardless of permission restrictions
3. Even if the admin account should be restricted (e.g., site-restricted admin), the hardcoded check bypasses all restrictions

**Impact:**

- Complete bypass of permission system for admin users
- Unauthorized access to sensitive data
- Potential privilege escalation if admin role can be assigned to regular users
- Violation of principle of least privilege

**Remediation:**

```typescript
// ❌ BAD - Hardcoded role check
if (session.user.role !== "ADMIN" && !(await hasPermission("holiday:delete"))) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ✅ GOOD - Permission-only check
if (!(await hasPermission("holiday:delete"))) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**Priority:** IMMEDIATE - Fix within 24 hours

---

### 🔴 CRITICAL-2: Inconsistent SUPER_ADMIN Role Handling

**Severity:** CRITICAL  
**CVSS Score:** 8.9 (High)  
**Location:** `lib/auth.ts:182, 250, 307`

**Description:**
The application uses two different string representations for the SUPER_ADMIN role: `'SUPER_ADMIN'` and `'Super Admin'`. This inconsistency can lead to authorization bypasses if one representation is used in some checks but not others.

**Vulnerable Code:**

```typescript
// lib/auth.ts:182 - Checks both representations
if (role?.name === "SUPER_ADMIN" || role?.name === "Super Admin") {
  console.log("[AUTH] SUPER_ADMIN access granted");
}

// lib/auth.ts:250 - Checks both representations
if (token.role === "SUPER_ADMIN" || token.role === "Super Admin") {
  token.accessAdminPanel = true;
  token.accessEmployeePanel = true;
}
```

**Attack Scenario:**

1. Database contains role with name 'Super Admin' (with spaces)
2. Some permission checks only look for 'SUPER_ADMIN'
3. User with 'Super Admin' role may fail some checks but pass others
4. Inconsistent behavior can be exploited to bypass certain restrictions

**Impact:**

- Unpredictable authorization behavior
- Potential bypass of SUPER_ADMIN restrictions
- Confusion in permission assignment and testing

**Remediation:**

```typescript
// Define constants for role names
const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

// Use constants consistently
if (role?.name === ROLES.SUPER_ADMIN) {
  // Grant access
}
```

**Priority:** IMMEDIATE - Fix within 48 hours

---

### 🔴 CRITICAL-3: Missing Authorization Checks

**Severity:** CRITICAL  
**CVSS Score:** 8.6 (High)  
**Location:** `app/api/admin/chat/global/route.ts`

**Description:**
Several endpoints only perform authentication checks without any authorization validation. Authenticated users can access sensitive functionality regardless of their permissions.

**Vulnerable Code:**

```typescript
// app/api/admin/chat/global/route.ts:8
export async function GET(req: NextRequest) {
    try {
        const user = await verifyAuth(req)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        // ❌ NO PERMISSION CHECK HERE
        // Any authenticated user can access global chat
        const chatService = new ChatService()
        // ...
    }
}
```

**Other Affected Endpoints:**

- `app/api/admin/chat/users/route.ts` - Lists all chat users without permission check
- `app/api/onus/stats/route.ts` - Access to ONU statistics without permission check
- `app/api/onus/test-table/route.ts` - Test endpoint without authorization

**Attack Scenario:**

1. Attacker obtains valid session token (any user)
2. Attacker accesses `/api/admin/chat/global` without any special permissions
3. Attacker can read global chat messages, potentially exposing sensitive information
4. No audit trail of unauthorized access

**Impact:**

- Unauthorized access to sensitive functionality
- Data leakage
- Potential for privilege escalation through exposed information

**Remediation:**

```typescript
// ✅ GOOD - Add permission check
export async function GET(req: NextRequest) {
    try {
        const user = await verifyAuth(req)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Add permission check
        if (!await hasPermission('chat:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const chatService = new ChatService()
        // ...
    }
}
```

**Priority:** IMMEDIATE - Fix within 24 hours

---

## High Severity Vulnerabilities

### 🟠 HIGH-1: Insecure Direct Object Reference (IDOR)

**Severity:** HIGH  
**CVSS Score:** 7.5 (High)  
**Location:** Multiple endpoints with resource-based access

**Description:**
Many endpoints check if a user has general permission to access a resource type (e.g., `workorder:read`) but don't validate whether the user has access to that specific resource instance. This allows users to access resources they shouldn't see.

**Vulnerable Code:**

```typescript
// app/api/admin/workorders/[id]/route.ts:75-77
if (!(await hasPermission("list:read"))) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ❌ Missing: Check if user has access to THIS specific work order
const workOrder = await workOrderRepo.findById(id);
// Returns work order regardless of site/department ownership
```

**Partial Mitigation Present:**
Some endpoints have site/department checks, but they're inconsistent:

```typescript
// app/api/admin/workorders/[id]/route.ts:90-94
if (user.permissions?.includes("workorders:site_only") && !isSuperAdmin) {
  if (workOrder.siteId !== user.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
```

**Attack Scenario:**

1. User has `workorder:read` permission but is site-restricted
2. User doesn't have `workorders:site_only` permission (or check is missing)
3. User requests `/api/admin/workorders/[id-of-workorder-in-different-site]`
4. System returns work order from different site
5. User accesses sensitive data from other sites/departments

**Affected Endpoints:**

- `/api/admin/workorders/[id]` - GET, PATCH, DELETE
- `/api/admin/support-tickets/[id]` - GET, PATCH, DELETE
- `/api/invoices/[id]` - GET, PATCH, DELETE
- `/api/finance/expenses` - GET, POST

**Impact:**

- Cross-site data access
- Violation of data isolation requirements
- Potential data leakage between departments/sites

**Remediation:**

```typescript
// ✅ GOOD - Comprehensive access control
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  // 1. Permission check
  if (!(await hasPermission("list:read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const workOrder = await workOrderRepo.findById(id);

  if (!workOrder) {
    return NextResponse.json(
      { error: "Work order not found" },
      { status: 404 }
    );
  }

  // 2. Resource ownership check (ALWAYS perform, not conditional)
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  if (!isSuperAdmin) {
    // Site check
    if (workOrder.siteId !== user.siteId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Department check
    if (workOrder.departmentId !== user.departmentId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json({ success: true, data: workOrder });
}
```

**Priority:** HIGH - Fix within 1 week

---

### 🟠 HIGH-2: Permission Cache Staleness

**Severity:** HIGH  
**CVSS Score:** 7.1 (High)  
**Location:** `lib/auth.ts:464-518`

**Description:**
User permissions are cached in Redis for 5 minutes. When role permissions are updated or a user's role is changed, the cached permissions remain valid for up to 5 minutes, allowing users to retain access they should no longer have.

**Vulnerable Code:**

```typescript
// lib/auth.ts:464-465
const PERMISSION_CACHE_TTL = 300; // 5 minutes cache TTL
const PERMISSION_CACHE_PREFIX = "permissions:";

export async function getUserPermissions(userId: string): Promise<string[]> {
  const cacheKey = `${PERMISSION_CACHE_PREFIX}${userId}`;

  // Try cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached); // ❌ Returns stale permissions
    }
  } catch (e) {
    console.warn("[AUTH] Redis cache read error, falling back to DB:", e);
  }
  // ...
}
```

**Attack Scenario:**

1. Admin has all permissions including `users:delete`
2. Admin's permissions are cached
3. Security team removes `users:delete` permission from admin role
4. Admin can still delete users for up to 5 minutes
5. Cache invalidation function may not be called consistently

**Impact:**

- Extended window for privilege abuse after permission revocation
- Difficulty enforcing immediate access revocation
- Potential for data loss or unauthorized changes during cache window

**Remediation:**

```typescript
// ✅ GOOD - Implement cache invalidation on role/permission changes

// When role permissions are updated
export async function updateRolePermissions(
  roleId: string,
  permissions: string[]
) {
  // Update database
  await prisma.role.update({
    where: { id: roleId },
    data: {
      permission: {
        set: permissions.map((p) => ({ id: p })),
      },
    },
  });

  // Invalidate cache for ALL users with this role
  await invalidateRolePermissionCache(roleId);
}

// When user's role is changed
export async function changeUserRole(userId: string, newRoleId: string) {
  // Update database
  await prisma.user.update({
    where: { id: userId },
    data: { roleId: newRoleId },
  });

  // Invalidate user's permission cache
  await invalidatePermissionCache(userId);
}

// Reduce cache TTL for critical operations
const PERMISSION_CACHE_TTL = 60; // 1 minute for critical permissions
```

**Priority:** HIGH - Fix within 1 week

---

### 🟠 HIGH-3: Inconsistent Site/Department Restriction Implementation

**Severity:** HIGH  
**CVSS Score:** 7.0 (High)  
**Location:** Multiple endpoints

**Description:**
Site and department restrictions are implemented inconsistently across the application. Some endpoints check `workorders:site_only` permission, others check `olt:site_only`, `odc:site_only`, etc. This creates confusion and potential bypass opportunities.

**Inconsistent Examples:**

```typescript
// app/api/olts/route.ts:54
const isSiteRestricted = (await hasPermission("olt:site_only")) && session.user.role !== 'SUPER_ADMIN';

// app/api/odcs/route.ts:16
const isSiteRestricted = (await hasPermission("odc:site_only")) && session.user.role !== 'SUPER_ADMIN';

// app/api/admin/workorders/[id]/route.ts:90
if (user.permissions?.includes('workorders:site_only') && !isSuperAdmin) {
```

**Issues:**

1. Different permission keys for same concept (`olt:site_only` vs `workorders:site_only`)
2. Some check `user.permissions?.includes()` directly, others use `await hasPermission()`
3. SUPER_ADMIN bypass is inconsistent (sometimes checked, sometimes not)

**Impact:**

- Confusing permission model
- Potential for misconfiguration
- Difficult to audit and maintain

**Remediation:**

```typescript
// ✅ GOOD - Centralized site restriction check
export async function checkSiteRestriction(
  user: UserSession,
  resourceSiteId: string | null
): Promise<boolean> {
  // SUPER_ADMIN bypass
  if (user.role === "SUPER_ADMIN") {
    return true;
  }

  // Check if user has site restriction
  const hasSiteRestriction = await hasPermission("site_restricted");
  if (!hasSiteRestriction) {
    return true;
  }

  // Verify site ownership
  if (!user.siteId) {
    return false;
  }

  return resourceSiteId === user.siteId;
}

// Usage in endpoints
const hasAccess = await checkSiteRestriction(user, workOrder.siteId);
if (!hasAccess) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**Priority:** HIGH - Fix within 2 weeks

---

### 🟠 HIGH-4: Missing Audit Logging for Authorization Failures

**Severity:** HIGH  
**CVSS Score:** 6.8 (Medium)  
**Location:** All endpoints with permission checks

**Description:**
Authorization failures (403 errors) are not consistently logged. This makes it difficult to detect and investigate potential security incidents or privilege escalation attempts.

**Current Implementation:**

```typescript
// Most endpoints just return 403 without logging
if (!(await hasPermission("workorder:read"))) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**Impact:**

- No visibility into authorization failures
- Cannot detect brute-force permission testing
- Difficult to investigate security incidents
- Compliance issues (audit trail requirements)

**Remediation:**

```typescript
// ✅ GOOD - Add audit logging
export async function checkPermissionWithAudit(
  userId: string,
  permission: string,
  resource: string,
  action: string
): Promise<boolean> {
  const hasAccess = await hasPermission(permission);

  if (!hasAccess) {
    // Log authorization failure
    await logger.logSecurityEvent({
      type: "AUTHORIZATION_FAILURE",
      userId,
      permission,
      resource,
      action,
      timestamp: new Date().toISOString(),
    });
  }

  return hasAccess;
}

// Usage
if (
  !(await checkPermissionWithAudit(
    user.id,
    "workorder:read",
    `workorder:${id}`,
    "READ"
  ))
) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

**Priority:** HIGH - Fix within 2 weeks

---

### 🟠 HIGH-5: Weak Session Validation in verifyAuth

**Severity:** HIGH  
**CVSS Score:** 6.5 (Medium)  
**Location:** `lib/auth.ts:404-459`

**Description:**
The `verifyAuth` function handles both NextAuth sessions and mobile tokens but doesn't validate them with the same security level. Mobile tokens may not have the same security guarantees as NextAuth sessions.

**Vulnerable Code:**

```typescript
// lib/auth.ts:407-433
if (authHeader?.startsWith("Bearer ")) {
  const token = authHeader.split(" ")[1];
  if (token === "null" || !token) {
    console.warn('[AUTH_VERIFY] Bearer token is literal "null" or empty');
    return null;
  }

  const mobilePayload = await verifyMobileToken(token);

  if (mobilePayload) {
    console.log(
      "[AUTH_VERIFY] Mobile token verified for:",
      mobilePayload.email
    );
    return {
      id: mobilePayload.userId,
      email: mobilePayload.email as string,
      name: mobilePayload.name as string | null,
      role: mobilePayload.role as string | undefined,
      // ❌ No validation that this user is still active
      // ❌ No token version check for mobile tokens
    };
  }
}
```

**Attack Scenario:**

1. User's mobile token is stolen
2. Admin deactivates user account or forces logout
3. Mobile token remains valid until it expires
4. Attacker can continue accessing the system

**Impact:**

- Inability to immediately revoke mobile sessions
- Extended window for account compromise
- Inconsistent security between web and mobile

**Remediation:**

```typescript
// ✅ GOOD - Add session validation for mobile tokens
export async function verifyAuth(
  request: NextRequest
): Promise<UserSession | null> {
  try {
    const authHeader = request.headers.get("Authorization");

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token === "null" || !token) {
        return null;
      }

      const mobilePayload = await verifyMobileToken(token);

      if (mobilePayload) {
        // Validate user is still active
        const dbUser = await prisma.user.findUnique({
          where: { id: mobilePayload.userId },
          select: { isActive: true, tokenVersion: true },
        });

        if (!dbUser || !dbUser.isActive) {
          console.warn("[AUTH_VERIFY] Mobile token for inactive user");
          return null;
        }

        // Check token version (if mobile tokens support it)
        if (dbUser.tokenVersion > (mobilePayload.tokenVersion || 0)) {
          console.warn("[AUTH_VERIFY] Mobile token version mismatch");
          return null;
        }

        return {
          id: mobilePayload.userId,
          email: mobilePayload.email as string,
          name: mobilePayload.name as string | null,
          role: mobilePayload.role as string | undefined,
          departmentId: (mobilePayload as any).departmentId,
          siteId: (mobilePayload as any).siteId,
        };
      }
    }

    // NextAuth validation...
  } catch (error) {
    console.error("[AUTH_VERIFY] Error verifying auth:", error);
    return null;
  }
}
```

**Priority:** HIGH - Fix within 1 week

---

## Medium Severity Vulnerabilities

### 🟡 MEDIUM-1: Permission Enumeration via Error Messages

**Severity:** MEDIUM  
**CVSS Score:** 5.3 (Medium)  
**Location:** All permission check endpoints

**Description:**
Error messages reveal which permissions are required, allowing attackers to enumerate the permission system and understand the authorization model.

**Example:**

```typescript
// app/api/admin/workorders/route.ts:96
if (!(await hasPermission("list:read"))) {
  return NextResponse.json(
    {
      error: "Forbidden: You do not have permission to view work orders",
    },
    { status: 403 }
  );
}
```

**Attack Scenario:**

1. Attacker attempts to access various endpoints
2. Error messages reveal required permissions
3. Attacker builds map of permission structure
4. Attacker can focus attacks on high-value permissions

**Impact:**

- Information disclosure
- Easier privilege escalation planning
- Exposure of system architecture

**Remediation:**

```typescript
// ✅ GOOD - Generic error messages
if (!(await hasPermission("list:read"))) {
  return NextResponse.json(
    {
      error: "Forbidden",
    },
    { status: 403 }
  );
}

// Log detailed info server-side only
await logger.logSecurityEvent({
  type: "AUTHORIZATION_FAILURE",
  userId: user.id,
  requiredPermission: "list:read",
  endpoint: "/api/admin/workorders",
});
```

**Priority:** MEDIUM - Fix within 1 month

---

### 🟡 MEDIUM-2: No Rate Limiting on Permission Checks

**Severity:** MEDIUM  
**CVSS Score:** 5.0 (Medium)  
**Location:** All permission check endpoints

**Description:**
There's no rate limiting on permission checks, allowing attackers to brute-force permission enumeration or test multiple endpoints rapidly.

**Impact:**

- Ability to enumerate permissions quickly
- Potential for DoS on permission cache
- Increased attack surface

**Remediation:**

```typescript
// ✅ GOOD - Add rate limiting
import { checkRateLimit } from "@/lib/redis";

export async function hasPermission(
  requiredPermission: string
): Promise<boolean> {
  const session = await getServerSession(authConfig);

  if (!session?.user) {
    return false;
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return false;
  }

  // Rate limit permission checks
  const allowed = await checkRateLimit(
    `permission_check:${userId}`,
    100, // 100 checks per minute
    60
  );

  if (!allowed) {
    console.warn("[RBAC] Rate limit exceeded for permission checks", {
      userId,
    });
    return false;
  }

  const permissions = await getUserPermissions(userId);
  return permissions.includes(requiredPermission);
}
```

**Priority:** MEDIUM - Fix within 1 month

---

### 🟡 MEDIUM-3: Inconsistent Error Handling in Permission Checks

**Severity:** MEDIUM  
**CVSS Score:** 4.8 (Medium)  
**Location:** `lib/rbac.ts`

**Description:**
The `hasPermission` function doesn't handle errors gracefully. If the database query fails, it returns `false`, which may mask underlying issues.

**Current Implementation:**

```typescript
// lib/rbac.ts:4-20
export async function hasPermission(
  requiredPermission: string
): Promise<boolean> {
  const session = await getServerSession(authConfig);

  if (!session?.user) {
    return false;
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return false;
  }

  const permissions = await getUserPermissions(userId);
  // ❌ If getUserPermissions throws, this function crashes
  return permissions.includes(requiredPermission);
}
```

**Impact:**

- Application crashes on permission check failures
- Poor user experience
- Potential for denial of service

**Remediation:**

```typescript
// ✅ GOOD - Add error handling
export async function hasPermission(
  requiredPermission: string
): Promise<boolean> {
  try {
    const session = await getServerSession(authConfig);

    if (!session?.user) {
      return false;
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return false;
    }

    const permissions = await getUserPermissions(userId);
    return permissions.includes(requiredPermission);
  } catch (error) {
    console.error("[RBAC] Error checking permission:", {
      permission: requiredPermission,
      error,
    });

    // Fail-closed: deny access on error
    return false;
  }
}
```

**Priority:** MEDIUM - Fix within 1 month

---

### 🟡 MEDIUM-4: Missing Permission Validation on Role Assignment

**Severity:** MEDIUM  
**CVSS Score:** 4.5 (Medium)  
**Location:** Role management endpoints

**Description:**
There's no validation to prevent users from assigning roles higher than their own, potentially allowing privilege escalation through role assignment.

**Attack Scenario:**

1. User has `users:update` permission
2. User can assign any role to any user
3. User assigns SUPER_ADMIN role to their own account
4. User gains full system access

**Impact:**

- Privilege escalation through role assignment
- Violation of separation of duties
- Potential for complete system compromise

**Remediation:**

```typescript
// ✅ GOOD - Add role hierarchy validation
const ROLE_HIERARCHY = {
  SUPER_ADMIN: 100,
  ADMIN: 50,
  MANAGER: 30,
  USER: 10,
} as const;

export async function assignRole(
  targetUserId: string,
  newRoleId: string,
  assignedBy: string
): Promise<void> {
  // Get assigner's role
  const assigner = await prisma.user.findUnique({
    where: { id: assignedBy },
    include: { role: true },
  });

  // Get target role
  const targetRole = await prisma.role.findUnique({
    where: { id: newRoleId },
  });

  // Validate role hierarchy
  const assignerLevel =
    ROLE_HIERARCHY[assigner.role.name as keyof typeof ROLE_HIERARCHY] || 0;
  const targetLevel =
    ROLE_HIERARCHY[targetRole.name as keyof typeof ROLE_HIERARCHY] || 0;

  if (targetLevel > assignerLevel) {
    throw new Error("Cannot assign role higher than your own");
  }

  // Assign role
  await prisma.user.update({
    where: { id: targetUserId },
    data: { roleId: newRoleId },
  });

  // Invalidate cache
  await invalidatePermissionCache(targetUserId);
}
```

**Priority:** MEDIUM - Fix within 1 month

---

## Performance and Scalability Issues

### ⚡ PERF-1: N+1 Query Problem in Permission Checks

**Severity:** MEDIUM (Performance)  
**Location:** Endpoints with multiple permission checks

**Description:**
Each `hasPermission()` call triggers a database query (or cache lookup). Endpoints that check multiple permissions sequentially cause multiple round trips.

**Example:**

```typescript
// Multiple sequential permission checks
if (!(await hasPermission("workorder:read"))) return 403;
if (!(await hasPermission("workorder:site_only"))) return 403;
if (!(await hasPermission("workorder:department_only"))) return 403;
// 3 separate queries/cache lookups
```

**Impact:**

- Increased latency
- Higher database load
- Poor scalability under high traffic

**Remediation:**

```typescript
// ✅ GOOD - Batch permission checks
export async function hasPermissions(
  requiredPermissions: string[]
): Promise<Record<string, boolean>> {
  const session = await getServerSession(authConfig);

  if (!session?.user) {
    return requiredPermissions.reduce((acc, p) => ({ ...acc, [p]: false }), {});
  }

  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return requiredPermissions.reduce((acc, p) => ({ ...acc, [p]: false }), {});
  }

  // Single query/cache lookup
  const permissions = await getUserPermissions(userId);
  const permissionSet = new Set(permissions);

  return requiredPermissions.reduce(
    (acc, p) => ({
      ...acc,
      [p]: permissionSet.has(p),
    }),
    {}
  );
}

// Usage
const permissions = await hasPermissions([
  "workorder:read",
  "workorder:site_only",
  "workorder:department_only",
]);

if (!permissions["workorder:read"]) return 403;
if (permissions["workorder:site_only"]) {
  // Apply site restriction
}
```

**Priority:** MEDIUM - Optimize within 1 month

---

### ⚡ PERF-2: Cache Key Collision Risk

**Severity:** LOW (Performance)  
**Location:** `lib/auth.ts:471`

**Description:**
Permission cache keys use simple concatenation: `${PERMISSION_CACHE_PREFIX}${userId}`. If userIds can contain special characters or if the prefix is not unique enough, there's a risk of cache key collisions.

**Current Implementation:**

```typescript
const cacheKey = `${PERMISSION_CACHE_PREFIX}${userId}`;
```

**Remediation:**

```typescript
// ✅ GOOD - Use structured cache key
const cacheKey = `permissions:${userId}:v1`;
```

**Priority:** LOW - Fix within 2 months

---

## Architecture Recommendations

### 1. Implement Centralized Authorization Layer

Create a unified authorization middleware that handles all permission checks consistently:

```typescript
// lib/authorization.ts
export class AuthorizationService {
  static async checkAccess(
    user: UserSession,
    resource: string,
    action: string,
    resourceId?: string
  ): Promise<AccessResult> {
    // 1. Check authentication
    if (!user.id) {
      return { allowed: false, reason: "UNAUTHENTICATED" };
    }

    // 2. Check permission
    const permission = `${resource}:${action}`;
    const hasPermission = await this.hasPermission(user.id, permission);

    if (!hasPermission) {
      await this.logAuthorizationFailure(user, permission, resource, action);
      return { allowed: false, reason: "INSUFFICIENT_PERMISSIONS" };
    }

    // 3. Check resource ownership (if resourceId provided)
    if (resourceId) {
      const hasOwnership = await this.checkResourceOwnership(
        user,
        resource,
        resourceId
      );

      if (!hasOwnership) {
        await this.logAuthorizationFailure(user, permission, resource, action, {
          resourceId,
        });
        return { allowed: false, reason: "RESOURCE_OWNERSHIP" };
      }
    }

    return { allowed: true };
  }

  private static async checkResourceOwnership(
    user: UserSession,
    resource: string,
    resourceId: string
  ): Promise<boolean> {
    // Implement resource-specific ownership checks
    // e.g., site, department, or user ownership
    switch (resource) {
      case "workorder":
        return this.checkWorkOrderOwnership(user, resourceId);
      case "support_ticket":
        return this.checkSupportTicketOwnership(user, resourceId);
      default:
        return true;
    }
  }
}
```

### 2. Implement Permission Inheritance

Create a permission hierarchy to reduce the number of explicit permissions:

```typescript
// lib/permissions.ts
export const PERMISSION_HIERARCHY = {
  "workorder:read": ["workorder:read"],
  "workorder:update": ["workorder:read", "workorder:update"],
  "workorder:delete": [
    "workorder:read",
    "workorder:update",
    "workorder:delete",
  ],
  "workorder:admin": [
    "workorder:read",
    "workorder:update",
    "workorder:delete",
    "workorder:verify",
    "workorder:cancel",
  ],
};

export async function hasPermissionWithInheritance(
  userId: string,
  requiredPermission: string
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);

  // Check direct permission
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Check inherited permissions
  for (const [parent, children] of Object.entries(PERMISSION_HIERARCHY)) {
    if (
      children.includes(requiredPermission) &&
      userPermissions.includes(parent)
    ) {
      return true;
    }
  }

  return false;
}
```

### 3. Implement Role-Based Data Filtering

Move data filtering to the repository layer for consistency:

```typescript
// repositories/BaseRepository.ts
export abstract class BaseRepository {
  protected applyUserFilters<T>(
    query: PrismaQuery<T>,
    user: UserSession,
    resource: string
  ): PrismaQuery<T> {
    // Apply site filter
    if (user.siteId && (await hasPermission(`${resource}:site_only`))) {
      query.where = {
        ...query.where,
        siteId: user.siteId,
      };
    }

    // Apply department filter
    if (
      user.departmentId &&
      (await hasPermission(`${resource}:department_only`))
    ) {
      query.where = {
        ...query.where,
        departmentId: user.departmentId,
      };
    }

    return query;
  }
}
```

---

## Testing Recommendations

### 1. Automated Security Testing

Implement automated tests for authorization:

```typescript
// tests/authorization.test.ts
describe("Authorization Tests", () => {
  test("user cannot access workorder from different site", async () => {
    const user1 = await createTestUser({ siteId: "site-1" });
    const user2 = await createTestUser({ siteId: "site-2" });
    const workOrder = await createTestWorkOrder({ siteId: "site-2" });

    const response = await request(app)
      .get(`/api/admin/workorders/${workOrder.id}`)
      .set("Authorization", `Bearer ${user1.token}`);

    expect(response.status).toBe(403);
  });

  test("admin cannot bypass permission checks", async () => {
    const admin = await createTestUser({ role: "ADMIN" });
    await removePermission(admin.id, "holiday:delete");

    const holiday = await createTestHoliday();

    const response = await request(app)
      .delete(`/api/admin/holidays/${holiday.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(403);
  });
});
```

### 2. Penetration Testing

Conduct regular penetration tests focusing on:

- IDOR vulnerabilities
- Permission bypass attempts
- Role escalation attacks
- Cache poisoning attempts

### 3. Audit Trail Review

Regularly review audit logs for:

- Unusual authorization failure patterns
- Permission enumeration attempts
- Cross-site access attempts
- Role assignment anomalies

---

## Compliance Considerations

### 1. GDPR/Privacy

- Implement proper audit logging for all authorization decisions
- Ensure data access is properly restricted by site/department
- Implement data retention policies for audit logs

### 2. SOC 2

- Document authorization controls
- Implement automated monitoring for authorization failures
- Regularly review and test authorization controls
- Maintain evidence of permission reviews

### 3. ISO 27001

- Implement access control policy
- Regular access reviews
- Privilege management procedures
- Incident response for authorization violations

---

## Implementation Timeline

### Phase 1: Critical Fixes (Week 1)

- [ ] Remove all hardcoded role checks
- [ ] Standardize SUPER_ADMIN role name
- [ ] Add missing authorization checks
- [ ] Implement audit logging for failures

### Phase 2: High Priority (Weeks 2-4)

- [ ] Fix IDOR vulnerabilities
- [ ] Implement proper cache invalidation
- [ ] Standardize site/department restrictions
- [ ] Improve mobile token validation

### Phase 3: Medium Priority (Weeks 5-8)

- [ ] Implement centralized authorization layer
- [ ] Add permission inheritance
- [ ] Implement rate limiting
- [ ] Optimize permission checks

### Phase 4: Long-term (Months 3-6)

- [ ] Implement role hierarchy validation
- [ ] Add automated security testing
- [ ] Implement RBAC monitoring dashboard
- [ ] Regular security audits

---

## Conclusion

The RBAC implementation in NetManager has several critical and high-severity vulnerabilities that require immediate attention. The most concerning issues are:

1. **Hardcoded role checks** that bypass the permission system
2. **Inconsistent SUPER_ADMIN handling** that creates bypass opportunities
3. **Missing authorization checks** on sensitive endpoints
4. **IDOR vulnerabilities** that allow cross-site data access

These issues should be addressed immediately to prevent potential security incidents. The recommended remediation steps will significantly improve the security posture of the application while maintaining usability and performance.

**Overall Risk Level:** HIGH  
**Recommended Action:** IMMEDIATE REMEDIATION REQUIRED

---

## Appendix: Code Examples

### A. Secure Permission Check Pattern

```typescript
// lib/secure-rbac.ts
export async function requirePermission(
  request: NextRequest,
  permission: string,
  options: {
    resource?: string;
    resourceId?: string;
    action?: string;
  } = {}
): Promise<UserSession | NextResponse> {
  // 1. Authenticate
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Authorize
  const hasAccess = await hasPermission(permission);
  if (!hasAccess) {
    // Log failure
    await logger.logSecurityEvent({
      type: "AUTHORIZATION_FAILURE",
      userId: user.id,
      permission,
      ...options,
    });

    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Check resource ownership (if applicable)
  if (options.resourceId) {
    const hasOwnership = await checkResourceOwnership(
      user,
      options.resource,
      options.resourceId
    );

    if (!hasOwnership) {
      await logger.logSecurityEvent({
        type: "RESOURCE_ACCESS_DENIED",
        userId: user.id,
        resource: options.resource,
        resourceId: options.resourceId,
      });

      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return user;
}

// Usage in API routes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(request, "workorder:read", {
    resource: "workorder",
    resourceId: (await params).id,
    action: "READ",
  });

  if (user instanceof NextResponse) {
    return user;
  }

  // Proceed with request...
}
```

### B. Secure Repository Pattern

```typescript
// repositories/SecureWorkOrderRepository.ts
export class SecureWorkOrderRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string, user: UserSession): Promise<WorkOrder | null> {
    const isSuperAdmin = user.role === "SUPER_ADMIN";

    const query: any = {
      where: { id },
    };

    // Apply site filter
    if (!isSuperAdmin && user.siteId) {
      query.where.siteId = user.siteId;
    }

    // Apply department filter
    if (!isSuperAdmin && user.departmentId) {
      query.where.departmentId = user.departmentId;
    }

    return this.prisma.workOrders.findFirst(query);
  }

  async findMany(user: UserSession, filters: any = {}): Promise<WorkOrder[]> {
    const isSuperAdmin = user.role === "SUPER_ADMIN";

    const query: any = {
      where: filters,
    };

    // Apply site filter
    if (!isSuperAdmin && user.siteId) {
      query.where.siteId = user.siteId;
    }

    // Apply department filter
    if (!isSuperAdmin && user.departmentId) {
      query.where.departmentId = user.departmentId;
    }

    return this.prisma.workOrders.findMany(query);
  }
}
```

---

**Report Version:** 1.0  
**Last Updated:** 2026-01-13  
**Next Review Date:** 2026-02-13
