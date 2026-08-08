# Testing Strategy & Coverage

**Last Updated:** 2026-08-09

---

## Testing Overview

### Test Framework Stack
- **Vitest:** 4.1.1 — Unit & integration tests
- **Playwright:** 1.58.1 — E2E browser tests
- **vitest-mock-extended:** Mock utilities
- **@vitest/coverage-v8:** Code coverage reports

### Test Statistics
- **Total Test Files:** 582
- **Test Database:** Isolated `netmanager_test` database
- **Coverage Target:** 70% for business logic, 90% for critical paths

---

## Test Structure

```
tests/
├── setup.ts                    # Global test setup
├── modules/                    # Module-specific unit tests
│   ├── accounting/
│   │   ├── RecurringEngineService.test.ts
│   │   ├── PeriodService.test.ts
│   │   ├── JournalPostingService.test.ts
│   │   ├── BankReconciliationService.test.ts
│   │   └── [15+ accounting tests]
│   ├── pelanggan/
│   ├── finance/
│   └── [other modules]
├── api/                        # API integration tests
│   ├── admin-*.test.ts
│   ├── mobile-*.test.ts
│   └── customer-*.test.ts
├── lib/                        # Library unit tests
│   ├── auth.test.ts
│   ├── rbac.test.ts
│   ├── prisma-errors.test.ts
│   └── [other lib tests]
├── ui/                         # UI component tests
│   ├── restock-pdf.test.ts
│   ├── procurement-po-pdf.test.ts
│   └── rab-csv.test.ts
└── e2e/                        # End-to-end tests
    └── [playwright tests]
```

---

## Test Database Setup

### Isolated Test Database
**Critical:** Tests run against separate database to prevent data loss

```bash
# Setup script (run once)
./scripts/setup-test-db.sh
```

**What it does:**
1. Creates `netmanager_test` database
2. Adds `TEST_DATABASE_URL` to `.env`
3. Runs migrations on test database
4. Seeds minimal test data

### Environment Variable
```bash
TEST_DATABASE_URL="postgresql://netmgr:netmgr@localhost:5432/netmanager_test"
```

### Test Database Lifecycle
```
Before Each Test Suite:
  ↓
Clean database (truncate all tables)
  ↓
Seed required reference data
  ↓
Run test
  ↓
After Each Test Suite:
  ↓
Clean database (for next test)
```

---

## Unit Testing Strategy

### Service Layer Tests
**Purpose:** Test business logic in isolation

**Example: Accounting Service**
```typescript
// tests/modules/accounting/JournalPostingService.test.ts
describe('JournalPostingService', () => {
  let service: JournalPostingService
  let mockRepository: MockProxy<IJournalRepository>
  
  beforeEach(() => {
    mockRepository = mock<IJournalRepository>()
    service = new JournalPostingService(mockRepository)
  })
  
  it('should create balanced journal entry', async () => {
    const input = {
      date: new Date(),
      entries: [
        { accountId: 'A1', debit: 1000, credit: 0 },
        { accountId: 'A2', debit: 0, credit: 1000 }
      ]
    }
    
    mockRepository.create.mockResolvedValue(mockJournal)
    
    const result = await service.createJournal(input)
    
    expect(result.isBalanced).toBe(true)
    expect(mockRepository.create).toHaveBeenCalled()
  })
  
  it('should reject unbalanced journal entry', async () => {
    const input = {
      date: new Date(),
      entries: [
        { accountId: 'A1', debit: 1000, credit: 0 },
        { accountId: 'A2', debit: 0, credit: 500 } // Unbalanced!
      ]
    }
    
    await expect(service.createJournal(input)).rejects.toThrow('Journal must be balanced')
  })
})
```

### Repository Layer Tests
**Purpose:** Test data access with real database

```typescript
// tests/modules/pelanggan/PelangganRepository.test.ts
describe('PelangganRepository', () => {
  let repository: PelangganRepository
  let testTenantId: string
  
  beforeEach(async () => {
    await cleanDatabase()
    testTenantId = await createTestTenant()
    repository = new PelangganRepository()
  })
  
  it('should create customer with tenant isolation', async () => {
    const customer = await repository.create({
      nama: 'Test Customer',
      username: 'testuser',
      tenantId: testTenantId
    })
    
    expect(customer.tenantId).toBe(testTenantId)
    
    // Verify isolation: different tenant cannot see
    const otherTenantCustomers = await repository.findAll({
      tenantId: 'other-tenant-id'
    })
    
    expect(otherTenantCustomers).not.toContainEqual(
      expect.objectContaining({ id: customer.id })
    )
  })
})
```

### Utility Tests
**Purpose:** Test pure functions

```typescript
// tests/lib/validation-utils.test.ts
describe('validateIndonesianPhone', () => {
  it('should accept valid Indonesian phone numbers', () => {
    expect(validateIndonesianPhone('081234567890')).toBe(true)
    expect(validateIndonesianPhone('+628123456789')).toBe(true)
    expect(validateIndonesianPhone('628123456789')).toBe(true)
  })
  
  it('should reject invalid formats', () => {
    expect(validateIndonesianPhone('123')).toBe(false)
    expect(validateIndonesianPhone('abc')).toBe(false)
  })
})
```

---

## Integration Testing Strategy

### API Route Tests
**Purpose:** Test full request → response flow

```typescript
// tests/api/admin-pelanggan-route.test.ts
describe('GET /api/admin/pelanggan', () => {
  let authCookie: string
  
  beforeEach(async () => {
    await setupTestDatabase()
    authCookie = await getAdminAuthCookie()
  })
  
  it('should return paginated customers', async () => {
    // Seed test data
    await createTestCustomers(50)
    
    // Make request
    const response = await fetch('http://localhost:3000/api/admin/pelanggan?page=1&limit=10', {
      headers: {
        cookie: authCookie
      }
    })
    
    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data.customers).toHaveLength(10)
    expect(data.total).toBe(50)
    expect(data.page).toBe(1)
  })
  
  it('should require authentication', async () => {
    const response = await fetch('http://localhost:3000/api/admin/pelanggan')
    expect(response.status).toBe(401)
  })
  
  it('should enforce RBAC permissions', async () => {
    const viewerCookie = await getViewerAuthCookie()
    
    const response = await fetch('http://localhost:3000/api/admin/pelanggan', {
      method: 'POST',
      headers: {
        cookie: viewerCookie,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ nama: 'Test' })
    })
    
    expect(response.status).toBe(403)
  })
})
```

### Multi-Tenant Tests
**Purpose:** Verify tenant isolation

```typescript
describe('Tenant Isolation', () => {
  it('should not leak data across tenants', async () => {
    const tenant1 = await createTestTenant('tenant-1')
    const tenant2 = await createTestTenant('tenant-2')
    
    // Create customer in tenant 1
    const customer1 = await createCustomer({ tenantId: tenant1.id })
    
    // Try to access from tenant 2 context
    const tenant2Cookie = await getAuthCookie({ tenantId: tenant2.id })
    
    const response = await fetch(`http://localhost:3000/api/admin/pelanggan/${customer1.id}`, {
      headers: { cookie: tenant2Cookie }
    })
    
    expect(response.status).toBe(404) // Should not find
  })
})
```

---

## E2E Testing Strategy

### Playwright Configuration
```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
```

### E2E Test Example
```typescript
// tests/e2e/customer-registration.spec.ts
test.describe('Customer Registration Flow', () => {
  test('should complete registration and login', async ({ page }) => {
    // Navigate to registration
    await page.goto('/registrasi')
    
    // Fill form
    await page.fill('[name="nama"]', 'Test Customer')
    await page.fill('[name="username"]', 'testuser')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="nomorHp"]', '081234567890')
    
    // Submit
    await page.click('button[type="submit"]')
    
    // Verify success
    await expect(page.locator('text=Registrasi berhasil')).toBeVisible()
    
    // Login with new credentials
    await page.goto('/login')
    await page.fill('[name="username"]', 'testuser')
    await page.fill('[name="password"]', 'default-password')
    await page.click('button[type="submit"]')
    
    // Verify dashboard
    await expect(page).toHaveURL('/dashboard')
  })
})
```

---

## Test Coverage Strategy

### Coverage Configuration
```typescript
// vitest.config.ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  include: ['modules/**/*.ts', 'lib/**/*.ts'],
  exclude: [
    'node_modules',
    'tests',
    '**/*.d.ts',
    '**/index.ts',  // Public API exports
    '**/*.constants.ts',
    '**/*.types.ts'
  ],
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 70,
    statements: 70
  }
}
```

### Coverage Targets

**Critical Paths (90%+):**
- Payment processing
- Billing calculations
- Accounting journal entries
- Authentication & authorization
- Network provisioning

**Business Logic (70%+):**
- Customer management
- Invoice generation
- Attendance tracking
- Work order lifecycle
- Inventory management

**Supporting Code (50%+):**
- UI components
- Utilities
- Helpers
- Constants

---

## Mocking Strategy

### External Services
```typescript
// Mock MikroTik API
vi.mock('node-routeros-v2', () => ({
  RouterOSAPI: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(true),
    write: vi.fn().mockResolvedValue([]),
    close: vi.fn().mockResolvedValue(true)
  }))
}))

// Mock Firebase Admin
vi.mock('firebase-admin', () => ({
  messaging: vi.fn(() => ({
    send: vi.fn().mockResolvedValue('success')
  }))
}))

// Mock Redis
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn()
    }))
  }
})
```

### Database Mocking (Unit Tests)
```typescript
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

const prismaMock = mockDeep<PrismaClient>()

beforeEach(() => {
  mockReset(prismaMock)
})

// Use in tests
prismaMock.pelanggan.findUnique.mockResolvedValue(mockCustomer)
```

---

## Test Data Management

### Factories
```typescript
// tests/factories/customer.factory.ts
export function createTestCustomer(overrides?: Partial<Customer>): Customer {
  return {
    id: uuid(),
    idPelanggan: `CUST-${Date.now()}`,
    nama: 'Test Customer',
    username: `user${Date.now()}`,
    status: 'AKTIF',
    tenantId: 'test-tenant',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}
```

### Fixtures
```typescript
// tests/fixtures/invoices.ts
export const sampleInvoices = [
  {
    id: 'inv-1',
    invoiceNumber: 'INV-2026-001',
    amount: 100000,
    status: 'UNPAID',
    dueDate: new Date('2026-01-31')
  },
  // ... more fixtures
]
```

---

## CI/CD Integration

### GitHub Actions (if exists)
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: ./scripts/setup-test-db.sh
      - run: npm test
      - run: npm run test:coverage
```

### Jenkins Pipeline
```groovy
stage('Quality Check') {
  steps {
    container('node') {
      // Setup test database
      sh './scripts/setup-test-db.sh'
      
      // Run tests with CI timeout
      sh 'npm run test:run'
      
      // Generate coverage
      sh 'npm run test:coverage'
      
      // Publish reports
      publishHTML([
        reportDir: 'coverage',
        reportFiles: 'index.html',
        reportName: 'Coverage Report'
      ])
    }
  }
}
```

---

## Test Execution

### Local Development
```bash
# Watch mode (recommended)
npm test

# Run once
npm run test:run

# With coverage
npm run test:coverage

# Specific test file
npm test -- tests/modules/pelanggan/PelangganService.test.ts

# E2E tests
npm run test:e2e
npm run test:e2e:ui     # Interactive UI
npm run test:e2e:headed # With browser visible
```

### CI Environment
```bash
# Increased timeouts for slower CI
CI=true npm run test:run

# Parallel execution limited
npm run test:run -- --maxWorkers=50%
```

---

## Test Patterns & Best Practices

### AAA Pattern (Arrange-Act-Assert)
```typescript
test('should calculate invoice total with tax', () => {
  // Arrange
  const invoice = createTestInvoice({
    subtotal: 100000,
    taxRate: 0.11
  })
  
  // Act
  const total = calculateInvoiceTotal(invoice)
  
  // Assert
  expect(total).toBe(111000)
})
```

### Test Naming Convention
```typescript
// Good: Descriptive, behavior-focused
it('should reject payment when invoice is already paid')
it('should send notification after successful payment')

// Bad: Implementation-focused
it('tests the processPayment function')
it('checks if status is updated')
```

### Async Testing
```typescript
// Good: Use async/await
test('should create customer', async () => {
  const customer = await service.createCustomer(data)
  expect(customer.id).toBeDefined()
})

// Bad: Callback hell
test('should create customer', (done) => {
  service.createCustomer(data).then(customer => {
    expect(customer.id).toBeDefined()
    done()
  })
})
```

### Test Isolation
```typescript
// Good: Each test is independent
beforeEach(async () => {
  await cleanDatabase()
  testData = await seedTestData()
})

afterEach(async () => {
  await cleanupTestData()
})

// Bad: Tests depend on each other
test('step 1: create customer', () => { /* ... */ })
test('step 2: update customer', () => { /* ... */ }) // Depends on step 1
```

---

## Known Test Issues

### Vitest 4 Timeout Syntax
**Issue:** Timeout syntax changed from v3 to v4

```typescript
// Old (v3) - Deprecated
it('test name', async () => { /* ... */ }, { timeout: 30000 })

// New (v4) - Current
it('test name', { timeout: 30000 }, async () => { /* ... */ })
```

### Database Connection Leaks
**Solution:** Properly close connections in `afterAll`

```typescript
afterAll(async () => {
  await prisma.$disconnect()
})
```

---

## Future Improvements

### Planned Enhancements
- [ ] Contract testing for API endpoints
- [ ] Visual regression testing (Playwright + Percy)
- [ ] Performance testing (load & stress tests)
- [ ] Mutation testing (Stryker)
- [ ] Property-based testing (fast-check)

### Coverage Goals
- [ ] Increase overall coverage to 80%
- [ ] 100% coverage for payment processing
- [ ] 100% coverage for accounting engine
- [ ] Add E2E tests for critical user flows

---

**Testing Strategy:** DOCUMENTED  
**Test Files:** 582  
**Coverage Tool:** Vitest + Playwright  
**Test Database:** Isolated instance required
