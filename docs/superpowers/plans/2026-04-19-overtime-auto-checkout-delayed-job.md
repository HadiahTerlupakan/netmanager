# Overtime Auto Checkout Delayed Job Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti cron overtime auto-checkout berbasis polling per menit menjadi metadata PostgreSQL + BullMQ delayed job yang tahan restart, idempotent, dan tidak memproses scan global.

**Architecture:** Implementasi dibagi menjadi empat unit: penyimpanan metadata schedule di Prisma/repository overtime, scheduler service yang mengikat lifecycle overtime ke delayed job, worker BullMQ yang mengeksekusi dan merehydrate job dari metadata DB, lalu pembersihan cron lama beserta regression test. Semua perubahan mengikuti pola modular monolith repo ini: service overtime tetap menjadi pintu logika bisnis, queue/worker hidup di `lib/event-bus`, dan recovery startup dilakukan lewat inisialisasi worker yang sudah ada.

**Tech Stack:** TypeScript, Prisma, PostgreSQL, BullMQ, ioredis, Vitest, Next.js 16.

---

## File Structure

- Modify: `prisma/schema.prisma`
  - Menambah model metadata schedule auto-checkout overtime dan enum status schedule.
- Create: `prisma/migrations/<timestamp>_add_overtime_auto_checkout_schedule/migration.sql`
  - Membuat tabel dan index baru untuk metadata schedule.
- Modify: `modules/overtime/repositories/IOvertimeRepository.ts`
  - Menambah kontrak repository untuk membaca dan memperbarui schedule auto-checkout.
- Modify: `modules/overtime/repositories/OvertimeRepository.ts`
  - Mengimplementasikan query Prisma untuk create/upsert/cancel/complete/find-due schedule.
- Create: `modules/overtime/services/OvertimeAutoCheckoutSchedulerService.ts`
  - Menghitung `scheduledFor`, membuat `jobId` deterministik, sinkron metadata DB ↔ BullMQ.
- Modify: `modules/overtime/services/OvertimeService.ts`
  - Memanggil scheduler service saat overtime start, reschedule, dan manual completion.
- Modify: `modules/overtime/services/OvertimeAutoCheckoutService.ts`
  - Mengubah service dari scan global menjadi executor satu schedule spesifik berbasis payload job.
- Modify: `modules/overtime/index.ts`
  - Mengekspor scheduler service baru.
- Modify: `lib/event-bus/types.ts`
  - Menambah queue name untuk overtime auto-checkout.
- Modify: `lib/event-bus/queues.ts`
  - Menambah helper add/get/remove delayed job overtime auto-checkout.
- Modify: `lib/event-bus/workers.ts`
  - Menambah worker BullMQ untuk execute dan rehydrate overtime auto-checkout.
- Modify: `lib/event-bus/index.ts`
  - Menjalankan rehydration startup sebagai bagian inisialisasi event bus.
- Modify: `lib/cron-registry.ts`
  - Menghapus cron overtime auto-checkout lama.
- Create: `tests/modules/overtime/OvertimeAutoCheckoutSchedulerService.test.ts`
  - Mengunci create/reschedule/cancel metadata dan queue sync.
- Modify: `tests/modules/overtime/OvertimeService.test.ts`
  - Mengunci integrasi lifecycle overtime dengan scheduler service.
- Modify: `tests/modules/overtime/OvertimeAutoCheckoutService.test.ts`
  - Mengubah test dari scan global menjadi execute-by-schedule dengan validasi stale state.
- Create: `tests/lib/event-bus/overtime-auto-checkout-worker.test.ts`
  - Mengunci delayed job worker, skip stale job, dan startup rehydration.
- Modify: `tests/lib/cron-registry-lock.test.ts`
  - Menambah regression assertion bahwa helper cron tetap utuh sementara job overtime sudah hilang dari registry.

## Task 1: Tambah metadata schedule auto-checkout di Prisma

**Files:**
- Modify: `prisma/schema.prisma:765-796`
- Create: `prisma/migrations/<timestamp>_add_overtime_auto_checkout_schedule/migration.sql`
- Test: `tests/modules/overtime/OvertimeAutoCheckoutSchedulerService.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Overtime auto checkout schedule schema", () => {
  it("adds schedule model and status enum to Prisma schema", () => {
    const schema = readFileSync(
      resolve(process.cwd(), "prisma/schema.prisma"),
      "utf8",
    );

    expect(schema).toContain("model OvertimeAutoCheckoutSchedule {");
    expect(schema).toContain("scheduleStatus OvertimeAutoCheckoutScheduleStatus");
    expect(schema).toContain("@@unique([overtimeId])");
    expect(schema).toContain("@@index([scheduleStatus, scheduledFor])");
    expect(schema).toContain("enum OvertimeAutoCheckoutScheduleStatus {");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- tests/modules/overtime/OvertimeAutoCheckoutSchedulerService.test.ts
```

Expected:
- FAIL karena model `OvertimeAutoCheckoutSchedule` dan enum status belum ada di `prisma/schema.prisma`

- [ ] **Step 3: Write minimal implementation**

Tambahkan enum dan model berikut ke `prisma/schema.prisma` tepat setelah model `Overtime` agar tetap satu modul bisnis:

```prisma
enum OvertimeAutoCheckoutScheduleStatus {
  SCHEDULED
  COMPLETED
  CANCELLED
  FAILED
}

model OvertimeAutoCheckoutSchedule {
  id             String                            @id @default(cuid())
  overtimeId     String                            @unique
  scheduledFor   DateTime
  jobId          String?
  version        Int                               @default(1)
  scheduleStatus OvertimeAutoCheckoutScheduleStatus @default(SCHEDULED)
  executedAt     DateTime?
  cancelledAt    DateTime?
  lastError      String?
  createdAt      DateTime                          @default(now())
  updatedAt      DateTime                          @updatedAt
  overtime       Overtime                          @relation(fields: [overtimeId], references: [id], onDelete: Cascade)

  @@index([scheduleStatus, scheduledFor])
  @@index([jobId])
}
```

Tambahkan relasi balik ke model `Overtime`:

```prisma
  autoCheckoutSchedule OvertimeAutoCheckoutSchedule?
```

Buat migration SQL minimal dengan bentuk:

```sql
CREATE TYPE "OvertimeAutoCheckoutScheduleStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'FAILED');

CREATE TABLE "OvertimeAutoCheckoutSchedule" (
    "id" TEXT NOT NULL,
    "overtimeId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "jobId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "scheduleStatus" "OvertimeAutoCheckoutScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "executedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OvertimeAutoCheckoutSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OvertimeAutoCheckoutSchedule_overtimeId_key"
ON "OvertimeAutoCheckoutSchedule"("overtimeId");

CREATE INDEX "OvertimeAutoCheckoutSchedule_scheduleStatus_scheduledFor_idx"
ON "OvertimeAutoCheckoutSchedule"("scheduleStatus", "scheduledFor");

CREATE INDEX "OvertimeAutoCheckoutSchedule_jobId_idx"
ON "OvertimeAutoCheckoutSchedule"("jobId");

ALTER TABLE "OvertimeAutoCheckoutSchedule"
ADD CONSTRAINT "OvertimeAutoCheckoutSchedule_overtimeId_fkey"
FOREIGN KEY ("overtimeId") REFERENCES "Overtime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:run -- tests/modules/overtime/OvertimeAutoCheckoutSchedulerService.test.ts
```

Expected:
- PASS
- Prisma schema sudah mengandung model dan enum schedule auto-checkout

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/*_add_overtime_auto_checkout_schedule/migration.sql tests/modules/overtime/OvertimeAutoCheckoutSchedulerService.test.ts
git commit -m "feat: add overtime auto checkout schedule metadata"
```

## Task 2: Tambah repository dan helper queue untuk delayed job overtime

**Files:**
- Modify: `modules/overtime/repositories/IOvertimeRepository.ts`
- Modify: `modules/overtime/repositories/OvertimeRepository.ts`
- Modify: `lib/event-bus/types.ts:296-306`
- Modify: `lib/event-bus/queues.ts:1-325`
- Test: `tests/modules/overtime/OvertimeAutoCheckoutSchedulerService.test.ts`

- [ ] **Step 1: Write the failing test**

Tambahkan test repository/queue contract ke `tests/modules/overtime/OvertimeAutoCheckoutSchedulerService.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../../setup";

const queueAdd = vi.fn();
const queueGetJob = vi.fn();
const queueRemove = vi.fn();

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: queueAdd,
    getJob: queueGetJob,
  })),
}));

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({ on: vi.fn() })),
}));

describe("Overtime auto checkout scheduler queue contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts schedule metadata and enqueues a deterministic delayed job", async () => {
    prismaMock.overtimeAutoCheckoutSchedule.upsert.mockResolvedValue({
      id: "schedule-1",
      overtimeId: "overtime-1",
      version: 3,
      scheduledFor: new Date("2026-04-19T18:00:00.000Z"),
      jobId: null,
      scheduleStatus: "SCHEDULED",
    } as never);

    queueAdd.mockResolvedValue({ id: "overtime:auto-checkout:schedule-1:v3" });

    const { OvertimeAutoCheckoutSchedulerService } = await import(
      "@/modules/overtime/services/OvertimeAutoCheckoutSchedulerService"
    );

    const service = new OvertimeAutoCheckoutSchedulerService();
    await service.schedule({
      overtimeId: "overtime-1",
      startTime: new Date("2026-04-19T10:00:00.000Z"),
    });

    expect(prismaMock.overtimeAutoCheckoutSchedule.upsert).toHaveBeenCalled();
    expect(queueAdd).toHaveBeenCalledWith(
      "overtime-auto-checkout",
      {
        overtimeId: "overtime-1",
        scheduleId: "schedule-1",
        version: 3,
      },
      expect.objectContaining({
        jobId: "overtime:auto-checkout:schedule-1:v3",
        delay: 8 * 60 * 60 * 1000,
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- tests/modules/overtime/OvertimeAutoCheckoutSchedulerService.test.ts
```

Expected:
- FAIL karena service scheduler, repository method, dan queue overtime belum ada

- [ ] **Step 3: Write minimal implementation**

Perluas kontrak repository di `modules/overtime/repositories/IOvertimeRepository.ts` dengan method berikut:

```ts
export interface UpsertOvertimeAutoCheckoutScheduleInput {
  overtimeId: string;
  scheduledFor: Date;
  jobId?: string | null;
}

export interface CancelOvertimeAutoCheckoutScheduleInput {
  overtimeId: string;
  cancelledAt: Date;
}

export interface CompleteOvertimeAutoCheckoutScheduleInput {
  overtimeId: string;
  executedAt: Date;
  lastError?: string | null;
}
```

Tambahkan method ke repository implementation:

```ts
async upsertAutoCheckoutSchedule(input: UpsertOvertimeAutoCheckoutScheduleInput) {
  const current = await prisma.overtimeAutoCheckoutSchedule.findUnique({
    where: { overtimeId: input.overtimeId },
  });

  const nextVersion = (current?.version ?? 0) + 1;

  return prisma.overtimeAutoCheckoutSchedule.upsert({
    where: { overtimeId: input.overtimeId },
    create: {
      overtimeId: input.overtimeId,
      scheduledFor: input.scheduledFor,
      jobId: input.jobId ?? null,
      version: nextVersion,
      scheduleStatus: "SCHEDULED",
    },
    update: {
      scheduledFor: input.scheduledFor,
      jobId: input.jobId ?? null,
      version: nextVersion,
      scheduleStatus: "SCHEDULED",
      cancelledAt: null,
      executedAt: null,
      lastError: null,
    },
  });
}

async cancelAutoCheckoutSchedule(input: CancelOvertimeAutoCheckoutScheduleInput) {
  return prisma.overtimeAutoCheckoutSchedule.updateMany({
    where: { overtimeId: input.overtimeId, scheduleStatus: "SCHEDULED" },
    data: {
      scheduleStatus: "CANCELLED",
      cancelledAt: input.cancelledAt,
      jobId: null,
    },
  });
}
```

Tambahkan queue name di `lib/event-bus/types.ts`:

```ts
  OVERTIME_AUTO_CHECKOUT: 'radpro-overtime-auto-checkout',
```

Tambahkan helper queue di `lib/event-bus/queues.ts`:

```ts
export interface OvertimeAutoCheckoutJobData {
  overtimeId: string;
  scheduleId: string;
  version: number;
}

export async function addOvertimeAutoCheckoutJob(
  data: OvertimeAutoCheckoutJobData,
  options: { delay: number; jobId: string },
): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.OVERTIME_AUTO_CHECKOUT);
  await queue.add("overtime-auto-checkout", data, {
    jobId: options.jobId,
    delay: options.delay,
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 3600 * 24 },
    removeOnFail: { age: 3600 * 24 * 7 },
  });
}

export async function removeOvertimeAutoCheckoutJob(jobId: string): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.OVERTIME_AUTO_CHECKOUT);
  const job = await queue.getJob(jobId);
  if (job) {
    await job.remove();
  }
}
```

Pastikan `getQueue()` dan `closeAllQueues()` mengenali queue baru.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:run -- tests/modules/overtime/OvertimeAutoCheckoutSchedulerService.test.ts
```

Expected:
- PASS
- Repository metadata schedule dan helper queue overtime tersedia

- [ ] **Step 5: Commit**

```bash
git add modules/overtime/repositories/IOvertimeRepository.ts modules/overtime/repositories/OvertimeRepository.ts lib/event-bus/types.ts lib/event-bus/queues.ts tests/modules/overtime/OvertimeAutoCheckoutSchedulerService.test.ts
git commit -m "feat: add overtime auto checkout repository and queue helpers"
```

## Task 3: Tambah scheduler service untuk create, reschedule, dan cancel

**Files:**
- Create: `modules/overtime/services/OvertimeAutoCheckoutSchedulerService.ts`
- Modify: `modules/overtime/index.ts`
- Test: `tests/modules/overtime/OvertimeAutoCheckoutSchedulerService.test.ts`

- [ ] **Step 1: Write the failing test**

Lengkapi `tests/modules/overtime/OvertimeAutoCheckoutSchedulerService.test.ts` dengan test lifecycle:

```ts
it("cancels the previous delayed job before rescheduling", async () => {
  prismaMock.overtimeAutoCheckoutSchedule.findUnique.mockResolvedValueOnce({
    id: "schedule-1",
    overtimeId: "overtime-1",
    version: 2,
    jobId: "overtime:auto-checkout:schedule-1:v2",
    scheduledFor: new Date("2026-04-19T18:00:00.000Z"),
    scheduleStatus: "SCHEDULED",
  } as never);

  prismaMock.overtimeAutoCheckoutSchedule.upsert.mockResolvedValueOnce({
    id: "schedule-1",
    overtimeId: "overtime-1",
    version: 3,
    jobId: null,
    scheduledFor: new Date("2026-04-19T19:00:00.000Z"),
    scheduleStatus: "SCHEDULED",
  } as never);

  const removeJob = vi.fn().mockResolvedValue(undefined);
  vi.doMock("@/lib/event-bus/queues", async () => {
    const actual = await vi.importActual("@/lib/event-bus/queues");
    return {
      ...actual,
      removeOvertimeAutoCheckoutJob: removeJob,
      addOvertimeAutoCheckoutJob: queueAdd,
    };
  });

  const { OvertimeAutoCheckoutSchedulerService } = await import(
    "@/modules/overtime/services/OvertimeAutoCheckoutSchedulerService"
  );

  const service = new OvertimeAutoCheckoutSchedulerService();
  await service.schedule({
    overtimeId: "overtime-1",
    startTime: new Date("2026-04-19T11:00:00.000Z"),
  });

  expect(removeJob).toHaveBeenCalledWith("overtime:auto-checkout:schedule-1:v2");
  expect(queueAdd).toHaveBeenCalledWith(
    expect.objectContaining({ version: 3 }),
    expect.objectContaining({ jobId: "overtime:auto-checkout:schedule-1:v3" }),
  );
});

it("marks the schedule as cancelled when overtime stops manually", async () => {
  prismaMock.overtimeAutoCheckoutSchedule.findUnique.mockResolvedValueOnce({
    overtimeId: "overtime-1",
    jobId: "overtime:auto-checkout:schedule-1:v3",
    scheduleStatus: "SCHEDULED",
  } as never);

  const removeJob = vi.fn().mockResolvedValue(undefined);

  const { OvertimeAutoCheckoutSchedulerService } = await import(
    "@/modules/overtime/services/OvertimeAutoCheckoutSchedulerService"
  );

  const service = new OvertimeAutoCheckoutSchedulerService();
  await service.cancel("overtime-1");

  expect(prismaMock.overtimeAutoCheckoutSchedule.updateMany).toHaveBeenCalled();
  expect(removeJob).toHaveBeenCalledWith("overtime:auto-checkout:schedule-1:v3");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- tests/modules/overtime/OvertimeAutoCheckoutSchedulerService.test.ts
```

Expected:
- FAIL karena service scheduler belum punya logika reschedule/cancel dan ekspor modul belum ada

- [ ] **Step 3: Write minimal implementation**

Buat `modules/overtime/services/OvertimeAutoCheckoutSchedulerService.ts`:

```ts
import { OvertimeRepository } from "../repositories/OvertimeRepository";
import {
  addOvertimeAutoCheckoutJob,
  removeOvertimeAutoCheckoutJob,
} from "@/lib/event-bus/queues";

const MAX_OVERTIME_DURATION_MS = 8 * 60 * 60 * 1000;

export class OvertimeAutoCheckoutSchedulerService {
  private repository = new OvertimeRepository();

  async schedule(input: { overtimeId: string; startTime: Date }) {
    const existing = await this.repository.findAutoCheckoutScheduleByOvertimeId(
      input.overtimeId,
    );

    if (existing?.jobId) {
      await removeOvertimeAutoCheckoutJob(existing.jobId);
    }

    const scheduledFor = new Date(
      input.startTime.getTime() + MAX_OVERTIME_DURATION_MS,
    );

    const schedule = await this.repository.upsertAutoCheckoutSchedule({
      overtimeId: input.overtimeId,
      scheduledFor,
      jobId: null,
    });

    const jobId = `overtime:auto-checkout:${schedule.id}:v${schedule.version}`;
    const delay = Math.max(scheduledFor.getTime() - Date.now(), 0);

    await addOvertimeAutoCheckoutJob(
      {
        overtimeId: input.overtimeId,
        scheduleId: schedule.id,
        version: schedule.version,
      },
      { jobId, delay },
    );

    await this.repository.attachAutoCheckoutJobId(input.overtimeId, jobId);

    return { ...schedule, jobId, scheduledFor };
  }

  async cancel(overtimeId: string) {
    const schedule = await this.repository.findAutoCheckoutScheduleByOvertimeId(
      overtimeId,
    );

    if (schedule?.jobId) {
      await removeOvertimeAutoCheckoutJob(schedule.jobId);
    }

    await this.repository.cancelAutoCheckoutSchedule({
      overtimeId,
      cancelledAt: new Date(),
    });
  }
}
```

Tambahkan ekspor di `modules/overtime/index.ts`:

```ts
export * from "./services/OvertimeAutoCheckoutSchedulerService";
```

Tambahkan helper repository yang dipakai service:

```ts
async findAutoCheckoutScheduleByOvertimeId(overtimeId: string) {
  return prisma.overtimeAutoCheckoutSchedule.findUnique({ where: { overtimeId } });
}

async attachAutoCheckoutJobId(overtimeId: string, jobId: string) {
  return prisma.overtimeAutoCheckoutSchedule.update({
    where: { overtimeId },
    data: { jobId },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:run -- tests/modules/overtime/OvertimeAutoCheckoutSchedulerService.test.ts
```

Expected:
- PASS
- Scheduler service berhasil create/reschedule/cancel metadata dan delayed job

- [ ] **Step 5: Commit**

```bash
git add modules/overtime/services/OvertimeAutoCheckoutSchedulerService.ts modules/overtime/index.ts modules/overtime/repositories/OvertimeRepository.ts tests/modules/overtime/OvertimeAutoCheckoutSchedulerService.test.ts
git commit -m "feat: add overtime auto checkout scheduler service"
```

## Task 4: Hubungkan lifecycle overtime start dan stop ke scheduler service

**Files:**
- Modify: `modules/overtime/services/OvertimeService.ts:88-200`
- Modify: `tests/modules/overtime/OvertimeService.test.ts:1-255`

- [x] **Step 1: Write the failing test**

Tambahkan test berikut ke `tests/modules/overtime/OvertimeService.test.ts`:

```ts
const mockScheduler = {
  schedule: vi.fn(),
  cancel: vi.fn(),
};

vi.mock("@/modules/overtime/services/OvertimeAutoCheckoutSchedulerService", () => ({
  OvertimeAutoCheckoutSchedulerService: class MockScheduler {
    schedule = mockScheduler.schedule;
    cancel = mockScheduler.cancel;
  },
}));

it("schedules auto checkout when overtime starts", async () => {
  const startTime = new Date("2026-04-19T10:00:00.000Z");

  mockOvertimeRepo.findById.mockResolvedValueOnce({
    id: "overtime-1",
    userId: "user-1",
    status: OvertimeStatus.APPROVED,
  });
  mockOvertimeRepo.update.mockResolvedValueOnce({
    id: "overtime-1",
    userId: "user-1",
    status: OvertimeStatus.IN_PROGRESS,
    startTime,
  });
  prismaMock.attendance.findFirst.mockResolvedValue(null as never);

  await service.startOvertime("user-1", "overtime-1", {
    photo: "start.jpg",
    timestamp: startTime,
    tenantId: "tenant-1",
  });

  expect(mockScheduler.schedule).toHaveBeenCalledWith({
    overtimeId: "overtime-1",
    startTime,
  });
});

it("cancels auto checkout schedule when overtime stops manually", async () => {
  mockOvertimeRepo.findById.mockResolvedValueOnce({
    id: "overtime-1",
    userId: "user-1",
    status: OvertimeStatus.IN_PROGRESS,
    startTime: new Date("2026-04-19T10:00:00.000Z"),
  });
  mockOvertimeRepo.update.mockResolvedValueOnce({
    id: "overtime-1",
    status: OvertimeStatus.COMPLETED,
    duration: 120,
  });

  await service.stopOvertime("user-1", "overtime-1", {
    photo: "stop.jpg",
    timestamp: new Date("2026-04-19T12:00:00.000Z"),
  });

  expect(mockScheduler.cancel).toHaveBeenCalledWith("overtime-1");
});
```

- [x] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- tests/modules/overtime/OvertimeService.test.ts
```

Expected:
- FAIL karena `OvertimeService` belum memanggil scheduler service saat start/stop

- [x] **Step 3: Write minimal implementation**

Update constructor dan lifecycle method di `modules/overtime/services/OvertimeService.ts`:

```ts
import { OvertimeAutoCheckoutSchedulerService } from "./OvertimeAutoCheckoutSchedulerService";

export class OvertimeService {
  private repository: OvertimeRepository;
  private holidayRepository: HolidayRepository;
  private userRepository: UserRepository;
  private attendanceRepository: AttendanceRepository;
  private autoCheckoutScheduler: OvertimeAutoCheckoutSchedulerService;

  constructor() {
    this.repository = new OvertimeRepository();
    this.holidayRepository = new HolidayRepository();
    this.userRepository = new UserRepository();
    this.attendanceRepository = new AttendanceRepository();
    this.autoCheckoutScheduler = new OvertimeAutoCheckoutSchedulerService();
  }
```

Setelah update start overtime berhasil, jadwalkan auto-checkout:

```ts
    const startedOvertime = await this.repository.update(overtimeId, {
      status: OvertimeStatus.IN_PROGRESS,
      startTime: data.timestamp || new Date(),
      startPhoto: data.photo,
      startLocation: data.location,
      attendance: attendance ? { connect: { id: attendance.id } } : undefined,
      isHolidayOvertime: isHoliday || isOffDay,
      isNationalHoliday: isHoliday && holiday?.isNational === true,
      isOffDay: isOffDay && !isHoliday,
      holidayDescription: holidayDesc,
    });

    if (!startedOvertime.startTime) {
      throw new Error("Data Start Time corrupt.");
    }

    await this.autoCheckoutScheduler.schedule({
      overtimeId: startedOvertime.id,
      startTime: new Date(startedOvertime.startTime),
    });

    return startedOvertime;
```

Setelah stop overtime berhasil, batalkan schedule:

```ts
    const completedOvertime = await this.repository.update(overtimeId, {
      status: OvertimeStatus.COMPLETED,
      endTime,
      endPhoto: data.photo,
      endLocation: data.location,
      duration: validDuration,
    });

    await this.autoCheckoutScheduler.cancel(overtimeId);

    return completedOvertime;
```

- [x] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:run -- tests/modules/overtime/OvertimeService.test.ts
```

Expected:
- PASS
- Overtime start menjadwalkan delayed job, stop manual membatalkan schedule

- [ ] **Step 5: Commit**

```bash
git add modules/overtime/services/OvertimeService.ts tests/modules/overtime/OvertimeService.test.ts
git commit -m "feat: connect overtime lifecycle to auto checkout scheduler"
```

## Task 5: Ubah executor auto-checkout menjadi worker satu schedule spesifik

**Files:**
- Modify: `modules/overtime/services/OvertimeAutoCheckoutService.ts`
- Modify: `tests/modules/overtime/OvertimeAutoCheckoutService.test.ts`

- [x] **Step 1: Write the failing test**

Ganti test `tests/modules/overtime/OvertimeAutoCheckoutService.test.ts` menjadi kontrak execute-by-job:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OvertimeStatus } from "@prisma/client";

const mockOvertimeRepo = {
  findById: vi.fn(),
  update: vi.fn(),
  findAutoCheckoutScheduleById: vi.fn(),
  completeAutoCheckoutSchedule: vi.fn(),
};

vi.mock("@/modules/overtime/repositories/OvertimeRepository", () => ({
  OvertimeRepository: class MockOvertimeRepository {
    findById = mockOvertimeRepo.findById;
    update = mockOvertimeRepo.update;
    findAutoCheckoutScheduleById = mockOvertimeRepo.findAutoCheckoutScheduleById;
    completeAutoCheckoutSchedule = mockOvertimeRepo.completeAutoCheckoutSchedule;
  },
}));

describe("OvertimeAutoCheckoutService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T18:00:00.000Z"));
  });

  it("completes one overtime when schedule is still active and version matches", async () => {
    mockOvertimeRepo.findAutoCheckoutScheduleById.mockResolvedValueOnce({
      id: "schedule-1",
      overtimeId: "overtime-1",
      version: 3,
      scheduledFor: new Date("2026-04-19T18:00:00.000Z"),
      scheduleStatus: "SCHEDULED",
    });
    mockOvertimeRepo.findById.mockResolvedValueOnce({
      id: "overtime-1",
      status: OvertimeStatus.IN_PROGRESS,
      startTime: new Date("2026-04-19T10:00:00.000Z"),
    });

    const { OvertimeAutoCheckoutService } = await import(
      "@/modules/overtime/services/OvertimeAutoCheckoutService"
    );

    const result = await OvertimeAutoCheckoutService.runScheduledAutoCheckout({
      overtimeId: "overtime-1",
      scheduleId: "schedule-1",
      version: 3,
    });

    expect(mockOvertimeRepo.update).toHaveBeenCalledWith("overtime-1", {
      status: OvertimeStatus.COMPLETED,
      endTime: new Date("2026-04-19T18:00:00.000Z"),
      duration: 480,
    });
    expect(mockOvertimeRepo.completeAutoCheckoutSchedule).toHaveBeenCalledWith({
      overtimeId: "overtime-1",
      executedAt: new Date("2026-04-19T18:00:00.000Z"),
      scheduleStatus: "COMPLETED",
      lastError: null,
    });
    expect(result).toBe("completed");
  });

  it("skips stale jobs when schedule version no longer matches", async () => {
    mockOvertimeRepo.findAutoCheckoutScheduleById.mockResolvedValueOnce({
      id: "schedule-1",
      overtimeId: "overtime-1",
      version: 4,
      scheduledFor: new Date("2026-04-19T18:00:00.000Z"),
      scheduleStatus: "SCHEDULED",
    });

    const { OvertimeAutoCheckoutService } = await import(
      "@/modules/overtime/services/OvertimeAutoCheckoutService"
    );

    const result = await OvertimeAutoCheckoutService.runScheduledAutoCheckout({
      overtimeId: "overtime-1",
      scheduleId: "schedule-1",
      version: 3,
    });

    expect(mockOvertimeRepo.update).not.toHaveBeenCalled();
    expect(result).toBe("skipped");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- tests/modules/overtime/OvertimeAutoCheckoutService.test.ts
```

Expected:
- FAIL karena service masih scan `findAll()` dan belum mendukung payload schedule/version

- [x] **Step 3: Write minimal implementation**

Ganti isi `modules/overtime/services/OvertimeAutoCheckoutService.ts` menjadi executor satu job:

```ts
import { OvertimeStatus } from "@prisma/client";
import { OvertimeRepository } from "../repositories/OvertimeRepository";
import type { OvertimeAutoCheckoutJobData } from "@/lib/event-bus/queues";

export const MAX_OVERTIME_DURATION_MINUTES = 8 * 60;

export class OvertimeAutoCheckoutService {
  static async runScheduledAutoCheckout(
    job: OvertimeAutoCheckoutJobData,
  ): Promise<"completed" | "skipped"> {
    const overtimeRepository = new OvertimeRepository();
    const schedule = await overtimeRepository.findAutoCheckoutScheduleById(
      job.scheduleId,
    );

    if (!schedule || schedule.scheduleStatus !== "SCHEDULED") {
      return "skipped";
    }

    if (schedule.overtimeId !== job.overtimeId || schedule.version !== job.version) {
      return "skipped";
    }

    const now = new Date();
    if (schedule.scheduledFor.getTime() > now.getTime()) {
      return "skipped";
    }

    const overtime = await overtimeRepository.findById(job.overtimeId);
    if (!overtime || overtime.status !== OvertimeStatus.IN_PROGRESS) {
      return "skipped";
    }

    await overtimeRepository.update(job.overtimeId, {
      status: OvertimeStatus.COMPLETED,
      endTime: schedule.scheduledFor,
      duration: MAX_OVERTIME_DURATION_MINUTES,
    });

    await overtimeRepository.completeAutoCheckoutSchedule({
      overtimeId: job.overtimeId,
      executedAt: now,
      scheduleStatus: "COMPLETED",
      lastError: null,
    });

    return "completed";
  }
}
```

Tambahkan helper repository yang diperlukan:

```ts
async findAutoCheckoutScheduleById(id: string) {
  return prisma.overtimeAutoCheckoutSchedule.findUnique({ where: { id } });
}

async completeAutoCheckoutSchedule(input: {
  overtimeId: string;
  executedAt: Date;
  scheduleStatus: "COMPLETED" | "FAILED";
  lastError: string | null;
}) {
  return prisma.overtimeAutoCheckoutSchedule.update({
    where: { overtimeId: input.overtimeId },
    data: {
      scheduleStatus: input.scheduleStatus,
      executedAt: input.executedAt,
      lastError: input.lastError,
      jobId: null,
    },
  });
}
```

- [x] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:run -- tests/modules/overtime/OvertimeAutoCheckoutService.test.ts
```

Expected:
- PASS
- Executor hanya memproses satu job schedule dan skip aman untuk stale state

- [ ] **Step 5: Commit**

```bash
git add modules/overtime/services/OvertimeAutoCheckoutService.ts modules/overtime/repositories/OvertimeRepository.ts tests/modules/overtime/OvertimeAutoCheckoutService.test.ts
git commit -m "feat: execute overtime auto checkout per delayed job"
```

## Task 6: Tambah worker BullMQ dan startup rehydration untuk overtime auto-checkout

**Files:**
- Modify: `lib/event-bus/workers.ts:564-648`
- Modify: `lib/event-bus/index.ts:124-147`
- Create: `tests/lib/event-bus/overtime-auto-checkout-worker.test.ts`
- Modify: `modules/overtime/repositories/OvertimeRepository.ts`

- [x] **Step 1: Write the failing test**

Buat `tests/lib/event-bus/overtime-auto-checkout-worker.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "../../setup";

const workerCtor = vi.fn();
const addJob = vi.fn();

vi.mock("bullmq", () => ({
  Worker: workerCtor,
  Queue: vi.fn().mockImplementation(() => ({ add: addJob })),
}));

vi.mock("ioredis", () => ({
  default: vi.fn().mockImplementation(() => ({
    duplicate: vi.fn().mockReturnThis(),
    on: vi.fn(),
  })),
}));

describe("overtime auto checkout BullMQ worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts a dedicated worker for overtime auto checkout queue", async () => {
    const { startWorkers } = await import("@/lib/event-bus/workers");

    startWorkers();

    expect(workerCtor).toHaveBeenCalledWith(
      "radpro-overtime-auto-checkout",
      expect.any(Function),
      expect.objectContaining({ concurrency: 5 }),
    );
  });

  it("rehydrates scheduled overtime jobs on startup", async () => {
    prismaMock.overtimeAutoCheckoutSchedule.findMany.mockResolvedValueOnce([
      {
        id: "schedule-1",
        overtimeId: "overtime-1",
        version: 2,
        scheduledFor: new Date("2026-04-19T18:00:00.000Z"),
        jobId: null,
        scheduleStatus: "SCHEDULED",
      },
    ] as never);

    const { initializeEventBus } = await import("@/lib/event-bus");
    await initializeEventBus();

    expect(addJob).toHaveBeenCalledWith(
      "overtime-auto-checkout",
      {
        overtimeId: "overtime-1",
        scheduleId: "schedule-1",
        version: 2,
      },
      expect.objectContaining({
        jobId: "overtime:auto-checkout:schedule-1:v2",
      }),
    );
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- tests/lib/event-bus/overtime-auto-checkout-worker.test.ts
```

Expected:
- FAIL karena worker BullMQ overtime dan startup rehydration belum ada

- [x] **Step 3: Write minimal implementation**

Tambahkan helper repository untuk membaca schedule aktif yang perlu direhydrate:

```ts
async findSchedulesForRehydration(now: Date) {
  return prisma.overtimeAutoCheckoutSchedule.findMany({
    where: {
      scheduleStatus: "SCHEDULED",
      OR: [
        { jobId: null },
        { scheduledFor: { lte: now } },
      ],
    },
    orderBy: { scheduledFor: "asc" },
  });
}
```

Tambahkan function rehydration di `lib/event-bus/workers.ts`:

```ts
export async function rehydrateOvertimeAutoCheckoutJobs(): Promise<void> {
  const { OvertimeRepository } = await import("@/modules/overtime/repositories/OvertimeRepository");
  const { addOvertimeAutoCheckoutJob } = await import("./queues");

  const repository = new OvertimeRepository();
  const schedules = await repository.findSchedulesForRehydration(new Date());

  for (const schedule of schedules) {
    const jobId = `overtime:auto-checkout:${schedule.id}:v${schedule.version}`;
    const delay = Math.max(schedule.scheduledFor.getTime() - Date.now(), 0);

    await addOvertimeAutoCheckoutJob(
      {
        overtimeId: schedule.overtimeId,
        scheduleId: schedule.id,
        version: schedule.version,
      },
      { jobId, delay },
    );

    await repository.attachAutoCheckoutJobId(schedule.overtimeId, jobId);
  }
}
```

Tambahkan worker baru di `startWorkers()`:

```ts
  const overtimeAutoCheckoutWorker = new Worker<OvertimeAutoCheckoutJobData>(
    QUEUE_NAMES.OVERTIME_AUTO_CHECKOUT,
    async (job) => {
      const { OvertimeAutoCheckoutService } = await import(
        "@/modules/overtime/services/OvertimeAutoCheckoutService"
      );
      await OvertimeAutoCheckoutService.runScheduledAutoCheckout(job.data);
    },
    {
      connection: connection.duplicate(),
      concurrency: 5,
    },
  );
```

Masukkan worker itu ke array `workers`.

Panggil rehydration pada `lib/event-bus/index.ts`:

```ts
export async function initializeEventBus(): Promise<void> {
  const { startWorkers, rehydrateOvertimeAutoCheckoutJobs } = await import("./workers");
  const { startOutboxProcessor } = await import("./outbox-processor");

  startWorkers();
  await rehydrateOvertimeAutoCheckoutJobs();
  startOutboxProcessor();

  console.log("[EventBus] Initialized: workers + overtime rehydration + outbox processor");
}
```

- [x] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:run -- tests/lib/event-bus/overtime-auto-checkout-worker.test.ts
```

Expected:
- PASS
- Worker overtime BullMQ hidup dan startup rehydration menambah delayed job dari metadata DB

- [ ] **Step 5: Commit**

```bash
git add lib/event-bus/workers.ts lib/event-bus/index.ts modules/overtime/repositories/OvertimeRepository.ts tests/lib/event-bus/overtime-auto-checkout-worker.test.ts
git commit -m "feat: add overtime auto checkout worker rehydration"
```

## Task 7: Hapus cron overtime lama dan tambahkan regression test

**Files:**
- Modify: `lib/cron-registry.ts:84-107`
- Modify: `tests/lib/cron-registry-lock.test.ts`

- [x] **Step 1: Write the failing test**

Tambahkan assertion berikut ke `tests/lib/cron-registry-lock.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("does not keep the legacy overtime auto checkout cron registration", () => {
  const file = readFileSync(
    resolve(process.cwd(), "lib/cron-registry.ts"),
    "utf8",
  );

  expect(file).not.toContain("overtimeAutoCheckout");
  expect(file).not.toContain('"[Cron] Running overtime auto-checkout"');
  expect(file).not.toContain('"* * * * *"');
});
```

- [x] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test:run -- tests/lib/cron-registry-lock.test.ts
```

Expected:
- FAIL karena cron overtime auto-checkout masih terdaftar di `lib/cron-registry.ts`

- [x] **Step 3: Write minimal implementation**

Hapus blok berikut dari `lib/cron-registry.ts`:

```ts
    import("../modules/overtime/services/OvertimeAutoCheckoutService")
      .then(({ OvertimeAutoCheckoutService }) => {
        const overtimeAutoCheckoutTask = cron.schedule(
          "* * * * *",
          async () => {
            if (!(await canRunCronJob("overtimeAutoCheckout", 55))) return;
            console.log("[Cron] Running overtime auto-checkout");
            OvertimeAutoCheckoutService.runAutoCheckout().catch((err) =>
              console.error("[Cron] Overtime auto-checkout failed:", err),
            );
          },
        );
        this.tasks.set("overtimeAutoCheckout", overtimeAutoCheckoutTask);
        console.log(
          "[CronRegistry] Overtime auto checkout cron scheduled (Every minute)",
        );
      })
      .catch((err) =>
        console.error(
          "[CronRegistry] Failed to start Overtime Auto Checkout Service:",
          err,
        ),
      );
```

Tidak perlu menambahkan fallback cron baru untuk overtime.

- [x] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test:run -- tests/lib/cron-registry-lock.test.ts
```

Expected:
- PASS
- Registry cron sudah bersih dari overtime auto-checkout legacy

- [ ] **Step 5: Commit**

```bash
git add lib/cron-registry.ts tests/lib/cron-registry-lock.test.ts
git commit -m "refactor: remove overtime auto checkout cron"
```

## Task 8: Jalankan suite overtime dan BullMQ terkait sebagai verifikasi akhir

**Files:**
- Modify: `docs/superpowers/plans/2026-04-19-overtime-auto-checkout-delayed-job.md` (centang progres saat eksekusi)

- [x] **Step 1: Run focused overtime test suite**

Run:
```bash
npm run test:run -- tests/modules/overtime/OvertimeService.test.ts tests/modules/overtime/OvertimeAutoCheckoutService.test.ts tests/modules/overtime/OvertimeAutoCheckoutSchedulerService.test.ts
```

Expected:
- PASS
- Lifecycle overtime, scheduler service, dan delayed executor sama-sama hijau

- [x] **Step 2: Run focused BullMQ and cron regression tests**

Run:
```bash
npm run test:run -- tests/lib/event-bus/overtime-auto-checkout-worker.test.ts tests/lib/cron-registry-lock.test.ts tests/lib/event-bus/queues-bullmq-redis-contract.test.ts
```

Expected:
- PASS
- Worker overtime, queue contract, dan penghapusan cron legacy tervalidasi

- [x] **Step 3: Run Prisma client generation**

Run:
```bash
npm run prisma:generate
```

Expected:
- PASS
- Client Prisma utama dan client tambahan berhasil regenerate dengan model baru

- [x] **Step 4: Run typecheck**

Run:
```bash
npm run typecheck
```

Expected:
- PASS
- Semua penambahan type queue, repository, dan Prisma model konsisten

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma modules/overtime lib/event-bus lib/cron-registry.ts tests docs/superpowers/plans/2026-04-19-overtime-auto-checkout-delayed-job.md
git commit -m "feat: move overtime auto checkout to delayed jobs"
```

## Self-review

- Spec coverage: plan menutup seluruh requirement spec — metadata PostgreSQL, delayed BullMQ job, lifecycle create/reschedule/cancel, execute-by-version, startup rehydration, penghapusan cron, dan verifikasi test.
- Placeholder scan: tidak ada `TODO`, `TBD`, atau langkah tanpa file path/perintah test; setiap task punya code block dan command konkret.
- Type consistency: plan memakai nama yang konsisten untuk model `OvertimeAutoCheckoutSchedule`, enum `OvertimeAutoCheckoutScheduleStatus`, method repository (`findAutoCheckoutScheduleByOvertimeId`, `attachAutoCheckoutJobId`, `completeAutoCheckoutSchedule`), payload queue `OvertimeAutoCheckoutJobData`, dan service `OvertimeAutoCheckoutSchedulerService`.
