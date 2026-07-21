# Work Order Notification Audience Design

**Tanggal**: 2026-07-21  
**Status**: Draft — menunggu review user  
**Scope**: `modules/notification`, `modules/work-order` (side-effects / event path), **bukan** UI mobile  
**Asumsi intent**: Opsi **B** — teknisi pool di dept+site tetap dapat "WO Baru"; stakeholder terkait saja untuk aksi/status; Branch Manager non-Technical tidak spam claim/inventory/status teknisi lain.

---

## 1. Masalah (terverifikasi production)

User Branch Manager (`dede@sblnet.id`, dept **Operations**, site CARIU) melihat badge ~9300 unread dan notifikasi WO teknisi lain, contoh `WO-20260721-0004` (dept **Technical**):

| Event di screenshot | Penerima aktual (sample) |
|---|---|
| Work Order Baru (3×) | Super Admin + 3 Teknisi Technical + Branch Manager Operations |
| Claim / ambil-kembali barang / COMPLETE | Sama: pool `findEligibleRecipients` |
| Status COMPLETED → VERIFIED | Sama (5 user, termasuk Dede) |

### Root cause (kode)

1. **Semua event WO** (baru, assign observer, status, update, mobile action) memakai `findEligibleRecipients` di  
   [`NotificationService.recipients.ts`](../../../modules/notification/services/NotificationService.recipients.ts).

2. **Pool eligible** = user aktif dengan `workorders:read` **atau** `m_work_order:read` + scope site longgar.

3. **Filter department bocor**: `buildDepartmentScopedConditions` OR-kan:
   - `user.departmentId === WO.departmentId`, **atau**
   - `user.departmentId === null`, **atau**
   - role **tidak** punya `workorders:department_only`  
   → Branch Manager yang punya `workorders:read` tanpa `workorders:department_only` lolos ke **semua dept di site**, meski punya `m_work_order:department_only` (resource **tidak dicek**).

4. **`notifyAdminsAboutMobileAction` menyesatkan**: penerima = eligible pool, bukan admin/verifier.

5. **Double/triple fire "Work Order Baru"**: path sinkron `onWorkOrderCreated` / `notifyWorkOrderCreatedSafely` **dan** handler event bus `WORK_ORDER_CREATED` keduanya memanggil `notifyNewWorkOrder`. Di create path utama (`WorkOrderMutationService`) keduanya dipanggil berurutan; production `WO-20260721-0004` menunjukkan **3 burst** × 5 user (kemungkinan retry worker / caller tambahan — primary fix tetap single publisher in-app).

### Bukti production (ringkas)

- Unread Dede: ~9614; mayoritas `WORK_ORDER` status change.
- Permission Dede: `workorders:read` + `m_work_order:*` termasuk `m_work_order:department_only`, **tanpa** `workorders:department_only`.
- `WO-20260721-0004` New WO: timestamps `02:25:49`, `02:25:50`, `02:25:54` — masing-masing 5 notif.

---

## 2. Tujuan

1. User non-stakeholder **tidak** menerima noise operasional teknisi (claim, inventory, task note, status teknis).
2. Teknisi di **dept + site** yang sama tetap dapat **WO Baru** (pool claim/assign).
3. Stakeholder terkait (assignee, creator, partner assignment, verifier/approver) tetap dapat event yang relevan.
4. Satu event create = **paling banyak satu** batch notifikasi in-app "Work Order Baru" per user.
5. Perubahan minimal, teruji, tanpa migrasi DB; historical unread **tidak** dihapus otomatis di scope ini (opsional ops terpisah).

### Non-goals

- Redesign bell UI / mark-all UX (kecuali terdampak count).
- Ubah permission matrix role di UI admin (kecuali dokumentasi rekomendasi seed).
- Ubah jalur WhatsApp teknisi (tetap dept+site di `sendNewWorkOrderWhatsApp`) kecuali inkonsistensi kritis.
- Purge 9k unread Dede (follow-up ops).

---

## 3. Pendekatan yang dipertimbangkan

### A — Stakeholder-only ketat

Hanya assignee / creator / partner / verify-permission untuk **semua** event termasuk WO Baru.

- **Pro**: spam hampir hilang.  
- **Contra**: teknisi pool tidak tahu ada WO baru di dept mereka (regresi operasional).  
- **Tolak** untuk "WO Baru".

### B — Audience per tipe event (direkomendasikan)

Matriks penerima berbeda per event class; perketat department; satu jalur create.

- **Pro**: cocok verifikasi + intent B; teknisi tetap dapat pool; manager non-dept tidak spam.  
- **Contra**: butuh beberapa helper + test matriks.  
- **Pilih**.

### C — Hanya perketat `department_only` + stop double-fire

Tetap broadcast status/claim ke semua `*:read` di dept.

- **Pro**: diff kecil.  
- **Contra**: claim/status tetap noise ke semua teknisi + manager di dept yang sama; tidak selesaikan "bukan bagiannya".  
- **Tidak cukup**.

---

## 4. Desain (pendekatan B)

### 4.1 Audience classes

| Class | Siapa | Dipakai untuk |
|---|---|---|
| **POOL** | User aktif dengan `workorders:read` **atau** `m_work_order:read`, **site match**, dan **dept match ketat** (lihat 4.2) | WO Baru (OPEN, belum di-assign atau broadcast pool) |
| **STAKEHOLDERS** | Union: `assignedToId`, `createdById` / `requestedById` (jika ada), user di `work_order_assignments` aktif, **plus** user site-scope dengan `workorders:verify` **atau** `workorders:approve_request` **atau** `m_work_order:verify` | Status change, update, mobile action (claim/inventory/complete/note) |
| **ASSIGNEE_ONLY** | `assignedToId` (exclude self-trigger) | "Di-assign ke Anda" (sudah ada) |

Super Admin: tetap masuk jika punya permission read/verify seperti sekarang **dan** lolos site scope (atau `siteId` null user). Tidak ada broadcast tenant-wide tanpa site.

### 4.2 Dept match ketat (ganti OR bocor)

Untuk user yang **salah satu** resource-nya (`workorders` atau `m_work_order`) punya action `department_only`:

- Hanya terima jika `user.departmentId === workOrder.departmentId`  
  **atau** `user.departmentId === null` (tenant-wide ops)  
  **atau** user punya permission **verify/approve** di resource work order (cross-dept supervisor).

Untuk user **tanpa** `department_only` di **kedua** resource:

- Perilaku sama dengan hari ini untuk **POOL** saja: boleh cross-dept di site (admin broad-read).  
- **STAKEHOLDERS** tidak memakai pool broad-read — hanya ID eksplisit + verify/approve.

**Perbaikan bug permission**: cek  
`department_only` pada `workorders` **atau** `m_work_order` (bukan hanya `workorders`).  
Dede (`m_work_order:department_only` + Operations) **keluar** dari POOL Technical.

### 4.3 Matriks event → audience

| Event | Fungsi saat ini | Audience target |
|---|---|---|
| WO Baru | `notifyNewWorkOrder` / `notifyNewWorkOrderEvent` | **POOL** (dept+site ketat) |
| Assigned | `notifyWorkOrderAssignedEvent` | Assignee + **STAKEHOLDERS** observers (bukan full POOL) |
| Status changed | `notifyWorkOrderStatusChangeEvent` | **STAKEHOLDERS** (+ assignee sudah termasuk) |
| Updated / mobile action | `notifyWorkOrderUpdateEvent`, `notifyAdminsAboutMobileActionEvent` | **STAKEHOLDERS** |
| Mobile claim/inventory/complete/note | `notifyAdminsAboutMobileAction` | **STAKEHOLDERS** (rename semantik di komentar; nama export boleh tetap untuk kompatibilitas) |

Exclude selalu: `triggeredByUserId` / actor.

### 4.4 Stop double-fire WO Baru

**Keputusan**: notifikasi in-app "Work Order Baru" hanya dari **satu** jalur.

| Jalur | Setelah fix |
|---|---|
| `notifyWorkOrderCreatedSafely` → `onWorkOrderCreated` | Tetap kirim **in-app + WA** (primary) |
| Event bus `WORK_ORDER_CREATED` handler | Hanya **realtime socket** (`socketEmitter.newWorkOrder`); **jangan** panggil `notifyNewWorkOrder` lagi |

Jika ada caller ketiga yang mempublish event **tanpa** `notifyWorkOrderCreatedSafely`, document: create path wajib call `notifyWorkOrderCreatedSafely` **atau** hanya event bus — pilih primary sync path di atas.

Idempotency tambahan (opsional hardening, same PR jika murah): sebelum create notif, skip jika sudah ada `sourceType=WORK_ORDER` + `sourceId=woId` + `userId` + `title` contains "Work Order Baru" dalam window 60s. Primary fix = single publisher.

### 4.5 API / struktur modul

Tetap di layer notification (tidak pindah business ke route):

```
modules/notification/services/
  NotificationService.recipients.ts
    - findEligibleRecipients(input)           // legacy name → implement POOL (dept ketat)
    - findWorkOrderStakeholders(input)        // NEW: IDs + verify/approve
  NotificationService.work-order-events.ts
    - WO baru → findEligibleRecipients (POOL)
    - status/update/mobile/assign observers → findWorkOrderStakeholders
  lib/event-bus/event-handlers.ts
    - WORK_ORDER_CREATED: hapus notifyNewWorkOrder
```

`findWorkOrderStakeholders` input:

```ts
{
  workOrderId: string;
  siteId?: string;
  departmentId?: string;
  assignedToId?: string | null;
  createdById?: string | null;
  requestedById?: string | null;
  excludeUserId?: string;
  userLookupService: UserLookupService;
}
```

Load assignment user IDs via Prisma/work-order repo port yang sudah ada di notification deps; **hindari** import module work-order service (boundary). Prefer inject query kecil di recipients atau port di `UserLookupService` + raw ids dari caller yang sudah punya WO entity.

Caller event sudah punya `assignedToId`, `departmentId`, `siteId`. Perkaya payload status/mobile action dengan `createdById` / `requestedById` jika belum ada (dari side-effect yang sudah load WO).

### 4.6 Data flow (setelah)

```
WO created
  → notifyWorkOrderCreatedSafely → notifyNewWorkOrder → POOL
  → publish WORK_ORDER_CREATED → socket only

Teknisi claim / inventory / complete
  → notifyAdminsAboutMobileAction → STAKEHOLDERS
  → Dede Operations tidak masuk

Status COMPLETED → VERIFIED
  → notifyWorkOrderStatusChange → STAKEHOLDERS
  → assignee + verifier + creator; bukan semua teknisi + BM cross-dept
```

### 4.7 Error handling

- Gagal resolve stakeholder → log + skip user (jangan throw putus flow WO).
- Empty recipients → no-op (sudah ada pattern).
- Tetap `excludeUserId` wajib di-log warn jika hilang.

### 4.8 Testing

Unit/integration (Vitest):

1. **recipients dept**: user dengan `m_work_order:department_only` + dept berbeda → **bukan** POOL.
2. **recipients dept**: teknisi same dept+site + read → **POOL**.
3. **stakeholders**: mobile action → hanya assignee/creator/verify; bukan broad read.
4. **event-handlers**: `WORK_ORDER_CREATED` tidak call `notifyNewWorkOrder` (mock).
5. **Regression**: WA path create tidak diubah (smoke mock).

Fixture permission mirror Dede vs Teknisi.

### 4.9 Success criteria (production)

Setelah deploy, untuk user seperti Dede (BM Operations, `m_work_order:department_only`, tanpa verify WO Technical):

- **Tidak** menerima claim/inventory/complete/status WO Technical yang bukan ia create/assign.
- **Tidak** triple "Work Order Baru" untuk satu WO.
- Teknisi Technical site CARIU **tetap** menerima WO Baru Technical.
- Verifier/approver site **tetap** menerima status/mobile action.

Ops follow-up (di luar PR wajib): mark-read massal notif `WORK_ORDER` lama untuk role non-pool (script ops).

---

## 5. File utama yang disentuh

| File | Perubahan |
|---|---|
| `modules/notification/services/NotificationService.recipients.ts` | Dept ketat multi-resource; `findWorkOrderStakeholders` |
| `modules/notification/services/NotificationService.work-order-events.ts` | Matriks audience per event |
| `modules/notification/services/NotificationService.ts` | Pass field stakeholder jika perlu |
| `lib/event-bus/event-handlers.ts` | Hapus double `notifyNewWorkOrder` |
| `modules/work-order/services/work-order-side-effects.ts` / helpers | Pastikan payload stakeholder IDs lengkap |
| `tests/modules/notification/*` | Case di atas |
| `docs/CHANGELOG.md` | `[FIXED]` entry |

---

## 6. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Manager cross-dept yang **sengaja** ingin semua WO | Mereka butuh `workorders:verify` atau hilangkan `department_only` — dokumentasikan |
| Super Admin tanpa site | Site null tetap eligible di POOL/verify path |
| Create path hanya event-bus di beberapa caller | Audit: `WorkOrderMutationService` (sync+event), `MixRadiusDismantleNotificationService` (`onWorkOrderCreated` only). Primary in-app tetap sync path; event bus = socket only |
| Announcement/canvasing noise di badge Dede | **Out of scope** PR ini; catat follow-up |

---

## 7. Keputusan terbuka (default di spec)

| Topik | Default spec |
|---|---|
| Intent audience | **B** (POOL + STAKEHOLDERS) |
| Historical unread | Tidak dihapus di PR ini |
| Rename `notifyAdminsAboutMobileAction` | Tidak rename export; perbaiki perilaku + komentas |
| WA new WO | Tetap dept+site teknisi; tidak ikut STAKEHOLDERS matrix |

Jika user menolak default, revisi section 4 sebelum implementasi.

---

## 8. Urutan implementasi (untuk writing-plans)

1. Fix `department_only` multi-resource + tests recipients.  
2. Add `findWorkOrderStakeholders` + wire status/update/mobile/assign.  
3. Remove double notify di event-handlers + test.  
4. Audit create call sites.  
5. Changelog + deploy verify sample WO.

**Terminal state brainstorm**: setelah user approve spec ini → skill **writing-plans**, bukan coding langsung.
