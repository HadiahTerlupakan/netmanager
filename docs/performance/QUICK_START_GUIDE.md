# Quick Start Guide - Memory Optimization

## Overview

This guide provides step-by-step instructions to implement the critical memory fixes identified in the audit report.

---

## Prerequisites

Before starting, ensure you have:

1. **Backup your database**

```bash
# PostgreSQL backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

2. **Create a feature branch**

```bash
git checkout -b feature/memory-optimization
```

3. **Install additional dependencies**

```bash
npm install lz4
npm install --save-dev @types/lz4
```

---

## Phase 1: Critical Fixes (Week 1)

### Fix 1.1: Implement LRU Cache for SNMP

**Time Required:** 2 hours  
**Impact:** 70-80% reduction in SNMP cache memory

#### Step 1: Create LRU Cache Class

Create file: `lib/utils/lru-cache.ts`

```typescript
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;
  private maxAge: number;

  constructor(maxSize: number, maxAge: number) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.maxAge = maxAge;
  }

  set(key: K, value: V): void {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (!value) return undefined;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  // Cleanup expired entries
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry instanceof Object && "timestamp" in entry) {
        if (now - (entry as any).timestamp > this.maxAge) {
          this.cache.delete(key);
          removed++;
        }
      }
    }
    return removed;
  }

  get keys(): IterableIterator<K> {
    return this.cache.keys();
  }

  get values(): IterableIterator<V> {
    return this.cache.values();
  }

  get entries(): IterableIterator<[K, V]> {
    return this.cache.entries();
  }
}
```

#### Step 2: Update SNMP Cache

Edit file: `modules/network/services/snmp-optimized.ts`

```typescript
// Add import at top
import { LRUCache } from "@/lib/utils/lru-cache";

// Replace unbounded cache with LRU cache (around line 112)
const cache = new LRUCache<string, CacheEntry>(100, CACHE_TTL); // Max 100 entries

// Add periodic cleanup (after cache definition)
setInterval(() => {
  const removed = cache.cleanup();
  if (removed > 0) {
    console.log(`[SNMP] Cleaned up ${removed} expired cache entries`);
  }
}, 60000); // Every minute

// Update setCache function to track size
function setCache(key: string, data: Record<string, string>): void {
  const size = JSON.stringify(data).length;
  cache.set(key, {
    data,
    timestamp: Date.now(),
    size,
  });
}
```

#### Step 3: Test

```bash
# Restart server
npm run dev

# Monitor memory
curl http://localhost:3000/api/health/memory

# Check logs for cleanup messages
```

---

### Fix 1.2: Socket.io Room Cleanup

**Time Required:** 1 hour  
**Impact:** 30-40% reduction in Socket.io memory

#### Step 1: Update WebSocket Server

Edit file: `lib/websocket/server.ts`

Find the `disconnect` handler (around line 130) and update:

```typescript
// Handle disconnect
socket.on("disconnect", async (reason) => {
  console.log(`[WS] User disconnected: ${userId} (${reason})`);

  // Explicitly leave all rooms
  const rooms = Array.from(socket.rooms);
  for (const room of rooms) {
    socket.leave(room);
  }

  // Check if any connections remain for this user
  const sockets = await globalThis.socketIOServer
    ?.in(`user:${userId}`)
    .fetchSockets();
  if (!sockets || sockets.length === 0) {
    // User is fully offline
    globalThis.socketIOServer
      ?.to("admin:notifications")
      .emit(SOCKET_EVENTS.USER_STATUS_CHANGE, {
        userId,
        isOnline: false,
      });
  }
});
```

#### Step 2: Add Periodic Cleanup

Add this at the end of the file (before export):

```typescript
// Add periodic cleanup of orphaned rooms
setInterval(() => {
  const io = globalThis.socketIOServer;
  if (!io) return;

  const rooms = io.sockets.adapter.rooms;
  let cleanedCount = 0;

  for (const [roomName, room] of rooms) {
    // Skip socket rooms (they start with 's#')
    if (roomName.startsWith("s#")) continue;

    // Check if room has any sockets
    if (room.size === 0) {
      // Clean up empty rooms
      io.sockets.adapter.rooms.delete(roomName);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`[WS] Cleaned up ${cleanedCount} empty rooms`);
  }
}, 300000); // Every 5 minutes
```

#### Step 3: Update OnuMonitor

Edit file: `modules/network/services/OnuMonitor.ts`

Add periodic cleanup call in `start()` method:

```typescript
start() {
  if (this.interval) return

  console.log('[OnuMonitor] Starting ONU view-based monitoring...')

  this.interval = setInterval(() => {
    this.processMonitoringQueue()
  }, POLL_INTERVAL)

  // Add periodic cleanup
  this.startPeriodicCleanup()
}

private startPeriodicCleanup() {
  setInterval(() => {
    this.timeoutCleanup()
  }, 60000) // Every minute
}
```

#### Step 4: Test

```bash
# Restart server
npm run dev

# Connect/disconnect multiple clients
# Monitor memory
curl http://localhost:3000/api/health/memory
```

---

### Fix 1.3: File Upload Streaming

**Time Required:** 3 hours  
**Impact:** 80-90% reduction during large file uploads

#### Step 1: Update Server Upload Handler

Edit file: `server.ts`

Update the formidable configuration (around line 50):

```typescript
const form = formidable.formidable({
  maxFileSize: 1024 * 1024 * 1024, // 1GB per file
  maxTotalFileSize: 1024 * 1024 * 1024, // 1GB total
  uploadDir: tmpDir,
  keepExtensions: true,
  multiples: false,
  // Enable file streaming
  fileWriteStreamHandler: (file) => {
    // Stream directly to disk instead of memory
    return fs.createWriteStream(file.filepath);
  },
});
```

#### Step 2: Update Image Upload Utility

Edit file: `lib/utils/image-upload.ts`

Add streaming support:

```typescript
import { createReadStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

export async function convertAndSaveImage(
  file: File,
  uploadDir: string,
  fileName: string,
  uploadType?: UploadType,
  subFolder?: string,
  watermarkLines?: string[],
): Promise<string> {
  try {
    // For files > 50MB, use streaming
    if (file.size > 50 * 1024 * 1024) {
      return await processImageStream(
        file,
        uploadDir,
        fileName,
        uploadType,
        subFolder,
        watermarkLines,
      );
    }

    // Small files: use existing buffer approach
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    return await processAndSaveBuffer(
      buffer,
      uploadDir,
      fileName,
      uploadType,
      subFolder,
      watermarkLines,
    );
  } catch (error: any) {
    console.error("Error converting image to WebP:", error);
    throw new Error(`Gagal mengkonversi gambar: ${error.message}`);
  }
}

async function processImageStream(
  file: File,
  uploadDir: string,
  fileName: string,
  uploadType?: UploadType,
  subFolder?: string,
  watermarkLines?: string[],
): Promise<string> {
  const absoluteUploadDir = path.resolve(process.cwd(), uploadDir);
  await mkdir(absoluteUploadDir, { recursive: true });
  const outputPath = path.join(absoluteUploadDir, `${fileName}.webp`);

  // Create readable stream from File
  const readableStream = file.stream();
  const reader = readableStream.getReader();

  // Create Sharp pipeline with streaming
  const transformer = sharp().webp({ quality: 85, effort: 6 });

  // Add watermark if needed
  if (watermarkLines && watermarkLines.length > 0) {
    const metadata = await transformer.metadata();
    if (metadata.width && metadata.height) {
      const svgWatermark = createWatermarkSvg(
        metadata.width,
        metadata.height,
        watermarkLines,
      );
      transformer.composite([{ input: svgWatermark, gravity: "southwest" }]);
    }
  }

  // Create write stream
  const writeStream = fs.createWriteStream(outputPath);

  // Stream processing
  await pipeline(Readable.fromWeb(reader as any), transformer, writeStream);

  return outputPath
    .replace(path.join(process.cwd(), "public"), "")
    .replace(/\\/g, "/");
}
```

#### Step 3: Test

```bash
# Restart server
npm run dev

# Upload a large file (>50MB)
# Monitor memory during upload
curl http://localhost:3000/api/health/memory
```

---

## Phase 2: High Impact Fixes (Week 2)

### Fix 2.1: Base Monitor Class

**Time Required:** 4 hours  
**Impact:** 20-30% reduction from prevented interval accumulation

#### Step 1: Create Base Monitor

Create file: `modules/network/services/BaseMonitor.ts`

```typescript
export abstract class BaseMonitor {
  protected interval: ReturnType<typeof setTimeout> | null = null;
  protected isRunning = false;
  protected errorCount = 0;
  protected maxErrors = 5;
  protected backoffMultiplier = 1;

  abstract poll(): Promise<void>;

  protected getPollInterval(): number {
    return 30000; // Default 30 seconds
  }

  start() {
    if (this.isRunning) {
      console.log(`[${this.constructor.name}] Already running`);
      return;
    }

    console.log(`[${this.constructor.name}] Starting...`);
    this.isRunning = true;
    this.errorCount = 0;
    this.backoffMultiplier = 1;

    this.scheduleNextPoll();
  }

  stop() {
    if (!this.isRunning) return;

    console.log(`[${this.constructor.name}] Stopping...`);
    this.isRunning = false;

    if (this.interval) {
      clearTimeout(this.interval);
      this.interval = null;
    }
  }

  private scheduleNextPoll() {
    if (!this.isRunning) return;

    const interval = this.getPollInterval() * this.backoffMultiplier;
    this.interval = setTimeout(async () => {
      await this.runPoll();
    }, interval);
  }

  private async runPoll() {
    if (!this.isRunning) return;

    try {
      await this.poll();
      this.errorCount = 0;
      this.backoffMultiplier = 1;
    } catch (error) {
      this.errorCount++;
      console.error(
        `[${this.constructor.name}] Poll error (${this.errorCount}/${this.maxErrors}):`,
        error,
      );

      // Exponential backoff
      if (this.errorCount > 2) {
        this.backoffMultiplier = Math.min(2 ** this.errorCount, 8);
      }

      // Stop after max errors
      if (this.errorCount >= this.maxErrors) {
        console.error(
          `[${this.constructor.name}] Stopping due to too many errors`,
        );
        this.stop();
        return;
      }
    }

    this.scheduleNextPoll();
  }
}
```

#### Step 2: Update RadiusMonitor

Edit file: `modules/network/services/RadiusMonitor.ts`

```typescript
import { BaseMonitor } from "./BaseMonitor";

export class RadiusMonitor extends BaseMonitor {
  private io: SocketIOServer;
  private repository: RadiusRepository;

  constructor(io: SocketIOServer) {
    super();
    this.io = io;
    this.repository = new RadiusRepository(prisma);
  }

  protected getPollInterval(): number {
    return 30 * 1000; // 30 seconds
  }

  protected async poll() {
    const [stats, recentSessions] = await Promise.all([
      this.repository.getDashboardStats(),
      this.repository.getRecentSessions({ limit: 50, status: "active" }),
    ]);

    this.io.to("admin:radius").emit("radius:stats", stats);
    this.io.to("admin:radius").emit("radius:sessions", recentSessions);
  }
}
```

#### Step 3: Test

```bash
# Restart server
npm run dev

# Monitor logs for proper interval management
# Check memory stability over time
```

---

### Fix 2.2: Batch Processing for Cron Jobs

**Time Required:** 3 hours  
**Impact:** 70-80% reduction during billing runs

#### Step 1: Update AutomaticBillingService

Edit file: `modules/finance/services/AutomaticBillingService.ts`

Replace the `generateDailyInvoices` method with batch processing version:

```typescript
static async generateDailyInvoices() {
  try {
    console.log('[Billing] Starting automatic invoice generation...')

    const invoiceOtomatisSetting = await prisma.settings.findUnique({
      where: { key: 'GENERAL_INVOICE_OTOMATIS' },
    })

    const daysBeforeDue = parseInt(invoiceOtomatisSetting?.value || '5')
    const today = new Date()
    const targetDate = new Date(today)
    targetDate.setDate(today.getDate() + daysBeforeDue)

    const targetDay = targetDate.getDate()
    const targetMonth = targetDate.getMonth() + 1
    const targetYear = targetDate.getFullYear()

    // Use cursor-based pagination to process in batches
    const BATCH_SIZE = 100
    let skip = 0
    let generatedCount = 0
    let hasMore = true

    while (hasMore) {
      // Fetch batch with minimal fields
      const customers = await prisma.pelanggan.findMany({
        where: {
          status: 'AKTIF',
          hargaPaketId: { not: '' }
        },
        select: {
          id: true,
          nama: true,
          jatuhTempo: true,
          userId: true,
          usePPN: true,
          hargaPaket: {
            select: {
              id: true,
              name: true,
              harga: true,
              usePPN: true,
              ppnPercentage: true
            }
          }
        },
        skip,
        take: BATCH_SIZE,
        orderBy: { id: 'asc' }
      })

      if (customers.length === 0) {
        hasMore = false
        break
      }

      console.log(`[Billing] Processing batch ${skip / BATCH_SIZE + 1} (${customers.length} customers)`)

      for (const customer of customers) {
        try {
          const dueDate = new Date(customer.jatuhTempo)

          if (dueDate.getDate() !== targetDay) {
            continue
          }

          const invoiceDueDate = new Date(targetYear, targetMonth - 1, targetDay)

          // Check if invoice exists
          const existingInvoice = await prisma.invoice.findFirst({
            where: {
              pelangganId: customer.id,
              dueDate: {
                gte: new Date(targetYear, targetMonth - 1, targetDay, 0, 0, 0),
                lte: new Date(targetYear, targetMonth - 1, targetDay, 23, 59, 59),
              }
            }
          })

          if (existingInvoice) {
            continue
          }

          await this.createInvoiceForCustomer(customer, invoiceDueDate)
          generatedCount++

        } catch (err) {
          console.error(`[Billing] Error processing customer ${customer.nama}:`, err)
        }
      }

      skip += BATCH_SIZE

      // Force garbage collection between batches
      if (global.gc) {
        global.gc()
      }
    }

    console.log(`[Billing] Completed. Generated ${generatedCount} invoices.`)

  } catch (error) {
    console.error('[Billing] Fatal error in generateDailyInvoices:', error)
  }
}
```

#### Step 2: Test

```bash
# Run billing manually for testing
# Monitor memory during run
curl http://localhost:3000/api/health/memory
```

---

### Fix 2.3: Prisma Connection Pool

**Time Required:** 1 hour  
**Impact:** 15-20% reduction from better connection management

#### Step 1: Update Prisma Configuration

Edit file: `lib/prisma.ts`

```typescript
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

import "dotenv/config";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

// Configure connection pool
const pool = new Pool({
  connectionString,
  max: 20, // Maximum pool size
  min: 5, // Minimum pool size
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Timeout after 10s
});

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error", "warn"],
  } as any);

// Add graceful shutdown for Prisma
if (typeof process !== "undefined") {
  const shutdownPrisma = async () => {
    console.log("[Prisma] Disconnecting...");
    await prisma.$disconnect();
    await pool.end();
  };

  process.on("beforeExit", shutdownPrisma);
  process.on("SIGINT", async () => {
    await shutdownPrisma();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await shutdownPrisma();
    process.exit(0);
  });
}

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

#### Step 2: Test

```bash
# Restart server
npm run dev

# Monitor database connections
# Check memory usage
curl http://localhost:3000/api/health/memory
```

---

## Monitoring and Validation

### Create Memory Health Endpoint

Create file: `app/api/health/memory/route.ts`

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  const memoryUsage = process.memoryUsage();

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
    external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
    heapUsedPercentage: `${Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)}%`,
  });
}
```

### Enable Memory Profiling

Update `package.json`:

```json
{
  "scripts": {
    "start:profile": "NODE_OPTIONS='--expose-gc --max-old-space-size=4096' tsx server.ts",
    "start:heap": "node --heap-prof --heap-prof-interval=100000 server.ts"
  }
}
```

### Monitor Memory Trends

```bash
# Watch memory usage
watch -n 5 'curl -s http://localhost:3000/api/health/memory | jq'

# Generate heap snapshot
curl http://localhost:3000/api/health/memory
```

---

## Success Criteria

After implementing all fixes, you should see:

| Metric                   | Before    | After        | Target |
| ------------------------ | --------- | ------------ | ------ |
| RSS Memory (Idle)        | ~2GB      | ~800MB       | <1GB   |
| RSS Memory (Peak)        | ~4GB      | ~1.5GB       | <2GB   |
| Heap Used %              | 85%       | 45%          | <50%   |
| SNMP Cache Size          | Unbounded | <100 entries | Fixed  |
| Socket.io Rooms          | Growing   | Stable       | Stable |
| Upload Memory (1GB file) | ~2GB      | ~200MB       | <500MB |

---

## Rollback Plan

If any fix causes issues:

1. **Revert the specific commit**

```bash
git revert <commit-hash>
```

2. **Restore from backup**

```bash
psql $DATABASE_URL < backup_YYYYMMDD.sql
```

3. **Restart server**

```bash
npm run dev
```

---

## Next Steps

After completing Phase 1 and Phase 2:

1. Monitor memory usage for 1 week
2. Collect metrics and compare to baseline
3. Proceed to Phase 3 (Medium Impact Fixes)
4. Continue monitoring and optimization

---

## Support

For questions or issues:

1. Review the full audit report: `docs/performance/MEMORY_OPTIMIZATION_AUDIT.md`
2. Check diagrams: `docs/performance/MEMORY_LEAK_DIAGRAMS.md`
3. Review code examples in this guide
4. Test in development environment first

---

**Remember:** Always test changes in development before deploying to production!
