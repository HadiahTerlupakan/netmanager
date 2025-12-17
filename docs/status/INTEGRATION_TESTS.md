# Integration Tests Guide

## 📋 Overview

Dokumen ini menjelaskan cara menjalankan dan menulis integration tests untuk API endpoints NetManager.

---

## 🧪 Setup

### **Dependencies**

Sudah terinstall:
- `vitest` - Testing framework
- `supertest` - HTTP assertion library
- `@types/supertest` - TypeScript types

### **Test Database**

Integration tests menggunakan database yang sama dengan development (atau test database jika `TEST_DATABASE_URL` di-set).

**⚠️ Warning:** Tests akan menghapus data di database! Pastikan menggunakan test database atau development database yang aman untuk di-cleanup.

---

## 🏃 Menjalankan Tests

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

---

## 📝 Menulis Integration Tests

### **Struktur Test File**

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createTestAdmin, cleanupTestDatabase, createMockSession } from '@/lib/test-utils'
import { createMockRequest, getResponseData } from '../../helpers/api-test-helper'

// Mock NextAuth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

describe('API Name Integration Tests', () => {
  let adminUser: any
  let mockSession: any

  beforeAll(async () => {
    adminUser = await createTestAdmin()
    mockSession = createMockSession(adminUser)
  })

  afterAll(async () => {
    await cleanupTestDatabase()
  })

  describe('GET /api/endpoint', () => {
    it('should return 401 if not authenticated', async () => {
      // Test implementation
    })

    it('should return data for authenticated user', async () => {
      // Test implementation
    })
  })
})
```

---

## 🛠️ Test Utilities

### **createTestAdmin()**
Membuat test admin user untuk authentication.

```typescript
const adminUser = await createTestAdmin()
// Returns: { id, email, password, name, role: 'ADMIN' }
```

### **createTestUser(overrides?)**
Membuat test user dengan custom data.

```typescript
const user = await createTestUser({
  email: 'custom@example.com',
  password: 'CustomPassword123!',
  role: 'USER',
})
```

### **createMockRequest(method, path, body?, headers?)**
Membuat mock NextRequest untuk testing.

```typescript
const req = createMockRequest('POST', '/api/users', {
  email: 'test@example.com',
  password: 'Password123!',
})
```

### **createMockSession(user)**
Membuat mock session untuk authentication.

```typescript
const session = createMockSession(adminUser)
```

### **getResponseData(response)**
Mengambil data dari Response (JSON atau text).

```typescript
const data = await getResponseData(response)
```

### **cleanupTestDatabase()**
Membersihkan semua data dari test database.

```typescript
await cleanupTestDatabase()
```

---

## 📚 Contoh Test

### **Test GET Endpoint**

```typescript
it('should return users list', async () => {
  const { getServerSession } = await import('next-auth')
  vi.mocked(getServerSession).mockResolvedValue(mockSession)

  const { GET } = await import('@/app/api/users/route')
  const req = createMockRequest('GET', '/api/users')
  const response = await GET(req)

  expect(response.status).toBe(200)
  const data = await getResponseData(response)
  expect(data).toHaveProperty('users')
  expect(Array.isArray(data.users)).toBe(true)
})
```

### **Test POST Endpoint**

```typescript
it('should create new user', async () => {
  const { getServerSession } = await import('next-auth')
  vi.mocked(getServerSession).mockResolvedValue(mockSession)

  const { POST } = await import('@/app/api/users/route')
  const req = createMockRequest('POST', '/api/users', {
    email: `test-${Date.now()}@example.com`,
    password: 'Password123!',
    name: 'Test User',
    role: 'USER',
  })
  const response = await POST(req)

  expect(response.status).toBe(200)
  const data = await getResponseData(response)
  expect(data).toHaveProperty('id')
})
```

### **Test Error Cases**

```typescript
it('should return 400 for invalid data', async () => {
  const { getServerSession } = await import('next-auth')
  vi.mocked(getServerSession).mockResolvedValue(mockSession)

  const { POST } = await import('@/app/api/users/route')
  const req = createMockRequest('POST', '/api/users', {
    email: 'invalid-email', // Invalid
    password: '123', // Too short
  })
  const response = await POST(req)

  expect(response.status).toBe(400)
})
```

### **Test Authentication**

```typescript
it('should return 401 if not authenticated', async () => {
  const { getServerSession } = await import('next-auth')
  vi.mocked(getServerSession).mockResolvedValue(null)

  const { GET } = await import('@/app/api/users/route')
  const req = createMockRequest('GET', '/api/users')
  const response = await GET(req)

  expect(response.status).toBe(401)
})
```

---

## 🎯 Best Practices

### **1. Setup & Cleanup**
- Gunakan `beforeAll` untuk setup test data
- Gunakan `afterAll` untuk cleanup
- Jangan lupa cleanup untuk menghindari data leak antar tests

### **2. Isolation**
- Setiap test harus independent
- Jangan bergantung pada urutan test
- Gunakan unique data (timestamp, random) untuk menghindari conflict

### **3. Mocking**
- Mock `getServerSession` untuk authentication
- Mock external services jika diperlukan
- Reset mocks di `beforeEach` jika perlu

### **4. Assertions**
- Test status code
- Test response structure
- Test data correctness
- Test error cases

### **5. Test Coverage**
- Test happy path
- Test error cases (400, 401, 404, 409, 500)
- Test authentication & authorization
- Test validation

---

## 📊 Test Files

### **Sudah Ada:**
- `tests/integration/api/users.test.ts` - Users API tests
- `tests/integration/api/health.test.ts` - Health check tests
- `tests/integration/api/olts.test.ts` - OLTs API tests

### **Bisa Ditambahkan:**
- `tests/integration/api/mikrotik-routers.test.ts`
- `tests/integration/api/odcs.test.ts`
- `tests/integration/api/odps.test.ts`
- `tests/integration/api/poles.test.ts`
- `tests/integration/api/kmz.test.ts`
- dll

---

## ⚠️ Catatan Penting

1. **Database Cleanup:**
   - Tests akan menghapus data di database
   - Pastikan menggunakan test database atau development database yang aman
   - Setup `TEST_DATABASE_URL` untuk test database terpisah

2. **Authentication:**
   - Mock `getServerSession` untuk setiap test
   - Set session ke `null` untuk test unauthenticated
   - Set session ke mock session untuk test authenticated

3. **Async/Await:**
   - Semua handler adalah async, selalu gunakan `await`
   - Import handler dengan dynamic import untuk mock yang benar

4. **Error Handling:**
   - Test error cases dengan berbagai status code
   - Test validation errors
   - Test database errors

---

## 🔧 Troubleshooting

### **Test Gagal dengan Database Error**
- Pastikan database berjalan
- Check `DATABASE_URL` atau `TEST_DATABASE_URL`
- Pastikan Prisma client sudah di-generate: `npm run prisma:generate`

### **Test Gagal dengan Authentication Error**
- Pastikan mock `getServerSession` sudah di-set dengan benar
- Check apakah session format sesuai dengan yang diharapkan

### **Test Timeout**
- Increase timeout di `vitest.config.ts`
- Check apakah ada async operation yang tidak selesai

---

## 📚 Referensi

- [Vitest Documentation](https://vitest.dev/)
- [Next.js Testing](https://nextjs.org/docs/app/building-your-application/testing)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

**Terakhir diupdate:** $(date)

