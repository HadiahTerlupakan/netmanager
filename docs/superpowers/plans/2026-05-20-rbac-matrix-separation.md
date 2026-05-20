# RBAC Matrix Separation: Admin vs Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pemisahan penuh matriks permission antara Portal Admin dan Mobile App — tidak ada lagi cross-dependency permission antara kedua panel.

**Architecture:** Mobile routes menggunakan `m_*` permission secara konsisten. Admin routes tetap pakai non-`m_*` permission. Notification system di-update agar juga check `m_*` permission untuk mobile recipients. Role templates mobile-only tidak lagi menyertakan admin permissions.

**Tech Stack:** Next.js API routes, `createHandler` middleware, Prisma ORM, permission-config.ts, role-templates.ts

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `app/api/mobile/work-orders/route.ts` | List mobile WO | Modify: add `m_work_order:read` |
| `app/api/mobile/work-orders/available/route.ts` | Available WO | Modify: add permissions |
| `app/api/mobile/work-orders/request/route.ts` | Create WO request | Modify: add `m_work_order:create` |
| `app/api/mobile/work-orders/[id]/route.ts` | WO detail | Modify: add `m_work_order:read` |
| `app/api/mobile/work-orders/[id]/update/route.ts` | Update WO | Modify: add `m_work_order:update` |
| `app/api/mobile/work-orders/[id]/tasks/route.ts` | Update WO task | Modify: add `m_work_order:update` |
| `app/api/mobile/work-orders/[id]/materials/route.ts` | Add materials | Modify: add `m_work_order:update` |
| `app/api/mobile/work-orders/[id]/return/route.ts` | Return materials | Modify: add `m_work_order:update` |
| `app/api/mobile/work-orders/[id]/partners/route.ts` | Manage partners | Modify: add `m_work_order:update` |
| `app/api/mobile/work-orders/[id]/partner-response/route.ts` | Partner response | Modify: add `m_work_order:update` |
| `app/api/mobile/attendance/status/route.ts` | Attendance status | Modify: add `m_absensi:read` |
| `app/api/mobile/attendance/history/route.ts` | Attendance history | Modify: add `m_absensi:read` |
| `app/api/mobile/attendance/check-in/route.ts` | Check in | Modify: add `m_absensi:create` |
| `app/api/mobile/attendance/check-out/route.ts` | Check out | Modify: add `m_absensi:create` |
| `app/api/mobile/overtime/route.ts` | Overtime list/create | Modify: add `m_lembur:read/create` |
| `app/api/mobile/leaves/route.ts` | Leave list/create | Modify: add `m_izin:read/create` |
| `app/api/mobile/holidays/route.ts` | Holiday list | Modify: add `m_holidays:read` |
| `app/api/mobile/chat/conversations/route.ts` | Chat conversations | Modify: add `m_chat:read/create` |
| `app/api/mobile/chat/conversations/[id]/route.ts` | Chat detail | Modify: add `m_chat:read/create` |
| `app/api/mobile/chat/users/route.ts` | Chat user list | Modify: add `m_chat:read` |
| `app/api/mobile/chat/global/route.ts` | Global chat | Modify: add `m_chat:read` |
| `app/api/mobile/chat/upload/route.ts` | Chat upload | Modify: add `m_chat:create` |
| `modules/notification/services/NotificationService.recipients.ts` | WO notification recipients | Modify: include `m_work_order:read` in recipient query |
| `lib/role-templates.ts` | Role templates | Modify: hapus admin permissions dari mobile-only roles |
| `lib/resource-capabilities.ts` | Resource capabilities | Modify: fix `m_topology` naming, add missing mobile resources |
| `lib/permission-config.ts` | Permission groups | Modify: tambah `m_overtime` jika perlu |

---

### Task 1: Fix Resource Capabilities — Mobile Resources

**Files:**
- Modify: `lib/resource-capabilities.ts`

Saat ini ada mismatch: `PERMISSION_GROUPS_MOBILE` punya `m_topology` tapi `resource-capabilities.ts` punya `m_topology_map`. Juga `m_salary`, `m_mixradius`, `m_partners` belum ada di capabilities (fallback ke default semua action).

- [ ] **Step 1: Fix m_topology naming dan tambah missing mobile resources**

```typescript
// Di resource-capabilities.ts, ganti m_topology_map → m_topology
// Dan tambahkan m_salary, m_mixradius, m_partners

// REPLACE:
m_topology_map: {
  actions: ["read"],
  description: "Akses menu Topology Map (Peta Jaringan)",
},

// WITH:
m_topology: {
  actions: ["read"],
  description: "Akses menu Topology Map (Peta Jaringan)",
},
m_salary: {
  actions: ["read"],
  description: "Akses menu Slip Gaji di mobile app",
},
m_mixradius: {
  actions: ["read"],
  description: "Akses menu MixRadius di mobile app",
},
m_partners: {
  actions: ["read"],
  description: "Akses menu Partners di mobile app",
},
```

- [ ] **Step 2: Verifikasi tidak ada referensi lain ke m_topology_map**

Run: `grep -rn "m_topology_map" --include="*.ts" --include="*.tsx" . | grep -v node_modules`
Expected: Hanya `resource-capabilities.ts` yang berubah.

- [ ] **Step 3: Commit**

```bash
git add lib/resource-capabilities.ts
git commit -m "fix(rbac): fix m_topology naming mismatch dan tambah missing mobile resource capabilities"
```

---

### Task 2: Tambah Permission Check ke Mobile Work Order Routes

**Files:**
- Modify: `app/api/mobile/work-orders/route.ts`
- Modify: `app/api/mobile/work-orders/available/route.ts`
- Modify: `app/api/mobile/work-orders/request/route.ts`
- Modify: `app/api/mobile/work-orders/[id]/route.ts`
- Modify: `app/api/mobile/work-orders/[id]/update/route.ts`

Routes ini sudah pakai `createHandler({ auth: true })`. Tambahkan `permissions` field.

- [ ] **Step 1: Update route.ts (GET list)**

```typescript
// app/api/mobile/work-orders/route.ts
// REPLACE:
export const GET = createHandler({ auth: true }, async (req, ctx) => {
// WITH:
export const GET = createHandler(
  { auth: true, permissions: ["m_work_order:read"] },
  async (req, ctx) => {
```

- [ ] **Step 2: Update available/route.ts (GET + POST)**

```typescript
// app/api/mobile/work-orders/available/route.ts
// REPLACE:
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
// WITH:
export const GET = createHandler(
  { auth: true, permissions: ["m_work_order:read"] },
  async (_req, ctx) => {

// REPLACE:
export const POST = createHandler({ auth: true }, async (req, ctx) => {
// WITH:
export const POST = createHandler(
  { auth: true, permissions: ["m_work_order:update"] },
  async (req, ctx) => {
```

- [ ] **Step 3: Update request/route.ts (POST create request)**

```typescript
// app/api/mobile/work-orders/request/route.ts
// REPLACE:
export const POST = createHandler({ auth: true }, async (req, ctx) => {
// WITH:
export const POST = createHandler(
  { auth: true, permissions: ["m_work_order:create"] },
  async (req, ctx) => {
```

- [ ] **Step 4: Update [id]/route.ts (GET detail)**

```typescript
// app/api/mobile/work-orders/[id]/route.ts
// REPLACE:
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
// WITH:
export const GET = createHandler(
  { auth: true, permissions: ["m_work_order:read"] },
  async (_req, ctx) => {
```

- [ ] **Step 5: Update [id]/update/route.ts (POST update)**

```typescript
// app/api/mobile/work-orders/[id]/update/route.ts
// REPLACE:
export const POST = createHandler({ auth: true }, async (req, ctx) => {
// WITH:
export const POST = createHandler(
  { auth: true, permissions: ["m_work_order:update"] },
  async (req, ctx) => {
```

- [ ] **Step 6: Commit**

```bash
git add app/api/mobile/work-orders/route.ts app/api/mobile/work-orders/available/route.ts app/api/mobile/work-orders/request/route.ts app/api/mobile/work-orders/\[id\]/route.ts app/api/mobile/work-orders/\[id\]/update/route.ts
git commit -m "feat(rbac): tambah m_work_order permission check ke mobile WO routes (createHandler)"
```

---

### Task 3: Tambah Permission Check ke Mobile WO Routes (getMobileAuthPayload pattern)

**Files:**
- Modify: `app/api/mobile/work-orders/[id]/tasks/route.ts`
- Modify: `app/api/mobile/work-orders/[id]/materials/route.ts`
- Modify: `app/api/mobile/work-orders/[id]/return/route.ts`
- Modify: `app/api/mobile/work-orders/[id]/partners/route.ts`
- Modify: `app/api/mobile/work-orders/[id]/partner-response/route.ts`

Routes ini masih pakai `getMobileAuthPayload()` langsung (legacy pattern). Migrasi ke `createHandler` dengan permission check.

- [ ] **Step 1: Migrasi tasks/route.ts ke createHandler**

File ini saat ini export `PATCH` function langsung. Ubah ke `createHandler` pattern:

```typescript
// app/api/mobile/work-orders/[id]/tasks/route.ts
import { createHandler, apiSuccess, apiError, ErrorCodes } from "@/lib/api";
import { MobileWorkOrderActionService } from "@/modules/work-order";

const service = new MobileWorkOrderActionService();

export const PATCH = createHandler(
  { auth: true, permissions: ["m_work_order:update"] },
  async (req, ctx) => {
    const body = await req.json();
    if (!body.taskId) {
      return apiError("Task ID wajib diisi", ErrorCodes.VALIDATION_ERROR, {
        status: 400,
      });
    }

    const result = await service.updateTaskStatus({
      workOrderId: ctx.params.id,
      taskId: body.taskId,
      status: body.status,
      userId: ctx.session!.user.id,
      userName: ctx.session!.user.name,
    });

    return apiSuccess(result);
  },
);
```

- [ ] **Step 2: Migrasi materials/route.ts ke createHandler**

```typescript
// app/api/mobile/work-orders/[id]/materials/route.ts
import { createHandler, apiSuccess, apiError, ErrorCodes } from "@/lib/api";
import { WorkOrderService, validateMobileMaterialPayload } from "@/modules/work-order";

const workOrderService = new WorkOrderService();

export const POST = createHandler(
  { auth: true, permissions: ["m_work_order:update"] },
  async (req, ctx) => {
    const { items } = validateMobileMaterialPayload(await req.json());
    const result = await workOrderService.addMobileMaterials(
      ctx.params.id,
      ctx.session!.user.id,
      ctx.session!.user.name,
      items,
    );
    return apiSuccess(result, { status: 201 });
  },
);
```

- [ ] **Step 3: Migrasi return/route.ts ke createHandler**

Baca file saat ini, lalu refactor ke `createHandler` pattern dengan `permissions: ["m_work_order:update"]`. Pertahankan business logic yang sama.

- [ ] **Step 4: Migrasi partners/route.ts ke createHandler**

Baca file saat ini, lalu refactor ke `createHandler` pattern dengan `permissions: ["m_work_order:update"]` untuk POST dan DELETE. Pertahankan business logic yang sama.

- [ ] **Step 5: Migrasi partner-response/route.ts ke createHandler**

Baca file saat ini, lalu refactor ke `createHandler` pattern dengan `permissions: ["m_work_order:update"]`. Pertahankan business logic yang sama.

- [ ] **Step 6: Verifikasi build**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add app/api/mobile/work-orders/\[id\]/tasks/route.ts app/api/mobile/work-orders/\[id\]/materials/route.ts app/api/mobile/work-orders/\[id\]/return/route.ts app/api/mobile/work-orders/\[id\]/partners/route.ts app/api/mobile/work-orders/\[id\]/partner-response/route.ts
git commit -m "refactor(rbac): migrasi mobile WO legacy routes ke createHandler + m_work_order permission"
```

---

### Task 4: Tambah Permission Check ke Mobile Attendance Routes

**Files:**
- Modify: `app/api/mobile/attendance/status/route.ts`
- Modify: `app/api/mobile/attendance/history/route.ts`
- Modify: `app/api/mobile/attendance/check-in/route.ts`
- Modify: `app/api/mobile/attendance/check-out/route.ts`

- [ ] **Step 1: Update attendance routes**

Semua file ini sudah pakai `createHandler({ auth: true })`. Tambahkan permissions:

```typescript
// status/route.ts & history/route.ts:
{ auth: true, permissions: ["m_absensi:read"] }

// check-in/route.ts & check-out/route.ts:
{ auth: true, permissions: ["m_absensi:create"] }
```

- [ ] **Step 2: Commit**

```bash
git add app/api/mobile/attendance/
git commit -m "feat(rbac): tambah m_absensi permission check ke mobile attendance routes"
```

---

### Task 5: Tambah Permission Check ke Mobile Overtime, Leave, Holiday Routes

**Files:**
- Modify: `app/api/mobile/overtime/route.ts`
- Modify: `app/api/mobile/leaves/route.ts`
- Modify: `app/api/mobile/holidays/route.ts`

- [ ] **Step 1: Update overtime route**

```typescript
// app/api/mobile/overtime/route.ts
// GET handler:
{ auth: true, permissions: ["m_lembur:read"] }
// POST handler:
{ auth: true, permissions: ["m_lembur:create"] }
```

- [ ] **Step 2: Update leaves route**

```typescript
// app/api/mobile/leaves/route.ts
// GET handler:
{ auth: true, permissions: ["m_izin:read"] }
// POST handler:
{ auth: true, permissions: ["m_izin:create"] }
```

- [ ] **Step 3: Update holidays route**

```typescript
// app/api/mobile/holidays/route.ts
// GET handler:
{ auth: true, permissions: ["m_holidays:read"] }
```

- [ ] **Step 4: Commit**

```bash
git add app/api/mobile/overtime/ app/api/mobile/leaves/ app/api/mobile/holidays/
git commit -m "feat(rbac): tambah m_lembur, m_izin, m_holidays permission check ke mobile routes"
```

---

### Task 6: Tambah Permission Check ke Mobile Chat Routes

**Files:**
- Modify: `app/api/mobile/chat/conversations/route.ts`
- Modify: `app/api/mobile/chat/conversations/[id]/route.ts`
- Modify: `app/api/mobile/chat/users/route.ts`
- Modify: `app/api/mobile/chat/global/route.ts`
- Modify: `app/api/mobile/chat/upload/route.ts`

- [ ] **Step 1: Update chat routes**

```typescript
// conversations/route.ts:
// GET: { auth: true, permissions: ["m_chat:read"] }
// POST: { auth: true, permissions: ["m_chat:create"] }

// conversations/[id]/route.ts:
// GET: { auth: true, permissions: ["m_chat:read"] }
// POST: { auth: true, permissions: ["m_chat:create"] }

// users/route.ts:
// GET: { auth: true, permissions: ["m_chat:read"] }

// global/route.ts:
// GET: { auth: true, permissions: ["m_chat:read"] }

// upload/route.ts:
// POST: { auth: true, permissions: ["m_chat:create"] }
```

- [ ] **Step 2: Verifikasi typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/api/mobile/chat/
git commit -m "feat(rbac): tambah m_chat permission check ke mobile chat routes"
```

---

### Task 7: Update Notification Recipient Logic

**Files:**
- Modify: `modules/notification/services/NotificationService.recipients.ts`

Saat ini `findEligibleRecipients()` hanya check `workorders:read` (admin permission). Perlu juga include user yang punya `m_work_order:read` agar mobile-only users yang punya akses WO juga bisa terima notifikasi.

**PENTING:** Ini bukan mengganti — ini menambahkan. Admin yang punya `workorders:read` tetap terima notifikasi. Mobile user yang punya `m_work_order:read` juga terima notifikasi.

- [ ] **Step 1: Update buildEligibleRecipientBaseWhere**

```typescript
// modules/notification/services/NotificationService.recipients.ts

const WORK_ORDER_RESOURCE = "workorders";
const WORK_ORDER_MOBILE_RESOURCE = "m_work_order";
const WORK_ORDER_READ_ACTION = "read";

function buildEligibleRecipientBaseWhere(
  excludeUserId?: string,
): Prisma.UserWhereInput {
  return {
    isActive: true,
    ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    role: {
      permission: {
        some: {
          OR: [
            { resource: WORK_ORDER_RESOURCE, action: WORK_ORDER_READ_ACTION },
            { resource: WORK_ORDER_MOBILE_RESOURCE, action: WORK_ORDER_READ_ACTION },
          ],
        },
      },
    },
  };
}
```

**Catatan:** Perlu verifikasi apakah Prisma `some` + `OR` di level field bekerja seperti ini. Jika tidak, alternatifnya:

```typescript
role: {
  OR: [
    { permission: { some: { resource: WORK_ORDER_RESOURCE, action: WORK_ORDER_READ_ACTION } } },
    { permission: { some: { resource: WORK_ORDER_MOBILE_RESOURCE, action: WORK_ORDER_READ_ACTION } } },
  ],
},
```

- [ ] **Step 2: Verifikasi Prisma query syntax**

Run: `npm run typecheck`
Jika error, gunakan alternatif syntax di atas.

- [ ] **Step 3: Commit**

```bash
git add modules/notification/services/NotificationService.recipients.ts
git commit -m "feat(rbac): notification recipients include m_work_order:read untuk mobile users"
```

---

### Task 8: Update Role Templates — Hapus Admin Permissions dari Mobile-Only Roles

**Files:**
- Modify: `lib/role-templates.ts`

Role template "Teknisi" dan "Sales" (`accessAdminPanel: false`) seharusnya tidak punya admin permissions.

- [ ] **Step 1: Update template Teknisi — hapus admin permissions**

```typescript
// lib/role-templates.ts - template "teknisi"
// HAPUS baris-baris ini:
"workorders:read",
"workorders:site_only",
"workorders:department_only",

// Teknisi sudah punya m_work_order:read/create/update yang cukup untuk mobile
```

Template Teknisi final permissions:
```typescript
permissions: [
  // Mobile - Beranda
  "m_dashboard:read",
  // Mobile - Work Order (full access)
  "m_work_order:read",
  "m_work_order:create",
  "m_work_order:update",
  // Mobile - Inventory
  "m_barang:read",
  "m_barang_masuk:read",
  "m_barang_masuk:create",
  "m_barang_keluar:read",
  "m_barang_keluar:create",
  // Mobile - Kehadiran
  "m_absensi:read",
  "m_absensi:create",
  "m_lembur:read",
  "m_lembur:create",
  "m_izin:read",
  "m_izin:create",
  "m_holidays:read",
  // Mobile - Chat
  "m_chat:read",
  "m_chat:create",
  // Mobile - Partners
  "m_partners:read",
],
```

- [ ] **Step 2: Update template Sales — pastikan hanya m_* permissions**

Template Sales sudah cukup bersih, tapi punya `canvasing:read` dan `canvasing:site_only` (admin permissions). Hapus:

```typescript
// HAPUS:
"canvasing:read",
"canvasing:site_only",
```

Template Sales final permissions:
```typescript
permissions: [
  // Mobile
  "m_dashboard:read",
  "m_canvasing:read",
  "m_canvasing:create",
  "m_absensi:read",
  "m_absensi:create",
  "m_izin:read",
  "m_izin:create",
  "m_holidays:read",
  "m_chat:read",
  "m_chat:create",
],
```

- [ ] **Step 3: Verifikasi template hybrid (Helpdesk, Manager, Staff Gudang) tetap punya kedua jenis**

Template dengan `accessAdminPanel: true` DAN `accessEmployeePanel: true` boleh punya kedua jenis permission. Verifikasi bahwa Helpdesk, Manager, dan Staff Gudang tidak terpengaruh.

- [ ] **Step 4: Commit**

```bash
git add lib/role-templates.ts
git commit -m "refactor(rbac): hapus admin permissions dari mobile-only role templates (Teknisi, Sales)"
```

---

### Task 9: Update Seed — FINANCE Role dan TEKNISI Role

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Update FINANCE role filter agar include semua FINANCE group resources**

Saat ini filter hanya: `finance`, `daily_income`, `period_income`, `expense`, `profit_loss`, `dashboard`.

Seharusnya include semua resources di `PERMISSION_GROUPS.FINANCE`:
`finance, accounts, debts_receivables, treasury, transactions, manual_payments, categories, reports, daily_income, period_income, expense, profit_loss`

```typescript
// prisma/seed.ts - FINANCE role section
// REPLACE filter logic:
const FINANCE_RESOURCES = [
  "finance", "accounts", "debts_receivables", "treasury",
  "transactions", "manual_payments", "categories", "reports",
  "daily_income", "period_income", "expense", "profit_loss",
  "dashboard",
];

const financePermissions = permissions.filter(
  (p) => FINANCE_RESOURCES.includes(p.resource as string),
);
```

- [ ] **Step 2: Update TEKNISI role — hapus admin permission workaround**

Saat ini `karyawanPermissions` sudah hanya berisi mobile resources (karena filter `MOBILE_RESOURCES`). Verifikasi bahwa tidak ada admin permission yang bocor ke TEKNISI.

Run: `grep -A5 "karyawanPermissions" prisma/seed.ts`

Jika ada logic yang menambahkan admin permissions ke karyawanPermissions, hapus.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "fix(rbac): perbaiki FINANCE role filter agar include semua finance resources"
```

---

### Task 10: Verifikasi End-to-End

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build success

- [ ] **Step 4: Verifikasi permission consistency**

Run: `grep -rn "hasPermission\|permissions:" app/api/mobile/ --include="*.ts" | grep -oP '"[a-z_]+:[a-z_-]+"' | sort -u`

Expected: Semua permission di mobile routes harus ber-prefix `m_*`

- [ ] **Step 5: Verifikasi tidak ada admin permission di mobile-only templates**

Run: `grep -A50 '"teknisi"' lib/role-templates.ts | grep -v "m_" | grep ":"`

Expected: Tidak ada output (semua permission ber-prefix m_)

- [ ] **Step 6: Commit final (jika ada fix)**

```bash
git commit -m "chore(rbac): final verification fixes"
```

---

## Catatan Penting

### Breaking Change untuk Existing Roles

Perubahan ini **TIDAK** breaking untuk role yang sudah ada di database karena:
1. Permission records di DB tidak berubah — hanya template dan route enforcement yang berubah
2. Role yang sudah di-assign ke user tetap punya permission yang sama
3. Yang berubah: role **baru** yang dibuat dari template akan mengikuti pola baru

### Migration Path untuk Existing Mobile-Only Roles

Jika ada role custom yang sudah dibuat dengan `accessAdminPanel: false` tapi punya admin permissions (karena sanitizer strip-nya):
- Permissions tersebut sudah di-strip oleh sanitizer saat role disimpan
- Jadi tidak ada dampak — mereka sudah tidak punya admin permissions di DB

### Yang TIDAK Termasuk dalam Plan Ini

1. **UI Role Matrix separation** — UI sudah punya tab terpisah "Portal Admin" dan "Mobile App". Tidak perlu perubahan UI karena pemisahan sudah ada di level tab.
2. **Geofence route** (`/api/mobile/geofence/`) — ini legitimately auth-only (semua user yang login bisa akses geofence data).
3. **Profile, push-token, error-report routes** — legitimately auth-only (personal data).
4. **Announcements route** — bisa dipertimbangkan nanti (semua user boleh baca announcement).
