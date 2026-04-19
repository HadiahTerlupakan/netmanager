# Attendance Missed Check-in Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan alur koreksi manual admin untuk record mangkir/ABSENT yang sebenarnya hadir, dengan permission khusus, bukti foto wajib, audit trail dua arah, dan perhitungan report/payroll yang memakai record final hasil koreksi.

**Architecture:** Gunakan route admin spesifik per-record untuk submit koreksi (`/api/admin/attendance/[id]/correct-missed-checkin`) agar route list tetap tipis. Logika bisnis koreksi ditempatkan di service baru dalam modul attendance; repository hanya menangani lookup/update/create terstruktur. Record mangkir asal tetap disimpan sebagai histori audit, sedangkan record attendance hasil koreksi menjadi sumber kebenaran operasional untuk list, report, dan payroll.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, PostgreSQL, Zod, Tailwind CSS, Vitest.

---

## File Map

### Create
- `app/api/admin/attendance/[id]/correct-missed-checkin/route.ts` — endpoint admin submit koreksi missed check-in dengan multipart form-data.
- `app/admin/attendance/components/MissedCheckInCorrectionModal.tsx` — modal khusus input koreksi missed check-in.
- `modules/attendance/services/AttendanceCorrectionService.ts` — business logic koreksi manual, validasi domain, create/update atomik.
- `tests/api/admin-attendance-correct-missed-checkin-route.test.ts` — test endpoint koreksi manual.
- `tests/modules/attendance/AttendanceCorrectionService.test.ts` — test domain/service koreksi.

### Modify
- `prisma/schema.prisma` — tambah metadata koreksi pada model `Attendance`.
- `lib/validations/attendance.ts` — tambah schema request koreksi missed check-in.
- `modules/attendance/repositories/AttendanceRepository.ts` — tambah helper lookup/update/create dan filter report agar source row yang sudah dikoreksi tidak ikut dihitung lagi.
- `modules/attendance/index.ts` — export service koreksi baru.
- `app/api/admin/attendance/route.ts` — tampilkan metadata corrected/correction target di list dan exclude source row terkoreksi dari summary/report list final bila dibutuhkan.
- `app/admin/attendance/AttendanceClient.tsx` — tampilkan tombol action baru, badge, disabled state, dan wire modal.
- `lib/role-templates.ts` — tambah permission `attendance:correct-missed-checkin` pada template role yang relevan.
- `prisma/seed-qa-users.ts` — tambah permission baru pada role QA/HR yang memang boleh koreksi.
- `modules/attendance/services/AttendanceService.ts` — bila diperlukan, konsolidasikan helper report agar memakai filter repository yang sama terhadap source row terkoreksi.
- `modules/salary/services/SalaryCalculatorService.ts` — verifikasi tidak perlu ubah logika payroll karena sudah membaca `attendanceEvaluation`; ubah hanya jika test menunjukkan sumber koreksi belum masuk.
- `tests/api/admin-attendance-status-detail-filter.test.ts` — tambah coverage badge/list untuk corrected absence.

---

### Task 1: Tambah failing tests untuk alur koreksi manual

**Files:**
- Create: `tests/api/admin-attendance-correct-missed-checkin-route.test.ts`
- Create: `tests/modules/attendance/AttendanceCorrectionService.test.ts`
- Modify: `tests/api/admin-attendance-status-detail-filter.test.ts`

- [ ] **Step 1: Tulis failing test service untuk happy path koreksi missed check-in**

```ts
it("creates a replacement attendance and marks source ABSENT row as corrected", async () => {
  const service = new AttendanceCorrectionService(mockRepository);

  mockRepository.findCorrectionSourceById.mockResolvedValue({
    id: "attendance-absent-1",
    tenantId: "tenant-1",
    userId: "user-1",
    status: "ABSENT",
    checkIn: new Date("2026-04-17T10:00:00.000Z"),
    checkOut: null,
    checkInDate: null,
    notes: "Tidak Masuk Kerja (Absent) - Auto Generated",
    correctedAt: null,
    user: {
      id: "user-1",
      workingHourMode: "FIXED",
      startWorkTime: "08:00",
      endWorkTime: "17:00",
      shift: null,
    },
  });

  mockRepository.createCorrectedAttendance.mockResolvedValue({
    id: "attendance-corrected-1",
    status: "ON_TIME",
  });

  const result = await service.correctMissedCheckIn({
    sourceAttendanceId: "attendance-absent-1",
    tenantId: "tenant-1",
    actorId: "admin-1",
    checkIn: new Date("2026-04-17T08:03:00.000Z"),
    checkOut: null,
    reason: "Karyawan hadir tetapi lupa absen masuk",
    notes: "Diverifikasi supervisor",
    evidencePhotoUrl: "/uploads/employee/attendance/admin-1-proof.webp",
  });

  expect(mockRepository.markAttendanceAsCorrected).toHaveBeenCalledWith(
    expect.objectContaining({
      sourceAttendanceId: "attendance-absent-1",
      correctedById: "admin-1",
      correctionReason: "Karyawan hadir tetapi lupa absen masuk",
      replacementAttendanceId: "attendance-corrected-1",
    }),
  );
  expect(result.correctedAttendance.status).toBe("ON_TIME");
});
```

- [ ] **Step 2: Tulis failing test service untuk guardrails domain**

```ts
it("rejects source rows that are not ABSENT or already corrected", async () => {
  const service = new AttendanceCorrectionService(mockRepository);

  mockRepository.findCorrectionSourceById.mockResolvedValue({
    id: "attendance-late-1",
    tenantId: "tenant-1",
    userId: "user-1",
    status: "LATE",
    correctedAt: null,
    user: {
      id: "user-1",
      workingHourMode: "FIXED",
      startWorkTime: "08:00",
      endWorkTime: "17:00",
      shift: null,
    },
  });

  await expect(
    service.correctMissedCheckIn({
      sourceAttendanceId: "attendance-late-1",
      tenantId: "tenant-1",
      actorId: "admin-1",
      checkIn: new Date("2026-04-17T08:30:00.000Z"),
      checkOut: null,
      reason: "Tidak relevan",
      notes: null,
      evidencePhotoUrl: "/uploads/employee/attendance/admin-1-proof.webp",
    }),
  ).rejects.toThrow("Record sumber harus berstatus mangkir");
});
```

- [ ] **Step 3: Tulis failing test route untuk validasi request dan permission**

```ts
it("returns 403 when user lacks attendance:correct-missed-checkin", async () => {
  hasPermissionMock.mockImplementation(async (permission: string) =>
    permission === "attendance:correct-missed-checkin" ? false : true,
  );

  const body = new FormData();
  body.set("checkIn", "2026-04-17T08:03");
  body.set("reason", "Karyawan hadir");
  body.set("photo", new File(["img"], "proof.png", { type: "image/png" }));

  const response = await postRoute(
    new NextRequest("http://localhost/api/admin/attendance/attendance-absent-1/correct-missed-checkin", {
      method: "POST",
      body,
    }),
    { params: { id: "attendance-absent-1" }, session: { user: { id: "admin-1", tenantId: "tenant-1" } } } as never,
  );

  expect(response.status).toBe(403);
});
```

- [ ] **Step 4: Tulis failing test route untuk submit sukses**

```ts
it("uploads evidence photo and delegates correction to service", async () => {
  correctionServiceMock.correctMissedCheckIn.mockResolvedValue({
    sourceAttendanceId: "attendance-absent-1",
    correctedAttendance: { id: "attendance-corrected-1", status: "ON_TIME" },
  });

  const body = new FormData();
  body.set("checkIn", "2026-04-17T08:03");
  body.set("reason", "Karyawan hadir tetapi lupa check-in");
  body.set("notes", "Diverifikasi oleh admin HR");
  body.set("photo", new File(["img"], "proof.png", { type: "image/png" }));

  const response = await postRoute(
    new NextRequest("http://localhost/api/admin/attendance/attendance-absent-1/correct-missed-checkin", {
      method: "POST",
      body,
    }),
    { params: { id: "attendance-absent-1" }, session: { user: { id: "admin-1", tenantId: "tenant-1" } } } as never,
  );

  const json = await response.json();
  expect(correctionServiceMock.correctMissedCheckIn).toHaveBeenCalled();
  expect(json.data.correctedAttendance.id).toBe("attendance-corrected-1");
});
```

- [ ] **Step 5: Tulis failing test list/filter untuk badge corrected**

```ts
it("returns corrected metadata so admin list can disable correction button", async () => {
  prismaMock.attendance.findMany.mockResolvedValue([
    {
      id: "attendance-absent-1",
      tenantId: "tenant-1",
      userId: "user-1",
      checkIn: new Date("2026-04-17T10:00:00.000Z"),
      checkOut: null,
      status: "ABSENT",
      correctedAt: new Date("2026-04-18T02:00:00.000Z"),
      correctionReplacementAttendanceId: "attendance-corrected-1",
      correctionReason: "Karyawan hadir tetapi lupa check-in",
      notes: "Tidak Masuk Kerja (Absent) - Auto Generated",
      user: {
        name: "User 1",
        email: "user1@example.com",
        image: null,
        workingHourMode: "FIXED",
        workDays: ["MONDAY"],
        departments: { name: "Ops" },
        sites: { name: "HQ" },
      },
    },
  ]);

  const response = await getAdminAttendance(
    new NextRequest("http://localhost/api/admin/attendance?page=1&limit=20&statusDetail=ABSENT&startDate=2026-04-01&endDate=2026-04-30"),
    { session: { user: { id: "admin-1", tenantId: "tenant-1" } } } as never,
  );

  const json = await response.json();
  expect(json.data[0].correctionReplacementAttendanceId).toBe("attendance-corrected-1");
});
```

- [ ] **Step 6: Jalankan test yang baru untuk memastikan gagal di alasan yang benar**

Run:
```bash
npx vitest run tests/modules/attendance/AttendanceCorrectionService.test.ts tests/api/admin-attendance-correct-missed-checkin-route.test.ts tests/api/admin-attendance-status-detail-filter.test.ts
```

Expected: FAIL karena `AttendanceCorrectionService`, route koreksi, dan field metadata koreksi belum ada.

---

### Task 2: Tambah persistence model dan validasi input

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/validations/attendance.ts`
- Modify: `modules/attendance/repositories/AttendanceRepository.ts`

- [ ] **Step 1: Tambah field metadata koreksi pada model `Attendance`**

```prisma
model Attendance {
  id                               String           @id
  userId                           String
  checkIn                          DateTime         @default(now())
  checkInDate                      DateTime?
  checkOut                         DateTime?
  checkInPhoto                     String?
  checkOutPhoto                    String?
  status                           AttendanceStatus @default(ON_TIME)
  notes                            String?
  location                         String?
  checkOutLocation                 String?
  createdAt                        DateTime         @default(now())
  updatedAt                        DateTime
  geofenceStatus                   String?
  geofenceDistance                 Float?
  geofenceSiteName                 String?
  checkOutGeofenceStatus           String?
  checkOutGeofenceDistance         Float?
  geofenceMeta                     Json?
  tenantId                         String?
  correctedAt                      DateTime?
  correctedById                    String?
  correctionReason                 String?
  correctionNotes                  String?
  correctionEvidencePhotoUrl       String?
  correctionReplacementAttendanceId String?
  correctionSourceAttendanceId     String?
  correctionSource                 String?
  tenant                           Tenant?          @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  user                             User             @relation(fields: [userId], references: [id])
  correctedBy                      User?            @relation("AttendanceCorrectedBy", fields: [correctedById], references: [id])
  correctionReplacementAttendance  Attendance?      @relation("AttendanceCorrectionReplacement", fields: [correctionReplacementAttendanceId], references: [id])
  correctionSourceAttendance       Attendance?      @relation("AttendanceCorrectionSource", fields: [correctionSourceAttendanceId], references: [id])
  overtime                         Overtime[]

  @@index([tenantId, correctedAt])
  @@index([correctionReplacementAttendanceId])
  @@index([correctionSourceAttendanceId])
  @@unique([correctionReplacementAttendanceId])
  @@unique([correctionSourceAttendanceId])
}
```

Catatan implementasi:
- `correctedAt` pada source row = penanda histori sudah dikoreksi.
- `correctionReplacementAttendanceId` pada source row = pointer ke record final.
- `correctionSourceAttendanceId` pada record final = pointer balik ke source row.
- `correctionSource` isi string tetap: `ADMIN_MISSED_CHECKIN`.
- Biarkan source row auto-ABSENT tetap memakai `checkInDate = null`; record final hasil koreksi yang memegang `checkInDate = workDate` agar tetap memenuhi unique constraint operasional per hari.

- [ ] **Step 2: Tambah schema Zod untuk payload koreksi**

```ts
const correctionReasonSchema = z.string().trim().min(1).max(500);
const correctionNotesSchema = z.string().trim().max(500).optional().nullable();

export const attendanceMissedCheckInCorrectionSchema = z
  .object({
    checkIn: z.iso.datetime(),
    checkOut: z.iso.datetime().optional().nullable(),
    reason: correctionReasonSchema,
    notes: correctionNotesSchema,
    evidencePhotoUrl: z.string().min(1),
  })
  .refine(
    (data) => !data.checkOut || new Date(data.checkOut) >= new Date(data.checkIn),
    {
      message: "Jam check-out harus lebih besar atau sama dengan jam check-in",
      path: ["checkOut"],
    },
  );
```

- [ ] **Step 3: Tambah repository contract khusus koreksi**

```ts
type AttendanceCorrectionSource = Prisma.AttendanceGetPayload<{
  include: {
    user: {
      include: { shift: true };
    };
  };
}>;

async findCorrectionSourceById(id: string): Promise<AttendanceCorrectionSource | null>
async createCorrectedAttendance(data: Prisma.AttendanceUncheckedCreateInput)
async markAttendanceAsCorrected(input: {
  sourceAttendanceId: string;
  correctedById: string;
  correctionReason: string;
  correctionNotes: string | null;
  correctionEvidencePhotoUrl: string;
  replacementAttendanceId: string;
})
```

- [ ] **Step 4: Tambah helper repository untuk exclude source row terkoreksi dari statistik raw**

```ts
function buildActiveAttendanceWhere(where: Prisma.AttendanceWhereInput): Prisma.AttendanceWhereInput {
  return {
    ...where,
    correctedAt: null,
  };
}
```

Pakai helper ini minimal di:
- `getStatsByDateRange`
- `getDailyStats`
- `getTopAbsentees`
- `getUserAttendanceStats`
- `getUserAbsenceStats`
- `getUserTotalDuration`
- `getUserLateStats`

- [ ] **Step 5: Jalankan generate client dan focused test**

Run:
```bash
npm run prisma:generate && npx vitest run tests/modules/attendance/AttendanceCorrectionService.test.ts
```

Expected: schema sudah valid; test masih FAIL karena service belum ada.

---

### Task 3: Implementasi service koreksi manual admin

**Files:**
- Create: `modules/attendance/services/AttendanceCorrectionService.ts`
- Modify: `modules/attendance/index.ts`
- Modify: `modules/attendance/repositories/AttendanceRepository.ts`

- [ ] **Step 1: Buat service dengan input yang eksplisit**

```ts
export interface CorrectMissedCheckInInput {
  sourceAttendanceId: string;
  tenantId: string;
  actorId: string;
  checkIn: Date;
  checkOut: Date | null;
  reason: string;
  notes: string | null;
  evidencePhotoUrl: string;
}

export class AttendanceCorrectionService {
  constructor(
    private readonly attendanceRepo = new AttendanceRepository(),
  ) {}

  async correctMissedCheckIn(input: CorrectMissedCheckInInput) {
    // implement here
  }
}
```

- [ ] **Step 2: Implementasi validasi domain service**

```ts
if (!sourceAttendance) {
  throw new NotFoundError("Data absensi tidak ditemukan");
}

if (sourceAttendance.tenantId !== input.tenantId) {
  throw new NotFoundError("Data absensi tidak ditemukan");
}

if (!["ABSENT", "ALPHA"].includes(sourceAttendance.status)) {
  throw new ValidationError("Record sumber harus berstatus mangkir");
}

if (sourceAttendance.correctedAt) {
  throw new ConflictError("Record mangkir ini sudah pernah dikoreksi");
}
```

- [ ] **Step 3: Hitung work date, validasi window, dan default check-out**

```ts
const timezone = await getTimezone(input.tenantId);
const workDate = toStartOfDay(sourceAttendance.checkIn, timezone);
const schedule = await this.resolveSchedule(sourceAttendance.user, workDate, timezone);

this.assertCheckInWithinWindow({
  checkIn: input.checkIn,
  workDate,
  schedule,
  timezone,
});

const effectiveCheckOut =
  input.checkOut ?? this.buildDefaultCheckOut({ workDate, schedule, timezone });

if (effectiveCheckOut < input.checkIn) {
  throw new ValidationError("Jam check-out harus lebih besar atau sama dengan jam check-in");
}
```

Aturan yang harus dipakai:
- window check-in = 3 jam sebelum start kerja/shift sampai akhir kerja/shift.
- untuk fixed gunakan `startWorkTime`/`endWorkTime` user.
- untuk shift gunakan jam shift aktif di hari itu.
- jika `checkOut` kosong, isi otomatis jam akhir kerja/shift.
- status final record baru dihitung menjadi `ON_TIME` atau `LATE` saja.

- [ ] **Step 4: Buat record attendance final dan tandai source row dalam satu transaksi**

```ts
return prisma.$transaction(async (tx) => {
  const correctedAttendance = await tx.attendance.create({
    data: {
      id: randomUUID(),
      tenantId: input.tenantId,
      userId: sourceAttendance.userId,
      checkIn: input.checkIn,
      checkInDate: workDate,
      checkOut: effectiveCheckOut,
      checkInPhoto: input.evidencePhotoUrl,
      status: finalStatus,
      notes: input.notes,
      location: "Manual correction by admin",
      checkOutLocation: input.checkOut ? "Manual correction by admin" : "Auto-filled from schedule",
      geofenceStatus: "MANUAL",
      correctionSource: "ADMIN_MISSED_CHECKIN",
      correctionSourceAttendanceId: sourceAttendance.id,
      updatedAt: new Date(),
    },
  });

  await tx.attendance.update({
    where: { id: sourceAttendance.id },
    data: {
      correctedAt: new Date(),
      correctedById: input.actorId,
      correctionReason: input.reason,
      correctionNotes: input.notes,
      correctionEvidencePhotoUrl: input.evidencePhotoUrl,
      correctionReplacementAttendanceId: correctedAttendance.id,
    },
  });

  return correctedAttendance;
});
```

- [ ] **Step 5: Recompute canonical evaluation setelah create/update**

```ts
await this.attendanceRepo.recordEvaluationChange({
  tenantId: input.tenantId,
  userId: sourceAttendance.userId,
  workDate,
  nextSnapshot: correctedEvaluation,
  previousSnapshot: previousEvaluation ?? null,
  action: "MISSED_CHECKIN_CORRECTED",
  reason: input.reason,
  actorType: "ADMIN",
  actorId: input.actorId,
});
```

Implementasi minimal yang harus terjadi:
- evaluation final untuk `workDate` harus mereferensikan record koreksi baru sebagai source of truth.
- source row ABSENT yang sudah dikoreksi tidak boleh lagi menang pada rekap final hari itu.

- [ ] **Step 6: Export service di public module API**

```ts
export * from "./services/AttendanceCorrectionService";
```

- [ ] **Step 7: Jalankan service tests hingga pass**

Run:
```bash
npx vitest run tests/modules/attendance/AttendanceCorrectionService.test.ts
```

Expected: PASS.

---

### Task 4: Implementasi route admin koreksi missed check-in

**Files:**
- Create: `app/api/admin/attendance/[id]/correct-missed-checkin/route.ts`
- Modify: `lib/validations/attendance.ts`

- [ ] **Step 1: Buat route POST dengan permission khusus**

```ts
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  if (!(await hasPermission("attendance:correct-missed-checkin"))) {
    return ApiErrors.forbidden("Akses ditolak");
  }

  const attendanceId = idSchema.parse(ctx.params.id);
  const formData = await req.formData();
  // parse fields here
});
```

- [ ] **Step 2: Validasi file upload dengan policy yang sudah ada**

```ts
const photo = formData.get("photo");
if (!(photo instanceof File)) {
  return ApiErrors.badRequest("Foto bukti wajib diupload");
}

const validation = validateUploadFile({
  folder: "uploads",
  mimeType: photo.type,
  size: photo.size,
  fileName: photo.name,
});

if (!validation.ok) {
  return ApiErrors.badRequest(validation.error);
}
```

Gunakan penyimpanan yang konsisten:
- `convertAndSaveImage(photo, "public/uploads/employee/attendance", fileName, "employee-attendance", ctx.session!.user.id)`
- URL hasil harus berada di prefix publik yang sudah diizinkan.

- [ ] **Step 3: Parse field string menjadi payload schema**

```ts
const payload = attendanceMissedCheckInCorrectionSchema.parse({
  checkIn: new Date(String(formData.get("checkIn"))).toISOString(),
  checkOut: formData.get("checkOut")
    ? new Date(String(formData.get("checkOut"))).toISOString()
    : null,
  reason: String(formData.get("reason") ?? ""),
  notes: formData.get("notes") ? String(formData.get("notes")) : null,
  evidencePhotoUrl,
});
```

- [ ] **Step 4: Delegasikan ke service dan log activity**

```ts
const service = new AttendanceCorrectionService();
const result = await service.correctMissedCheckIn({
  sourceAttendanceId: attendanceId,
  tenantId: ctx.session!.user.tenantId!,
  actorId: ctx.session!.user.id,
  checkIn: new Date(payload.checkIn),
  checkOut: payload.checkOut ? new Date(payload.checkOut) : null,
  reason: payload.reason,
  notes: payload.notes ?? null,
  evidencePhotoUrl: payload.evidencePhotoUrl,
});

logActivitySafe({
  action: "UPDATE",
  subject: "AttendanceCorrection",
  userId: ctx.session!.user.id,
  details: {
    sourceAttendanceId: attendanceId,
    correctedAttendanceId: result.correctedAttendance.id,
  },
});

return apiSuccess(result, { message: "Koreksi lupa absen berhasil disimpan" });
```

- [ ] **Step 5: Jalankan route tests hingga pass**

Run:
```bash
npx vitest run tests/api/admin-attendance-correct-missed-checkin-route.test.ts
```

Expected: PASS.

---

### Task 5: Tambah permission dan wire akses role

**Files:**
- Modify: `lib/role-templates.ts`
- Modify: `prisma/seed-qa-users.ts`
- Modify: `app/admin/attendance/AttendanceClient.tsx`

- [ ] **Step 1: Tambah permission baru ke template role yang memang mengelola absensi**

```ts
'attendance:read',
'attendance:update',
'attendance:correct-missed-checkin',
'attendance:site_only',
'attendance:department_only',
```

Masukkan minimal pada template yang saat ini memang memiliki `attendance:update` dan cocok sebagai admin HR/manager attendance. Jangan tambahkan ke role baca-saja.

- [ ] **Step 2: Tambah permission baru ke seed QA HR**

```ts
'attendance:read', 'attendance:create', 'attendance:update', 'attendance:delete', 'attendance:correct-missed-checkin',
```

- [ ] **Step 3: Tambah gate permission di client**

```ts
const canCorrectMissedCheckIn = hasPermission("attendance:correct-missed-checkin");
```

- [ ] **Step 4: Jalankan focused smoke test statis**

Run:
```bash
npx vitest run tests/api/admin-attendance-correct-missed-checkin-route.test.ts tests/api/admin-attendance-status-detail-filter.test.ts
```

Expected: PASS untuk permission gate route; UI build belum diuji di task ini.

---

### Task 6: Implementasi UI action khusus, modal, badge, dan disabled state

**Files:**
- Create: `app/admin/attendance/components/MissedCheckInCorrectionModal.tsx`
- Modify: `app/admin/attendance/AttendanceClient.tsx`

- [ ] **Step 1: Perluas type row attendance di client**

```ts
interface Attendance {
  id: string;
  checkIn: string;
  checkOut: string | null;
  checkInPhoto: string | null;
  checkOutPhoto: string | null;
  checkOutLocation: string | null;
  status: string;
  displayStatus?: string | null;
  notes: string | null;
  location: string | null;
  correctedAt?: string | null;
  correctionReason?: string | null;
  correctionReplacementAttendanceId?: string | null;
  correctionSourceAttendanceId?: string | null;
  correctionSource?: string | null;
  user: {
    name: string | null;
    email: string;
    image: string | null;
    workingHourMode?: string;
    departments: { name: string } | null;
    sites?: { name: string } | null;
  };
}
```

- [ ] **Step 2: Buat modal komponen terpisah**

```tsx
export function MissedCheckInCorrectionModal({
  isOpen,
  attendance,
  onClose,
  onSubmit,
  isSubmitting,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Koreksi Lupa Absen">
      {/* readonly employee/date/source status/schedule */}
      {/* input checkIn, checkOut, photo, reason, notes */}
      {/* submit button */}
    </Modal>
  );
}
```

Readonly section wajib menampilkan:
- nama karyawan
- tanggal kerja
- status lama: Mangkir
- jadwal kerja/shift

Input wajib:
- jam check-in aktual
- foto bukti manual
- alasan koreksi

Input opsional:
- jam check-out aktual
- catatan admin tambahan

- [ ] **Step 3: Tambah state modal dan submit handler di `AttendanceClient.tsx`**

```ts
const [selectedCorrectionAttendance, setSelectedCorrectionAttendance] = useState<Attendance | null>(null);
const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);

const handleOpenCorrectionModal = (item: Attendance) => {
  setSelectedCorrectionAttendance(item);
  setIsCorrectionModalOpen(true);
};
```

- [ ] **Step 4: Tambah action button khusus di `renderActions`**

```tsx
{canCorrectMissedCheckIn && (item.status === "ABSENT" || item.status === "ALPHA") && (
  <Button
    variant="ghost"
    size="icon-sm"
    onClick={() => handleOpenCorrectionModal(item)}
    disabled={Boolean(item.correctedAt)}
    className="text-amber-600 dark:text-amber-400"
    title={item.correctedAt ? "Sudah dikoreksi admin" : "Koreksi Lupa Absen"}
  >
    <MdFactCheck size={18} />
  </Button>
)}
```

Aturan UI yang harus dijaga:
- tombol hanya muncul untuk `ABSENT`/`ALPHA`
- tombol hanya tampil bila user punya permission baru
- jika `correctedAt` terisi, tombol tetap tampil tapi disabled
- source row yang sudah dikoreksi tampil dengan badge `Sudah Dikoreksi`
- replacement row tampil dengan badge `Koreksi Admin`

- [ ] **Step 5: Implementasi submit multipart form-data dari modal**

```ts
const formData = new FormData();
formData.set("checkIn", values.checkIn);
if (values.checkOut) formData.set("checkOut", values.checkOut);
formData.set("reason", values.reason);
if (values.notes) formData.set("notes", values.notes);
formData.set("photo", values.photo);

await fetchWithHandling(
  `/api/admin/attendance/${selectedCorrectionAttendance!.id}/correct-missed-checkin`,
  {
    method: "POST",
    body: formData,
  },
);
```

Setelah sukses:
- tutup modal
- reset form
- tampilkan toast sukses
- refresh list attendance

- [ ] **Step 6: Jalankan dev server dan uji manual golden path**

Run:
```bash
npm run dev
```

Verifikasi manual di browser:
- record `ABSENT` tanpa correction menampilkan tombol aktif.
- klik tombol membuka modal dengan field readonly + input yang benar.
- submit tanpa foto/alasan gagal di UI.
- submit sukses menampilkan badge `Sudah Dikoreksi` pada source row.
- replacement row terlihat sebagai attendance final dengan badge `Koreksi Admin`.
- tombol source row tetap tampil tetapi disabled.

---

### Task 7: Pastikan list, report, dan payroll memakai record final tanpa double count

**Files:**
- Modify: `app/api/admin/attendance/route.ts`
- Modify: `modules/attendance/repositories/AttendanceRepository.ts`
- Modify: `modules/attendance/services/AttendanceService.ts`
- Modify: `modules/salary/services/SalaryCalculatorService.ts` (hanya jika test membuktikan perlu)
- Modify: `tests/api/admin-attendance-status-detail-filter.test.ts`
- Modify: `tests/modules/attendance/AttendanceCorrectionService.test.ts`

- [ ] **Step 1: Return metadata koreksi di route list admin**

```ts
const includeUser = {
  user: {
    select: {
      name: true,
      email: true,
      image: true,
      workingHourMode: true,
      workDays: true,
      departments: { select: { name: true } },
      sites: { select: { name: true } },
    },
  },
};
```

Pastikan object row yang dikembalikan juga membawa:
- `correctedAt`
- `correctionReason`
- `correctionReplacementAttendanceId`
- `correctionSourceAttendanceId`
- `correctionSource`

- [ ] **Step 2: Exclude source row yang sudah dikoreksi dari statistik raw attendance**

```ts
const where = buildActiveAttendanceWhere({
  tenantId,
  checkIn: { gte: startDate, lte: endDate },
  ...(siteId ? { user: { siteId } } : {}),
});
```

Gunakan helper ini pada query statistik raw yang dipakai `AttendanceService.getReportData`. Tujuannya:
- source row `ABSENT` yang sudah dikoreksi tetap muncul di histori list,
- tetapi tidak ikut lagi sebagai mangkir aktif pada summary/report.

- [ ] **Step 3: Verifikasi payroll tetap memakai canonical evaluation final**

```ts
const payrollEvaluations =
  await this.attendanceRepo.findManyPayrollEvaluationsByUserAndDateRange({
    userId,
    startDate,
    endDate,
  });
```

Tidak perlu ubah `SalaryCalculatorService` bila setelah koreksi service sudah meng-upsert `AttendanceEvaluation` untuk `workDate` yang sama. Tambahkan regression test; ubah service payroll hanya jika test membuktikan hasil masih salah.

- [ ] **Step 4: Tambah regression test untuk report/payroll behavior**

```ts
it("excludes corrected ABSENT source rows from absence stats while preserving replacement row", async () => {
  prismaMock.attendance.groupBy.mockResolvedValue([
    { status: "ON_TIME", _count: { _all: 1 } },
  ]);

  await attendanceService.getReportData(
    new Date("2026-04-01T00:00:00.000Z"),
    new Date("2026-04-30T23:59:59.999Z"),
  );

  expect(prismaMock.attendance.groupBy).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ correctedAt: null }),
    }),
  );
});
```

- [ ] **Step 5: Jalankan regression tests**

Run:
```bash
npx vitest run tests/api/admin-attendance-status-detail-filter.test.ts tests/modules/attendance/AttendanceCorrectionService.test.ts
```

Expected: PASS.

---

### Task 8: Verifikasi akhir

**Files:**
- Modify: file yang berubah dari task sebelumnya

- [ ] **Step 1: Jalankan test suite terfokus**

Run:
```bash
npx vitest run tests/modules/attendance/AttendanceCorrectionService.test.ts tests/api/admin-attendance-correct-missed-checkin-route.test.ts tests/api/admin-attendance-status-detail-filter.test.ts tests/modules/attendance/AttendanceAlertService.test.ts tests/lib/attendance-display.test.ts
```

Expected: PASS.

- [ ] **Step 2: Jalankan typecheck**

Run:
```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Jalankan build bila perubahan API/UI sudah stabil**

Run:
```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Verifikasi manual di browser**

Checklist:
- source row mangkir tampil dengan tombol koreksi aktif bila belum pernah dikoreksi.
- modal menolak submit jika foto/alasan/check-in kosong.
- submit dengan check-out kosong menghasilkan replacement row dengan jam akhir kerja/shift.
- source row berubah menjadi badge `Sudah Dikoreksi`.
- replacement row tampil dengan badge `Koreksi Admin`.
- report admin tidak double count source row + replacement row.
- payroll periode yang memuat tanggal koreksi membaca final status pengganti.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma lib/validations/attendance.ts modules/attendance/repositories/AttendanceRepository.ts modules/attendance/services/AttendanceCorrectionService.ts modules/attendance/index.ts app/api/admin/attendance/[id]/correct-missed-checkin/route.ts app/api/admin/attendance/route.ts app/admin/attendance/AttendanceClient.tsx app/admin/attendance/components/MissedCheckInCorrectionModal.tsx lib/role-templates.ts prisma/seed-qa-users.ts tests/modules/attendance/AttendanceCorrectionService.test.ts tests/api/admin-attendance-correct-missed-checkin-route.test.ts tests/api/admin-attendance-status-detail-filter.test.ts
git commit -m "feat: add admin correction flow for missed check-in"
```

---

## Self-Review

### Spec coverage
- Permission baru `attendance:correct-missed-checkin` — covered di Task 4 dan 5.
- Tombol action khusus + modal admin — covered di Task 6.
- Foto bukti wajib — covered di Task 1, 4, 6.
- Validasi source row harus `ABSENT`/`ALPHA` dan belum dikoreksi — covered di Task 1 dan 3.
- Check-in valid dalam window, check-out auto-fill bila kosong — covered di Task 3.
- Source row tetap disimpan dan ditandai corrected — covered di Task 2 dan 3.
- Record final baru menjadi sumber kebenaran list/report/payroll — covered di Task 3 dan 7.
- Tombol tetap tampil tetapi disabled jika sudah pernah dikoreksi — covered di Task 6.

### Placeholder scan
- Tidak ada `TODO`, `TBD`, atau referensi “implement later”.
- Semua task menyebut file konkret, command konkret, dan perilaku test yang diharapkan.

### Type consistency
- Route yang dipilih konsisten: `app/api/admin/attendance/[id]/correct-missed-checkin/route.ts`.
- Nama service konsisten: `AttendanceCorrectionService`.
- Nama permission konsisten: `attendance:correct-missed-checkin`.
- Nama source metadata konsisten: `correctionSource = "ADMIN_MISSED_CHECKIN"`.
