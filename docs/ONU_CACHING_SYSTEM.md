# Sistem Caching Data ONU dari SNMP

## 📋 Overview

Sistem ini menyimpan data ONU yang diambil dari SNMP OLT ke database PostgreSQL, sehingga:
- **Frontend lebih cepat** - Data diambil dari database, bukan langsung dari OLT
- **Beban OLT lebih ringan** - SNMP query hanya dilakukan secara berkala
- **Data tetap up-to-date** - Auto-sync setiap 5 menit (bisa dikonfigurasi)

## 🏗️ Arsitektur

```
┌─────────────┐
│   OLT ZTE   │
│  (SNMP)     │
└──────┬──────┘
       │
       │ SNMP Query (setiap 5 menit)
       │
┌──────▼──────────────────┐
│  Node.js Backend        │
│  - Scheduler (cron)     │
│  - Sync Service         │
└──────┬──────────────────┘
       │
       │ Save to Database
       │
┌──────▼──────────────┐
│  PostgreSQL         │
│  - Table: Onu       │
│  - Table: Olt      │
└──────┬──────────────┘
       │
       │ Query from DB
       │
┌──────▼──────────────┐
│  Next.js Frontend   │
│  - Dashboard      │
└─────────────────────┘
```

## 📊 Database Schema

### Table: `Onu`

```sql
CREATE TABLE "Onu" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "oltId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "pppoe" TEXT,
  "gponOnu" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "rxOlt" TEXT,
  "rxOnu" TEXT,
  "serialNumber" TEXT,
  "actualType" TEXT,
  "lastUpdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  
  CONSTRAINT "Onu_oltId_gponOnu_key" UNIQUE ("oltId", "gponOnu"),
  FOREIGN KEY ("oltId") REFERENCES "Olt"("id") ON DELETE CASCADE
);

CREATE INDEX "Onu_oltId_idx" ON "Onu"("oltId");
CREATE INDEX "Onu_status_idx" ON "Onu"("status");
CREATE INDEX "Onu_lastUpdate_idx" ON "Onu"("lastUpdate");
```

### Table: `Olt` (Updated)

Field baru yang ditambahkan:
- `onuLastSync` - Waktu terakhir sync ONU data
- `onuSyncEnabled` - Enable/disable auto sync (default: true)

## 🔄 Alur Kerja

### 1. Auto Sync (Scheduler)

Scheduler berjalan otomatis setiap 5 menit menggunakan `node-cron`:

```typescript
// lib/cron/onu-sync-scheduler.ts
cron.schedule('*/5 * * * *', async () => {
  await syncAllOnuData()
})
```

**Konfigurasi:**
- Default: Setiap 5 menit (`*/5 * * * *`)
- Bisa diubah via environment variable: `ONU_SYNC_CRON`

### 2. Manual Sync

Sync manual bisa dilakukan melalui API:

```bash
# Sync semua OLT
POST /api/olts/onus/sync

# Sync OLT tertentu
POST /api/olts/onus/sync?oltId=xxx
```

### 3. Frontend Load Data

Frontend mengambil data dari database:

```typescript
// GET /api/olts/onus
// - Mengambil dari database (default)
// - Fallback ke SNMP jika database kosong
// - Force refresh: GET /api/olts/onus?refresh=true
```

## 📁 File Structure

```
lib/
├── repositories/
│   ├── IOnuRepository.ts      # Interface repository ONU
│   ├── OnuRepository.ts       # Implementation repository ONU
│   └── index.ts               # Export repository
├── services/
│   └── onu-sync.ts            # Service untuk sync data SNMP ke DB
└── cron/
    ├── onu-sync-scheduler.ts  # Scheduler untuk auto-sync
    └── start-scheduler.ts     # Start semua scheduler

app/api/
├── olts/
│   └── onus/
│       ├── route.ts           # GET endpoint (dari DB atau SNMP)
│       └── sync/
│           └── route.ts       # POST endpoint untuk manual sync
└── cron/
    └── start/
        └── route.ts           # POST endpoint untuk start scheduler
```

## 🚀 Setup & Usage

### 1. Migration Database

```bash
# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name add_onu_table_and_sync_fields

# Apply migration
npx prisma migrate deploy
```

### 2. Start Scheduler

Scheduler akan start otomatis saat aplikasi Next.js start, atau bisa start manual:

```bash
# Via API
POST /api/cron/start
```

### 3. Manual Sync

```bash
# Sync semua OLT
curl -X POST http://localhost:3000/api/olts/onus/sync \
  -H "Authorization: Bearer ***REMOVED***"

# Sync OLT tertentu
curl -X POST "http://localhost:3000/api/olts/onus/sync?oltId=xxx" \
  -H "Authorization: Bearer ***REMOVED***"
```

### 4. Load Data di Frontend

```typescript
// Load dari database (default)
const response = await fetch('/api/olts/onus')
const { onus, summary, total, source } = await response.json()

// Force refresh dari SNMP
const response = await fetch('/api/olts/onus?refresh=true')
```

## ⚙️ Konfigurasi

### Environment Variables

```env
# Cron expression untuk ONU sync (default: setiap 5 menit)
ONU_SYNC_CRON=*/5 * * * *

# Database URL (sudah ada)
DATABASE_URL=postgresql://user:password@localhost:5433/netmanager
```

### Enable/Disable Sync per OLT

```typescript
// Update OLT untuk disable sync
await prisma.olt.update({
  where: { id: oltId },
  data: { onuSyncEnabled: false }
})
```

## 📈 Monitoring

### Logs

Sistem akan log setiap sync:

```
[ONU-Sync] Starting sync for OLT OLT (113.192.1.98)...
[ONU-Sync] Fetched 20 ONUs from SNMP
[ONU-Sync] Successfully synced 20/20 ONUs for OLT OLT
[ONU-Sync-Scheduler] [2024-01-01T12:00:00.000Z] Scheduled sync completed. Synced 20 ONUs
```

### Check Last Sync

```typescript
const olt = await prisma.olt.findUnique({
  where: { id: oltId },
  select: { onuLastSync: true }
})

console.log(`Last sync: ${olt.onuLastSync}`)
```

## 🔍 Troubleshooting

### Data tidak ter-update

1. Check apakah scheduler running:
   ```typescript
   import { isOnuSyncSchedulerRunning } from '@/lib/cron/onu-sync-scheduler'
   console.log(isOnuSyncSchedulerRunning()) // true/false
   ```

2. Check log untuk error:
   ```bash
   # Check console logs untuk error message
   ```

3. Manual sync untuk test:
   ```bash
   POST /api/olts/onus/sync
   ```

### Database kosong

1. Pastikan migration sudah di-apply
2. Lakukan manual sync pertama kali
3. Check apakah OLT SNMP connected

## 🎯 Best Practices

1. **Jangan terlalu sering sync** - Default 5 menit sudah cukup
2. **Monitor last sync time** - Pastikan data tidak terlalu lama
3. **Handle error gracefully** - Sync error tidak akan crash aplikasi
4. **Use database untuk query** - Jangan force refresh kecuali perlu

## 📝 API Reference

### GET /api/olts/onus

Mengambil data ONU dari database (atau SNMP jika kosong).

**Query Parameters:**
- `refresh=true` - Force refresh dari SNMP

**Response:**
```json
{
  "onus": [...],
  "summary": {
    "good": { "count": 10, "percentage": 50, ... },
    "warning": { ... },
    "critical": { ... },
    "other": { ... }
  },
  "total": 20,
  "source": "database" | "snmp"
}
```

### POST /api/olts/onus/sync

Sync data ONU dari SNMP ke database.

**Query Parameters:**
- `oltId=xxx` - Sync OLT tertentu (optional)

**Response:**
```json
{
  "success": true,
  "message": "Successfully synced 20 ONUs",
  "count": 20
}
```

## 🔐 Security

- Semua endpoint memerlukan authentication (ADMIN role)
- SNMP credentials disimpan di database (encrypted jika perlu)
- Scheduler hanya berjalan di server-side

---

**Created:** 2024-01-01  
**Last Updated:** 2024-01-01

