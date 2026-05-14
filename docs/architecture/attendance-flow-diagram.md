# Attendance System — Flow Diagram

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ATTENDANCE SYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [Mobile App]          [Admin Panel]          [Cron Jobs]                │
│       │                     │                      │                     │
│       ▼                     ▼                      ▼                     │
│  ┌─────────┐         ┌──────────┐          ┌────────────┐              │
│  │Check-In │         │  Leave   │          │Orchestrator│              │
│  │Check-Out│         │ Approve/ │          │  (15 min)  │              │
│  │Location │         │  Reject  │          └─────┬──────┘              │
│  │Leave Req│         │  Edit    │                │                      │
│  └────┬────┘         └────┬─────┘          ┌─────┴──────────┐         │
│       │                   │                 │                 │         │
│       ▼                   ▼                 ▼                 ▼         │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │              SERVICE LAYER (Business Logic)                   │       │
│  ├─────────────────────────────────────────────────────────────┤       │
│  │  AttendanceMutationService  │  LeaveLifecycleService         │       │
│  │  AutoCheckoutService        │  AbsenceService                │       │
│  │  GeofenceService            │  LeaveAttendanceSyncService    │       │
│  │  AttendanceEvaluationService│  AttendanceAlertService        │       │
│  └──────────────────────┬──────────────────────────────────────┘       │
│                          │                                              │
│                          ▼                                              │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │              REPOSITORY LAYER (Data Access)                   │       │
│  └──────────────────────┬──────────────────────────────────────┘       │
│                          │                                              │
│                          ▼                                              │
│  ┌──────────┐    ┌───────────┐    ┌───────────┐                       │
│  │PostgreSQL│    │   Redis   │    │  Firebase  │                       │
│  │(Prisma)  │    │(Lock/Cache)│   │(Realtime)  │                       │
│  └──────────┘    └───────────┘    └───────────┘                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Flow 1: Check-In (Mobile → Backend)

```
┌──────────────────────────────────────────────────────────────────────┐
│ MOBILE APP                                                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  1. Face Detection (Camera)                                            │
│       │                                                                │
│  2. Capture Photo + Watermark (timestamp, location)                    │
│       │                                                                │
│  3. Resolve Location (GPS, max 60s stale)                              │
│       │                                                                │
│  4. Geofence Check (local)                                             │
│       ├── STRICT + Outside → BLOCK                                     │
│       ├── WARN + Outside   → Confirm Modal                             │
│       └── DISABLED/Inside  → Proceed                                   │
│       │                                                                │
│  5. Generate Idempotency Key (att-{timestamp}-{random6})               │
│       │                                                                │
│  6. Online Check                                                       │
│       ├── OFFLINE → Queue to SyncService (replay later)                │
│       └── ONLINE  → Upload Photo → POST /api/mobile/attendance/check-in│
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ BACKEND: Check-In Route Service                                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  1. Parse Payload (JSON/multipart)                                     │
│       │                                                                │
│  2. Resolve Timezone (per tenant, cached in Redis)                     │
│       │                                                                │
│  3. Idempotency Check (Redis)                                          │
│       ├── "completed"    → Return cached replay                        │
│       ├── "in-progress"  → Return 409 Conflict                         │
│       ├── "hash-mismatch"→ Return error                                │
│       └── "new"          → Proceed                                     │
│       │                                                                │
│  4. AttendanceMutationService.checkIn()                                │
│       │                                                                │
│       ├── 4a. Validate Coordinates                                     │
│       ├── 4b. Validate Eligibility (leave? holiday? off-day?)          │
│       ├── 4c. Auto-close stale sessions (SessionGuard)                 │
│       ├── 4d. Assert no active session (prevent duplicate)             │
│       ├── 4e. Validate time window                                     │
│       ├── 4f. Geofence validation (server-side, Haversine)             │
│       │         ├── STRICT + Outside → throw OUTSIDE_GEOFENCE          │
│       │         ├── WARN + Outside   → proceed with warning            │
│       │         └── Inside           → proceed                         │
│       ├── 4g. Resolve status (ON_TIME / LATE)                          │
│       ├── 4h. Create attendance record (DB write)                      │
│       ├── 4i. Publish check-in event                                   │
│       └── 4j. Evaluate attendance (recompute canonical status)         │
│       │                                                                │
│  5. Complete Idempotency (store response in Redis)                     │
│       │                                                                │
│  6. Return success + attendance data                                   │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ MOBILE APP: Post Check-In                                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  1. Start Background Location Tracking                                 │
│       └── Adaptive interval (battery-aware: 5min–1hr)                  │
│       └── POST /api/mobile/location (batch or single)                  │
│       └── Deduplication: skip if < 20m moved AND < 30min since last    │
│                                                                        │
│  2. Update UI (show check-out button)                                  │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Flow 2: Check-Out (Mobile → Backend)

```
┌──────────────────────────────────────────────────────────────────────┐
│ MOBILE APP                                                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Same as Check-In: Photo → Location → Idempotency Key → Upload → POST │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ BACKEND: Check-Out Route Service                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  1. Parse Payload                                                      │
│  2. Idempotency Check (same as check-in)                               │
│  3. AttendanceMutationService.checkOut()                               │
│       ├── Find active session (throw NO_ACTIVE_SESSION if none)        │
│       ├── Resolve check-out time (offlineTime or now)                  │
│       ├── Geofence validation                                          │
│       ├── Update attendance record (checkOut, photo, location)         │
│       ├── Evaluate attendance (recompute status)                       │
│       └── Publish check-out event                                      │
│  4. Complete Idempotency                                               │
│  5. Return success + evaluation data                                   │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ MOBILE APP: Post Check-Out                                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  1. Stop Background Location Tracking                                  │
│  2. Show warning modal (if geofence WARN + outside)                    │
│  3. Update UI (show check-in button)                                   │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Flow 3: Cron Orchestration (Automated Processes)

```
┌──────────────────────────────────────────────────────────────────────┐
│ CRON TRIGGER (every 15 minutes)                                       │
│ POST /api/cron/attendance-orchestrator                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  getDueAttendanceCronJobs(now, timezone = "Asia/Jakarta")              │
│       │                                                                │
│       ├── ALWAYS: "auto-checkout"                                      │
│       ├── IF minute % 15 === 0: "attendance-alert:auto"                │
│       ├── IF 22:00: "attendance-alert:process"                         │
│       └── IF 01:00: "process-absence"                                  │
│                                                                        │
│  Execute SEQUENTIALLY (not parallel, prevents race conditions):        │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
         │              │                │               │
         ▼              ▼                ▼               ▼
┌─────────────┐ ┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│ Auto-Alert  │ │Alert:Process │ │Process      │ │Auto-Checkout │
│ (15 min)    │ │(22:00 daily) │ │Absence      │ │(every tick)  │
│             │ │              │ │(01:00 daily)│ │              │
│ • Check-in  │ │ • Process    │ │             │ │ • Find open  │
│   reminders │ │   incomplete │ │ • Mark      │ │   sessions   │
│ • Check-out │ │   sessions   │ │   ABSENT    │ │ • Enqueue    │
│   reminders │ │ • Auto-alpha │ │ • Mark      │ │   auto-close │
│ • Flexible  │ │   (FIXED     │ │   DAY_OFF   │ │   jobs       │
│   hour alert│ │   hour users)│ │ • Skip      │ │ • Execute    │
│             │ │              │ │   holidays  │ │   when due   │
└─────────────┘ └──────────────┘ └─────────────┘ └──────────────┘
```

---

## Flow 4: Leave Request Lifecycle

```
┌──────────────────────────────────────────────────────────────────────┐
│ LEAVE REQUEST LIFECYCLE                                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────┐     ┌─────────┐     ┌──────────┐     ┌──────────┐      │
│  │ CREATE  │────▶│ PENDING │────▶│ APPROVED │     │ REJECTED │      │
│  └─────────┘     └────┬────┘     └────┬─────┘     └──────────┘      │
│                        │               │                  ▲            │
│                        │               │                  │            │
│                        ├───────────────┼──────────────────┘            │
│                        │               │                               │
│                        ▼               ▼                               │
│              ┌──────────────┐  ┌──────────────────┐                   │
│              │ Auto-Reject  │  │ Attendance Sync  │                   │
│              │ (deadline)   │  │ (create records) │                   │
│              └──────────────┘  └──────────────────┘                   │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘

DETAIL:

[CREATE] Employee submits leave request
  │
  ├── Validate: overlap check, quota check, tukar libur rules
  ├── Upload attachments (if SAKIT/IZIN)
  ├── Save as PENDING
  └── Notify approvers

[PENDING] Waiting for approval
  │
  ├── Reminder Cron (hourly):
  │     ├── Determine category: mendadak / normal / advance
  │     ├── Determine stage: first / second / final
  │     └── Send notification to approvers
  │
  └── Auto-Reject Cron (hourly):
        ├── Check if past deadline
        └── If yes → rejectLeave() → refund balance → revert attendance

[APPROVED] Admin approves
  │
  ├── Update status → APPROVED
  ├── Decrement leave balance
  ├── Sync to attendance:
  │     For each date in range:
  │       ├── Skip holidays, non-work days, before join date
  │       ├── SAKIT       → create SICK attendance
  │       ├── TUKAR_LIBUR → create DAY_OFF attendance
  │       └── Others      → create PERMIT attendance
  └── Notify employee

[REJECTED] Admin rejects (or auto-reject)
  │
  ├── If was APPROVED: refund leave balance
  ├── Update status → REJECTED
  ├── Revert attendance (delete synced records)
  └── Notify employee
```

---

## Flow 5: Reminder & Auto-Reject Timeline

```
┌──────────────────────────────────────────────────────────────────────┐
│ TIMELINE CATEGORIES                                                   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ MENDADAK (< 8 jam sebelum startDate)                             │  │
│  │                                                                   │  │
│  │  Submit ──── Reminder 1 ──── Reminder 2 ──── AUTO-REJECT         │  │
│  │         4h before        6h before       8h before startDate     │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ NORMAL (1-7 hari sebelum startDate)                              │  │
│  │                                                                   │  │
│  │  Submit ──── Reminder 1 ──── Reminder 2 ──── AUTO-REJECT         │  │
│  │         3d before        2d before       1d before startDate     │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ ADVANCE (> 7 hari sebelum startDate)                             │  │
│  │                                                                   │  │
│  │  Submit ── Rem 1 ── Rem 2 ── Rem 3 ──── AUTO-REJECT             │  │
│  │        7d       3d       1d         1d before startDate          │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  * Semua threshold configurable per tenant via TenantSettings          │
│  * Default values digunakan jika tenant belum konfigurasi              │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Flow 6: Location Tracking (Background)

```
┌──────────────────────────────────────────────────────────────────────┐
│ BACKGROUND LOCATION TRACKING                                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [Check-In Success] → startTracking()                                  │
│       │                                                                │
│       ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────┐      │
│  │ expo-task-manager: BACKGROUND_LOCATION_TASK                  │      │
│  │                                                               │      │
│  │  On each location update:                                     │      │
│  │    1. Check permission (stop if revoked)                      │      │
│  │    2. Adaptive interval (battery-aware):                      │      │
│  │         Battery < 15% → 1hr / 500m                            │      │
│  │         Battery < 30% → 30min / 200m                          │      │
│  │         Battery < 50% → 15min / 100m                          │      │
│  │         Battery ≥ 50% moving → 5min / 50m                     │      │
│  │         Battery ≥ 50% stationary → 10min / 100m               │      │
│  │    3. Deduplication: skip if < 20m AND < 30min                │      │
│  │    4. POST /api/mobile/location                               │      │
│  │         ├── Success: check shouldStopTracking                 │      │
│  │         ├── Offline: queue to pending (max 100)               │      │
│  │         └── Error: log, continue                              │      │
│  └─────────────────────────────────────────────────────────────┘      │
│       │                                                                │
│       ▼                                                                │
│  [Check-Out Success] → stopTracking()                                  │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘

BACKEND: POST /api/mobile/location
  │
  ├── Verify user is checked in (shouldStopTracking if not)
  ├── Save location (single or batch)
  ├── Publish to Firebase Realtime (live map)
  └── Return { shouldStopTracking: boolean }
```

---

## Flow 7: Offline Sync (Mobile)

```
┌──────────────────────────────────────────────────────────────────────┐
│ OFFLINE SYNC FLOW                                                     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [User submits while offline]                                          │
│       │                                                                │
│       ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────┐      │
│  │ DatabaseService (AsyncStorage queue)                         │      │
│  │                                                               │      │
│  │  Queue Item:                                                  │      │
│  │    { id, url, method, body, meta: { requestId, photos },     │      │
│  │      status: PENDING, retryCount: 0, createdAt }             │      │
│  └──────────────────────────────────────┬──────────────────────┘      │
│                                          │                             │
│  [Network reconnects] ──────────────────▶│                             │
│                                          ▼                             │
│  ┌─────────────────────────────────────────────────────────────┐      │
│  │ SyncService.processQueue()                                   │      │
│  │                                                               │      │
│  │  1. Check TTL:                                                │      │
│  │       Attendance > 24h → EXPIRED (skip)                       │      │
│  │       Others > 7 days  → EXPIRED (skip)                       │      │
│  │                                                               │      │
│  │  2. Priority sort:                                            │      │
│  │       work-orders (1) > attendance (2) > inventory (3)        │      │
│  │                                                               │      │
│  │  3. For each item:                                            │      │
│  │       a. Upload pending photos → get CDN URLs                 │      │
│  │       b. Replay API call with original Idempotency-Key        │      │
│  │       c. On success → remove from queue                       │      │
│  │       d. On 409 (duplicate) → remove (already processed)      │      │
│  │       e. On 4xx → mark FAILED (permanent)                     │      │
│  │       f. On 5xx/network → exponential backoff → RETRY         │      │
│  │                                                               │      │
│  │  4. Adaptive concurrency: 2-4 parallel                        │      │
│  └─────────────────────────────────────────────────────────────┘      │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Cross-Flow Dependencies

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DEPENDENCY GRAPH                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Check-In ─────────────────┐                                          │
│       │                    │                                          │
│       │ creates            │ opens session for                        │
│       ▼                    ▼                                          │
│  [Attendance Record] ◄── Auto-Checkout (closes if stale)              │
│       ▲                    ▲                                          │
│       │                    │                                          │
│  Check-Out ────────────────┘                                          │
│                                                                       │
│  Leave Approval ──────► [Attendance Records: SICK/PERMIT/DAY_OFF]     │
│       │                         ▲                                     │
│       │                         │ deletes on reject                   │
│  Leave Rejection ───────────────┘                                     │
│                                                                       │
│  Process Absence ─────► [Attendance Records: ABSENT/DAY_OFF]          │
│       │                                                               │
│       └── Skips if: Check-In exists OR Leave exists OR Holiday        │
│                                                                       │
│  Auto-Alpha ──────────► [Attendance Records: ABSENT]                  │
│       │                                                               │
│       └── Only FIXED hour users past endWorkTime with no check-in     │
│                                                                       │
│  Evaluation ◄─── Triggered by: Check-In, Check-Out, Admin Edit,      │
│       │          Leave Approval, Recompute Cron                       │
│       │                                                               │
│       └── Produces: finalStatus, reviewState, payrollHoldState        │
│                                                                       │
│  Reminder Cron ──► [Notifications to Approvers]                       │
│       │                                                               │
│       └── Tracks: firstReminderSentAt, secondReminderSentAt, final    │
│                                                                       │
│  Auto-Reject Cron ──► rejectLeave() ──► Balance Refund                │
│                                     ──► Attendance Revert             │
│                                     ──► Employee Notification         │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Status State Machine

```
┌─────────────────────────────────────────────────────────────────────┐
│ ATTENDANCE STATUS TRANSITIONS                                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                    ┌──────────┐                                        │
│  Check-In ───────▶│ ON_TIME  │                                        │
│  (within window)   └──────────┘                                        │
│                                                                       │
│                    ┌──────────┐                                        │
│  Check-In ───────▶│  LATE    │                                        │
│  (past window)     └──────────┘                                        │
│                                                                       │
│                    ┌──────────┐                                        │
│  No Check-In ────▶│  ABSENT  │◄── Process Absence Cron                │
│  (auto-alpha)      └──────────┘◄── Admin Backdate                     │
│                                                                       │
│                    ┌──────────┐                                        │
│  Leave Approved ─▶│  SICK    │ (type = SAKIT)                         │
│                    └──────────┘                                        │
│                                                                       │
│                    ┌──────────┐                                        │
│  Leave Approved ─▶│  PERMIT  │ (type = CUTI/IZIN/LAINNYA)            │
│                    └──────────┘                                        │
│                                                                       │
│                    ┌──────────┐                                        │
│  Holiday/Off-day ▶│ DAY_OFF  │◄── Leave type TUKAR_LIBUR             │
│                    └──────────┘                                        │
│                                                                       │
│                    ┌───────────────┐                                   │
│  Check-In tanpa ─▶│ NO_CHECKOUT   │── Auto-Checkout ──▶ ON_TIME/LATE  │
│  Check-Out         └───────────────┘── NoCheckoutRepair               │
│                                                                       │
│                    ┌──────────┐                                        │
│  Tidak hadir     ▶│  ALPHA   │ (tanpa keterangan)                     │
│  tanpa izin        └──────────┘                                        │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Evaluation Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│ ATTENDANCE EVALUATION (Canonical Status)                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Triggered by:                                                         │
│    • Check-In / Check-Out (immediate)                                  │
│    • Admin Edit attendance                                             │
│    • Leave Approval / Rejection                                        │
│    • Recompute Cron (batch)                                            │
│                                                                        │
│  Input:                                                                │
│    attendance record + user schedule + holidays + leaves               │
│                                                                        │
│  Output (AttendanceEvaluation record):                                 │
│    ├── finalStatus: canonical status after all factors                 │
│    ├── reviewState: CLEAN / NEEDS_REVIEW / REVIEWED                    │
│    ├── leaveState: NONE / APPROVED / PENDING                           │
│    ├── holidayState: NONE / NATIONAL / CUSTOM                          │
│    ├── payrollHoldState: NONE / HELD / RELEASED                        │
│    ├── evidenceQuality: COMPLETE / PARTIAL / MISSING                   │
│    ├── reasonCodes: [array of evaluation reasons]                      │
│    └── anomalyCodes: [array of detected anomalies]                     │
│                                                                        │
│  Used by:                                                              │
│    • Admin attendance list (canonical status filter)                    │
│    • Payroll calculation (salary module)                                │
│    • Attendance reports                                                 │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Verified Correctness

Setelah review mendalam, flow ini sudah benar dengan safeguards:

| Concern | Safeguard |
|---------|-----------|
| Double check-in | Idempotency key (Redis) + Session Guard |
| Double check-out | Idempotency key (Redis) + NO_ACTIVE_SESSION guard |
| Offline replay duplicate | Same idempotency key preserved in queue |
| Concurrent cron runs | Distributed lock (Redis) per cron job |
| Race: absence vs check-in | Sequential orchestrator execution |
| Race: auto-reject concurrent | `rejectLeave` internal status guard |
| Stale geofence data | Max 60s location age check (mobile) |
| Cross-tenant data leak | tenantId filter on all queries |
| Permission revocation | Background task checks permission each tick |
| Queue overflow | TTL: 24h attendance, 7d others; location cap: 100 |

---

*Generated: 2026-05-14*
