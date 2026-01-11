# Work Order Optimization Implementation Guide

**Purpose:** Step-by-step implementation guide for Work Order performance optimizations  
**Based on:** [`WORK_ORDER_PERFORMANCE_AUDIT.md`](plans/WORK_ORDER_PERFORMANCE_AUDIT.md)  
**Target:** 80-90% reduction in load times

---

## Table of Contents

1. [Phase 1: Backend Query Optimization](#phase-1-backend-query-optimization)
2. [Phase 2: Dashboard Consolidation](#phase-2-dashboard-consolidation)
3. [Phase 3: Database Indexing](#phase-3-database-indexing)
4. [Phase 4: Caching Layer](#phase-4-caching-layer)
5. [Phase 5: Frontend Optimizations](#phase-5-frontend-optimizations)
6. [Phase 6: Testing & Monitoring](#phase-6-testing--monitoring)

---

## Phase 1: Backend Query Optimization

### 1.1 Create Lightweight List Query Method

**File:** [`modules/work-order/repositories/WorkOrderRepository.ts`](modules/work-order/repositories/WorkOrderRepository.ts)

**Action:** Add new method after existing [`findAll()`](modules/work-order/repositories/WorkOrderRepository.ts:276-472)

```typescript
/**
 * Find work orders for list view with minimal relations
 * Only fetches fields that are actually displayed in the table
 */
async findAllForList(
    filters?: WorkOrderFilters,
    page: number = 1,
    limit: number = 20
): Promise<{
    workOrders: WorkOrderList[];
    total: number;
    page: number;
    totalPages: number;
}> {
    const where: any = {};

    // Build where clause (reuse existing logic)
    if (filters?.status) {
        where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
    }

    if (filters?.priority) {
        where.priority = Array.isArray(filters.priority) ? { in: filters.priority } : filters.priority;
    }

    if (filters?.type) {
        where.type = Array.isArray(filters.type) ? { in: filters.type } : filters.type;
    }

    if (filters?.departmentId) {
        where.departmentId = filters.departmentId;
    }

    if (filters?.unassignedOnly) {
        where.assignedToId = null;
    }

    if (filters?.siteId) {
        where.siteId = filters.siteId;
    }

    if (filters?.assignedToId !== undefined) {
        where.assignedToId = filters.assignedToId;
    }

    if (filters?.pelangganId) {
        where.pelangganId = filters.pelangganId;
    }

    if (filters?.search) {
        where.OR = [
            { workOrderNumber: { contains: filters.search, mode: 'insensitive' } },
            { title: { contains: filters.search, mode: 'insensitive' } },
            { description: { contains: filters.search, mode: 'insensitive' } },
        ];
    }

    if (filters?.dateFrom || filters?.dateTo) {
        where.createdAt = {};
        if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
        if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    // OPTIMIZED: Only select fields needed for list view
    const [workOrders, total] = await Promise.all([
        this.prisma.workOrders.findMany({
            where,
            select: {
                id: true,
                workOrderNumber: true,
                title: true,
                type: true,
                status: true,
                priority: true,
                scheduledDate: true,
                contactName: true,
                createdAt: true,
                pelanggan: {
                    select: {
                        id: true,
                        idPelanggan: true,
                        nama: true,
                    },
                },
                site: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                department: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                assignedTo: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            skip: (page - 1) * limit,
            take: limit,
        }),
        this.prisma.workOrders.count({ where }),
    ]);

    return {
        workOrders,
        total,
        page,
        totalPages: Math.ceil(total / limit),
    };
}
```

**Type Definition:** Add to [`modules/work-order/repositories/IWorkOrderRepository.ts`](modules/work-order/repositories/IWorkOrderRepository.ts)

```typescript
// Lightweight work order type for list views
export type WorkOrderList = {
  id: string;
  workOrderNumber: string;
  title: string;
  type: WorkOrderType;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  scheduledDate: Date | null;
  contactName: string | null;
  createdAt: Date;
  pelanggan: {
    id: string;
    idPelanggan: string;
    nama: string;
  } | null;
  site: {
    id: string;
    name: string;
  } | null;
  department: {
    id: string;
    name: string;
  } | null;
  assignedTo: {
    id: string;
    name: string;
  } | null;
};
```

### 1.2 Update API Endpoint to Use Optimized Query

**File:** [`app/api/admin/workorders/route.ts`](app/api/admin/workorders/route.ts)

**Action:** Modify GET handler (line 87)

```typescript
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Permission check
    if (!(await hasPermission("list:read"))) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to view work orders" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const type = searchParams.get("type");
    const departmentId = searchParams.get("departmentId");
    const siteId = searchParams.get("siteId");
    const assignedToId = searchParams.get("assignedToId");
    const search = searchParams.get("search");
    const unassignedOnly = searchParams.get("unassignedOnly") === "true";

    const filters: any = {};
    if (status)
      filters.status = status.includes(",") ? status.split(",") : status;
    if (priority)
      filters.priority = priority.includes(",")
        ? priority.split(",")
        : priority;
    if (type) filters.type = type.includes(",") ? type.split(",") : type;
    if (unassignedOnly) filters.unassignedOnly = true;

    // Department restriction
    const hasDepartmentRestriction = user.permissions?.includes(
      "workorders:department_only"
    );
    const hasSiteRestriction = user.permissions?.includes(
      "workorders:site_only"
    );
    const isSuperAdmin = user.role === "SUPER_ADMIN";

    if (hasDepartmentRestriction && !isSuperAdmin) {
      if (!user.departmentId) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { total: 0, pages: 0, current: page, limit },
          message: "Restricted access: No department assigned to your account.",
        });
      }
      filters.departmentId = user.departmentId;
    } else {
      if (departmentId) filters.departmentId = departmentId;
    }

    // Site restriction
    if (hasSiteRestriction && !isSuperAdmin) {
      if (!user.siteId) {
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { total: 0, pages: 0, current: page, limit },
          message: "Restricted access: No site assigned to your account.",
        });
      }
      filters.siteId = user.siteId;
    } else {
      if (siteId) filters.siteId = siteId;
    }

    // OPTIMIZED: Use lightweight query for list view
    const result = await workOrderRepo.findAllForList(filters, page, limit);

    return NextResponse.json({
      success: true,
      workOrders: result.workOrders, // Keep same response structure
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error("Error fetching work orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch work orders" },
      { status: 500 }
    );
  }
}
```

### 1.3 Optimize Recent Work Orders Query

**File:** [`modules/work-order/repositories/WorkOrderRepository.ts`](modules/work-order/repositories/WorkOrderRepository.ts)

**Action:** Update [`getRecentWorkOrders()`](modules/work-order/repositories/WorkOrderRepository.ts:1106-1154)

```typescript
async getRecentWorkOrders(limit: number = 5, filters?: WorkOrderFilters): Promise<WorkOrderList[]> {
    const where: any = {};

    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.assignedToId !== undefined) where.assignedToId = filters.assignedToId;
    if (filters?.status) {
        where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
    }

    // OPTIMIZED: Only fetch list-view fields for recent WOs
    return this.prisma.workOrders.findMany({
        where,
        select: {
            id: true,
            workOrderNumber: true,
            title: true,
            type: true,
            status: true,
            priority: true,
            createdAt: true,
            pelanggan: {
                select: {
                    id: true,
                    idPelanggan: true,
                    nama: true,
                },
            },
            site: {
                select: {
                    id: true,
                    name: true,
                    code: true,
                },
            },
            department: {
                select: {
                    id: true,
                    name: true,
                },
            },
            assignedTo: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
        take: limit,
    }) as Promise<WorkOrderList[]>;
}
```

---

## Phase 2: Dashboard Consolidation

### 2.1 Create Consolidated Dashboard Endpoint

**File:** `app/api/admin/workorders/dashboard/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WorkOrderRepository } from "@/modules/work-order/repositories/WorkOrderRepository";
import { verifyAuth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";

const workOrderRepo = new WorkOrderRepository(prisma);

/**
 * GET /api/admin/workorders/dashboard
 * Consolidated endpoint for all dashboard data
 * Reduces 7 API calls to 1
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasPermission("work_order_dashboard:read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "all_time";

    // Build filters based on period
    const filters = buildPeriodFilters(period, user);

    // Single consolidated query
    const [stats, recentWorkOrders, departmentWorkload, performers, analytics] =
      await Promise.all([
        workOrderRepo.getStatistics(filters),
        workOrderRepo.getRecentWorkOrders(5, filters),
        workOrderRepo.getDepartmentWorkload(user.departmentId),
        workOrderRepo.getTopPerformers(
          5,
          filters.dateFrom,
          filters.dateTo,
          user.departmentId
        ),
        getAnalytics(filters),
      ]);

    return NextResponse.json({
      success: true,
      data: {
        stats,
        recentWorkOrders,
        departmentWorkload,
        topPerformers: performers,
        topAssists: await workOrderRepo.getTopAssists(
          5,
          filters.dateFrom,
          filters.dateTo,
          user.departmentId
        ),
        issueStats: analytics.issues,
        siteStats: analytics.sites,
        disconnectionStats: analytics.disconnections,
        responseStats: analytics.responseStats,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

function buildPeriodFilters(period: string, user: any) {
  const now = new Date();
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;

  switch (period) {
    case "daily":
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "weekly":
      dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "monthly":
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "yearly":
      dateFrom = new Date(now.getFullYear(), 0, 1);
      break;
    case "all_time":
    default:
      // No date filter
      break;
  }

  const filters: any = {};
  if (dateFrom) filters.dateFrom = dateFrom;
  if (dateTo) filters.dateTo = dateTo;

  // Apply department/site restrictions
  const hasDepartmentRestriction = user.permissions?.includes(
    "workorders:department_only"
  );
  const hasSiteRestriction = user.permissions?.includes("workorders:site_only");
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  if (hasDepartmentRestriction && !isSuperAdmin && user.departmentId) {
    filters.departmentId = user.departmentId;
  }

  if (hasSiteRestriction && !isSuperAdmin && user.siteId) {
    filters.siteId = user.siteId;
  }

  return filters;
}

async function getAnalytics(filters: any) {
  const [issues, sites, disconnections, responseStats] = await Promise.all([
    workOrderRepo.getIssueStatistics(
      5,
      filters.dateFrom,
      filters.dateTo,
      filters.departmentId,
      filters.siteId
    ),
    workOrderRepo.getSiteStatistics(
      5,
      filters.dateFrom,
      filters.dateTo,
      filters.departmentId,
      filters.siteId
    ),
    workOrderRepo.getDisconnectionStatistics(
      filters.dateFrom,
      filters.dateTo,
      filters.departmentId,
      filters.siteId
    ),
    workOrderRepo.getAdminResponseStats(
      filters.dateFrom || new Date(),
      filters.dateTo || new Date(),
      filters.departmentId
    ),
  ]);

  return { issues, sites, disconnections, responseStats };
}
```

### 2.2 Update Dashboard Component

**File:** [`app/admin/workorders/WoIndexClient.tsx`](app/admin/workorders/WoIndexClient.tsx)

**Action:** Replace multiple API calls with single consolidated endpoint

```typescript
const fetchDashboardData = async () => {
  try {
    // OPTIMIZED: Single API call instead of 7
    const response = await fetch("/api/admin/workorders/dashboard");

    if (response.ok) {
      const result = await response.json();
      setStats(result.data.stats);
      setRecentWorkOrders(result.data.recentWorkOrders);
      setDepartmentWorkload(result.data.departmentWorkload);
      setTopPerformers(result.data.topPerformers);
      setTopAssists(result.data.topAssists);
      setIssueStats(result.data.issueStats);
      setSiteStats(result.data.siteStats);
      setDisconnectionStats(result.data.disconnectionStats);
      setResponseStats(result.data.responseStats);
    }
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
  } finally {
    setLoading(false);
  }
};

const fetchDetailedStats = async () => {
  // OPTIMIZED: Reuse consolidated endpoint with period
  try {
    const response = await fetch(
      `/api/admin/workorders/dashboard?period=${performancePeriod}`
    );

    if (response.ok) {
      const result = await response.json();
      setTopPerformers(result.data.topPerformers);
      setTopAssists(result.data.topAssists);
      setIssueStats(result.data.issueStats);
      setSiteStats(result.data.siteStats);
      setDisconnectionStats(result.data.disconnections);
      setResponseStats(result.data.responseStats);
    }
  } catch (error) {
    console.error("Error fetching detailed stats:", error);
  }
};
```

---

## Phase 3: Database Indexing

### 3.1 Create Index Migration

**File:** `prisma/migrations/XXXXXX_add_work_order_indexes/migration.sql` (NEW)

```sql
-- Enable pg_trgm extension for text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Single column indexes for frequently filtered fields
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_orders_status
    ON work_orders(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_orders_priority
    ON work_orders(priority);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_orders_type
    ON work_orders(type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_orders_department_id
    ON work_orders(departmentId);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_orders_site_id
    ON work_orders(siteId);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_orders_assigned_to_id
    ON work_orders(assignedToId);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_orders_pelanggan_id
    ON work_orders(pelangganId);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_orders_created_at
    ON work_orders(createdAt DESC);

-- Composite indexes for common filter combinations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_orders_status_created
    ON work_orders(status, createdAt DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_orders_department_status
    ON work_orders(departmentId, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_orders_site_status
    ON work_orders(siteId, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_orders_priority_status
    ON work_orders(priority, status);

-- Index for scheduled work orders
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_orders_scheduled_date
    ON work_orders(scheduledDate)
    WHERE scheduledDate IS NOT NULL;

-- Full-text search indexes using trigram
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_orders_title_trgm
    ON work_orders USING gin(title gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_orders_description_trgm
    ON work_orders USING gin(description gin_trgm_ops);

-- Indexes for related tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_order_tasks_work_order_id
    ON work_order_tasks(workOrderId);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_order_tasks_status
    ON work_order_tasks(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_order_assignments_work_order_id
    ON work_order_assignments(workOrderId);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_order_assignments_user_id
    ON work_order_assignments(userId);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_order_assignments_status
    ON work_order_assignments(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_order_updates_work_order_id
    ON work_order_updates(workOrderId);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_order_updates_created_at
    ON work_order_updates(createdAt DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_work_order_attachments_work_order_id
    ON work_order_attachments(workOrderId);
```

### 3.2 Apply Migration

**Command:**

```bash
npx prisma migrate dev --name add_work_order_indexes
```

---

## Phase 4: Caching Layer

### 4.1 Create Cache Utility

**File:** `lib/cache/WorkOrderCache.ts` (NEW)

```typescript
import { Redis } from "ioredis";

interface CacheConfig {
  STATS_TTL: number;
  LIST_TTL: number;
  DETAIL_TTL: number;
  DASHBOARD_TTL: number;
}

class WorkOrderCache {
  private redis: Redis | null;
  private readonly config: CacheConfig = {
    STATS_TTL: 300, // 5 minutes
    LIST_TTL: 60, // 1 minute
    DETAIL_TTL: 300, // 5 minutes
    DASHBOARD_TTL: 120, // 2 minutes
  };

  constructor() {
    // Only initialize Redis if URL is provided
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });
      console.log("[WorkOrderCache] Redis initialized");
    } else {
      console.warn("[WorkOrderCache] Redis not configured - caching disabled");
    }
  }

  private isEnabled(): boolean {
    return this.redis !== null;
  }

  // Stats cache
  async getStats(filters: string): Promise<any | null> {
    if (!this.isEnabled()) return null;
    try {
      const key = `wo:stats:${filters}`;
      const cached = await this.redis!.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error("[WorkOrderCache] Error getting stats:", error);
      return null;
    }
  }

  async setStats(filters: string, data: any): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      const key = `wo:stats:${filters}`;
      await this.redis!.setex(key, this.config.STATS_TTL, JSON.stringify(data));
    } catch (error) {
      console.error("[WorkOrderCache] Error setting stats:", error);
    }
  }

  // List cache
  async getList(page: number, filters: string): Promise<any | null> {
    if (!this.isEnabled()) return null;
    try {
      const key = `wo:list:${page}:${filters}`;
      const cached = await this.redis!.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error("[WorkOrderCache] Error getting list:", error);
      return null;
    }
  }

  async setList(page: number, filters: string, data: any): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      const key = `wo:list:${page}:${filters}`;
      await this.redis!.setex(key, this.config.LIST_TTL, JSON.stringify(data));
    } catch (error) {
      console.error("[WorkOrderCache] Error setting list:", error);
    }
  }

  // Dashboard cache
  async getDashboard(period: string, filters: string): Promise<any | null> {
    if (!this.isEnabled()) return null;
    try {
      const key = `wo:dashboard:${period}:${filters}`;
      const cached = await this.redis!.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error("[WorkOrderCache] Error getting dashboard:", error);
      return null;
    }
  }

  async setDashboard(
    period: string,
    filters: string,
    data: any
  ): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      const key = `wo:dashboard:${period}:${filters}`;
      await this.redis!.setex(
        key,
        this.config.DASHBOARD_TTL,
        JSON.stringify(data)
      );
    } catch (error) {
      console.error("[WorkOrderCache] Error setting dashboard:", error);
    }
  }

  // Cache invalidation
  async invalidateStats(filters: string): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      const pattern = `wo:stats:${filters}*`;
      const keys = await this.redis!.keys(pattern);
      if (keys.length > 0) {
        await this.redis!.del(...keys);
        console.log(
          `[WorkOrderCache] Invalidated ${keys.length} stats cache entries`
        );
      }
    } catch (error) {
      console.error("[WorkOrderCache] Error invalidating stats:", error);
    }
  }

  async invalidateList(filters: string): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      const pattern = `wo:list:*:${filters}*`;
      const keys = await this.redis!.keys(pattern);
      if (keys.length > 0) {
        await this.redis!.del(...keys);
        console.log(
          `[WorkOrderCache] Invalidated ${keys.length} list cache entries`
        );
      }
    } catch (error) {
      console.error("[WorkOrderCache] Error invalidating list:", error);
    }
  }

  async invalidateDashboard(filters: string): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      const pattern = `wo:dashboard:*:${filters}*`;
      const keys = await this.redis!.keys(pattern);
      if (keys.length > 0) {
        await this.redis!.del(...keys);
        console.log(
          `[WorkOrderCache] Invalidated ${keys.length} dashboard cache entries`
        );
      }
    } catch (error) {
      console.error("[WorkOrderCache] Error invalidating dashboard:", error);
    }
  }

  async invalidateAll(): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      const pattern = "wo:*";
      const keys = await this.redis!.keys(pattern);
      if (keys.length > 0) {
        await this.redis!.del(...keys);
        console.log(
          `[WorkOrderCache] Invalidated all ${keys.length} cache entries`
        );
      }
    } catch (error) {
      console.error("[WorkOrderCache] Error invalidating all:", error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      console.log("[WorkOrderCache] Redis disconnected");
    }
  }
}

// Singleton instance
export const workOrderCache = new WorkOrderCache();
```

### 4.2 Integrate Cache into API Endpoints

**File:** [`app/api/admin/workorders/route.ts`](app/api/admin/workorders/route.ts)

```typescript
import { workOrderCache } from "@/lib/cache/WorkOrderCache";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasPermission("list:read"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // Build filters...
    const filters = buildFilters(searchParams, user);
    const cacheKey = JSON.stringify(filters);

    // Try cache first
    const cached = await workOrderCache.getList(page, cacheKey);
    if (cached) {
      console.log("[WorkOrderAPI] Cache hit for list");
      return NextResponse.json({
        success: true,
        workOrders: cached.workOrders,
        total: cached.total,
        page: cached.page,
        totalPages: cached.totalPages,
      });
    }

    console.log("[WorkOrderAPI] Cache miss for list");

    // Query database
    const result = await workOrderRepo.findAllForList(filters, page, limit);

    // Cache result
    await workOrderCache.setList(page, cacheKey, result);

    return NextResponse.json({
      success: true,
      workOrders: result.workOrders,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error("Error fetching work orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch work orders" },
      { status: 500 }
    );
  }
}
```

### 4.3 Cache Invalidation on Mutations

**File:** [`app/api/admin/workorders/route.ts`](app/api/admin/workorders/route.ts)

```typescript
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await hasPermission("list:create"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // ... validation ...

    const workOrder = await workOrderRepo.create({
      ...body,
      createdById: user.id,
    });

    // Invalidate cache after creation
    await workOrderCache.invalidateAll();

    // ... notifications ...

    return NextResponse.json(
      {
        success: true,
        data: workOrder,
        message: "Work order created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating work order:", error);
    return NextResponse.json(
      { error: "Failed to create work order" },
      { status: 500 }
    );
  }
}
```

**File:** [`app/api/admin/workorders/[id]/route.ts`](app/api/admin/workorders/[id]/route.ts)

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workOrderId = params.id;
    const body = await request.json();

    // ... update logic ...

    // Invalidate cache after update
    await workOrderCache.invalidateAll();

    return NextResponse.json({
      success: true,
      data: updatedWorkOrder,
      message: "Work order updated successfully",
    });
  } catch (error) {
    console.error("Error updating work order:", error);
    return NextResponse.json(
      { error: "Failed to update work order" },
      { status: 500 }
    );
  }
}
```

---

## Phase 5: Frontend Optimizations

### 5.1 Implement Debounced Search

**File:** `hooks/useDebouncedCallback.ts` (NEW)

```typescript
import { useEffect, useRef } from "react";

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  };
}
```

**File:** [`app/admin/workorders/list/WoListClient.tsx`](app/admin/workorders/list/WoListClient.tsx)

```typescript
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

// In component
const [searchInput, setSearchInput] = useState("");
const [search, setSearch] = useState("");

// Debounce search with 300ms delay
const debouncedSearch = useDebouncedCallback((value: string) => {
  setSearch(value);
}, 300);

const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setSearchInput(e.target.value);
  debouncedSearch(e.target.value);
};

// In JSX
<input
  type="text"
  placeholder="Search by work order number, title..."
  value={searchInput}
  onChange={handleSearchChange}
  className="..."
/>;
```

### 5.2 Add Virtual Scrolling

**Install dependency:**

```bash
npm install @tanstack/react-virtual
```

**File:** `app/admin/workorders/list/WoListVirtual.tsx` (NEW)

```typescript
"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { WorkOrder, Column } from "./WoListClient";

interface Props {
  workOrders: WorkOrder[];
  columns: Column<WorkOrder>[];
  renderActions: (wo: WorkOrder) => React.ReactNode;
  onRowClick: (wo: WorkOrder) => void;
}

export function WoListVirtual({
  workOrders,
  columns,
  renderActions,
  onRowClick,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: workOrders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated row height in pixels
    overscan: 5, // Render 5 extra items above/below viewport
  });

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const workOrder = workOrders[virtualRow.index];
          return (
            <div
              key={workOrder.id}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              onClick={() => onRowClick(workOrder)}
              className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
            >
              <WorkOrderRow
                workOrder={workOrder}
                columns={columns}
                renderActions={renderActions}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WorkOrderRow({
  workOrder,
  columns,
  renderActions,
}: {
  workOrder: WorkOrder;
  columns: Column<WorkOrder>[];
  renderActions: (wo: WorkOrder) => React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-8 gap-4 px-4 py-3 items-center">
      {columns.map((column) => (
        <div key={column.key}>{column.render(workOrder)}</div>
      ))}
      <div>{renderActions(workOrder)}</div>
    </div>
  );
}
```

**Update [`WoListClient.tsx`](app/admin/workorders/list/WoListClient.tsx):**

```typescript
import { WoListVirtual } from "./WoListVirtual";

// Replace ResponsiveTable with WoListVirtual
<WoListVirtual
  data={workOrders}
  columns={columns}
  renderActions={renderActions}
  onRowClick={(wo) => router.push(`/admin/workorders/${wo.id}`)}
/>;
```

### 5.3 Implement Optimistic Updates

**File:** [`app/admin/workorders/list/WoListClient.tsx`](app/admin/workorders/list/WoListClient.tsx)

```typescript
const handleVerify = async (id: string, e: React.MouseEvent) => {
  e.stopPropagation();

  if (!confirm("Are you sure you want to verify this work order?")) return;

  // Optimistic update
  const previousWorkOrders = [...workOrders];
  setWorkOrders((prev) =>
    prev.map((wo) => (wo.id === id ? { ...wo, status: "VERIFIED" } : wo))
  );

  setProcessingApproval(true);

  try {
    const response = await fetch(`/api/admin/workorders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "VERIFIED" }),
    });

    if (!response.ok) {
      // Rollback on error
      setWorkOrders(previousWorkOrders);
      alert("Failed to verify work order");
    }
  } catch (error) {
    // Rollback on error
    setWorkOrders(previousWorkOrders);
    console.error("Error verifying:", error);
    alert("An error occurred");
  } finally {
    setProcessingApproval(false);
  }
};

const handleReject = async () => {
  if (!rejectReason.trim()) {
    alert("Please provide a rejection reason");
    return;
  }

  if (!selectedWorkOrderId) return;

  // Optimistic update
  const previousWorkOrders = [...workOrders];
  setWorkOrders((prev) =>
    prev.map((wo) =>
      wo.id === selectedWorkOrderId ? { ...wo, status: "IN_PROGRESS" } : wo
    )
  );

  setProcessingApproval(true);

  try {
    const response = await fetch(
      `/api/admin/workorders/${selectedWorkOrderId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "IN_PROGRESS",
          rejectionReason: rejectReason,
        }),
      }
    );

    if (response.ok) {
      setShowRejectModal(false);
      setRejectReason("");
      setSelectedWorkOrderId(null);
    } else {
      // Rollback on error
      setWorkOrders(previousWorkOrders);
      alert("Failed to reject work order");
    }
  } catch (error) {
    // Rollback on error
    setWorkOrders(previousWorkOrders);
    console.error("Error rejecting:", error);
    alert("An error occurred");
  } finally {
    setProcessingApproval(false);
  }
};
```

### 5.4 Add Skeleton Loading States

**File:** `components/work-order/WorkOrderSkeleton.tsx` (NEW)

```typescript
export function WorkOrderSkeleton() {
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3">
      <div className="grid grid-cols-8 gap-4 items-center">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    </div>
  );
}
```

**Usage in [`WoListClient.tsx`](app/admin/workorders/list/WoListClient.tsx):**

```typescript
import { WorkOrderSkeleton } from "@/components/work-order/WorkOrderSkeleton";

// In JSX
{
  loading ? (
    <div className="space-y-1">
      {[...Array(10)].map((_, i) => (
        <WorkOrderSkeleton key={i} />
      ))}
    </div>
  ) : (
    <WoListVirtual
      data={workOrders}
      columns={columns}
      renderActions={renderActions}
      onRowClick={(wo) => router.push(`/admin/workorders/${wo.id}`)}
    />
  );
}
```

---

## Phase 6: Testing & Monitoring

### 6.1 Performance Testing Script

**File:** `scripts/test-work-order-performance.ts` (NEW)

```typescript
import { prisma } from "@/lib/prisma";
import { WorkOrderRepository } from "@/modules/work-order/repositories/WorkOrderRepository";

const workOrderRepo = new WorkOrderRepository(prisma);

async function testPerformance() {
  console.log("=== Work Order Performance Test ===\n");

  // Test 1: List query
  console.log("Test 1: List query (20 items)");
  const start1 = Date.now();
  await workOrderRepo.findAllForList({}, 1, 20);
  const time1 = Date.now() - start1;
  console.log(`  Time: ${time1}ms`);
  console.log(
    `  Status: ${time1 < 100 ? "✓ PASS" : "✗ FAIL"} (target: <100ms)\n`
  );

  // Test 2: Statistics query
  console.log("Test 2: Statistics query");
  const start2 = Date.now();
  await workOrderRepo.getStatistics({});
  const time2 = Date.now() - start2;
  console.log(`  Time: ${time2}ms`);
  console.log(
    `  Status: ${time2 < 50 ? "✓ PASS" : "✗ FAIL"} (target: <50ms)\n`
  );

  // Test 3: Recent work orders
  console.log("Test 3: Recent work orders (5 items)");
  const start3 = Date.now();
  await workOrderRepo.getRecentWorkOrders(5, {});
  const time3 = Date.now() - start3;
  console.log(`  Time: ${time3}ms`);
  console.log(
    `  Status: ${time3 < 50 ? "✓ PASS" : "✗ FAIL"} (target: <50ms)\n`
  );

  // Test 4: Dashboard data
  console.log("Test 4: Dashboard data (all queries)");
  const start4 = Date.now();
  await Promise.all([
    workOrderRepo.getStatistics({}),
    workOrderRepo.getRecentWorkOrders(5, {}),
    workOrderRepo.getDepartmentWorkload(),
  ]);
  const time4 = Date.now() - start4;
  console.log(`  Time: ${time4}ms`);
  console.log(
    `  Status: ${time4 < 200 ? "✓ PASS" : "✗ FAIL"} (target: <200ms)\n`
  );

  // Summary
  const totalTime = time1 + time2 + time3 + time4;
  console.log("=== Summary ===");
  console.log(`  Total time: ${totalTime}ms`);
  console.log(`  Average: ${Math.round(totalTime / 4)}ms`);
  console.log(
    `  Overall: ${totalTime < 400 ? "✓ PASS" : "✗ FAIL"} (target: <400ms)`
  );
}

testPerformance()
  .then(() => {
    console.log("\n✓ Tests completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n✗ Tests failed:", error);
    process.exit(1);
  });
```

**Run test:**

```bash
npx tsx scripts/test-work-order-performance.ts
```

### 6.2 Load Testing with k6

**File:** `scripts/load-test-work-orders.js` (NEW)

```javascript
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 10 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 100 },
    { duration: "1m", target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests under 500ms
    http_req_failed: ["rate<0.01"], // Less than 1% error rate
  },
};

export default function () {
  // Test list endpoint
  const listRes = http.get(
    "http://localhost:3000/api/admin/workorders?page=1&limit=20",
    {
      headers: { Cookie: "session=..." }, // Add auth cookie
    }
  );

  check(listRes, {
    "list status is 200": (r) => r.status === 200,
    "list response time < 500ms": (r) => r.timings.duration < 500,
    "list response size < 50KB": (r) => r.body.length < 50000,
  });

  // Test dashboard endpoint
  const dashboardRes = http.get(
    "http://localhost:3000/api/admin/workorders/dashboard",
    {
      headers: { Cookie: "session=..." },
    }
  );

  check(dashboardRes, {
    "dashboard status is 200": (r) => r.status === 200,
    "dashboard response time < 1000ms": (r) => r.timings.duration < 1000,
  });

  sleep(1);
}
```

**Run load test:**

```bash
k6 run scripts/load-test-work-orders.js
```

### 6.3 Performance Monitoring

**File:** `lib/monitoring/performanceMonitor.ts` (NEW)

```typescript
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);

    // Keep only last 100 measurements
    const values = this.metrics.get(name)!;
    if (values.length > 100) {
      values.shift();
    }
  }

  getStats(name: string) {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;

    return {
      count: values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  printReport() {
    console.log("\n=== Performance Report ===");
    for (const [name, values] of this.metrics.entries()) {
      const stats = this.getStats(name);
      if (stats) {
        console.log(`\n${name}:`);
        console.log(`  Count: ${stats.count}`);
        console.log(`  Min:   ${stats.min}ms`);
        console.log(`  Avg:   ${stats.avg.toFixed(2)}ms`);
        console.log(`  P50:   ${stats.p50}ms`);
        console.log(`  P95:   ${stats.p95}ms`);
        console.log(`  P99:   ${stats.p99}ms`);
        console.log(`  Max:   ${stats.max}ms`);
      }
    }
  }
}

export const perfMonitor = new PerformanceMonitor();
```

**Usage in API:**

```typescript
// app/api/admin/workorders/route.ts

import { perfMonitor } from "@/lib/monitoring/performanceMonitor";

export async function GET(request: NextRequest) {
  const start = Date.now();

  try {
    // ... existing logic ...

    const duration = Date.now() - start;
    perfMonitor.recordMetric("workorder_list_api", duration);

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const duration = Date.now() - start;
    perfMonitor.recordMetric("workorder_list_api_error", duration);
    throw error;
  }
}
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All performance tests passing
- [ ] Load tests completed with acceptable results
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Backup created

### Deployment Steps

1. **Database Indexes**

   ```bash
   npx prisma migrate deploy
   ```

2. **Backend Changes**

   ```bash
   # Deploy new code
   git push origin main
   # CI/CD will deploy
   ```

3. **Redis Setup** (if not already configured)

   ```bash
   # Add REDIS_URL to environment variables
   echo "REDIS_URL=redis://localhost:6379" >> .env.production
   ```

4. **Frontend Changes**
   ```bash
   # Deploy new frontend code
   npm run build
   # Deploy to production
   ```

### Post-Deployment

- [ ] Verify API endpoints responding correctly
- [ ] Check cache hit rates
- [ ] Monitor error rates
- [ ] Run performance tests against production
- [ ] Compare with baseline metrics

---

## Rollback Plan

If issues occur after deployment:

1. **Disable Cache**

   ```bash
   # Remove REDIS_URL from environment
   # System will degrade gracefully
   ```

2. **Revert Backend Code**

   ```bash
   git revert <commit-hash>
   git push origin main
   ```

3. **Drop Indexes** (if causing issues)
   ```sql
   DROP INDEX CONCURRENTLY IF EXISTS idx_work_orders_status;
   -- ... drop other indexes
   ```

---

## Success Criteria

### Performance Metrics

- [ ] List page load time < 150ms (90% improvement)
- [ ] Dashboard load time < 300ms (87% improvement)
- [ ] API response size < 50KB (90% improvement)
- [ ] Database query time < 50ms (90% improvement)
- [ ] Cache hit rate > 80%

### User Experience

- [ ] Instant search results with debouncing
- [ ] Smooth scrolling through large lists
- [ ] Immediate feedback on actions
- [ ] No visible loading delays
- [ ] Mobile performance acceptable

### Scalability

- [ ] Performance constant with 1,000 work orders
- [ ] Performance constant with 10,000 work orders
- [ ] Performance constant with 100,000 work orders
- [ ] Database CPU usage < 50%
- [ ] Memory usage stable

---

## Troubleshooting

### Issue: Cache Not Working

**Symptoms:** High database load, slow responses

**Diagnosis:**

```bash
# Check Redis connection
redis-cli ping

# Check cache keys
redis-cli keys "wo:*"

# Check cache hit rate
redis-cli info stats
```

**Solution:**

- Verify REDIS_URL is set correctly
- Check Redis server is running
- Review cache logs for errors

### Issue: Indexes Not Used

**Symptoms:** Slow queries despite indexes

**Diagnosis:**

```sql
-- Check query plan
EXPLAIN ANALYZE
SELECT * FROM work_orders WHERE status = 'PENDING' ORDER BY createdAt DESC LIMIT 20;
```

**Solution:**

- Run `ANALYZE work_orders;` to update statistics
- Check if query matches index pattern
- Consider composite indexes for complex queries

### Issue: Virtual Scrolling Issues

**Symptoms:** Incorrect rendering, scroll problems

**Diagnosis:**

- Check browser console for errors
- Verify row height estimation
- Test with different data volumes

**Solution:**

- Adjust `estimateSize` in virtualizer config
- Ensure proper key prop is set
- Test with React DevTools Profiler

---

**Implementation Guide Version:** 1.0  
**Last Updated:** 2025-01-11  
**Next Review:** After implementation completion
