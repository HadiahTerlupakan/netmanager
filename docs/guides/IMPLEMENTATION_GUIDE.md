# Panduan Implementasi Fitur Baru

Dokumen ini menjelaskan fitur-fitur baru yang telah diimplementasikan dan cara penggunaannya.

---

## ✅ Fitur yang Telah Diimplementasikan

### 1. Error Boundary & Global Error Handling

**File yang dibuat:**
- `app/error.tsx` - Error boundary untuk route segments
- `app/global-error.tsx` - Error boundary global untuk root layout
- `app/not-found.tsx` - Halaman 404 custom

**Cara kerja:**
- Error boundary akan otomatis menangkap error di komponen React
- `error.tsx` menangani error di level route
- `global-error.tsx` menangani error kritis di root layout
- `not-found.tsx` ditampilkan saat halaman tidak ditemukan

**Tidak perlu konfigurasi tambahan** - Next.js akan otomatis menggunakan file-file ini.

---

### 2. Security Headers

**File yang diupdate:**
- `next.config.ts`

**Headers yang ditambahkan:**
- `X-Frame-Options: SAMEORIGIN` - Mencegah clickjacking
- `X-Content-Type-Options: nosniff` - Mencegah MIME type sniffing
- `X-XSS-Protection: 1; mode=block` - XSS protection
- `Strict-Transport-Security` - Force HTTPS
- `Content-Security-Policy` - CSP untuk mencegah XSS
- `Referrer-Policy` - Kontrol referrer information
- `Permissions-Policy` - Kontrol browser features

**Tidak perlu konfigurasi tambahan** - Headers akan otomatis diterapkan ke semua routes.

**Catatan:** Untuk production, pertimbangkan untuk memperketat CSP dengan menghapus `'unsafe-eval'` dan `'unsafe-inline'` jika memungkinkan.

---

### 3. Health Check Endpoint

**File yang dibuat:**
- `app/api/health/route.ts`

**Cara menggunakan:**
```bash
# Cek status aplikasi
curl http://localhost:3000/api/health

# Response contoh:
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 5
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2
    }
  },
  "uptime": 3600,
  "memory": {
    "used": 150,
    "total": 200,
    "unit": "MB"
  }
}
```

**Kegunaan:**
- Monitoring aplikasi
- Load balancer health checks
- Automated deployment checks

**Status Code:**
- `200` - Aplikasi sehat
- `503` - Aplikasi tidak sehat (database down)

---

### 4. Rate Limiting

**File yang dibuat:**
- `lib/middleware/rate-limit.ts` - Core rate limiting logic
- `lib/middleware/api-rate-limit.ts` - Helper untuk API routes
- `middleware.ts` - Updated dengan rate limiting

**Cara kerja:**
Rate limiting otomatis diterapkan ke semua API routes melalui middleware.

**Konfigurasi default:**
```typescript
// Default: 100 requests per minute untuk semua API
default: {
  maxRequests: 100,
  windowSeconds: 60,
}

// Khusus untuk endpoint tertentu:
'/api/auth': 10 requests/minute
'/api/olts/test-connection': 20 requests/minute
'/api/olts/onus/sync': 5 requests per 5 minutes
'/api/kmz': 10 uploads/minute
```

**Custom rate limit di API route:**
```typescript
import { applyApiRateLimit } from '@/lib/middleware/api-rate-limit'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = await applyApiRateLimit(req)
  if (rateLimitResponse) return rateLimitResponse
  
  // ... rest of your handler
}
```

**Response saat rate limit exceeded:**
```json
{
  "error": "Terlalu banyak permintaan. Silakan coba lagi nanti.",
  "retryAfter": 60
}
```
Status: `429 Too Many Requests`

**Headers yang dikembalikan:**
- `Retry-After: 60`
- `X-RateLimit-Limit: 100`
- `X-RateLimit-Window: 60`

**Mengubah konfigurasi:**
Edit `apiRateLimitConfig` di `lib/middleware/rate-limit.ts`

---

### 5. Logging Utility

**File yang dibuat:**
- `lib/logger.ts`

**Cara menggunakan:**

```typescript
import { logger } from '@/lib/logger'

// Basic logging
logger.debug('Debug message', { userId: '123' })
logger.info('Info message', { action: 'login' })
logger.warn('Warning message', { issue: 'slow query' })
logger.error('Error message', error, { context: 'api' })

// API request logging
const start = Date.now()
// ... your API logic
logger.apiRequest('POST', '/api/users', 200, Date.now() - start, {
  userId: '123',
  ip: '192.168.1.1'
})

// Database operation logging
const dbStart = Date.now()
// ... your DB operation
logger.dbOperation('create', 'User', Date.now() - dbStart, {
  userId: '123'
})
```

**Log Levels:**
- `DEBUG` - Detail informasi (hanya di development)
- `INFO` - Informasi umum
- `WARN` - Peringatan
- `ERROR` - Error dengan stack trace

**Environment Variables:**
```env
LOG_LEVEL=info  # debug, info, warn, error (default: info)
```

**Output format:**
```
[2024-01-01T00:00:00.000Z] [INFO] API POST /api/users {"statusCode":200,"duration":"50ms"}
```

**TODO untuk production:**
- Integrasi dengan error tracking service (Sentry, LogRocket)
- Integrasi dengan logging service (Datadog, CloudWatch)
- Log rotation dan retention policy

---

### 6. XSS Prevention (Input Sanitization)

**File yang dibuat:**
- `lib/utils/sanitize.ts` - Utility functions untuk sanitization

**Dependencies yang diinstall:**
- `dompurify` - Library untuk sanitize HTML
- `isomorphic-dompurify` - DOMPurify untuk server-side

**Cara menggunakan:**

```typescript
import { sanitizeHtml, sanitizeText, sanitizeInput, sanitizeRichText, sanitizeObject, escapeHtml } from '@/lib/utils/sanitize'

// Sanitize HTML (hapus semua HTML tags)
const clean = sanitizeHtml(userInput)

// Sanitize plain text (hapus semua HTML)
const text = sanitizeText(userInput)

// Sanitize input form (allow line breaks)
const input = sanitizeInput(userInput)

// Sanitize rich text (allow beberapa HTML tags yang aman)
const rich = sanitizeRichText(userInput)

// Sanitize object (recursive)
const cleanObj = sanitizeObject(userData)

// Escape HTML characters
const escaped = escapeHtml(userInput)
```

**Fungsi yang tersedia:**
- `sanitizeHtml()` - Hapus semua HTML tags
- `sanitizeText()` - Plain text tanpa HTML
- `sanitizeInput()` - Input form dengan line breaks
- `sanitizeRichText()` - Rich text dengan tags yang aman
- `sanitizeObject()` - Recursive sanitization untuk objects
- `escapeHtml()` - Escape HTML special characters

**Contoh penggunaan di API route:**
```typescript
import { sanitizeText } from '@/lib/utils/sanitize'

export async function POST(req: Request) {
  const body = await req.json()
  
  // Sanitize user input sebelum disimpan
  const sanitizedName = sanitizeText(body.name)
  const sanitizedDescription = sanitizeText(body.description)
  
  // ... save to database
}
```

**Contoh penggunaan di React component:**
```typescript
'use client'

import { sanitizeHtml } from '@/lib/utils/sanitize'
import { useEffect, useState } from 'react'

export function UserContent({ content }: { content: string }) {
  const [sanitized, setSanitized] = useState('')
  
  useEffect(() => {
    setSanitized(sanitizeHtml(content))
  }, [content])
  
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />
}
```

---

### 7. CORS Configuration

**File yang dibuat:**
- `lib/middleware/cors.ts` - CORS middleware utilities

**Cara menggunakan:**

```typescript
import { applyCors, addCorsHeaders } from '@/lib/middleware/cors'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  // Handle preflight requests
  const corsResponse = applyCors(req, {
    origin: ['http://localhost:3000', 'https://example.com'],
    methods: ['GET', 'POST'],
    credentials: true,
  })
  if (corsResponse) return corsResponse
  
  // Your handler logic
  const response = NextResponse.json({ data: '...' })
  
  // Add CORS headers to response
  return addCorsHeaders(response, req, {
    origin: ['http://localhost:3000', 'https://example.com'],
    credentials: true,
  })
}
```

**Environment Variables:**
```env
# CORS Configuration
# Untuk development: http://localhost:3000
# Untuk production: https://yourdomain.com
# Untuk multiple origins: http://localhost:3000,https://yourdomain.com
# Untuk allow all: *
CORS_ORIGIN=*
```

**CORS Options:**
- `origin` - Allowed origins (string, array, atau function)
- `methods` - Allowed HTTP methods
- `allowedHeaders` - Allowed request headers
- `exposedHeaders` - Headers yang bisa diakses oleh client
- `credentials` - Allow credentials (cookies, dll)
- `maxAge` - Cache preflight requests (dalam detik)

**Contoh konfigurasi untuk production:**
```typescript
const corsResponse = applyCors(req, {
  origin: (origin) => {
    const allowed = [
      'https://yourdomain.com',
      'https://www.yourdomain.com',
    ]
    return origin ? allowed.includes(origin) : false
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // 24 hours
})
```

---

## 📝 Contoh Penggunaan di API Route

Berikut contoh lengkap penggunaan logger dan rate limiting di API route:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { applyApiRateLimit } from '@/lib/middleware/api-rate-limit'
import { applyCors, addCorsHeaders } from '@/lib/middleware/cors'
import { sanitizeText, sanitizeObject } from '@/lib/utils/sanitize'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    // 1. CORS handling
    const corsResponse = applyCors(req)
    if (corsResponse) return corsResponse

    // 2. Rate limiting
    const rateLimitResponse = await applyApiRateLimit(req)
    if (rateLimitResponse) {
      logger.warn('Rate limit exceeded', { path: req.nextUrl.pathname })
      return addCorsHeaders(rateLimitResponse, req)
    }

    // 3. Authentication
    const session = await getServerSession(authConfig as any)
    if (!session) {
      logger.warn('Unauthorized access attempt', { path: req.nextUrl.pathname })
      const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return addCorsHeaders(response, req)
    }

    // 4. Sanitize input
    const body = await req.json()
    const sanitizedBody = sanitizeObject(body)
    
    logger.info('Processing request', { 
      path: req.nextUrl.pathname,
      userId: session.user.id 
    })

    // 5. Your business logic
    // ... your logic here

    // 6. Success logging
    logger.apiRequest('POST', req.nextUrl.pathname, 200, Date.now() - startTime, {
      userId: session.user.id
    })

    const response = NextResponse.json({ success: true })
    return addCorsHeaders(response, req)
  } catch (error: any) {
    // 7. Error logging
    logger.error('API error', error, {
      path: req.nextUrl.pathname,
      method: 'POST'
    })

    const response = NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
    return addCorsHeaders(response, req)
  }
}
```

---

## 🔧 Konfigurasi Tambahan

### Environment Variables

Tambahkan ke `.env` jika diperlukan:

```env
# Logging
LOG_LEVEL=info  # debug, info, warn, error

# CORS Configuration
CORS_ORIGIN=*  # atau http://localhost:3000,https://yourdomain.com

# Rate Limiting (optional - menggunakan default jika tidak di-set)
RATE_LIMIT_ENABLED=true
```

### Production Considerations

1. **Security Headers:**
   - Review dan sesuaikan CSP untuk production
   - Pertimbangkan menghapus `'unsafe-eval'` dan `'unsafe-inline'`

2. **Rate Limiting:**
   - Sesuaikan rate limit berdasarkan traffic
   - Monitor rate limit violations
   - Pertimbangkan menggunakan Redis cluster untuk high availability

3. **Logging:**
   - Setup log aggregation service
   - Implement log rotation
   - Setup alerting untuk error logs

4. **Error Tracking:**
   - Integrasikan Sentry atau error tracking service lainnya
   - Setup alerting untuk critical errors

---

## 🧪 Testing

### Test Health Check
```bash
curl http://localhost:3000/api/health
```

### Test Rate Limiting
```bash
# Test rate limit (coba request lebih dari limit)
for i in {1..150}; do
  curl http://localhost:3000/api/users
done
```

### Test Error Boundary
- Akses route yang tidak ada: `http://localhost:3000/nonexistent`
- Trigger error di komponen untuk test error boundary

### Test CORS
```bash
# Test CORS dari browser console atau Postman
fetch('http://localhost:3000/api/users', {
  method: 'GET',
  headers: {
    'Origin': 'http://localhost:3001'
  }
})
```

### Test XSS Prevention
```typescript
import { sanitizeHtml } from '@/lib/utils/sanitize'

// Test dengan malicious input
const malicious = '<script>alert("XSS")</script><img src=x onerror=alert(1)>'
const safe = sanitizeHtml(malicious)
console.log(safe) // Output: '' (semua HTML dihapus)
```

---

## 📚 Referensi

- [Next.js Error Handling](https://nextjs.org/docs/app/building-your-application/routing/error-handling)
- [Next.js Security Headers](https://nextjs.org/docs/app/api-reference/next-config-js/headers)
- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [CORS MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

### 8. Request/Response Logging Middleware

**File yang dibuat:**
- `lib/middleware/request-logger.ts` - Auto-logging middleware

**Cara menggunakan:**

```typescript
import { logRequest, logResponse, withRequestLogging } from '@/lib/middleware/request-logger'
import { NextRequest, NextResponse } from 'next/server'

// Method 1: Manual logging
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  logRequest(req)
  
  // ... your handler logic
  
  const response = NextResponse.json({ data: '...' })
  logResponse(req, response, Date.now() - startTime)
  return response
}

// Method 2: Auto-logging dengan wrapper
export const GET = withRequestLogging(async (req: NextRequest) => {
  // ... your handler logic
  return NextResponse.json({ data: '...' })
})
```

**Fitur:**
- ✅ Auto-logging request method, path, IP
- ✅ Auto-logging response status, duration
- ✅ Error logging dengan stack trace
- ✅ Exclude paths (default: `/api/health`)
- ✅ Configurable (log body, headers, dll)

**Options:**
```typescript
withRequestLogging(handler, {
  logRequestBody: false,  // Log request body (default: false)
  logResponseBody: false,  // Log response body (default: false)
  logHeaders: false,      // Log headers (default: false)
  excludePaths: ['/api/health'], // Paths to exclude
  maxBodyLength: 1000,     // Max body length to log
})
```

---

### 9. Backup Strategy

**File yang dibuat:**
- `scripts/backup-db.sh` - Backup script
- `scripts/restore-db.sh` - Restore script
- `docs/BACKUP_STRATEGY.md` - Dokumentasi lengkap

**Cara menggunakan:**

```bash
# Backup database
./scripts/backup-db.sh

# Backup ke custom location
./scripts/backup-db.sh /path/to/backup

# Restore database
./scripts/restore-db.sh ./backups/netmanager_backup_20240101_120000.sql.gz
```

**Fitur:**
- ✅ Automated backup dengan timestamp
- ✅ Kompresi otomatis (gzip)
- ✅ Auto-cleanup (menyimpan 30 backup terakhir)
- ✅ Error handling
- ✅ Restore dengan konfirmasi

**Setup Automated Backup:**

```bash
# Tambahkan ke crontab untuk backup harian jam 02:00
crontab -e
# Tambahkan:
0 2 * * * cd /path/to/netmanager && ./scripts/backup-db.sh
```

---

### 10. Unit Tests

**File yang dibuat:**
- `vitest.config.ts` - Vitest configuration
- `lib/utils/__tests__/sanitize.test.ts` - Test untuk sanitize utilities
- `lib/middleware/__tests__/rate-limit.test.ts` - Test untuk rate limiting
- `lib/__tests__/logger.test.ts` - Test untuk logger

**Dependencies yang diinstall:**
- `vitest` - Testing framework
- `@vitest/ui` - UI untuk test runner
- `@testing-library/react` - React testing utilities
- `@testing-library/jest-dom` - DOM matchers

**Cara menggunakan:**

```bash
# Run tests
npm test

# Run tests dengan UI
npm run test:ui

# Run tests sekali (CI mode)
npm run test:run

# Run tests dengan coverage
npm run test:coverage
```

**Test Coverage:**
- ✅ Sanitize utilities (XSS prevention)
- ✅ Rate limiting configuration
- ✅ Logger functionality

**Menambah Test Baru:**

```typescript
// lib/utils/__tests__/my-function.test.ts
import { describe, it, expect } from 'vitest'
import { myFunction } from '../my-function'

describe('myFunction', () => {
  it('should work correctly', () => {
    expect(myFunction('input')).toBe('expected')
  })
})
```

---

### 11. Integration Tests

**File yang dibuat:**
- `lib/test-utils.ts` - Test utilities (createTestUser, cleanupTestDatabase, dll)
- `tests/setup.ts` - Test setup configuration
- `tests/helpers/api-test-helper.ts` - API test helpers
- `tests/integration/api/users.test.ts` - Users API integration tests
- `tests/integration/api/health.test.ts` - Health check integration tests
- `tests/integration/api/olts.test.ts` - OLTs API integration tests
- `docs/INTEGRATION_TESTS.md` - Dokumentasi lengkap

**Dependencies yang diinstall:**
- `supertest` - HTTP assertion library
- `@types/supertest` - TypeScript types

**Cara menggunakan:**

```bash
# Run semua tests (unit + integration)
npm test

# Run hanya integration tests
npm run test:run -- tests/integration

# Run dengan UI
npm run test:ui

# Run dengan coverage
npm run test:coverage
```

**Test Coverage:**
- ✅ Users API (GET, POST dengan berbagai scenarios)
- ✅ Health Check API
- ✅ OLTs API (GET, POST dengan berbagai scenarios)
- ✅ Authentication & Authorization tests
- ✅ Error handling tests (400, 401, 404, 409)

**Test Utilities:**
- `createTestAdmin()` - Create test admin user
- `createTestUser()` - Create test user dengan custom data
- `createTestOlt()` - Create test OLT
- `createMockRequest()` - Create mock NextRequest
- `createMockSession()` - Create mock session
- `cleanupTestDatabase()` - Cleanup test database

**Menambah Integration Test Baru:**

```typescript
// tests/integration/api/my-endpoint.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createTestAdmin, cleanupTestDatabase, createMockSession } from '@/lib/test-utils'
import { createMockRequest, getResponseData } from '../../helpers/api-test-helper'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

describe('My Endpoint Integration Tests', () => {
  let adminUser: any
  let mockSession: any

  beforeAll(async () => {
    adminUser = await createTestAdmin()
    mockSession = createMockSession(adminUser)
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  it('should work correctly', async () => {
    const { getServerSession } = await import('next-auth')
    vi.mocked(getServerSession).mockResolvedValue(mockSession)

    const { GET } = await import('@/app/api/my-endpoint/route')
    const req = createMockRequest('GET', '/api/my-endpoint')
    const response = await GET(req)

    expect(response.status).toBe(200)
    const data = await getResponseData(response)
    expect(data).toHaveProperty('expectedProperty')
  })
})
```

**⚠️ Catatan:**
- Tests akan menghapus data di database
- Pastikan menggunakan test database atau development database yang aman
- Setup `TEST_DATABASE_URL` untuk test database terpisah

---

### 12. API Documentation (Swagger/OpenAPI)

**File yang dibuat:**
- `lib/swagger/swagger-config.ts` - Swagger configuration
- `app/api/docs/route.ts` - OpenAPI spec endpoint
- `app/api/docs/ui/page.tsx` - Swagger UI page
- `docs/API_DOCUMENTATION.md` - Dokumentasi lengkap

**Dependencies yang diinstall:**
- `swagger-jsdoc` - Generate OpenAPI spec dari JSDoc
- `swagger-ui-react` - Swagger UI React component
- `@types/swagger-jsdoc` - TypeScript types
- `@types/swagger-ui-react` - TypeScript types

**Cara menggunakan:**

```bash
# Start development server
npm run dev

# Akses Swagger UI
# http://localhost:3000/api/docs/ui

# Akses OpenAPI spec (JSON)
# http://localhost:3000/api/docs
```

**Fitur:**
- ✅ Swagger UI interaktif untuk testing API
- ✅ OpenAPI 3.0 specification
- ✅ Auto-generate dari JSDoc comments
- ✅ Schema definitions untuk User, OLT, MikroTikRouter, Health, Error
- ✅ Security schemes (Bearer Token & Cookie Auth)
- ✅ Dokumentasi untuk endpoint utama (Health, Users, OLTs, MikroTik, Geocode)

**Menambah Dokumentasi Endpoint Baru:**

Tambahkan JSDoc comment dengan format Swagger di atas function handler:

```typescript
/**
 * @swagger
 * /api/my-endpoint:
 *   get:
 *     summary: My endpoint summary
 *     description: Detailed description
 *     tags: [MyTag]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
export async function GET() {
  // ... implementation
}
```

**Endpoint yang sudah didokumentasikan:**
- ✅ `GET /api/health` - Health check
- ✅ `GET /api/users` - Get all users
- ✅ `POST /api/users` - Create user
- ✅ `PATCH /api/users/{id}` - Update user
- ✅ `DELETE /api/users/{id}` - Delete user
- ✅ `GET /api/olts` - Get all OLTs
- ✅ `POST /api/olts` - Create OLT
- ✅ `GET /api/olts/{id}` - Get OLT by ID
- ✅ `GET /api/mikrotik-routers` - Get all MikroTik routers
- ✅ `GET /api/geocode/search` - Search location

**⚠️ Catatan:**
- Dokumentasi akan di-generate otomatis dari JSDoc comments
- Refresh halaman Swagger UI setelah menambahkan dokumentasi baru
- Pastikan path di `swagger-config.ts` sesuai dengan struktur file API

---

### 13. CI/CD Pipeline (GitHub Actions)

**File yang dibuat:**
- `.github/workflows/ci.yml` - CI Pipeline (lint, test, build, security)
- `.github/workflows/release.yml` - Release Pipeline
- `.github/workflows/deploy.yml` - Deploy Pipeline
- `docs/CI_CD_PIPELINE.md` - Dokumentasi lengkap

**Cara kerja:**

**CI Pipeline (`ci.yml`):**
- Trigger: Push ke `main`/`develop` atau Pull Request
- Jobs:
  - `lint` - ESLint & TypeScript type check
  - `test` - Run unit & integration tests (dengan PostgreSQL & Redis services)
  - `build` - Build verification
  - `security` - Security audit (npm audit)

**Release Pipeline (`release.yml`):**
- Trigger: Push tag dengan format `v*` (contoh: `v1.0.0`)
- Jobs:
  - `release` - Create GitHub Release dengan release notes

**Deploy Pipeline (`deploy.yml`):**
- Trigger: Manual workflow dispatch atau push ke `main`
- Jobs:
  - `deploy` - Deploy ke staging/production (Vercel)

**Setup:**

1. **Tidak perlu setup tambahan** - Workflow akan otomatis berjalan saat:
   - Push ke `main` atau `develop`
   - Pull Request dibuat
   - Tag dibuat (untuk release)

2. **Untuk deployment ke Vercel** (opsional):
   - Tambahkan secrets di GitHub:
     - `VERCEL_TOKEN`
     - `VERCEL_ORG_ID`
     - `VERCEL_PROJECT_ID`

**Fitur:**
- ✅ Automated linting & type checking
- ✅ Automated tests dengan PostgreSQL & Redis services
- ✅ Build verification
- ✅ Security audit
- ✅ Automated releases
- ✅ Deployment automation (Vercel)

**Lihat dokumentasi lengkap:** [`docs/CI_CD_PIPELINE.md`](docs/CI_CD_PIPELINE.md)

---

**Terakhir diupdate:** $(date)

