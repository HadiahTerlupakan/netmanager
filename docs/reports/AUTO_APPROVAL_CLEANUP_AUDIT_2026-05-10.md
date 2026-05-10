# Audit & Cleanup: Existing Auto-Approval Code

**Tanggal:** 2026-05-10  
**Status:** AUDIT REQUIRED  
**Prioritas:** HIGH (Sebelum implementasi Auto-Reject)

---

## 🔍 Current State Analysis

### Kode Auto-Approval yang Sudah Ada

#### 1. **LeaveAutoApprovalService.ts** - Cron Job untuk Tukar Libur

**File:** `modules/attendance/services/LeaveAutoApprovalService.ts`

**Fungsi:**
```typescript
export async function autoApproveTukarLibur(
  now = new Date(),
): Promise<LeaveAutoApprovalResult>
```

**Behavior:**
- Cron job yang berjalan setiap hari
- Auto-approve semua TUKAR_LIBUR yang PENDING untuk besok
- Menggunakan `approveLeave()` dengan actor `"SYSTEM_AUTO"`

**Status:** ✅ **KEEP - Ini adalah business logic yang valid**

**Rationale:**
- Tukar libur memang seharusnya auto-approve
- Tidak mengurangi quota (hanya swap tanggal)
- Sudah production-ready dengan error handling

---

#### 2. **LeaveLifecycleService.ts** - Parameter autoApprove

**File:** `modules/attendance/services/LeaveLifecycleService.ts`

**Signature:**
```typescript
async createLeave(
  data: CreateLeaveData,
  createdById: string,
  tenantId: string,
  autoApprove: boolean,  // ⚠️ Parameter ini
): Promise<LeaveResult>
```

**Behavior:**
```typescript
status: context.autoApprove ? "APPROVED" : "PENDING",
approvedBy: context.autoApprove ? context.actorId : null,
```

**Current Usage:**
- Default value: `true` di LeaveService.ts
- Tapi tidak ada caller yang pass `false`
- Tidak ada business rules untuk tentukan kapan true/false

**Status:** ⚠️ **NEEDS CLARIFICATION - Infrastructure tanpa business logic**

---

#### 3. **LeaveService.ts** - Default autoApprove = true

**File:** `modules/attendance/services/LeaveService.ts`

```typescript
async createLeave(
  data: CreateLeaveData,
  createdById: string,
  tenantId: string,
  autoApprove: boolean = true,  // ⚠️ Default true
): Promise<LeaveResult> {
  return this.lifecycleService.createLeave(
    data,
    createdById,
    tenantId,
    autoApprove,
  );
}
```

**Status:** ⚠️ **DANGEROUS - Default true tanpa validation**

---

#### 4. **API Routes** - Tidak Pass autoApprove

**Mobile API:** `app/api/mobile/leaves/route.ts`
```typescript
// ❌ Tidak pass autoApprove parameter
const leave = await mobileLeaveService.createLeaveRequest({
  ...validated,
  userId: user.id,
  tenantId: user.tenantId,
});
```

**Admin API:** `app/api/admin/leaves/route.ts`
```typescript
// ❌ Tidak pass autoApprove parameter
const result = await leaveRouteService.createLeave({
  ...ctx.validated,
  session: ctx.session as never,
});
```

**Status:** ⚠️ **INCONSISTENT - Bergantung pada default value**

---

## 🚨 Problems Identified

### Problem 1: Ambiguous Default Behavior
```typescript
autoApprove: boolean = true  // ⚠️ Default true
```

**Issue:**
- Semua leave request default auto-approve
- Tidak ada business rules
- Tidak konsisten dengan UI (semua masuk PENDING di mobile)

**Impact:**
- Confusion: Kenapa ada parameter tapi tidak digunakan?
- Risk: Jika ada yang pass `true` tanpa validation, langsung approved

---

### Problem 2: Cron Job vs Manual Create Conflict

**Cron Job:**
```typescript
// Auto-approve TUKAR_LIBUR besok
await autoApproveTukarLibur();
```

**Manual Create:**
```typescript
// Buat TUKAR_LIBUR dengan autoApprove = true (default)
await leaveService.createLeave(data, userId, tenantId);
```

**Issue:**
- Dua mekanisme berbeda untuk auto-approve
- Cron job: Approve yang sudah PENDING
- Manual create: Langsung APPROVED saat create
- Tidak konsisten!

---

### Problem 3: No Audit Trail for Auto-Approve Decision

**Current:**
```typescript
approvedBy: context.autoApprove ? context.actorId : null,
```

**Issue:**
- Tidak ada field untuk track "kenapa auto-approved"
- Tidak ada field untuk track "rule mana yang trigger"
- Sulit untuk audit dan debug

---

## 💡 Proposed Solution

### Option 1: Keep Both (Auto-Approve + Auto-Reject)

**Approach:**
- Keep cron job untuk TUKAR_LIBUR
- Tambahkan Auto-Reject rules untuk validation
- Rename parameter `autoApprove` → `skipManualApproval`

**Flow:**
```
1. User submit leave request
2. Check Auto-Reject rules
   - If auto-reject → Return error 400
3. If pass validation:
   - Check Auto-Approve rules
     - If auto-approve → Create with status APPROVED
     - Else → Create with status PENDING
4. Cron job: Auto-approve TUKAR_LIBUR yang PENDING untuk besok
```

**Pros:**
- ✅ Backward compatible
- ✅ Flexible (bisa auto-approve dan auto-reject)
- ✅ Keep existing cron job

**Cons:**
- ⚠️ Lebih complex
- ⚠️ Dua mekanisme approval (immediate + cron)

---

### Option 2: Replace with Auto-Reject Only

**Approach:**
- Remove parameter `autoApprove` dari createLeave
- Semua leave request masuk PENDING
- Tambahkan Auto-Reject rules untuk validation
- Keep cron job untuk TUKAR_LIBUR

**Flow:**
```
1. User submit leave request
2. Check Auto-Reject rules
   - If auto-reject → Return error 400
3. If pass validation:
   - Create with status PENDING
4. Cron job: Auto-approve TUKAR_LIBUR yang PENDING untuk besok
5. Admin: Manual approve yang lain
```

**Pros:**
- ✅ Simpler
- ✅ Consistent (semua masuk PENDING kecuali cron)
- ✅ Clear separation: Validation vs Approval

**Cons:**
- ⚠️ Breaking change (remove parameter)
- ⚠️ Tidak ada immediate auto-approve

---

### Option 3: Clarify Auto-Approve with Business Rules

**Approach:**
- Keep parameter `autoApprove`
- Tambahkan Auto-Reject rules untuk validation
- Tambahkan Auto-Approve rules untuk business logic
- Rename parameter → `bypassManualApproval`

**Flow:**
```
1. User submit leave request
2. Check Auto-Reject rules
   - If auto-reject → Return error 400
3. If pass validation:
   - Check Auto-Approve rules
     - If eligible → bypassManualApproval = true
     - Else → bypassManualApproval = false
   - Create with appropriate status
4. Cron job: Auto-approve TUKAR_LIBUR yang PENDING untuk besok
```

**Pros:**
- ✅ Most flexible
- ✅ Clear business rules
- ✅ Backward compatible

**Cons:**
- ⚠️ Most complex
- ⚠️ Perlu maintain dua set rules

---

## 🎯 Recommended Approach: **Option 2 (Auto-Reject Only)**

### Rationale

1. **Simplicity**
   - Satu flow yang jelas: Validate → PENDING → Manual Approve
   - Cron job untuk special case (TUKAR_LIBUR)

2. **Safety**
   - Tidak ada immediate auto-approve yang bisa di-abuse
   - Admin tetap punya kontrol penuh

3. **Consistency**
   - Semua leave request masuk PENDING (kecuali cron)
   - UI sudah menunjukkan PENDING di mobile

4. **Maintainability**
   - Tidak perlu maintain dua set rules
   - Fokus ke validation (auto-reject)

---

## 📝 Implementation Plan

### Phase 1: Audit & Documentation (1 jam)

**1.1 Document Current Behavior**
- [x] Audit semua penggunaan `autoApprove`
- [x] Document cron job behavior
- [x] Identify breaking changes

**1.2 Create Migration Plan**
- [ ] List all files yang perlu diubah
- [ ] Identify test cases yang perlu diupdate
- [ ] Plan rollback strategy

---

### Phase 2: Cleanup autoApprove Parameter (2 jam)

**2.1 Remove Default Value**

```typescript
// BEFORE
async createLeave(
  data: CreateLeaveData,
  createdById: string,
  tenantId: string,
  autoApprove: boolean = true,  // ❌ Remove default
): Promise<LeaveResult>

// AFTER
async createLeave(
  data: CreateLeaveData,
  createdById: string,
  tenantId: string,
): Promise<LeaveResult> {
  // Always create as PENDING
  return this.lifecycleService.createLeave(
    data,
    createdById,
    tenantId,
    false,  // ✅ Explicit false
  );
}
```

**2.2 Update LeaveLifecycleService**

```typescript
// Keep parameter for internal use (cron job needs it)
async createLeave(
  data: CreateLeaveData,
  createdById: string,
  tenantId: string,
  bypassManualApproval: boolean = false,  // ✅ Rename + default false
): Promise<LeaveResult>
```

**2.3 Update Cron Job**

```typescript
// Cron job tetap bisa auto-approve
await leaveService.approveLeave(
  request.id,
  "SYSTEM_AUTO",
  request.tenantId,
);
```

**2.4 Update API Routes**

```typescript
// Mobile API - Explicit PENDING
const leave = await mobileLeaveService.createLeaveRequest({
  ...validated,
  userId: user.id,
  tenantId: user.tenantId,
  // No autoApprove parameter
});

// Admin API - Explicit PENDING
const result = await leaveRouteService.createLeave({
  ...ctx.validated,
  session: ctx.session as never,
  // No autoApprove parameter
});
```

---

### Phase 3: Add Auto-Reject Rules (4 jam)

**3.1 Create AutoRejectService**
- Implement 8 validation rules
- Return clear rejection messages

**3.2 Integrate with API**
- Check auto-reject before create
- Return error 400 with reason

**3.3 Add Settings UI**
- Toggle on/off per rule
- Configure thresholds

---

### Phase 4: Testing (2 jam)

**4.1 Unit Tests**
- Test auto-reject rules
- Test cron job still works
- Test manual approval flow

**4.2 Integration Tests**
- Test mobile leave creation
- Test admin leave creation
- Test cron job execution

**4.3 Manual Testing**
- Submit various leave types
- Verify rejection messages
- Verify cron job behavior

---

## 🧪 Test Cases

### Test 1: Cron Job Still Works
```typescript
it("should auto-approve TUKAR_LIBUR via cron", async () => {
  // Create TUKAR_LIBUR with PENDING status
  const leave = await createLeave({
    type: "TUKAR_LIBUR",
    startDate: tomorrow,
    replacementDate: nextWeek,
  });
  
  expect(leave.status).toBe("PENDING");
  
  // Run cron job
  await autoApproveTukarLibur();
  
  // Verify auto-approved
  const updated = await getLeave(leave.id);
  expect(updated.status).toBe("APPROVED");
  expect(updated.approvedBy).toBe("SYSTEM_AUTO");
});
```

### Test 2: Auto-Reject Works
```typescript
it("should auto-reject if quota insufficient", async () => {
  // Mock quota = 0
  const response = await POST(createLeaveRequest({
    type: "CUTI",
    leaveDays: 3,
  }));
  
  expect(response.status).toBe(400);
  expect(response.body.error).toContain("Quota tidak cukup");
});
```

### Test 3: Manual Approval Flow
```typescript
it("should create leave as PENDING if validation passes", async () => {
  const leave = await createLeave({
    type: "CUTI",
    startDate: nextWeek,
    leaveDays: 2,
  });
  
  expect(leave.status).toBe("PENDING");
  expect(leave.approvedBy).toBeNull();
});
```

---

## 📊 Impact Analysis

### Breaking Changes

1. **Parameter Removal**
   - `autoApprove` parameter removed from public API
   - Internal parameter renamed to `bypassManualApproval`

2. **Behavior Change**
   - Semua leave request masuk PENDING (kecuali cron)
   - Tidak ada immediate auto-approve

### Migration Path

**For External Callers:**
```typescript
// BEFORE
await leaveService.createLeave(data, userId, tenantId, true);

// AFTER
await leaveService.createLeave(data, userId, tenantId);
// Status will be PENDING, admin needs to approve
```

**For Internal Callers (Cron):**
```typescript
// BEFORE
await leaveService.createLeave(data, "SYSTEM_AUTO", tenantId, true);

// AFTER
const leave = await leaveService.createLeave(data, "SYSTEM_AUTO", tenantId);
await leaveService.approveLeave(leave.id, "SYSTEM_AUTO", tenantId);
```

---

## ✅ Checklist

### Pre-Implementation
- [x] Audit existing autoApprove usage
- [x] Document current behavior
- [x] Identify breaking changes
- [ ] Get stakeholder approval for approach

### Implementation
- [ ] Remove default value from autoApprove
- [ ] Rename parameter to bypassManualApproval
- [ ] Update all API routes
- [ ] Update cron job if needed
- [ ] Add auto-reject service
- [ ] Add settings UI

### Testing
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Manual testing
- [ ] Verify cron job still works

### Documentation
- [ ] Update API documentation
- [ ] Update user guide
- [ ] Add migration notes
- [ ] Update CLAUDE.md

---

## 🎯 Timeline

**Total Effort:** 1 hari (8 jam)

- **Phase 1:** Audit & Documentation - 1 jam ✅ (Done)
- **Phase 2:** Cleanup autoApprove - 2 jam
- **Phase 3:** Add Auto-Reject - 4 jam
- **Phase 4:** Testing - 1 jam

---

## 💬 Questions for Stakeholder

1. **Apakah OK untuk remove immediate auto-approve?**
   - Semua leave masuk PENDING kecuali TUKAR_LIBUR via cron
   - Admin harus manual approve

2. **Apakah cron job TUKAR_LIBUR masih diperlukan?**
   - Atau bisa diganti dengan auto-approve saat create?

3. **Apakah ada leave type lain yang perlu auto-approve?**
   - Selain TUKAR_LIBUR

4. **Apakah breaking change acceptable?**
   - Remove parameter autoApprove dari public API

---

## ✅ Recommendation

**PROCEED WITH OPTION 2: Auto-Reject Only**

**Next Steps:**
1. Get stakeholder approval untuk approach
2. Implement Phase 2 (Cleanup)
3. Implement Phase 3 (Auto-Reject)
4. Test thoroughly
5. Deploy dengan feature flag

**Risk Mitigation:**
- Feature flag untuk enable/disable auto-reject
- Rollback plan jika ada masalah
- Monitoring untuk track rejection rate

---

*Dokumentasi dibuat oleh: Claude Sonnet 4.6*  
*Tanggal: 2026-05-10*
