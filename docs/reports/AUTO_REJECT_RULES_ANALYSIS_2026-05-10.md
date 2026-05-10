# Revisi ISU #7: Auto-Reject Rules untuk Leave Request

**Tanggal:** 2026-05-10  
**Status:** VALID - Pendekatan Direvisi  
**Prioritas:** MEDIUM  
**Estimasi Effort:** 1 hari (6-8 jam)

---

## 🔄 Perubahan Konsep

### Konsep Awal (Auto-Approve)
- Request yang memenuhi kriteria → Auto-approve
- Request yang tidak memenuhi → Manual approval
- **Masalah:** Admin tetap harus review banyak request

### Konsep Baru (Auto-Reject)
- Request yang **TIDAK** memenuhi kriteria → Auto-reject dengan alasan jelas
- Request yang memenuhi kriteria → Masuk antrian manual approval
- **Keuntungan:** Admin hanya review request yang valid

---

## 📋 Problem Statement (Revised)

### Situasi Saat Ini
- Semua leave request masuk ke admin untuk approval
- Banyak request yang invalid (quota habis, format salah, dll)
- Admin buang waktu untuk reject request yang jelas-jelas invalid

### Dengan Auto-Reject
- System otomatis reject request yang invalid
- Admin hanya review request yang valid dan layak di-approve
- Employee langsung tahu alasan rejection tanpa menunggu

---

## 💡 Auto-Reject Rules

### Rule 1: Quota Tidak Cukup
```typescript
const remainingQuota = await leaveBalanceRepo.getRemainingDays(
  userId,
  year,
  leaveType,
  tenantId,
);

if (remainingQuota < leaveDays) {
  return {
    autoReject: true,
    reason: `Quota ${leaveType} tidak cukup. Sisa: ${remainingQuota} hari, diminta: ${leaveDays} hari`,
  };
}
```

**Rationale:** Jika quota tidak cukup, pasti akan ditolak. Tidak perlu admin review.

### Rule 2: Tanggal Sudah Lewat (Backdate)
```typescript
const today = startOfDay(new Date());
if (isBefore(startDate, today)) {
  return {
    autoReject: true,
    reason: "Tidak bisa mengajukan izin untuk tanggal yang sudah lewat",
  };
}
```

**Rationale:** Backdate leave tidak diperbolehkan (kecuali admin yang input manual).

### Rule 3: Overlap dengan Leave Lain
```typescript
const existingLeave = await leaveRepo.findActiveLeaveForUserOnDate(
  userId,
  startDate,
  endDate,
  tenantId,
);

if (existingLeave && existingLeave.status === "APPROVED") {
  return {
    autoReject: true,
    reason: `Anda sudah memiliki ${existingLeave.type} yang disetujui pada tanggal ini`,
  };
}
```

**Rationale:** Tidak bisa double-booking leave di tanggal yang sama.

### Rule 4: Durasi Terlalu Panjang
```typescript
const maxDaysPerRequest = settings.maxDaysPerRequest || 14;

if (leaveDays > maxDaysPerRequest) {
  return {
    autoReject: true,
    reason: `Durasi izin maksimal ${maxDaysPerRequest} hari per pengajuan. Silakan pecah menjadi beberapa pengajuan.`,
  };
}
```

**Rationale:** Leave terlalu panjang perlu approval khusus atau dipecah.

### Rule 5: Sakit Tanpa Bukti (> 2 hari)
```typescript
if (
  leaveType === "SAKIT" &&
  leaveDays > 2 &&
  !hasAttachment
) {
  return {
    autoReject: true,
    reason: "Sakit lebih dari 2 hari wajib melampirkan surat dokter",
  };
}
```

**Rationale:** Policy perusahaan: sakit > 2 hari harus ada surat dokter.

### Rule 6: Cuti Tanpa Advance Notice
```typescript
const daysInAdvance = differenceInDays(startDate, new Date());
const minAdvanceNotice = settings.minAdvanceNoticeDays || 3;

if (
  leaveType === "CUTI" &&
  daysInAdvance < minAdvanceNotice
) {
  return {
    autoReject: true,
    reason: `Cuti harus diajukan minimal ${minAdvanceNotice} hari sebelumnya. Anda mengajukan ${daysInAdvance} hari sebelumnya.`,
  };
}
```

**Rationale:** Cuti mendadak mengganggu planning. Harus diajukan jauh-jauh hari.

### Rule 7: Tukar Libur Tanpa Tanggal Pengganti
```typescript
if (leaveType === "TUKAR_LIBUR" && !replacementDate) {
  return {
    autoReject: true,
    reason: "Tukar libur harus menyertakan tanggal pengganti",
  };
}
```

**Rationale:** Tukar libur harus ada tanggal pengganti yang jelas.

### Rule 8: Blackout Period
```typescript
const isBlackoutPeriod = await checkBlackoutPeriod(
  startDate,
  endDate,
  tenantId,
);

if (isBlackoutPeriod) {
  return {
    autoReject: true,
    reason: "Tidak bisa mengajukan cuti pada periode sibuk (blackout period)",
  };
}
```

**Rationale:** Ada periode tertentu (akhir tahun, peak season) yang tidak boleh cuti.

---

## 🏗️ Implementation Plan (Revised)

### Phase 1: Tenant Settings (2-3 jam)

**Database Schema:**

```prisma
model TenantSettings {
  id        String   @id
  tenantId  String   @unique
  
  // Auto-reject rules (enable/disable)
  autoRejectInsufficientQuota   Boolean @default(true)
  autoRejectBackdate            Boolean @default(true)
  autoRejectOverlap             Boolean @default(true)
  autoRejectTooLong             Boolean @default(true)
  autoRejectSakitNoDocument     Boolean @default(true)
  autoRejectCutiNoAdvance       Boolean @default(true)
  autoRejectTukarLiburNoDate    Boolean @default(true)
  autoRejectBlackoutPeriod      Boolean @default(true)
  
  // Thresholds
  maxDaysPerRequest             Int     @default(14)
  minAdvanceNoticeDays          Int     @default(3)
  sakitDocumentRequiredDays     Int     @default(2)
  
  // Blackout periods (JSON array)
  blackoutPeriods               Json    @default("[]")
  // Format: [{ start: "2026-12-20", end: "2026-12-31", reason: "Akhir tahun" }]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
}
```

### Phase 2: Auto-Reject Service (2-3 jam)

```typescript
// modules/attendance/services/AutoRejectService.ts
export class AutoRejectService {
  constructor(
    private readonly settingsRepo = new TenantSettingsRepository(),
    private readonly leaveBalanceRepo = new LeaveBalanceRepository(),
    private readonly leaveRepo = new LeaveRepository(),
  ) {}
  
  async shouldAutoReject(
    input: {
      userId: string;
      tenantId: string;
      leaveType: LeaveType;
      startDate: Date;
      endDate: Date;
      leaveDays: number;
      hasAttachment: boolean;
      replacementDate?: Date;
      isAdminCreated?: boolean; // Admin bypass some rules
    }
  ): Promise<{ autoReject: boolean; reason: string }> {
    const settings = await this.settingsRepo.getAutoRejectSettings(
      input.tenantId
    );
    
    if (!settings) {
      return { autoReject: false, reason: "" };
    }
    
    // Admin-created leaves bypass some rules
    if (input.isAdminCreated) {
      // Admin bisa backdate, tapi tetap check quota & overlap
      const quotaCheck = await this.checkQuota(input, settings);
      if (quotaCheck.autoReject) return quotaCheck;
      
      const overlapCheck = await this.checkOverlap(input, settings);
      if (overlapCheck.autoReject) return overlapCheck;
      
      return { autoReject: false, reason: "" };
    }
    
    // Rule 1: Quota check
    if (settings.autoRejectInsufficientQuota) {
      const quotaCheck = await this.checkQuota(input, settings);
      if (quotaCheck.autoReject) return quotaCheck;
    }
    
    // Rule 2: Backdate check
    if (settings.autoRejectBackdate) {
      const backdateCheck = this.checkBackdate(input);
      if (backdateCheck.autoReject) return backdateCheck;
    }
    
    // Rule 3: Overlap check
    if (settings.autoRejectOverlap) {
      const overlapCheck = await this.checkOverlap(input, settings);
      if (overlapCheck.autoReject) return overlapCheck;
    }
    
    // Rule 4: Duration check
    if (settings.autoRejectTooLong) {
      const durationCheck = this.checkDuration(input, settings);
      if (durationCheck.autoReject) return durationCheck;
    }
    
    // Rule 5: Sakit without document
    if (settings.autoRejectSakitNoDocument) {
      const sakitCheck = this.checkSakitDocument(input, settings);
      if (sakitCheck.autoReject) return sakitCheck;
    }
    
    // Rule 6: Cuti without advance notice
    if (settings.autoRejectCutiNoAdvance) {
      const advanceCheck = this.checkAdvanceNotice(input, settings);
      if (advanceCheck.autoReject) return advanceCheck;
    }
    
    // Rule 7: Tukar libur without replacement date
    if (settings.autoRejectTukarLiburNoDate) {
      const tukarLiburCheck = this.checkTukarLibur(input);
      if (tukarLiburCheck.autoReject) return tukarLiburCheck;
    }
    
    // Rule 8: Blackout period
    if (settings.autoRejectBlackoutPeriod) {
      const blackoutCheck = await this.checkBlackoutPeriod(input, settings);
      if (blackoutCheck.autoReject) return blackoutCheck;
    }
    
    // All checks passed - eligible for manual approval
    return { autoReject: false, reason: "" };
  }
  
  private async checkQuota(
    input: AutoRejectInput,
    settings: AutoRejectSettings,
  ): Promise<AutoRejectResult> {
    const remainingQuota = await this.leaveBalanceRepo.getRemainingDays(
      input.userId,
      new Date().getFullYear(),
      input.leaveType,
      input.tenantId,
    );
    
    if (remainingQuota < input.leaveDays) {
      return {
        autoReject: true,
        reason: `Quota ${input.leaveType} tidak cukup. Sisa: ${remainingQuota} hari, diminta: ${input.leaveDays} hari`,
      };
    }
    
    return { autoReject: false, reason: "" };
  }
  
  private checkBackdate(input: AutoRejectInput): AutoRejectResult {
    const today = startOfDay(new Date());
    if (isBefore(input.startDate, today)) {
      return {
        autoReject: true,
        reason: "Tidak bisa mengajukan izin untuk tanggal yang sudah lewat",
      };
    }
    return { autoReject: false, reason: "" };
  }
  
  private async checkOverlap(
    input: AutoRejectInput,
    settings: AutoRejectSettings,
  ): Promise<AutoRejectResult> {
    const existingLeave = await this.leaveRepo.findActiveLeaveForUserOnDate(
      input.userId,
      input.startDate,
      input.endDate,
      input.tenantId,
    );
    
    if (existingLeave && existingLeave.status === "APPROVED") {
      return {
        autoReject: true,
        reason: `Anda sudah memiliki ${existingLeave.type} yang disetujui pada tanggal ini`,
      };
    }
    
    return { autoReject: false, reason: "" };
  }
  
  private checkDuration(
    input: AutoRejectInput,
    settings: AutoRejectSettings,
  ): AutoRejectResult {
    const maxDays = settings.maxDaysPerRequest || 14;
    
    if (input.leaveDays > maxDays) {
      return {
        autoReject: true,
        reason: `Durasi izin maksimal ${maxDays} hari per pengajuan. Silakan pecah menjadi beberapa pengajuan.`,
      };
    }
    
    return { autoReject: false, reason: "" };
  }
  
  private checkSakitDocument(
    input: AutoRejectInput,
    settings: AutoRejectSettings,
  ): AutoRejectResult {
    const requiredDays = settings.sakitDocumentRequiredDays || 2;
    
    if (
      input.leaveType === "SAKIT" &&
      input.leaveDays > requiredDays &&
      !input.hasAttachment
    ) {
      return {
        autoReject: true,
        reason: `Sakit lebih dari ${requiredDays} hari wajib melampirkan surat dokter`,
      };
    }
    
    return { autoReject: false, reason: "" };
  }
  
  private checkAdvanceNotice(
    input: AutoRejectInput,
    settings: AutoRejectSettings,
  ): AutoRejectResult {
    const minDays = settings.minAdvanceNoticeDays || 3;
    const daysInAdvance = differenceInDays(input.startDate, new Date());
    
    if (input.leaveType === "CUTI" && daysInAdvance < minDays) {
      return {
        autoReject: true,
        reason: `Cuti harus diajukan minimal ${minDays} hari sebelumnya. Anda mengajukan ${daysInAdvance} hari sebelumnya.`,
      };
    }
    
    return { autoReject: false, reason: "" };
  }
  
  private checkTukarLibur(input: AutoRejectInput): AutoRejectResult {
    if (input.leaveType === "TUKAR_LIBUR" && !input.replacementDate) {
      return {
        autoReject: true,
        reason: "Tukar libur harus menyertakan tanggal pengganti",
      };
    }
    
    return { autoReject: false, reason: "" };
  }
  
  private async checkBlackoutPeriod(
    input: AutoRejectInput,
    settings: AutoRejectSettings,
  ): Promise<AutoRejectResult> {
    const blackoutPeriods = settings.blackoutPeriods as Array<{
      start: string;
      end: string;
      reason: string;
    }>;
    
    for (const period of blackoutPeriods) {
      const periodStart = new Date(period.start);
      const periodEnd = new Date(period.end);
      
      // Check if leave overlaps with blackout period
      if (
        (input.startDate >= periodStart && input.startDate <= periodEnd) ||
        (input.endDate >= periodStart && input.endDate <= periodEnd) ||
        (input.startDate <= periodStart && input.endDate >= periodEnd)
      ) {
        return {
          autoReject: true,
          reason: `Tidak bisa mengajukan cuti pada periode ${format(periodStart, "dd MMM")} - ${format(periodEnd, "dd MMM yyyy")}: ${period.reason}`,
        };
      }
    }
    
    return { autoReject: false, reason: "" };
  }
}
```

### Phase 3: API Integration (1-2 jam)

```typescript
// app/api/mobile/leaves/route.ts
import { AutoRejectService } from "@/modules/attendance";

const autoRejectService = new AutoRejectService();

export const POST = createHandler(
  { auth: true, schema: createLeaveSchema },
  async (req, ctx) => {
    // ... validation ...
    
    // Check auto-reject
    const { autoReject, reason } = await autoRejectService.shouldAutoReject({
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
      isAdminCreated: false,
    });
    
    // If auto-reject, return error immediately
    if (autoReject) {
      return apiError(
        reason,
        ErrorCodes.VALIDATION_ERROR,
        { status: 400 }
      );
    }
    
    // Create leave with PENDING status (menunggu approval manual)
    const leave = await mobileLeaveService.createLeaveRequest({
      ...validated,
      userId: user.id,
      tenantId: user.tenantId,
    });
    
    return apiSuccess(leave, {
      status: 201,
      message: "Izin berhasil diajukan, menunggu approval admin",
    });
  }
);
```

### Phase 4: Admin UI (1-2 jam)

**Settings Page:**

```typescript
// app/admin/settings/auto-reject/page.tsx
export default function AutoRejectSettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        Pengaturan Auto-Reject Izin
      </h1>
      
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Catatan:</strong> Request yang di-reject otomatis akan langsung ditolak tanpa perlu approval admin. 
            Karyawan akan menerima notifikasi dengan alasan rejection yang jelas.
          </p>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Quota Tidak Cukup</h3>
            <p className="text-sm text-gray-500">
              Otomatis reject jika sisa quota tidak mencukupi
            </p>
          </div>
          <Switch checked={settings?.autoRejectInsufficientQuota} />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Tanggal Sudah Lewat (Backdate)</h3>
            <p className="text-sm text-gray-500">
              Otomatis reject izin untuk tanggal yang sudah lewat
            </p>
          </div>
          <Switch checked={settings?.autoRejectBackdate} />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Overlap dengan Leave Lain</h3>
            <p className="text-sm text-gray-500">
              Otomatis reject jika sudah ada leave approved di tanggal yang sama
            </p>
          </div>
          <Switch checked={settings?.autoRejectOverlap} />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Durasi Terlalu Panjang</h3>
            <p className="text-sm text-gray-500">
              Otomatis reject jika durasi melebihi batas maksimal
            </p>
          </div>
          <Switch checked={settings?.autoRejectTooLong} />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Sakit Tanpa Surat Dokter</h3>
            <p className="text-sm text-gray-500">
              Otomatis reject sakit > 2 hari tanpa lampiran dokter
            </p>
          </div>
          <Switch checked={settings?.autoRejectSakitNoDocument} />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Cuti Tanpa Advance Notice</h3>
            <p className="text-sm text-gray-500">
              Otomatis reject cuti yang diajukan terlalu mendadak
            </p>
          </div>
          <Switch checked={settings?.autoRejectCutiNoAdvance} />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Tukar Libur Tanpa Tanggal Pengganti</h3>
            <p className="text-sm text-gray-500">
              Otomatis reject tukar libur yang tidak menyertakan tanggal pengganti
            </p>
          </div>
          <Switch checked={settings?.autoRejectTukarLiburNoDate} />
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Blackout Period</h3>
            <p className="text-sm text-gray-500">
              Otomatis reject cuti pada periode sibuk yang ditentukan
            </p>
          </div>
          <Switch checked={settings?.autoRejectBlackoutPeriod} />
        </div>
        
        <div className="border-t pt-6">
          <h3 className="font-semibold mb-4">Threshold Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Maksimal Hari per Pengajuan
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings?.maxDaysPerRequest}
                className="w-32 px-3 py-2 border rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave request lebih dari ini akan di-reject
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Minimal Advance Notice untuk Cuti (hari)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={settings?.minAdvanceNoticeDays}
                className="w-32 px-3 py-2 border rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Cuti harus diajukan minimal sekian hari sebelumnya
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">
                Sakit Wajib Surat Dokter (hari)
              </label>
              <input
                type="number"
                min="1"
                max="7"
                value={settings?.sakitDocumentRequiredDays}
                className="w-32 px-3 py-2 border rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Sakit lebih dari ini harus melampirkan surat dokter
              </p>
            </div>
          </div>
        </div>
        
        <div className="border-t pt-6">
          <h3 className="font-semibold mb-4">Blackout Periods</h3>
          <p className="text-sm text-gray-500 mb-4">
            Tentukan periode dimana karyawan tidak bisa mengajukan cuti
          </p>
          
          <BlackoutPeriodManager
            periods={settings?.blackoutPeriods}
            onUpdate={handleUpdateBlackoutPeriods}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## 📊 Comparison: Auto-Approve vs Auto-Reject

| Aspek | Auto-Approve | Auto-Reject |
|-------|--------------|-------------|
| **Admin Workload** | Masih harus review yang tidak auto-approve | Hanya review yang valid |
| **Employee Experience** | Instant approval untuk eligible | Instant rejection dengan alasan jelas |
| **Risk** | False positive approval | False positive rejection (lebih aman) |
| **Transparency** | Kurang jelas kenapa tidak auto-approve | Sangat jelas kenapa di-reject |
| **Flexibility** | Admin bisa override rejection | Admin bisa approve yang di-reject |
| **Audit Trail** | Perlu track auto-approved | Perlu track auto-rejected |

**Kesimpulan:** Auto-Reject lebih aman dan transparan.

---

## 🎯 Benefits of Auto-Reject Approach

1. **Reduced Admin Workload**
   - Admin hanya review request yang valid
   - Tidak buang waktu untuk reject yang jelas invalid

2. **Instant Feedback**
   - Employee langsung tahu kenapa di-reject
   - Bisa perbaiki dan submit ulang dengan benar

3. **Clear Rules**
   - Transparansi penuh tentang policy
   - Tidak ada "kenapa saya ditolak?"

4. **Safer**
   - False rejection lebih aman dari false approval
   - Admin bisa manual approve jika perlu exception

5. **Better Data Quality**
   - Request yang masuk ke admin sudah ter-filter
   - Mengurangi noise dan invalid requests

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
describe("AutoRejectService", () => {
  it("should auto-reject if quota insufficient", async () => {
    // Mock remaining quota = 0
    const result = await service.shouldAutoReject({
      leaveType: "CUTI",
      leaveDays: 3,
      // ...
    });
    
    expect(result.autoReject).toBe(true);
    expect(result.reason).toContain("Quota");
  });
  
  it("should auto-reject backdate leave", async () => {
    const result = await service.shouldAutoReject({
      startDate: subDays(new Date(), 1), // Yesterday
      // ...
    });
    
    expect(result.autoReject).toBe(true);
    expect(result.reason).toContain("sudah lewat");
  });
  
  it("should NOT auto-reject valid leave", async () => {
    const result = await service.shouldAutoReject({
      leaveType: "CUTI",
      leaveDays: 2,
      startDate: addDays(new Date(), 7),
      hasAttachment: false,
      // All checks pass
    });
    
    expect(result.autoReject).toBe(false);
  });
});
```

---

## ✅ Recommendation (Revised)

**PROCEED WITH AUTO-REJECT APPROACH**

**Keuntungan dibanding Auto-Approve:**
- ✅ Lebih aman (false rejection < false approval)
- ✅ Lebih transparan (alasan rejection jelas)
- ✅ Admin workload lebih rendah (hanya review valid requests)
- ✅ Better employee experience (instant feedback)
- ✅ Easier to implement (validation rules sudah familiar)

**Implementation Priority:**
1. **HIGH:** Quota check, Overlap check, Backdate check
2. **MEDIUM:** Duration check, Sakit document check
3. **LOW:** Advance notice check, Blackout period

**Next Steps:**
1. Confirm business rules dengan stakeholder
2. Implement Phase 1 (Database & Settings)
3. Implement Phase 2 (Auto-Reject Service)
4. Test thoroughly dengan edge cases
5. Deploy dengan feature flag (bisa disable jika ada masalah)

---

*Dokumentasi direvisi oleh: Claude Sonnet 4.6*  
*Tanggal: 2026-05-10*
