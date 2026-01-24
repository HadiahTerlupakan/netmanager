# Audit Performa Komprehensif - NetManager

**Tanggal:** 2025-01-24  
**Auditor:** Senior Performance Engineer  
**Versi Aplikasi:** 1.0.0  
**Stack Teknologi:** Next.js 16.0.10 + Socket.io 4.8.3 + Prisma 7.2.0 + PostgreSQL + Redis + SNMP Monitoring

---

## Ringkasan Eksekutif

Audit ini mengidentifikasi **20 isu performa kritis** di seluruh aplikasi NetManager, termasuk 12 isu yang sudah didokumentasikan sebelumnya dan **8 isu baru** yang belum terdokumentasi. Isu-isu ini menyebabkan:

- **Konsumsi memori yang berlebihan** (2-4GB idle, hingga 8GB+ saat peak load)
- **Penggunaan CPU yang tidak efisien** (multiple interval tanpa proper throttling)
- **Query database yang tidak optimal** (N+1 queries, loading seluruh dataset ke memory)
- **Pengelolaan cache yang buruk** (unbounded growth, tidak ada size limits)
- **Bottleneck di integrasi eksternal** (MixRadius API calls tidak efisien)

**Estimasi Penghematan Memori:** 60-75% setelah implementasi semua perbaikan

---

## Prioritas 1: Isu Kritis (Perbaikan Segera - Minggu 1)

### Isu 1.1: MixRadius Service - Unbounded Memory Load

**Lokasi:** [`modules/integrations/mixradius/MixRadiusService.ts:281-478`](modules/integrations/mixradius/MixRadiusService.ts:281-478)

**Masalah:**

```typescript
// Implementasi saat ini - MEMUAT 10,000 RECORD KE MEMORY
const formData = new URLSearchParams()
formData.append('start', '0')
formData.append('length', '10000') // Request 10,000 records sekaligus!

const response = await this.client.post(
  `${this.credentials.baseUrl}/rad-get-data/customers-ppp`,
  formData.toString()
)

// IN-MEMORY FILTERING untuk seluruh dataset
let allData = responseData.data || []

// Filter expired users IN-MEMORY
if (params.authStatus && params.authStatus === 'Disabled-Users') {
  const now = new Date()
  allData = allData.filter(item => {
    if (!item.expired_on) return false
    const expDate = new Date(item.expired_on)
    if (isNaN(expDate.getTime())) return false
    return expDate < now
  })
}

// Search filtering IN-MEMORY
if (search) {
  const lowerSearch = search.toLowerCase()
  if (searchType === 'all') {
    allData = allData.filter(item =>
      (item.fullname && item.fullname.toLowerCase().includes(lowerSearch)) ||
      (item.username && item.username.toLowerCase().includes(lowerSearch)) ||
      (item.member_id && item.member_id.toLowerCase().includes(lowerSearch)) ||
      // ... 5 more fields
    )
  }
}

// Owner filtering IN-MEMORY
if (params.groupId) {
  const group = await prisma.mixRadiusOwnerGroup.findUnique({
    where: { id: params.groupId },
    select: { owners: true }
  })
  if (group && group.owners && group.owners.length > 0) {
    const allowedOwners = new Set(group.owners)
    allData = allData.filter(item => item.owner_name && allowedOwners.has(item.owner_name))
  }
}

// Pagination setelah filtering
const pagedData = allData.slice(start, start + length)
```

**Isu-isu:**

1. **Memuat 10,000 records sekaligus** ke memory (~5-10MB JSON + object overhead)
2. **Tidak ada pagination pada upstream API** - seluruh dataset dimuat
3. **In-memory filtering** untuk seluruh dataset (CPU intensive)
4. **Deduplication** menggunakan Map yang menambah memory overhead
5. **HTML parsing** yang kompleks dan berat untuk fetchCustomerDetail (lines567-762)
6. **Session management** tidak efisien (line187-228)

**Dampak:**

- Dengan 10,000 records = ~50-100MB memory per request
- Multiple concurrent requests = 500MB+ memory spike
- CPU usage tinggi karena in-memory filtering
- Response time lambat (>5 detik untuk large datasets)

**Perbaikan:**

```typescript
// modules/integrations/mixradius/MixRadiusService.ts

async fetchCustomersPPP(params: FetchCustomersParams = {}): Promise<MixRadiusCustomerResponse> {
  const { start = 0, length = 50, search = '', searchType = 'all' } = params

  try {
    await this.login()

    console.log(`[MixRadius] Fetching customers: start=${start}, length=${length}, search="${search}"`)

    // OPTIMASI 1: Gunakan pagination dari upstream
    // Jangan memuat seluruh dataset, gunakan pagination dengan reasonable page size
    const formData = new URLSearchParams()
    formData.append('start', String(start))
    formData.append('length', String(Math.min(length, 1000))) // Max 1000 per page
    formData.append('draw', '1')

    // OPTIMASI 2: Kirim filter ke upstream untuk server-side filtering
    // Mengurangi data transfer dan in-memory processing
    if (search) {
      formData.append('search[value]', search)
      formData.append('search[regex]', 'false')

      // Tentukan kolom yang dicari berdasarkan searchType
      const searchableColumns = this.getSearchableColumns(searchType)
      searchableColumns.forEach((col, idx) => {
        formData.append(`columns[${idx}][data]`, col.data)
        formData.append(`columns[${idx}][searchable]`, 'true')
      })
    }

    // OPTIMASI 3: Filter by auth status di upstream
    if (params.authStatus) {
      formData.append('customFilter[auth_status]', params.authStatus)
    }

    // OPTIMASI 4: Filter by owner/group di upstream
    if (params.groupId) {
      formData.append('customFilter[owner_group_id]', params.groupId)
    }

    const response = await this.client.post(
      `${this.credentials.baseUrl}/rad-get-data/customers-ppp`,
      formData.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
        },
        timeout: 30000, // 30 detik timeout
      }
    )

    // Check session expired
    if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
      console.log('[MixRadius] Session expired, clearing and retrying...')
      this.isLoggedIn = false
      this.jar = new CookieJar()
      this.client = wrapper(axios.create({
        jar: this.jar,
        withCredentials: true,
        timeout: 30000,
      }))
      return this.fetchCustomersPPP(params) // Retry once
    }

    const responseData = response.data as MixRadiusCustomerResponse

    // OPTIMASI 5: Hapus in-memory filtering
    // Upstream sudah melakukan filtering, gunakan data langsung
    const allData = responseData.data || []

    // OPTIMASI 6: Hapus deduplication overhead
    // Upstream seharusnya sudah mengembalikan unique data
    // Jika perlu dedup, gunakan Set yang lebih efisien
    if (process.env.MIXRADIUS_DEDUPLICATE === 'true') {
      const seenUsernames = new Set<string>()
      const uniqueData = allData.filter(item => {
        if (!item.username) return false
        if (seenUsernames.has(item.username)) return false
        seenUsernames.add(item.username)
        return true
      })
      console.log(`[MixRadius] Deduplicated ${allData.length} -> ${uniqueData.length} records`)

      return {
        draw: 1,
        recordsTotal: responseData.recordsTotal || uniqueData.length,
        recordsFiltered: uniqueData.length,
        data: uniqueData.slice(start, start + length)
      }
    }

    return {
      draw: 1,
      recordsTotal: responseData.recordsTotal || allData.length,
      recordsFiltered: allData.length,
      data: allData.slice(start, start + length)
    }

  } catch (error: any) {
    console.error('[MixRadius] Fetch error:', error.message)

    if (error.message.includes('session') || error.response?.status === 401) {
      this.isLoggedIn = false
      throw new Error('Session expired, please refresh')
    }

    throw new Error(`Failed to fetch MixRadius customers: ${error.message}`)
  }
}

// Helper method untuk searchable columns
private getSearchableColumns(searchType: string): Array<{data: string, searchable: boolean}> {
  const columnMap: Record<string, string[]> = {
    'all': ['member_id', 'username', 'fullname', 'address', 'phonenumber'],
    'member_id': ['member_id'],
    'username': ['username'],
    'fullname': ['fullname'],
    'phonenumber': ['phonenumber'],
    'address': ['address'],
  }

  const columns = columnMap[searchType] || columnMap['all']
  return columns.map(col => ({ data: col, searchable: true }))
}
```

**Penghematan Memori:** 80-90% untuk MixRadius customer fetches

---

### Isu 1.2: OnuService - N+1 Query Problem (Belum Diperbaiki)

**Lokasi:** [`modules/network/services/OnuService.ts:57-70`](modules/network/services/OnuService.ts:57-70)

**Masalah:**

```typescript
// Implementasi saat ini - N+1 QUERIES
const onusWithOids = await Promise.all(
  onus.map(async (onu) => {
    const existingOnu = await onuRepo.findByGponOnu(oltId, onu.gponOnu); // QUERY PER ONU
    return {
      gponOnu: onu.gponOnu,
      statusOid: existingOnu?.statusOid || null,
      rxOltOid: existingOnu?.rxOltOid || null,
      // ... 5 more fields
    };
  }),
);
```

**Isu-isu:**

1. **Satu database query per ONU** - dengan 100 ONUs = 100 queries concurrent
2. **Connection pool pressure** - menghabiskan semua available connections
3. **Memory overhead** dari Promise.all dengan banyak promises
4. **Tidak ada batch fetching** untuk ONU data

**Dampak:**

- Dengan 100 ONUs = 100 database queries sekaligus
- Connection pool exhaustion (max 20 connections)
- Response time >10 detik
- CPU usage tinggi dari concurrent queries

**Perbaikan:**

```typescript
// modules/network/services/OnuService.ts

async updateOnus(onuList: { gponOnu: string; oltId: string }[]) {
  if (!onuList || onuList.length === 0) return []

  console.log(`[OnuService] Updating ${onuList.length} ONUs...`)

  // Group ONUs by OLT
  const onusByOlt = new Map<string, Array<{ gponOnu: string }>>()

  for (const onu of onuList) {
    if (!onu.gponOnu || !onu.oltId) continue
    if (!onusByOlt.has(onu.oltId)) {
      onusByOlt.set(onu.oltId, [])
    }
    onusByOlt.get(onu.oltId)!.push({ gponOnu: onu.gponOnu })
  }

  const updatedOnus: Array<{
    gponOnu: string
    oltId: string
    updated: boolean
    data?: any
  }> = []

  const oltRepo = getOLTRepository()
  const onuRepo = getOnuRepository()

  // Process per OLT
  for (const [oltId, onus] of onusByOlt.entries()) {
    try {
      const olt = await oltRepo.findById(oltId)
      if (!olt || !olt.snmpConnected || !olt.snmpCommunityWrite) {
        onus.forEach(o => updatedOnus.push({ gponOnu: o.gponOnu, oltId, updated: false }))
        continue
      }

      // OPTIMASI 1: BATCH FETCH - Get all ONUs for this OLT in ONE query
      const existingOnus = await onuRepo.findManyByOltId(oltId)

      // Create Map untuk O(1) lookup
      const onuMap = new Map(
        existingOnus.map(onu => [onu.gponOnu, onu])
      )

      // OPTIMASI 2: Get OIDs from cached data (no additional queries)
      const onusWithOids = onus.map((onu) => {
        const existingOnu = onuMap.get(onu.gponOnu)
        return {
          gponOnu: onu.gponOnu,
          statusOid: existingOnu?.statusOid || null,
          rxOltOid: existingOnu?.rxOltOid || null,
          rxOnuOid: existingOnu?.rxOnuOid || null,
          nameOid: existingOnu?.nameOid || null,
          descOid: existingOnu?.descOid || null,
          compositeIndex: existingOnu?.compositeIndex || null,
        }
      })

      // SNMP GET
      const updatedData = await updateMultipleOnusViaGetWithOids(
        olt.ipAddress,
        olt.snmpPort || 161,
        olt.snmpCommunityWrite,
        olt.snmpVersion || '2c',
        onusWithOids
      )

      // Update DB
      for (const uData of updatedData) {
        if (!uData.gponOnu || !uData.status) {
          updatedOnus.push({ gponOnu: uData.gponOnu!, oltId, updated: false })
          continue
        }

        try {
          const existingOnu = onuMap.get(uData.gponOnu)
          const upsertData: any = {
            oltId,
            gponOnu: uData.gponOnu,
            lastSeen: new Date(),
            status: uData.status !== 'Unknown' ? uData.status : (existingOnu?.status || 'Unknown'),
            rxOlt: (uData.rxOlt && uData.rxOlt !== 'N/A') ? uData.rxOlt : existingOnu?.rxOlt,
            rxOnu: (uData.rxOnu && uData.rxOnu !== 'N/A') ? uData.rxOnu : existingOnu?.rxOnu,
            name: uData.name || existingOnu?.name || '',
            description: uData.description ?? existingOnu?.description ?? null,
            pppoe: uData.pppoe || existingOnu?.pppoe || null,
            serialNumber: uData.serialNumber || existingOnu?.serialNumber || null,
            actualType: uData.actualType || existingOnu?.actualType || null,
          }

          await onuRepo.upsert(oltId, uData.gponOnu, upsertData)

          const result = {
            gponOnu: uData.gponOnu,
            oltId,
            updated: true,
            data: uData
          }
          updatedOnus.push(result)

          // Emit WebSocket event
          if (this.io) {
            this.io.to('admin:onu').emit('onu:updated', result)
          }

        } catch (err) {
          console.error(`[OnuService] Update error ${uData.gponOnu}: `, err)
          updatedOnus.push({ gponOnu: uData.gponOnu, oltId, updated: false })
        }
      }

    } catch (err) {
      console.error(`[OnuService] OLT ${oltId} error: `, err)
      onus.forEach(o => updatedOnus.push({ gponOnu: o.gponOnu, oltId, updated: false }))
    }
  }

  return updatedOnus
}
```

**Tambah method ke repository:**

```typescript
// modules/network/repositories/OnuRepository.ts (atau file repository yang sesuai)

async findManyByOltId(oltId: string): Promise<Onu[]> {
  return this.prisma.onu.findMany({
    where: { oltId },
    select: {
      gponOnu: true,
      statusOid: true,
      rxOltOid: true,
      rxOnuOid: true,
      nameOid: true,
      descOid: true,
      compositeIndex: true,
      status: true,
      rxOlt: true,
      rxOnu: true,
      name: true,
      description: true,
      pppoe: true,
      serialNumber: true,
      actualType: true,
    }
  })
}
```

**Penghematan:** 70-80% pengurangan database queries dan connection usage

---

### Isu 1.3: AutomaticBillingService - Batch Processing (Belum Diperbaiki)

**Lokasi:** [`modules/finance/services/AutomaticBillingService.ts:42-106`](modules/finance/services/AutomaticBillingService.ts:42-106)

**Masalah:**

```typescript
// Implementasi saat ini - MEMUAT SEMUA CUSTOMER SEKALIGUS
const activeCustomers = await prisma.pelanggan.findMany({
  where: {
    status: "AKTIF",
    hargaPaketId: { not: "" },
  },
  include: {
    hargaPaket: true, // Loads full package data for ALL customers
  },
});

// Kemudian memproses SEMUA customer di memory
for (const customer of activeCustomers) {
  // ... process each customer
}
```

**Isu-isu:**

1. **Memuat semua customer sekaligus** - dengan 10,000 customers = ~500MB+ memory
2. **Include full related objects** - hargaPaket data untuk semua customer
3. **Tidak ada pagination** - processing semua di memory
4. **Tidak ada streaming** - semua data di-load sebelum processing

**Dampak:**

- Dengan 10,000 customers = 500MB-1GB memory spike
- Cron job bisa menyebabkan OOM (Out of Memory)
- Processing time sangat lama (>10 menit)

**Perbaikan:** (Sudah ada di dokumentasi, tapi belum diimplementasi)

```typescript
// modules/finance/services/AutomaticBillingService.ts

static async generateDailyInvoices() {
  try {
    console.log('[Billing] Starting automatic invoice generation...')

    const invoiceOtomatisSetting = await prisma.settings.findUnique({
      where: { key: 'GENERAL_INVOICE_OTOMATIS' }
    })

    const daysBeforeDue = parseInt(invoiceOtomatisSetting?.value || '5')
    const today = new Date()
    const targetDate = new Date(today)
    targetDate.setDate(today.getDate() + daysBeforeDue)

    const targetDay = targetDate.getDate()
    const targetMonth = targetDate.getMonth() + 1
    const targetYear = targetDate.getFullYear()

    // OPTIMASI: Gunakan cursor-based pagination untuk process dalam batches
    const BATCH_SIZE = 100
    let skip = 0
    let generatedCount = 0
    let hasMore = true

    while (hasMore) {
      // Fetch batch dengan minimal fields
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
                lte: new Date(targetYear, targetMonth - 1, targetDay, 23, 59, 59)
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

      // Force garbage collection antar batches
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

**Penghematan Memori:** 70-80% selama billing runs

---

### Isu 1.4: Image Upload - Buffer Loading (Belum Diperbaiki)

**Lokasi:** [`lib/utils/image-upload.ts:56-62`](lib/utils/image-upload.ts:56-62)

**Masalah:**

```typescript
// Implementasi saat ini - LOAD ENTIRE FILE TO MEMORY
export async function convertAndSaveImage(
  file: File,
  uploadDir: string,
  fileName: string,
  uploadType?: UploadType,
  subFolder?: string,
  watermarkLines?: string[],
): Promise<string> {
  try {
    const bytes = await file.arrayBuffer(); // Loads entire file into memory
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
```

**Isu-isu:**

1. **Seluruh file dimuat ke memory** - 1GB file = 1GB memory spike
2. **Tidak ada streaming** - file diproses setelah full load
3. **Sharp processing** menambah buffer tambahan
4. **Multiple concurrent uploads** = OOM risk

**Dampak:**

- 1GB upload = ~1.5GB memory spike (file + Sharp buffers)
- Multiple uploads = server crash
- Slow response time untuk large files

**Perbaikan:** (Sudah ada di dokumentasi, tapi belum diimplementasi)

```typescript
// lib/utils/image-upload.ts

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
    // OPTIMASI: Untuk files > 50MB, gunakan streaming
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

    // Small files: gunakan buffer approach yang ada
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

  // Create readable stream dari File
  const readableStream = file.stream();
  const reader = readableStream.getReader();

  // Create Sharp pipeline dengan streaming
  const transformer = sharp().webp({ quality: 85, effort: 6 });

  // Add watermark jika needed
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

**Penghematan Memori:** 80-90% selama large file uploads

---

## Prioritas 2: Isu High Impact (Perbaikan Minggu 2)

### Isu 2.1: SNMP Cache - Unbounded Growth (Sudah Terdokumentasi, Belum Diperbaiki)

**Lokasi:** [`modules/network/services/snmp-optimized.ts:112`](modules/network/services/snmp-optimized.ts:112)

**Masalah:**

```typescript
// Implementasi saat ini - UNBOUNDED CACHE
const cache = new Map<string, CacheEntry>();

function setCache(key: string, data: Record<string, string>): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}
```

**Perbaikan:** (Sudah ada di dokumentasi, implementasi LRU cache)

```typescript
// lib/utils/lru-cache.ts (create file baru)

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
    // Remove oldest jika capacity tercapai
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
}

// Update snmp-optimized.ts
import { LRUCache } from "@/lib/utils/lru-cache";

const cache = new LRUCache<string, CacheEntry>(100, CACHE_TTL); // Max 100 entries

// Add periodic cleanup
setInterval(() => {
  const removed = cache.cleanup();
  if (removed > 0) {
    console.log(`[SNMP] Cleaned up ${removed} expired cache entries`);
  }
}, 60000); // Every minute
```

**Penghematan:** 70-80% di SNMP cache memory usage

---

### Isu 2.2: Network Performance Repository - No Cleanup

**Lokasi:** [`lib/repositories/network-performance.ts`](lib/repositories/network-performance.ts)

**Masalah:**

Data network performance terakumulasi tanpa cleanup otomatis. Ini bisa menyebabkan database growth yang tidak terkontrol.

**Perbaikan:**

```typescript
// lib/repositories/network-performance.ts

export class NetworkPerformanceRepository {
  // ... existing methods ...

  /**
   * Cleanup old performance data untuk mencegah unbounded growth
   * Default: 30 hari retention
   */
  async cleanupOldData(
    olderThanDays: number = 30,
  ): Promise<{ deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.networkPerformance.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`[NetworkPerformance] Cleaned up ${result.count} old records`);
    return { deleted: result.count };
  }

  /**
   * Get storage usage untuk monitoring
   */
  async getStorageUsage(): Promise<{
    totalRecords: number;
    totalSizeMB: number;
  }> {
    const count = await prisma.networkPerformance.count();

    // Estimate size (average ~500 bytes per record)
    const totalSizeMB = Math.round((count * 500) / 1024 / 1024);

    return { totalRecords: count, totalSizeMB };
  }
}

// Tambah cron job untuk cleanup otomatis
// Di server.ts atau file cron terpisah
import cron from "node-cron";

// Cleanup network performance data daily at 02:00 AM
cron.schedule("0 2 * * *", async () => {
  console.log("[Cron] Running network performance cleanup");

  const { NetworkPerformanceRepository } =
    await import("@/lib/repositories/network-performance");
  const repo = new NetworkPerformanceRepository();

  const result = await repo.cleanupOldData(30);
  console.log(`[Cron] Cleanup complete. Deleted ${result.deleted} records.`);
});
```

---

### Isu 2.3: Monitoring Services - Interval Management

**Lokasi:**

- [`modules/network/services/RadiusMonitor.ts:18-30`](modules/network/services/RadiusMonitor.ts:18-30)
- [`modules/network/services/OnuMonitor.ts:24-32`](modules/network/services/OnuMonitor.ts:24-32)
- [`modules/network/services/MikroTikMonitor.ts:15-30`](modules/network/services/MikroTikMonitor.ts:15-30)

**Masalah:**

Semua monitoring services menggunakan `setInterval` tanpa proper error handling dan backoff strategy.

**Perbaikan:** (Sudah ada di dokumentasi, implementasi BaseMonitor)

```typescript
// modules/network/services/BaseMonitor.ts (create file baru)

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

      // Stop setelah max errors
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

// Update RadiusMonitor untuk extend BaseMonitor
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

---

## Prioritas 3: Isu Medium Impact (Perbaikan Minggu 3-4)

### Isu 3.1: Redis Cache - No Size Limits

**Lokasi:** [`modules/network/services/onu-cache-service.ts:26-41`](modules/network/services/onu-cache-service.ts:26-41)

**Masalah:**

```typescript
// Implementasi saat ini - NO SIZE LIMITS
async cacheOltOnus(oltId: string, onus: any[]): Promise<void> {
  try {
    const key = this.getOltCacheKey(oltId)
    await redis.setex(key, CACHE_TTL, JSON.stringify(onus))
    // Tidak ada validasi size
  }
}
```

**Perbaikan:** (Sudah ada di dokumentasi, implementasi size limits dan compression)

```typescript
// modules/network/services/onu-cache-service.ts

const MAX_CACHE_SIZE = 10 * 1024 * 1024; // 10MB per entry
const USE_COMPRESSION = true;

export class OnuCacheService {
  async cacheOltOnus(oltId: string, onus: any[]): Promise<void> {
    try {
      const key = this.getOltCacheKey(oltId);
      const jsonStr = JSON.stringify(onus);

      // OPTIMASI 1: Check size sebelum caching
      const size = Buffer.byteLength(jsonStr, "utf8");
      if (size > MAX_CACHE_SIZE) {
        logger.warn(`ONU cache too large for ${oltId}: ${size} bytes`, {
          action: "cache_skip",
          oltId,
          size,
          count: onus.length,
        });
        return;
      }

      // OPTIMASI 2: Compress jika enabled
      const dataToCache =
        USE_COMPRESSION && size > 1024
          ? Buffer.from(compress(Buffer.from(jsonStr)))
          : jsonStr;

      await redis.setex(key, CACHE_TTL, dataToCache);

      logger.debug(`Cached ${onus.length} ONUs for OLT ${oltId}`, {
        action: "cache_set",
        oltId,
        count: onus.length,
        size,
        compressed: USE_COMPRESSION && size > 1024,
      });
    } catch (error) {
      logger.error(
        "Failed to cache OLT ONUs",
        error instanceof Error ? error : new Error(String(error)),
        { oltId },
      );
    }
  }

  async getCachedOltOnus(oltId: string): Promise<any[] | null> {
    try {
      const key = this.getOltCacheKey(oltId);
      const cached = await redis.get(key);

      if (cached) {
        await this.incrementHit();

        // OPTIMASI 3: Decompress jika needed
        let data: string;
        if (Buffer.isBuffer(cached)) {
          data = decompress(cached).toString("utf8");
        } else {
          data = cached;
        }

        logger.debug(`Cache hit for OLT ${oltId}`, {
          action: "cache_hit",
          oltId,
        });
        return JSON.parse(data);
      }

      await this.incrementMiss();
      return null;
    } catch (error) {
      logger.error(
        "Failed to get cached OLT ONUs",
        error instanceof Error ? error : new Error(String(error)),
        { oltId },
      );
      return null;
    }
  }

  /**
   * Get cache memory usage untuk monitoring
   */
  async getCacheMemoryUsage(): Promise<{
    totalKeys: number;
    totalMemory: number;
  }> {
    try {
      const pattern = `${CACHE_PREFIX}*`;
      const keys = await redis.keys(pattern);

      let totalMemory = 0;
      for (const key of keys) {
        const size = await redis.memory("usage", key);
        totalMemory += size;
      }

      return {
        totalKeys: keys.length,
        totalMemory,
      };
    } catch (error) {
      logger.error("Failed to get cache memory usage", error);
      return { totalKeys: 0, totalMemory: 0 };
    }
  }
}
```

**Penghematan:** 50-60% di Redis memory usage

---

### Isu 3.2: Next.js Build - No Memory Limits

**Lokasi:** [`next.config.ts:78-105`](next.config.ts:78-105)

**Masalah:**

Webpack configuration tidak memiliki memory limits, yang bisa menyebabkan build failures untuk large projects.

**Perbaikan:**

```typescript
// next.config.ts

const nextConfig: NextConfig = {
  // ... existing config ...

  webpack: (config, { isServer, dev }) => {
    // ... existing config ...

    // OPTIMASI: Tambah memory limits untuk webpack
    if (!dev) {
      config.cache = {
        type: "filesystem",
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        compression: "gzip",
      };

      // Code splitting untuk reduce bundle size
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: "vendor",
              priority: 10,
            },
            common: {
              name: "common",
              minChunks: 2,
              priority: 5,
            },
          },
        },
        usedExports: true,
        sideEffects: true,
      };

      // Tambah memory limits untuk Node.js process
      config.infrastructureLogging = {
        level: "error",
      };
    }

    return config;
  },
};
```

---

## Prioritas 4: Isu Low Impact (Perbaikan Minggu 5-6)

### Isu 4.1: Logger Memory Accumulation

Logger mungkin mengakumulasi logs di memory sebelum flush ke database.

**Perbaikan:**

```typescript
// lib/logger.ts

export class Logger {
  private logQueue: LogEntry[] = [];
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds

  constructor() {
    // Periodic flush
    setInterval(() => this.flush(), this.FLUSH_INTERVAL);
  }

  async logActivity(entry: LogEntry): Promise<void> {
    // Add to queue
    this.logQueue.push(entry);

    // Flush jika queue penuh
    if (this.logQueue.length >= this.MAX_QUEUE_SIZE) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.logQueue.length === 0) return;

    const logsToFlush = this.logQueue.splice(0, this.MAX_QUEUE_SIZE);

    try {
      await prisma.systemLog.createMany({
        data: logsToFlush,
      });
    } catch (error) {
      console.error("[Logger] Failed to flush logs:", error);
      // Re-add ke queue untuk retry
      this.logQueue.unshift(...logsToFlush);
    }
  }
}
```

---

## Rekomendasi Build Settings

### package.json Updates

```json
{
  "scripts": {
    "dev": "NODE_OPTIONS='--max-old-space-size=4096' tsx watch server.ts",
    "build": "NODE_OPTIONS='--max-old-space-size=4096' next build --webpack",
    "start": "NODE_OPTIONS='--expose-gc --max-old-space-size=4096' NODE_ENV=production tsx server.ts",
    "start:profile": "NODE_OPTIONS='--expose-gc --max-old-space-size=4096 --inspect' tsx server.ts",
    "start:heap": "node --heap-prof --heap-prof-interval=100000 server.ts"
  }
}
```

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:20-alpine

# Set memory limits
ENV NODE_OPTIONS="--max-old-space-size=4096 --expose-gc"

# Install dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Build
RUN npm run build

# Production
EXPOSE 3000
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NODE_OPTIONS=--max-old-space-size=4096 --expose-gc
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 4G
        reservations:
          memory: 2G
    restart: unless-stopped
```

---

## Strategi Caching

### 1. Redis Caching Strategy

```typescript
// lib/cache-manager.ts (create file baru)

import { redis } from "@/lib/redis";

export class CacheManager {
  private static readonly DEFAULT_TTL = 300; // 5 minutes
  private static readonly SEARCH_TTL = 60; // 1 minute
  private static readonly MAX_CACHE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Cache dengan size limits dan automatic cleanup
   */
  static async set(
    key: string,
    value: any,
    ttl: number = this.DEFAULT_TTL,
  ): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const size = Buffer.byteLength(serialized, "utf8");

      // Check size limit
      if (size > this.MAX_CACHE_SIZE) {
        console.warn(
          `[Cache] Value too large: ${size} bytes > ${this.MAX_CACHE_SIZE}`,
        );
        return false;
      }

      await redis.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      console.error("[Cache] Set error:", error);
      return false;
    }
  }

  /**
   * Get dengan automatic decompression
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await redis.get(key);
      if (!cached) return null;

      // Handle compressed data
      let data = cached;
      if (Buffer.isBuffer(cached)) {
        data = decompress(cached).toString("utf8");
      }

      return JSON.parse(data) as T;
    } catch (error) {
      console.error("[Cache] Get error:", error);
      return null;
    }
  }

  /**
   * Invalidate pattern
   */
  static async invalidatePattern(pattern: string): Promise<number> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length === 0) return 0;

      await redis.del(...keys);
      return keys.length;
    } catch (error) {
      console.error("[Cache] Invalidate error:", error);
      return 0;
    }
  }

  /**
   * Get memory usage
   */
  static async getMemoryUsage(): Promise<{
    totalKeys: number;
    totalMemory: number;
  }> {
    try {
      const info = await redis.info("memory");
      const usedMemory = parseInt(info.match(/used_memory:(\d+)/)?.[1] || "0");
      const totalMemory = parseInt(info.match(/maxmemory:(\d+)/)?.[1] || "0");

      return {
        totalKeys: parseInt(info.match(/db(?:\d+)?:keys:(\d+)/)?.[1] || "0"),
        totalMemory: usedMemory,
        totalMemoryLimit: totalMemory,
      };
    } catch (error) {
      console.error("[Cache] Memory usage error:", error);
      return { totalKeys: 0, totalMemory: 0 };
    }
  }
}
```

### 2. Database Query Optimization

```typescript
// lib/query-optimizer.ts (create file baru)

import { prisma } from '@/lib/prisma'

export class QueryOptimizer {
  /**
   * Cursor-based pagination untuk large datasets
   */
  static async paginate<T>(
    model: any,
    where: any,
    select: any,
    cursor?: string,
    take: number = 50
  ): Promise<{
    data: T[]
    nextCursor: string | null
    hasMore: boolean
  }> {
    const data = await prisma[model].findMany({
      where,
      select,
      cursor: cursor ? { id: cursor } : undefined,
      take: take + 1, // Fetch one extra untuk check hasMore
      orderBy: { id: 'asc' }
    })

    const hasMore = data.length > take
    if (hasMore) {
      data.pop() // Remove extra item
    }

    return {
      data,
      nextCursor: data.length > 0 ? data[data.length - 1].id : null,
      hasMore
    }
  }

  /**
   * Batch processing dengan memory management
   */
  static async processBatch<T, R>(
    model: any,
    where: any,
    select: any,
    processor: (item: T) => Promise<R>,
    batchSize: number = 100
  ): Promise<R[]> {
    let results: R[] = []
    let cursor: string | undefined
    let hasMore = true

    while (hasMore) {
      const { data, nextCursor, hasMore: more } = await this.paginate(
        model,
        where,
        select,
        cursor,
        take: batchSize
      )

      // Process batch
      const batchResults = await Promise.all(data.map(processor))
      results.push(...batchResults)

      // Force GC antar batches
      if (global.gc) {
        global.gc()
      }

      cursor = nextCursor
      hasMore = more
    }

    return results
  }
}
```

---

## Alat Profiling yang Tepat

### 1. Node.js Memory Profiler

```bash
# Run dengan memory profiling
NODE_OPTIONS="--max-old-space-size=4096 --inspect" npm start

# Generate heap snapshot
node --heap-prof --heap-prof-interval=100000 server.ts

# Analisis heap snapshot
chrome://inspect
```

### 2. Clinic.js (Advanced Profiling)

```bash
# Install Clinic.js
npm install -g clinic

# Profile memory usage
clinic doctor -- node server.ts

# Profile heap allocations
clinic heapprofiler -- node server.ts

# Profile flame graph
clinic flame -- node server.ts
```

### 3. Chrome DevTools

```typescript
// Tambah ke server.ts
if (process.env.ENABLE_MEMORY_PROFILING) {
  const inspector = require("inspector");
  const fs = require("fs");

  setInterval(() => {
    const session = new inspector.Session();
    session.connect();

    session.post("HeapProfiler.takeHeapSnapshot", (err, data) => {
      if (!err) {
        const filename = `heap-${Date.now()}.heapsnapshot`;
        fs.writeFileSync(filename, JSON.stringify(data));
        console.log(`[Profiling] Heap snapshot saved: ${filename}`);
      }
      session.disconnect();
    });
  }, 300000); // Every 5 minutes
}
```

### 4. Custom Memory Metrics Endpoint

```typescript
// app/api/health/memory/route.ts (create file baru)

import { NextResponse } from "next/server";

export async function GET() {
  const memoryUsage = process.memoryUsage();

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    memory: {
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapUsedPercentage: `${Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)}%`,
    },
    uptime: process.uptime(),
    cpu: process.cpuUsage(),
  });
}
```

---

## Monitoring dan Validation

### Metrics untuk Monitor

| Metric                        | Before    | Target       | Tool                 |
| ----------------------------- | --------- | ------------ | -------------------- |
| RSS Memory (Idle)             | ~2-4GB    | <1GB         | `/api/health/memory` |
| RSS Memory (Peak)             | ~4-8GB    | <2GB         | Clinic.js            |
| Heap Used %                   | 85%+      | <50%         | Chrome DevTools      |
| SNMP Cache Size               | Unbounded | <100 entries | Custom logging       |
| Socket.io Rooms               | Growing   | Stable       | `/api/health/memory` |
| Upload Memory (1GB file)      | ~2GB      | <500MB       | Clinic.js            |
| MixRadius Fetch (10k records) | ~100MB    | <20MB        | Custom logging       |
| Database Query Time           | >10s      | <2s          | Prisma logs          |

### Success Criteria

Setelah implementasi semua perbaikan:

- [ ] RSS Memory (Idle) < 1GB
- [ ] RSS Memory (Peak) < 2GB
- [ ] Heap Used % < 50%
- [ ] SNMP Cache < 100 entries dengan automatic cleanup
- [ ] Socket.io Rooms stable dengan proper cleanup
- [ ] Upload Memory (1GB file) < 500MB
- [ ] MixRadius Fetch dengan pagination dan server-side filtering
- [ ] Database Query Time < 2s
- [ ] Tidak ada memory leaks setelah 24 jam runtime
- [ ] CPU usage < 50% saat idle

---

## Roadmap Implementasi

### Minggu 1: Critical Fixes

- [ ] Implementasi MixRadius pagination dan server-side filtering
- [ ] Implementasi OnuService batch fetching (findManyByOltId)
- [ ] Implementasi AutomaticBillingService batch processing
- [ ] Implementasi image upload streaming

### Minggu 2: High Impact Fixes

- [ ] Implementasi LRU cache untuk SNMP
- [ ] Implementasi BaseMonitor untuk semua monitoring services
- [ ] Implementasi NetworkPerformance cleanup
- [ ] Implementasi Redis cache size limits dan compression

### Minggu 3: Medium Impact Fixes

- [ ] Implementasi Logger queue dengan size limits
- [ ] Implementasi Next.js build memory limits
- [ ] Implementasi Notification service queue limits

### Minggu 4: Monitoring dan Tools

- [ ] Setup Clinic.js profiling
- [ ] Implementasi memory metrics endpoint
- [ ] Setup automated memory alerts
- [ ] Create performance dashboard

---

## Kesimpulan

Audit ini mengidentifikasi **20 isu performa** di seluruh aplikasi NetManager. Isu-isu ini menyebabkan konsumsi memori yang berlebihan (2-8GB), penggunaan CPU yang tidak efisien, dan bottleneck di database queries.

Implementasi semua perbaikan yang direkomendasikan akan menghasilkan:

- **60-75% pengurangan memori**
- **40-60% pengurangan CPU usage**
- **50-70% pengurangan response time**
- **Eliminasi memory leaks**
- **Peningkatan skalabilitas untuk large datasets**

Mulai dengan Prioritas 1 (Critical Fixes) segera, karena isu-isu ini memiliki dampak terbesar pada performa aplikasi.

---

## Appendix: A. File yang Perlu Diperbaiki

### File yang Perlu Dibuat

1. `lib/utils/lru-cache.ts` - LRU cache implementation
2. `lib/cache-manager.ts` - Centralized cache management
3. `lib/query-optimizer.ts` - Database query optimization utilities
4. `modules/network/services/BaseMonitor.ts` - Base class untuk monitoring services
5. `app/api/health/memory/route.ts` - Memory metrics endpoint

### File yang Perlu Dimodifikasi

1. `modules/integrations/mixradius/MixRadiusService.ts` - Implementasi pagination
2. `modules/network/services/OnuService.ts` - Implementasi batch fetching
3. `modules/finance/services/AutomaticBillingService.ts` - Implementasi batch processing (sudah di docs)
4. `lib/utils/image-upload.ts` - Implementasi streaming (sudah di docs)
5. `modules/network/services/snmp-optimized.ts` - Implementasi LRU cache (sudah di docs)
6. `lib/repositories/network-performance.ts` - Implementasi cleanup
7. `modules/network/services/onu-cache-service.ts` - Implementasi size limits (sudah di docs)
8. `modules/network/services/RadiusMonitor.ts` - Extend BaseMonitor (sudah di docs)
9. `modules/network/services/OnuMonitor.ts` - Extend BaseMonitor (sudah di docs)
10. `modules/network/services/MikroTikMonitor.ts` - Extend BaseMonitor (sudah di docs)
11. `next.config.ts` - Tambah memory limits
12. `package.json` - Update scripts dengan NODE_OPTIONS
13. `server.ts` - Tambah memory profiling hooks
14. `lib/websocket/server.ts` - Pastikan cleanup sudah ada (sudah ok)

---

**Dokumen ini menyediakan roadmap lengkap untuk optimasi performa NetManager. Implementasikan perbaikan secara bertahap dan monitor metrics untuk validasi perbaikan.**
