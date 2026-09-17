# Testing Standards

## Coverage Requirements

- Business logic (services): minimum 70%
- Critical path (payment, auth, leave approval): minimum 90%
- Repositories: integration test dengan real DB
- API routes: E2E test untuk happy path + critical error cases
- Baseline coverage yang masih rendah bukan alasan untuk menunda testing — setiap perubahan signifikan wajib sekaligus menambah atau memperbaiki test di area yang disentuh
- Prioritas testing dimulai dari service/business logic dan critical path, lalu meluas ke repository dan E2E sesuai risiko perubahan
- Jangan biarkan feature besar, refactor besar, atau migrasi architecture masuk tanpa minimal happy path test dan failure path utama

## Mocking Strategy

- Mock external API (MikroTik, Firebase, payment gateway)
- Mock notification services (email, WhatsApp, push notification)
- Real database untuk integration test (via `./scripts/setup-test-db.sh`)
- Real Prisma client untuk repository test
- Mock time/date untuk predictable test results

## Test Structure

```typescript
describe("LeaveLifecycleService", () => {
  describe("createLeave", () => {
    it("should create leave and sync balance when auto-approve enabled", async () => {
      // Arrange: setup test data
      const mockUser = createMockUser();
      const leaveData = createMockLeaveData();
      
      // Act: call service method
      const result = await service.createLeave(leaveData, mockUser.id, tenantId, true);
      
      // Assert: verify result and side effects
      expect(result.success).toBe(true);
      expect(balanceService.incrementUsed).toHaveBeenCalled();
    });

    it("should return error when insufficient balance", async () => {
      // Test error case
    });
  });
});
```

## Test Naming Convention

- Unit test: `*.test.ts` (di folder `__tests__` sejajar dengan file yang ditest)
- Integration test: `*.integration.test.ts`
- E2E test: `*.e2e.spec.ts` (di root `tests/e2e/`)

## Test Data

- Gunakan factory pattern untuk test data (`createMockUser()`, `createMockInvoice()`)
- Seed data untuk integration test via `prisma/seed.test.ts`
- Cleanup setelah test (transaction rollback atau explicit cleanup)

## Running Tests

```bash
# Setup test DB (wajib sebelum test pertama kali)
./scripts/setup-test-db.sh

# Run all tests
npm test

# Run specific test file
npm test -- LeaveLifecycleService.test.ts

# Run with coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```
