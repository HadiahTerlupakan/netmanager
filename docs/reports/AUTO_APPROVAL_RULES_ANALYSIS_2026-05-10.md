# Analisis ISU #7: Auto-Approval Rules untuk Leave Request

**Tanggal:** 2026-05-10  
**Status:** VALID - Perlu Implementasi  
**Prioritas:** MEDIUM  
**Estimasi Effort:** 1 hari (6-8 jam)

---

## 📋 Problem Statement

### Situasi Saat Ini
Semua leave request (izin, sakit, cuti) harus melalui manual approval oleh admin, meskipun ada parameter `autoApprove` di service layer yang tidak digunakan secara efektif.

### Masalah yang Timbul
1. **Admin Overload**: Admin harus approve setiap request, termasuk yang trivial
2. **Delay Response**: Karyawan harus menunggu admin online untuk approval
3. **Inconsistency**: Tidak ada aturan jelas kapan auto-approve vs manual
4. **Wasted Infrastructure**: Parameter `autoApprove` sudah ada tapi tidak ada business rules

### Impact
- **Admin Workload**: Tinggi - Admin approve puluhan request per hari
- **Employee Experience**: Buruk - Menunggu approval untuk hal sederhana
- **Business Efficiency**: Rendah - Proses approval lambat

---

## 🔍 Current Implementation Analysis

### 1. Service Layer - Infrastructure Sudah Ada

**File:** `modules/attendance/services/LeaveService.ts`

```typescript
async createLeave(
  data: CreateLeaveData,
  createdById: string,
  tenantId: string,
  autoApprove: boolean = true,  // ✅ Parameter ada
): Promise<LeaveResult> {
  return this.lifecycleService.createLeave(
    data,
    createdById,
    tenantId,
    autoApprove,  // ✅ Diteruskan ke lifecycle
  );
}
```

**File:** `modules/attendance/services/LeaveLifecycleService.ts`

```typescript
async createLeave(
  data: CreateLeaveData,
  createdById: string,
  tenantId: string,
  autoApprove: boolean = true,
): Promise<LeaveResult> {
  // ...
  const status = autoApprove ? "APPROVED" : "PENDING";  // ✅ Logic ada
  
  const leave = await this.leaveRepository.create({
    ...data,
    status,  // ✅ Status ditentukan oleh autoApprove
    approvedBy: autoApprove ? "SYSTEM_AUTO" : undefined,
  });
  // ...
}
```

### 2. API Layer - Tidak Ada Rules

**File:** `app/api/admin/leaves/route.ts`

```typescript
const result = await leaveRouteService.createLeave({
  ...ctx.validated,
  // ❌ autoApprove tidak di-pass
  // Default true tapi tidak ada business rules
});
```

**File:** `app/api/mobile/leaves/route.ts`

```typescript
const leave = await mobileLeaveService.createLeaveRequest({
  ...validated,
  userId: user.id,
  tenantId: user.tenantId,
  // ❌ Tidak ada parameter autoApprove
  // Semua jadi PENDING
});
```

### 3. Database - Support Sudah Ada

**Field `approvedBy`:**
- `null`: Belum di-approve
- `"SYSTEM_AUTO"`: Auto-approved by system
- `"user-id"`: Manual approved by admin

---

## 💡 Proposed Solution

### Business Rules untuk Auto-Approval

#### Rule 1: Izin Singkat (< 1 hari)
```typescript
if (leaveType === "IZIN" && leaveDays < 1) {
  autoApprove = true;
  reason = "Izin kurang dari 1 hari";
}
```

**Rationale:** Izin singkat (beberapa jam) tidak perlu approval manual.

#### Rule 2: Sakit dengan Bukti
```typescript
if (leaveType === "SAKIT" && hasAttachment && leaveDays <= 3) {
  autoApprove = true;
  reason = "Sakit dengan bukti dokumen";
}
```

**Rationale:** Sakit dengan surat dokter bisa langsung di-approve.

#### Rule 3: Cuti dengan Advance Notice
```typescript
const daysInAdvance = differenceInDays(startDate, new Date());
if (leaveType === "CUTI" && daysInAdvance >= 7 && leaveDays <= 3) {
  autoApprove = true;
  reason = "Cuti diajukan 7 hari sebelumnya";
}
```

**Rationale:** Cuti yang direncanakan jauh-jauh hari bisa auto-approve.

#### Rule 4: Tukar Libur
```typescript
if (leaveType === "TUKAR_LIBUR" && hasReplacementDate) {
  autoApprove = true;
  reason = "Tukar libur dengan tanggal pengganti";
}
```

**Rationale:** Tukar libur tidak mengurangi hari kerja, bisa auto-approve.

#### Rule 5: Quota Check
```typescript
const remainingQuota = await leaveBalanceRepo.getRemainingDays(...);
if (remainingQuota < leaveDays) {
  autoApprove = false;
  reason = "Quota tidak cukup, perlu approval manual";
}
```

**Rationale:** Jika quota tidak cukup, admin harus review manual.

---

## 🏗️ Implementation Plan

### Phase 1: Tenant Settings (2-3 jam)

**1.1 Database Schema**

```prisma
model TenantSettings {
  id        String   @id
  tenantId  String   @unique
  
  // Auto-approval rules
  autoApproveIzinUnder1Day      Boolean @default(true)
  autoApproveSakitWithDocument  Boolean @default(true)
  autoApproveCutiAdvance7Days   Boolean @default(false)
  autoApproveTukarLibur         Boolean @default(true)
  
  // Thresholds
  maxAutoApproveDays            Int     @default(3)
  minAdvanceNoticeDays          Int     @default(7)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
}
```

**1.2 Repository**

```typescript
// modules/settings/repositories/TenantSettingsRepository.ts
export class TenantSettingsRepository {
  async getAutoApprovalSettings(tenantId: string) {
    return prisma.tenantSettings.findUnique({
      where: { tenantId },
      select: {
        autoApproveIzinUnder1Day: true,
        autoApproveSakitWithDocument: true,
        autoApproveCutiAdvance7Days: true,
        autoApproveTukarLibur: true,
        maxAutoApproveDays: true,
        minAdvanceNoticeDays: true,
      },
    });
  }
  
  async updateAutoApprovalSettings(
    tenantId: string,
    settings: Partial<AutoApprovalSettings>
  ) {
    return prisma.tenantSettings.upsert({
      where: { tenantId },
      update: settings,
      create: { tenantId, ...settings },
    });
  }
}
```

### Phase 2: Auto-Approval Service (2-3 jam)

**2.1 Service Logic**

```typescript
// modules/attendance/services/AutoApprovalService.ts
export class AutoApprovalService {
  constructor(
    private readonly settingsRepo = new TenantSettingsRepository(),
    private readonly leaveBalanceRepo = new LeaveBalanceRepository(),
  ) {}
  
  async shouldAutoApprove(
    input: {
      userId: string;
      tenantId: string;
      leaveType: LeaveType;
      startDate: Date;
      endDate: Date;
      leaveDays: number;
      hasAttachment: boolean;
      replacementDate?: Date;
    }
  ): Promise<{ autoApprove: boolean; reason: string }> {
    const settings = await this.settingsRepo.getAutoApprovalSettings(
      input.tenantId
    );
    
    if (!settings) {
      return { autoApprove: false, reason: "No settings found" };
    }
    
    // Rule 1: Izin singkat
    if (
      input.leaveType === "IZIN" &&
      input.leaveDays < 1 &&
      settings.autoApproveIzinUnder1Day
    ) {
      return { autoApprove: true, reason: "Izin kurang dari 1 hari" };
    }
    
    // Rule 2: Sakit dengan bukti
    if (
      input.leaveType === "SAKIT" &&
      input.hasAttachment &&
      input.leaveDays <= settings.maxAutoApproveDays &&
      settings.autoApproveSakitWithDocument
    ) {
      return { autoApprove: true, reason: "Sakit dengan bukti dokumen" };
    }
    
    // Rule 3: Cuti dengan advance notice
    const daysInAdvance = differenceInDays(input.startDate, new Date());
    if (
      input.leaveType === "CUTI" &&
      daysInAdvance >= settings.minAdvanceNoticeDays &&
      input.leaveDays <= settings.maxAutoApproveDays &&
      settings.autoApproveCutiAdvance7Days
    ) {
      return {
        autoApprove: true,
        reason: `Cuti diajukan ${daysInAdvance} hari sebelumnya`,
      };
    }
    
    // Rule 4: Tukar libur
    if (
      input.leaveType === "TUKAR_LIBUR" &&
      input.replacementDate &&
      settings.autoApproveTukarLibur
    ) {
      return {
        autoApprove: true,
        reason: "Tukar libur dengan tanggal pengganti",
      };
    }
    
    // Rule 5: Check quota
    const remainingQuota = await this.leaveBalanceRepo.getRemainingDays(
      input.userId,
      new Date().getFullYear(),
      input.leaveType,
      input.tenantId,
    );
    
    if (remainingQuota < input.leaveDays) {
      return {
        autoApprove: false,
        reason: "Quota tidak cukup, perlu approval manual",
      };
    }
    
    // Default: Manual approval
    return {
      autoApprove: false,
      reason: "Tidak memenuhi kriteria auto-approval",
    };
  }
}
```

### Phase 3: Integration (1-2 jam)

**3.1 Mobile Leave API**

```typescript
// app/api/mobile/leaves/route.ts
import { AutoApprovalService } from "@/modules/attendance";

const autoApprovalService = new AutoApprovalService();

export const POST = createHandler(
  { auth: true, schema: createLeaveSchema },
  async (req, ctx) => {
    // ... validation ...
    
    // Check auto-approval
    const { autoApprove, reason } = await autoApprovalService.shouldAutoApprove({
      userId: user.id,
      tenantId: user.tenantId,
      leaveType: validated.type,
      startDate: new Date(validated.startDate),
      endDate: new Date(validated.endDate),
      leaveDays: workingDays,
      hasAttachment: !!validated.photos?.length,
      replacementDate: validated.replacementDate
        ? new Date(validated.replacementDate)
        : undefined,
    });
    
    const leave = await mobileLeaveService.createLeaveRequest({
      ...validated,
      userId: user.id,
      tenantId: user.tenantId,
      autoApprove,  // ✅ Pass auto-approve decision
    });
    
    // Log auto-approval reason
    if (autoApprove) {
      await logger.logActivity({
        type: "LEAVE_AUTO_APPROVED",
        message: `Leave auto-approved: ${reason}`,
        userId: user.id,
        tenantId: user.tenantId,
      });
    }
    
    return apiSuccess(leave, {
      status: 201,
      message: autoApprove
        ? `Izin otomatis disetujui: ${reason}`
        : "Izin berhasil diajukan, menunggu approval",
    });
  }
);
```

**3.2 Admin Leave API**

```typescript
// app/api/admin/leaves/route.ts
export const POST = createHandler(
  { auth: true, schema: createLeaveSchema },
  async (_req, ctx) => {
    // ... permission check ...
    
    // Admin-created leaves: check auto-approval
    const { autoApprove, reason } = await autoApprovalService.shouldAutoApprove({
      userId: ctx.validated.userId,
      tenantId: ctx.session!.user.tenantId,
      leaveType: ctx.validated.type,
      startDate: new Date(ctx.validated.startDate),
      endDate: new Date(ctx.validated.endDate),
      leaveDays: calculateWorkingDays(...),
      hasAttachment: !!ctx.validated.attachmentUrl,
      replacementDate: ctx.validated.replacementDate
        ? new Date(ctx.validated.replacementDate)
        : undefined,
    });
    
    const result = await leaveRouteService.createLeave({
      ...ctx.validated,
      autoApprove,  // ✅ Pass auto-approve decision
      session: ctx.session as never,
    });
    
    return apiSuccess(result.data, {
      status: 201,
      message: autoApprove
        ? `Izin otomatis disetujui: ${reason}`
        : "Izin berhasil dibuat",
    });
  }
);
```

### Phase 4: Admin UI (1-2 jam)

**4.1 Settings Page**

```typescript
// app/admin/settings/auto-approval/page.tsx
export default function AutoApprovalSettingsPage() {
  const [settings, setSettings] = useState<AutoApprovalSettings | null>(null);
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Pengaturan Auto-Approval Izin
      </h1>
      
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Izin Kurang dari 1 Hari</h3>
            <p className="text-sm text-gray-500">
              Otomatis approve izin yang kurang dari 1 hari kerja
            </p>
          </div>
          <Switch
            checked={settings?.autoApproveIzinUnder1Day}
            onChange={(checked) => updateSetting("autoApproveIzinUnder1Day", checked)}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Sakit dengan Dokumen</h3>
            <p className="text-sm text-gray-500">
              Otomatis approve sakit yang melampirkan surat dokter
            </p>
          </div>
          <Switch
            checked={settings?.autoApproveSakitWithDocument}
            onChange={(checked) => updateSetting("autoApproveSakitWithDocument", checked)}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Cuti dengan Advance Notice</h3>
            <p className="text-sm text-gray-500">
              Otomatis approve cuti yang diajukan jauh-jauh hari
            </p>
          </div>
          <Switch
            checked={settings?.autoApproveCutiAdvance7Days}
            onChange={(checked) => updateSetting("autoApproveCutiAdvance7Days", checked)}
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Tukar Libur</h3>
            <p className="text-sm text-gray-500">
              Otomatis approve tukar libur dengan tanggal pengganti
            </p>
          </div>
          <Switch
            checked={settings?.autoApproveTukarLibur}
            onChange={(checked) => updateSetting("autoApproveTukarLibur", checked)}
          />
        </div>
        
        <div className="border-t pt-6">
          <h3 className="font-semibold mb-4">Threshold Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Maksimal Hari untuk Auto-Approve
              </label>
              <input
                type="number"
                min="1"
                max="7"
                value={settings?.maxAutoApproveDays}
                onChange={(e) => updateSetting("maxAutoApproveDays", parseInt(e.target.value))}
                className="w-32 px-3 py-2 border rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave request lebih dari ini harus manual approval
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Minimal Advance Notice (hari)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings?.minAdvanceNoticeDays}
                onChange={(e) => updateSetting("minAdvanceNoticeDays", parseInt(e.target.value))}
                className="w-32 px-3 py-2 border rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Cuti harus diajukan minimal sekian hari sebelumnya
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**4.2 Leave List - Show Auto-Approval Indicator**

```typescript
// app/admin/kehadiran/izin/IzinClient.tsx
// Tambahkan badge untuk auto-approved leaves
{selectedRequest.status === "APPROVED" && selectedRequest.approvedBy && (
  <span
    className={`text-xs px-2 py-1 rounded-full border ${
      selectedRequest.approvedBy === "SYSTEM_AUTO"
        ? "bg-purple-50 text-purple-700 border-purple-100"
        : "bg-blue-50 text-blue-700 border-blue-100"
    }`}
  >
    {selectedRequest.approvedBy === "SYSTEM_AUTO"
      ? "🤖 Auto System"
      : "👤 Admin"}
  </span>
)}
```

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
// tests/modules/attendance/services/AutoApprovalService.test.ts
describe("AutoApprovalService", () => {
  it("should auto-approve izin under 1 day", async () => {
    const result = await service.shouldAutoApprove({
      leaveType: "IZIN",
      leaveDays: 0.5,
      // ...
    });
    
    expect(result.autoApprove).toBe(true);
    expect(result.reason).toContain("kurang dari 1 hari");
  });
  
  it("should auto-approve sakit with document", async () => {
    const result = await service.shouldAutoApprove({
      leaveType: "SAKIT",
      leaveDays: 2,
      hasAttachment: true,
      // ...
    });
    
    expect(result.autoApprove).toBe(true);
    expect(result.reason).toContain("bukti dokumen");
  });
  
  it("should NOT auto-approve if quota insufficient", async () => {
    // Mock remaining quota = 0
    const result = await service.shouldAutoApprove({
      leaveType: "CUTI",
      leaveDays: 3,
      // ...
    });
    
    expect(result.autoApprove).toBe(false);
    expect(result.reason).toContain("Quota tidak cukup");
  });
});
```

### Integration Tests

```typescript
// tests/api/mobile-leaves-auto-approval.test.ts
describe("Mobile Leave Auto-Approval", () => {
  it("should auto-approve izin under 1 day", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/mobile/leaves", {
        method: "POST",
        body: JSON.stringify({
          type: "IZIN",
          startDate: "2026-05-10T09:00:00",
          endDate: "2026-05-10T12:00:00",
          reason: "Keperluan keluarga",
        }),
      })
    );
    
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.data.status).toBe("APPROVED");
    expect(data.data.approvedBy).toBe("SYSTEM_AUTO");
  });
});
```

---

## 📊 Impact Analysis

### Benefits

1. **Reduced Admin Workload**
   - Estimasi: 30-50% reduction dalam approval tasks
   - Admin fokus ke cases yang perlu review manual

2. **Faster Response Time**
   - Auto-approval: Instant (< 1 detik)
   - Manual approval: Bisa 1-24 jam
   - Employee satisfaction meningkat

3. **Consistency**
   - Rules jelas dan transparan
   - Tidak ada bias atau favoritism
   - Audit trail lengkap

4. **Flexibility**
   - Tenant bisa customize rules sesuai policy
   - Easy to enable/disable per rule
   - Threshold adjustable

### Risks & Mitigation

1. **Risk: Abuse of Auto-Approval**
   - **Mitigation:** Quota check tetap enforce
   - **Mitigation:** Audit log untuk review
   - **Mitigation:** Admin bisa disable rules kapan saja

2. **Risk: False Positive Auto-Approval**
   - **Mitigation:** Conservative thresholds (max 3 hari)
   - **Mitigation:** Admin bisa revoke approval
   - **Mitigation:** Notification ke admin untuk awareness

3. **Risk: Complex Rules Hard to Maintain**
   - **Mitigation:** Start simple, iterate based on feedback
   - **Mitigation:** Clear documentation
   - **Mitigation:** UI untuk manage rules

---

## 📝 Implementation Checklist

### Phase 1: Database & Repository (2-3 jam)
- [ ] Add TenantSettings model to schema
- [ ] Run migration
- [ ] Create TenantSettingsRepository
- [ ] Write unit tests for repository

### Phase 2: Service Layer (2-3 jam)
- [ ] Create AutoApprovalService
- [ ] Implement business rules
- [ ] Write unit tests (11 test cases)
- [ ] Integration with LeaveService

### Phase 3: API Integration (1-2 jam)
- [ ] Update mobile leaves API
- [ ] Update admin leaves API
- [ ] Add activity logging
- [ ] Test API endpoints

### Phase 4: Admin UI (1-2 jam)
- [ ] Create settings page
- [ ] Add toggle switches
- [ ] Add threshold inputs
- [ ] Add auto-approval indicator in leave list

### Phase 5: Testing & Documentation (1 jam)
- [ ] Run full test suite
- [ ] Manual testing scenarios
- [ ] Update documentation
- [ ] Create user guide

---

## 🎯 Success Metrics

### Quantitative
- **Auto-Approval Rate:** Target 40-60% of all leave requests
- **Admin Approval Time:** Reduce by 50%
- **Employee Satisfaction:** Survey score > 4.0/5.0

### Qualitative
- Admin feedback: "Lebih fokus ke cases yang penting"
- Employee feedback: "Lebih cepat dapat approval"
- System reliability: No false approvals reported

---

## 🔮 Future Enhancements

1. **Machine Learning Rules**
   - Learn from historical approval patterns
   - Suggest new rules based on data

2. **Department-Specific Rules**
   - Different rules per department
   - Custom thresholds per site

3. **Time-Based Rules**
   - Auto-approve during low-season
   - Stricter during peak season

4. **Approval Workflow**
   - Multi-level approval for long leaves
   - Escalation if no response in 24h

---

## 💰 Cost-Benefit Analysis

### Development Cost
- **Time:** 1 hari (6-8 jam)
- **Complexity:** Medium
- **Risk:** Low (infrastructure sudah ada)

### Benefit
- **Admin Time Saved:** 2-3 jam/hari
- **Employee Satisfaction:** High
- **Process Efficiency:** 50% faster

### ROI
- **Break-even:** < 1 minggu
- **Long-term Value:** High

---

## ✅ Recommendation

**PROCEED WITH IMPLEMENTATION**

ISU #7 adalah **medium-priority feature** dengan **high ROI**:

**Pros:**
- ✅ Infrastructure sudah ada (parameter autoApprove)
- ✅ Clear business rules
- ✅ High impact on admin workload
- ✅ Reasonable effort (1 hari)
- ✅ Low risk (bisa disable kapan saja)

**Cons:**
- ⚠️ Perlu careful testing untuk avoid false positives
- ⚠️ Perlu clear communication ke users tentang rules

**Next Steps:**
1. Review business rules dengan stakeholder
2. Confirm thresholds (max days, advance notice)
3. Start implementation Phase 1
4. Iterate based on feedback

---

*Dokumentasi dibuat oleh: Claude Sonnet 4.6*  
*Tanggal: 2026-05-10*
