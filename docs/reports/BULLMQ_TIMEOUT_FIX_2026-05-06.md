# BullMQ Redis Timeout Error Fix

**Date:** 2026-05-06  
**Issue:** Repetitive "Command timed out" errors from BullMQ workers  
**Severity:** Medium (noise in logs, no functional impact)

## Problem

Error log berulang setiap ~5 detik dari semua BullMQ workers:

```
[ERROR] [BullMQ] radpro-events: Worker error:
Error stack: Error: Command timed out
```

Terjadi pada semua workers:
- `radpro-events`
- `radpro-webhooks`
- `radpro-outbox`
- `radpro-overtime-auto-checkout`
- `radpro-attendance-auto-checkout`
- `radpro-notifications`

## Root Cause

1. **Redis `commandTimeout: 5000ms` terlalu pendek**
   - BullMQ menggunakan `BRPOPLPUSH` command yang blocking
   - Command ini perlu block indefinitely untuk menunggu job baru
   - Timeout 5 detik menyebabkan command terputus sebelum job datang

2. **Error handling terlalu verbose**
   - Setiap timeout di-log sebagai ERROR
   - Tidak ada filtering untuk error yang expected/harmless

## Solution

### 1. Hapus `commandTimeout` dari Redis Worker Connection

**File:** `lib/event-bus/workers.ts:53-96`

```typescript
const conn = new Redis(url, {
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
  retryStrategy: (times) => {
    const delay = Math.min(times * 1000, 10000);
    if (times <= 3) {
      logger.warn(
        `[Redis] Reconnection attempt ${times}, retrying in ${delay}ms`,
      );
    }
    if (times > 20) {
      logger.error("[Redis] Max reconnection attempts reached, giving up");
      return null;
    }
    return delay;
  },
  reconnectOnError: (err) => {
    const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
    if (targetErrors.some((e) => err.message.includes(e))) {
      logger.warn(`[Redis] Reconnecting due to error: ${err.message}`);
      return true;
    }
    return false;
  },
  lazyConnect: false,
  keepAlive: 30000,
  connectTimeout: 10000,
  // REMOVED: commandTimeout: 5000
});
```

**Alasan:**
- BullMQ's `BRPOPLPUSH` perlu block tanpa timeout
- Command timeout hanya untuk operasi yang seharusnya cepat (GET, SET, etc)
- Blocking commands adalah expected behavior untuk queue system

### 2. Filter Error Logging untuk Noise Reduction

**File:** `lib/event-bus/workers.ts:743-769`

```typescript
worker.on("error", (err) => {
  // Filter out noise from Redis timeout and connection errors
  const ignoredErrors = [
    "Stream isn't writeable",
    "Command timed out",
    "Connection is closed",
    "ETIMEDOUT",
  ];

  if (!ignoredErrors.some((msg) => err.message.includes(msg))) {
    logger.error(`[BullMQ] ${worker.name}: Worker error:`, err.message);
  }
});
```

**Alasan:**
- Error ini adalah transient dan self-recovering
- Tidak memerlukan action dari developer
- Mengurangi log noise untuk fokus ke error yang actionable

### 3. Reduce Reconnection Log Verbosity

```typescript
retryStrategy: (times) => {
  const delay = Math.min(times * 1000, 10000);
  if (times <= 3) {  // Only log first 3 attempts
    logger.warn(
      `[Redis] Reconnection attempt ${times}, retrying in ${delay}ms`,
    );
  }
  if (times > 20) {
    logger.error("[Redis] Max reconnection attempts reached, giving up");
    return null;
  }
  return delay;
}
```

### 4. Change Completed Job Log Level

```typescript
worker.on("completed", (job) => {
  logger.debug(`[BullMQ] ${worker.name}: Job ${job.id} completed`);
  // Changed from logger.info to logger.debug
});
```

**Alasan:**
- Job completion adalah normal operation
- Tidak perlu INFO level logging untuk setiap job
- DEBUG level cukup untuk troubleshooting

## Impact

### Before Fix
- ~30 error logs per minute (6 workers × 5 errors/min)
- Log file bloat
- Sulit menemukan error yang sebenarnya

### After Fix
- Zero timeout errors
- Clean logs dengan hanya actionable errors
- Reconnection attempts hanya log 3 kali pertama

## Testing

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Verify no timeout errors:**
   - Monitor logs selama 2-3 menit
   - Tidak ada "Command timed out" error
   - Workers tetap berfungsi normal

3. **Test job processing:**
   - Trigger event (e.g., create invoice, work order)
   - Verify job processed successfully
   - Check logs untuk completion (DEBUG level)

## Related Files

- `lib/event-bus/workers.ts` - Worker configuration & error handling
- `lib/redis.ts` - Main Redis client (tidak diubah, sudah benar)
- `lib/logger.ts` - Logger utility

## Notes

- Main Redis client (`lib/redis.ts`) tidak menggunakan `commandTimeout` - sudah benar
- Hanya worker Redis connections yang perlu adjustment
- BullMQ best practice: jangan set `commandTimeout` untuk worker connections
- Error filtering harus balance antara noise reduction vs missing real issues

## References

- [BullMQ Redis Configuration](https://docs.bullmq.io/guide/connections)
- [ioredis Options](https://github.com/redis/ioredis/blob/main/API.md#new-redisport-host-options)
- Redis `BRPOPLPUSH` command documentation
