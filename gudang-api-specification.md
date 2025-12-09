# API Spesifikasi untuk Menu Gudang

## 1. API Endpoints Baru

### 1.1. GET /api/inventory/employee/items

**Deskripsi**: Mendapatkan daftar barang yang sedang dipinjam oleh karyawan

**Authentication**: Employee token required

**Query Parameters**:
```
status: 'dipinjam' | 'dikembalikan' | 'semua' (default: 'dipinjam')
page: number (default: 1)
limit: number (default: 20)
search: string (optional)
```

**Response**:
```json
{
  "success": true,
  "data": {
    "borrowedItems": [
      {
        "id": "keluar_123",
        "barangId": "barang_456",
        "barangKode": "KB001",
        "barangNama": "Kabel LAN CAT 6",
        "barangSatuan": "pcs",
        "gudangId": "gudang_789",
        "gudangKode": "GU001",
        "gudangNama": "Gudang Utama",
        "jumlah": 5,
        "jumlahDikembalikan": 0,
        "tanggalAmbil": "2024-10-15T10:30:00Z",
        "purpose": "Untuk instalasi kantor baru",
        "kondisi": "BARU",
        "fotoBukti": ["https://example.com/photo1.jpg"],
        "isReturned": false,
        "returnedAt": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "totalPages": 1
    }
  }
}
```

**Error Responses**:
```json
{
  "success": false,
  "error": "Unauthorized",
  "code": 401
}
```

### 1.2. POST /api/inventory/return

**Deskripsi**: Memproses pengembalian barang yang dipinjam

**Authentication**: Employee token required

**Request Body**:
```json
{
  "keluarId": "keluar_123",
  "barangId": "barang_456",
  "gudangId": "gudang_789",
  "jumlah": 5,
  "kondisi": "BAIK" | "RUSAK" | "HILANG",
  "keterangan": "Konektor rusak 2 pcs",
  "fotoBukti": ["https://example.com/return_photo1.jpg"]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Barang berhasil dikembalikan",
  "data": {
    "masukId": "masuk_456",
    "keluarId": "keluar_123",
    "transaction": {
      "id": "masuk_456",
      "barangId": "barang_456",
      "gudangId": "gudang_789",
      "jumlah": 5,
      "kondisi": "RUSAK",
      "keterangan": "Konektor rusak 2 pcs",
      "tanggal": "2024-10-20T14:30:00Z",
      "isReturnTransaction": true,
      "returnReferenceId": "keluar_123"
    },
    "updatedStock": {
      "barangId": "barang_456",
      "gudangId": "gudang_789",
      "previousStock": 45,
      "newStock": 50,
      "kondisiBreakdown": {
        "BAIK": 48,
        "RUSAK": 2,
        "HILANG": 0
      }
    }
  }
}
```

**Error Responses**:
```json
{
  "success": false,
  "error": "Jumlah pengembalian melebihi jumlah yang dipinjam",
  "code": 400,
  "details": {
    "dipinjam": 5,
    "dikembalikan": 6
  }
}
```

### 1.3. GET /api/inventory/employee/history

**Deskripsi**: Mendapatkan riwayat transaksi inventory karyawan

**Authentication**: Employee token required

**Query Parameters**:
```
type: 'keluar' | 'masuk' | 'semua' (default: 'semua')
page: number (default: 1)
limit: number (default: 20)
startDate: string (YYYY-MM-DD, optional)
endDate: string (YYYY-MM-DD, optional)
```

**Response**:
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "keluar_123",
        "type": "keluar",
        "tanggal": "2024-10-15T10:30:00Z",
        "barang": {
          "id": "barang_456",
          "kode": "KB001",
          "nama": "Kabel LAN CAT 6",
          "satuan": "pcs"
        },
        "gudang": {
          "id": "gudang_789",
          "kode": "GU001",
          "nama": "Gudang Utama"
        },
        "jumlah": 5,
        "kondisi": "BARU",
        "keterangan": "Untuk instalasi kantor baru",
        "purpose": "Untuk instalasi kantor baru",
        "isReturned": true,
        "returnedAt": "2024-10-20T14:30:00Z",
        "fotoBukti": ["https://example.com/photo1.jpg"]
      },
      {
        "id": "masuk_456",
        "type": "masuk",
        "tanggal": "2024-10-20T14:30:00Z",
        "barang": {
          "id": "barang_456",
          "kode": "KB001",
          "nama": "Kabel LAN CAT 6",
          "satuan": "pcs"
        },
        "gudang": {
          "id": "gudang_789",
          "kode": "GU001",
          "nama": "Gudang Utama"
        },
        "jumlah": 5,
        "kondisi": "RUSAK",
        "keterangan": "Konektor rusak 2 pcs",
        "isReturnTransaction": true,
        "returnReferenceId": "keluar_123",
        "fotoBukti": ["https://example.com/return_photo1.jpg"]
      }
    ],
    "summary": {
      "totalTransactions": 2,
      "totalBorrowed": 5,
      "totalReturned": 5,
      "currentlyBorrowed": 0
    },
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 2,
      "totalPages": 1
    }
  }
}
```

### 1.4. GET /api/inventory/employee/stats

**Deskripsi**: Mendapatkan statistik inventory untuk karyawan

**Authentication**: Employee token required

**Response**:
```json
{
  "success": true,
  "data": {
    "currentlyBorrowed": {
      "totalItems": 3,
      "totalQuantity": 8,
      "items": [
        {
          "barangId": "barang_456",
          "barangNama": "Kabel LAN CAT 6",
          "jumlah": 5,
          "tanggalAmbil": "2024-10-15T10:30:00Z",
          "daysBorrowed": 5
        }
      ]
    },
    "monthlyStats": [
      {
        "month": "2024-10",
        "borrowed": 8,
        "returned": 5,
        "net": -3
      }
    ],
    "topItems": [
      {
        "barangId": "barang_456",
        "barangNama": "Kabel LAN CAT 6",
        "borrowCount": 5,
        "totalQuantity": 25
      }
    ]
  }
}
```

## 2. API Endpoints yang Dimodifikasi

### 2.1. GET /api/inventory/keluar (Enhanced)

**Query Parameters Baru**:
```
employeeId: string (optional, filter by employee)
isReturned: boolean (optional, filter return status)
```

**Response Enhancement**:
```json
{
  "keluarList": [
    {
      "id": "keluar_123",
      "barangId": "barang_456",
      "gudangId": "gudang_789",
      "jumlah": 5,
      "kondisi": "BARU",
      "keterangan": "Untuk instalasi kantor baru",
      "employeeId": "employee_789",
      "purpose": "Untuk instalasi kantor baru",
      "tanggal": "2024-10-15T10:30:00Z",
      "isReturned": true,
      "returnedAt": "2024-10-20T14:30:00Z",
      "returnedById": "employee_789",
      "returnMasukId": "masuk_456",
      "barang": {
        "id": "barang_456",
        "kode": "KB001",
        "nama": "Kabel LAN CAT 6",
        "satuan": "pcs"
      },
      "gudang": {
        "id": "gudang_789",
        "kode": "GU001",
        "nama": "Gudang Utama"
      },
      "user": {
        "id": "employee_789",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ]
}
```

### 2.2. POST /api/inventory/masuk (Enhanced)

**Authentication Update**: Bisa diakses oleh EMPLOYEE untuk transaksi pengembalian

**Request Body Enhancement**:
```json
{
  "barangId": "barang_456",
  "gudangId": "gudang_789",
  "jumlah": 5,
  "kondisi": "RUSAK",
  "keterangan": "Konektor rusak 2 pcs",
  "fotoBukti": ["https://example.com/return_photo1.jpg"],
  "isReturnTransaction": true,
  "returnReferenceId": "keluar_123"
}
```

**Validation Logic**:
```typescript
// Employee access validation
if (session.user.role === 'EMPLOYEE') {
  // Only allow return transactions
  if (!body.isReturnTransaction || !body.returnReferenceId) {
    return NextResponse.json(
      { error: 'Employee hanya dapat melakukan transaksi pengembalian' },
      { status: 403 }
    )
  }
  
  // Validate employee owns the original transaction
  const originalTransaction = await prisma.barangKeluar.findUnique({
    where: { id: body.returnReferenceId }
  })
  
  if (originalTransaction.employeeId !== session.user.id) {
    return NextResponse.json(
      { error: 'Tidak memiliki akses ke transaksi ini' },
      { status: 403 }
    )
  }
}
```

## 3. Database Schema Updates

### 3.1. BarangKeluar Table Enhancements

```sql
ALTER TABLE barang_keluar 
ADD COLUMN isReturned BOOLEAN DEFAULT FALSE,
ADD COLUMN returnedAt TIMESTAMP,
ADD COLUMN returnedById STRING,
ADD COLUMN returnMasukId STRING;

-- Indexes for performance
CREATE INDEX idx_barang_keluar_employee_returned 
ON barang_keluar(employeeId, isReturned);

CREATE INDEX idx_barang_keluar_return_reference 
ON barang_keluar(returnMasukId);

-- Foreign key constraint
ALTER TABLE barang_keluar 
ADD CONSTRAINT fk_barang_keluar_returned_by 
FOREIGN KEY (returnedById) REFERENCES user(id);

ALTER TABLE barang_keluar 
ADD CONSTRAINT fk_barang_keluar_return_masuk 
FOREIGN KEY (returnMasukId) REFERENCES barang_masuk(id);
```

### 3.2. BarangMasuk Table Enhancements

```sql
ALTER TABLE barang_masuk
ADD COLUMN isReturnTransaction BOOLEAN DEFAULT FALSE,
ADD COLUMN returnReferenceId STRING,
ADD COLUMN employeeId STRING;

-- Indexes for performance
CREATE INDEX idx_barang_masuk_return_transaction 
ON barang_masuk(isReturnTransaction, returnReferenceId);

CREATE INDEX idx_barang_masuk_employee 
ON barang_masuk(employeeId);

-- Foreign key constraint
ALTER TABLE barang_masuk 
ADD CONSTRAINT fk_barang_masuk_return_reference 
FOREIGN KEY (returnReferenceId) REFERENCES barang_keluar(id);

ALTER TABLE barang_masuk 
ADD CONSTRAINT fk_barang_masuk_employee 
FOREIGN KEY (employeeId) REFERENCES user(id);
```

### 3.3. New View for Employee Inventory

```sql
CREATE VIEW employee_inventory_summary AS
SELECT 
  u.id as employeeId,
  u.name as employeeName,
  b.id as barangId,
  b.kode as barangKode,
  b.nama as barangNama,
  b.satuan as barangSatuan,
  g.id as gudangId,
  g.kode as gudangKode,
  g.nama as gudangNama,
  COALESCE(SUM(CASE WHEN bk.isReturned = FALSE THEN bk.jumlah ELSE 0 END), 0) as jumlahDipinjam,
  COALESCE(SUM(CASE WHEN bk.isReturned = TRUE THEN bk.jumlah ELSE 0 END), 0) as jumlahDikembalikan,
  MAX(bk.tanggal) as lastTransactionDate
FROM users u
LEFT JOIN barang_keluar bk ON u.id = bk.employeeId
LEFT JOIN barang b ON bk.barangId = b.id
LEFT JOIN gudang g ON bk.gudangId = g.id
WHERE u.role = 'EMPLOYEE'
GROUP BY u.id, u.name, b.id, b.kode, b.nama, b.satuan, g.id, g.kode, g.nama;
```

## 4. API Implementation Details

### 4.1. Error Handling

```typescript
// Standard error response format
const createErrorResponse = (message: string, code: number, details?: any) => {
  return NextResponse.json({
    success: false,
    error: message,
    code,
    ...(details && { details })
  }, { status: code })
}

// Common validation errors
const VALIDATION_ERRORS = {
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Access forbidden',
  INVALID_QUANTITY: 'Jumlah tidak valid',
  EXCEEDS_BORROWED: 'Jumlah pengembalian melebihi jumlah yang dipinjam',
  ITEM_NOT_FOUND: 'Barang tidak ditemukan',
  WAREHOUSE_NOT_FOUND: 'Gudang tidak ditemukan',
  ALREADY_RETURNED: 'Barang sudah dikembalikan',
  INVALID_CONDITION: 'Kondisi barang tidak valid'
}
```

### 4.2. Transaction Logic

```typescript
// Return transaction logic
async function processReturnTransaction(data: ReturnRequest, employeeId: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Validate original transaction
    const originalTransaction = await tx.barangKeluar.findUnique({
      where: { id: data.keluarId }
    })
    
    if (!originalTransaction) {
      throw new Error(VALIDATION_ERRORS.ITEM_NOT_FOUND)
    }
    
    if (originalTransaction.employeeId !== employeeId) {
      throw new Error(VALIDATION_ERRORS.FORBIDDEN)
    }
    
    if (originalTransaction.isReturned) {
      throw new Error(VALIDATION_ERRORS.ALREADY_RETURNED)
    }
    
    if (data.jumlah > originalTransaction.jumlah) {
      throw new Error(VALIDATION_ERRORS.EXCEEDS_BORROWED)
    }
    
    // 2. Create return transaction
    const returnTransaction = await tx.barangMasuk.create({
      data: {
        barangId: data.barangId,
        gudangId: data.gudangId,
        jumlah: data.jumlah,
        kondisi: data.kondisi,
        keterangan: data.keterangan,
        fotoBukti: data.fotoBukti,
        isReturnTransaction: true,
        returnReferenceId: data.keluarId,
        employeeId: employeeId
      }
    })
    
    // 3. Update stock
    const currentStock = await tx.barangGudang.findUnique({
      where: { 
        barangId_gudangId: { 
          barangId: data.barangId, 
          gudangId: data.gudangId 
        } 
      }
    })
    
    const newStock = currentStock ? currentStock.stok + data.jumlah : data.jumlah
    
    if (currentStock) {
      await tx.barangGudang.update({
        where: { 
          barangId_gudangId: { 
            barangId: data.barangId, 
            gudangId: data.gudangId 
          } 
        },
        data: { stok: newStock }
      })
    } else {
      await tx.barangGudang.create({
        data: {
          barangId: data.barangId,
          gudangId: data.gudangId,
          stok: data.jumlah
        }
      })
    }
    
    // 4. Update original transaction
    await tx.barangKeluar.update({
      where: { id: data.keluarId },
      data: {
        isReturned: true,
        returnedAt: new Date(),
        returnedById: employeeId,
        returnMasukId: returnTransaction.id
      }
    })
    
    return {
      returnTransaction,
      updatedStock: {
        previousStock: currentStock?.stok || 0,
        newStock
      }
    }
  })
}
```

### 4.3. Caching Strategy

```typescript
// Redis cache keys
const CACHE_KEYS = {
  EMPLOYEE_ITEMS: (employeeId: string) => `employee:${employeeId}:items`,
  EMPLOYEE_STATS: (employeeId: string) => `employee:${employeeId}:stats`,
  BARANG_STOCK: (barangId: string, gudangId: string) => `stock:${barangId}:${gudangId}`
}

// Cache TTL (seconds)
const CACHE_TTL = {
  EMPLOYEE_ITEMS: 300, // 5 minutes
  EMPLOYEE_STATS: 600, // 10 minutes
  BARANG_STOCK: 60    // 1 minute
}

// Cache helper functions
async function getCachedData<T>(key: string): Promise<T | null> {
  const cached = await redis.get(key)
  return cached ? JSON.parse(cached) : null
}

async function setCachedData<T>(key: string, data: T, ttl: number): Promise<void> {
  await redis.setex(key, ttl, JSON.stringify(data))
}

async function invalidateCache(patterns: string[]): Promise<void> {
  const keys = []
  for (const pattern of patterns) {
    const matchingKeys = await redis.keys(pattern)
    keys.push(...matchingKeys)
  }
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}
```

## 5. Testing Strategy

### 5.1. Unit Tests

```typescript
// Example test for return transaction
describe('POST /api/inventory/return', () => {
  test('should process valid return transaction', async () => {
    const mockEmployee = await createMockEmployee()
    const mockBarang = await createMockBarang()
    const mockGudang = await createMockGudang()
    const mockKeluar = await createMockBarangKeluar({
      employeeId: mockEmployee.id,
      barangId: mockBarang.id,
      gudangId: mockGudang.id,
      jumlah: 5
    })
    
    const returnData = {
      keluarId: mockKeluar.id,
      barangId: mockBarang.id,
      gudangId: mockGudang.id,
      jumlah: 3,
      kondisi: 'BAIK',
      keterangan: 'Tidak digunakan'
    }
    
    const response = await POST(request(returnData), {
      session: mockEmployee
    })
    
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.data.masukId).toBeDefined()
  })
  
  test('should reject return exceeding borrowed quantity', async () => {
    // Test implementation
  })
  
  test('should reject return for non-owner', async () => {
    // Test implementation
  })
})
```

### 5.2. Integration Tests

```typescript
// Example integration test
describe('Return Transaction Flow', () => {
  test('complete return flow with stock update', async () => {
    // 1. Create initial stock
    // 2. Process borrow transaction
    // 3. Process return transaction
    // 4. Verify stock updated correctly
    // 5. Verify transaction history
  })
})
```

### 5.3. Load Testing

```typescript
// Load test scenarios
const LOAD_TEST_SCENARIOS = {
  CONCURRENT_RETURNS: {
    users: 10,
    requests: 5,
    duration: '30s'
  },
  PEAK_HOUR_SIMULATION: {
    users: 50,
    requests: 20,
    duration: '5m'
  }
}
```

## 6. Security Considerations

### 6.1. Authorization

```typescript
// Role-based access control
const PERMISSIONS = {
  EMPLOYEE: [
    'inventory:borrow',
    'inventory:return:own',
    'inventory:view:own'
  ],
  ADMIN: [
    'inventory:borrow',
    'inventory:return:any',
    'inventory:view:any',
    'inventory:manage'
  ]
}

// Permission checking middleware
function checkPermission(permission: string) {
  return (req: NextRequest, session: any) => {
    const userPermissions = PERMISSIONS[session.user.role] || []
    if (!userPermissions.includes(permission)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }
    return null
  }
}
```

### 6.2. Data Validation

```typescript
// Input validation schemas
const returnSchema = z.object({
  keluarId: z.string().min(1),
  barangId: z.string().min(1),
  gudangId: z.string().min(1),
  jumlah: z.number().min(1).max(1000),
  kondisi: z.enum(['BAIK', 'RUSAK', 'HILANG']),
  keterangan: z.string().max(500).optional(),
  fotoBukti: z.array(z.string().url()).max(3).optional()
})

// Validation middleware
function validateInput(schema: z.ZodSchema) {
  return (req: NextRequest) => {
    try {
      const body = req.json()
      return schema.parse(body)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
  }
}
```

### 6.3. Rate Limiting

```typescript
// Rate limiting configuration
const RATE_LIMITS = {
  '/api/inventory/return': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10 // 10 requests per window
  },
  '/api/inventory/employee/items': {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30 // 30 requests per window
  }
}

// Rate limiting middleware
function rateLimit(endpoint: string) {
  const config = RATE_LIMITS[endpoint]
  if (!config) return null
  
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: 'Too many requests, please try again later'
  })
}
```

## 7. Monitoring & Logging

### 7.1. API Metrics

```typescript
// Metrics to track
const API_METRICS = {
  REQUEST_COUNT: 'api_requests_total',
  REQUEST_DURATION: 'api_request_duration_seconds',
  ERROR_COUNT: 'api_errors_total',
  ACTIVE_TRANSACTIONS: 'active_transactions_total',
  STOCK_ACCURACY: 'stock_accuracy_percentage'
}

// Logging format
const logFormat = {
  timestamp: 'iso',
  level: 'info',
  message: string,
  userId: string,
  endpoint: string,
  method: string,
  duration: number,
  statusCode: number,
  error?: string,
  metadata?: any
}
```

### 7.2. Business Metrics

```typescript
// Business metrics to track
const BUSINESS_METRICS = {
  DAILY_BORROWED_ITEMS: 'daily_borrowed_items',
  DAILY_RETURNED_ITEMS: 'daily_returned_items',
  AVERAGE_BORROW_DURATION: 'average_borrow_duration_days',
  RETURN_CONDITION_BREAKDOWN: 'return_condition_breakdown',
  EMPLOYEE_ACTIVITY: 'employee_inventory_activity'
}
```

## 8. Performance Optimization

### 8.1. Database Optimization

```sql
-- Optimized queries
EXPLAIN ANALYZE
SELECT bk.*, b.kode, b.nama, g.kode as gudang_kode, g.nama as gudang_nama
FROM barang_keluar bk
JOIN barang b ON bk.barangId = b.id
JOIN gudang g ON bk.gudangId = g.id
WHERE bk.employeeId = $1 AND bk.isReturned = false
ORDER BY bk.tanggal DESC
LIMIT $2;

-- Index usage analysis
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### 8.2. Caching Strategy

```typescript
// Multi-level caching
const CACHE_STRATEGY = {
  L1_MEMORY: {
    ttl: 60, // 1 minute
    maxSize: 100 // items
  },
  L2_REDIS: {
    ttl: 300, // 5 minutes
    maxSize: 1000 // items
  },
  L3_DATABASE: {
    // Fallback to database
  }
}
```

## 9. API Documentation

### 9.1. OpenAPI Specification

```yaml
openapi: 3.0.0
info:
  title: NetManager Inventory API
  version: 2.0.0
  description: API for inventory management in NetManager

paths:
  /api/inventory/employee/items:
    get:
      summary: Get employee borrowed items
      tags:
        - Employee Inventory
      security:
        - bearerAuth: []
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [dipinjam, dikembalikan, semua]
            default: dipinjam
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/EmployeeItemsResponse'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /api/inventory/return:
    post:
      summary: Process item return
      tags:
        - Employee Inventory
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ReturnRequest'
      responses:
        '200':
          description: Return processed successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ReturnResponse'
        '400':
          description: Bad request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

components:
  schemas:
    EmployeeItemsResponse:
      type: object
      properties:
        success:
          type: boolean
        data:
          type: object
          properties:
            borrowedItems:
              type: array
              items:
                $ref: '#/components/schemas/BorrowedItem'
            pagination:
              $ref: '#/components/schemas/Pagination'

    BorrowedItem:
      type: object
      properties:
        id:
          type: string
        barangId:
          type: string
        barangKode:
          type: string
        barangNama:
          type: string
        barangSatuan:
          type: string
        gudangId:
          type: string
        gudangKode:
          type: string
        gudangNama:
          type: string
        jumlah:
          type: integer
        jumlahDikembalikan:
          type: integer
        tanggalAmbil:
          type: string
          format: date-time
        purpose:
          type: string
        kondisi:
          type: string
        fotoBukti:
          type: array
          items:
            type: string
        isReturned:
          type: boolean
        returnedAt:
          type: string
          format: date-time
          nullable: true

    ReturnRequest:
      type: object
      required:
        - keluarId
        - barangId
        - gudangId
        - jumlah
        - kondisi
      properties:
        keluarId:
          type: string
        barangId:
          type: string
        gudangId:
          type: string
        jumlah:
          type: integer
          minimum: 1
        kondisi:
          type: string
          enum: [BAIK, RUSAK, HILANG]
        keterangan:
          type: string
          maxLength: 500
        fotoBukti:
          type: array
          items:
            type: string
            format: uri
          maxItems: 3

    ReturnResponse:
      type: object
      properties:
        success:
          type: boolean
        message:
          type: string
        data:
          type: object
          properties:
            masukId:
              type: string
            keluarId:
              type: string
            transaction:
              $ref: '#/components/schemas/Transaction'
            updatedStock:
              $ref: '#/components/schemas/StockUpdate'

    Transaction:
      type: object
      properties:
        id:
          type: string
        barangId:
          type: string
        gudangId:
          type: string
        jumlah:
          type: integer
        kondisi:
          type: string
        keterangan:
          type: string
        tanggal:
          type: string
          format: date-time
        isReturnTransaction:
          type: boolean
        returnReferenceId:
          type: string

    StockUpdate:
      type: object
      properties:
        barangId:
          type: string
        gudangId:
          type: string
        previousStock:
          type: integer
        newStock:
          type: integer
        kondisiBreakdown:
          type: object
          properties:
            BAIK:
              type: integer
            RUSAK:
              type: integer
            HILANG:
              type: integer

    ErrorResponse:
      type: object
      properties:
        success:
          type: boolean
        error:
          type: string
        code:
          type: integer
        details:
          type: object

    Pagination:
      type: object
      properties:
        page:
          type: integer
        limit:
          type: integer
        total:
          type: integer
        totalPages:
          type: integer

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

## 10. Migration Plan

### 10.1. Phase 1: Database Schema Updates
```sql
-- Migration script
-- Step 1: Add new columns
ALTER TABLE barang_keluar ADD COLUMN IF NOT EXISTS isReturned BOOLEAN DEFAULT FALSE;
ALTER TABLE barang_keluar ADD COLUMN IF NOT EXISTS returnedAt TIMESTAMP;
ALTER TABLE barang_keluar ADD COLUMN IF NOT EXISTS returnedById STRING;
ALTER TABLE barang_keluar ADD COLUMN IF NOT EXISTS returnMasukId STRING;

ALTER TABLE barang_masuk ADD COLUMN IF NOT EXISTS isReturnTransaction BOOLEAN DEFAULT FALSE;
ALTER TABLE barang_masuk ADD COLUMN IF NOT EXISTS returnReferenceId STRING;
ALTER TABLE barang_masuk ADD COLUMN IF NOT EXISTS employeeId STRING;

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_barang_keluar_employee_returned ON barang_keluar(employeeId, isReturned);
CREATE INDEX IF NOT EXISTS idx_barang_masuk_return_transaction ON barang_masuk(isReturnTransaction, returnReferenceId);

-- Step 3: Create constraints
ALTER TABLE barang_keluar ADD CONSTRAINT IF NOT EXISTS fk_barang_keluar_returned_by 
FOREIGN KEY (returnedById) REFERENCES user(id);

ALTER TABLE barang_keluar ADD CONSTRAINT IF NOT EXISTS fk_barang_keluar_return_masuk 
FOREIGN KEY (returnMasukId) REFERENCES barang_masuk(id);

ALTER TABLE barang_masuk ADD CONSTRAINT IF NOT EXISTS fk_barang_masuk_return_reference 
FOREIGN KEY (returnReferenceId) REFERENCES barang_keluar(id);

ALTER TABLE barang_masuk ADD CONSTRAINT IF NOT EXISTS fk_barang_masuk_employee 
FOREIGN KEY (employeeId) REFERENCES user(id);
```

### 10.2. Phase 2: API Implementation
- Implement new endpoints
- Update existing endpoints
- Add authentication and authorization
- Implement validation and error handling

### 10.3. Phase 3: Frontend Integration
- Update employee navigation
- Implement new UI components
- Add form validation
- Implement photo upload

### 10.4. Phase 4: Testing & Deployment
- Unit and integration testing
- Performance testing
- Security testing
- User acceptance testing
- Production deployment

---

## Appendix

### A. Error Codes Reference
| Code | Description | HTTP Status |
|------|-------------|-------------|
| E001 | Unauthorized access | 401 |
| E002 | Insufficient permissions | 403 |
| E003 | Invalid input data | 400 |
| E004 | Item not found | 404 |
| E005 | Quantity exceeds limit | 400 |
| E006 | Item already returned | 400 |
| E007 | Warehouse not found | 404 |
| E008 | Stock insufficient | 400 |

### B. Rate Limits Reference
| Endpoint | Requests | Window | Description |
|----------|----------|--------|-------------|
| /api/inventory/return | 10 | 15 minutes | Return transactions |
| /api/inventory/employee/items | 30 | 15 minutes | View borrowed items |
| /api/inventory/employee/history | 20 | 15 minutes | View transaction history |
| /api/inventory/employee/stats | 10 | 15 minutes | View statistics |

### C. Cache Keys Reference
| Pattern | TTL | Description |
|----------|-----|-------------|
| employee:{id}:items | 5m | Employee borrowed items |
| employee:{id}:stats | 10m | Employee statistics |
| stock:{barangId}:{gudangId} | 1m | Current stock levels |
| transaction:{id} | 1h | Transaction details |