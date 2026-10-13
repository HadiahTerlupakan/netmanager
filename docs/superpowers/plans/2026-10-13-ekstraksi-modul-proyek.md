# Ekstraksi Modul Proyek — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memindahkan subsistem RAB (Proyek) keluar dari `modules/finance` dan `app/admin/pengeluaran` menjadi `modules/proyek` mandiri dengan halaman `/admin/proyek`, tanpa mengubah perilaku dan tanpa migration Prisma.

**Architecture:** 39 file modul, 13 route API, 31 file UI, dan 30 file test pindah lewat `git mv` dengan isi utuh; struktur folder dipertahankan sehingga impor relatif antar file RAB tetap sah. Kopling dua arah diselesaikan dengan tiga pintu root-level: `modules/proyek/{index,client,public-queries}.ts` dan satu pintu baru `modules/finance/public-queries.ts` berisi `getExpensesByRabProject()`. Nama model Prisma tetap `Rab*`, gate izin tetap `expense:*`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Prisma, Zod, Vitest, SWR/`useApi`.

**Spec:** `docs/superpowers/specs/2026-10-13-ekstraksi-modul-proyek-design.md`

## Global Constraints

- **Nol migration Prisma.** `prisma/schema.prisma` tidak disentuh sama sekali. Model tetap `RabProject`, `RabItem`, `RabWbs`, `RabRevision`, `RabRevisionItem`, `RabRevisionApproval`, `RabApproval`, `RabDisbursement`, `RabActualAchievement`, `RabInvestor`.
- **Nol perubahan izin.** Semua route proyek tetap `expense:read|create|update|delete`; approval tetap flag `Role.canApproveRab`. `lib/permissions.ts` dan `lib/permission-config.ts` tidak disentuh.
- **Isi file tidak diubah** selain jalur impor, dengan satu pengecualian yang disebut eksplisit: `FinanceRabFacadeService` → `ProyekService`.
- **Nama simbol tetap `Rab*`** di dalam `modules/proyek` (kelas, tipe, fungsi, schema Zod).
- **Dilarang impor internal lintas modul.** `tests/architecture/module-public-api.test.ts` sudah mengunci pola `@/modules/<x>/{repositories,services,utils,validators,mappers,domain,factories,constants}/` dari luar modul pemilik — semua akses lintas modul lewat file root (`index.ts`, `client.ts`, `public-queries.ts`).
- **`modules/proyek` tidak boleh mengimpor `@/modules/finance`** (index), hanya `@/modules/finance/public-queries`, agar tidak ada siklus.
- **Tiap task berakhir hijau**: `npm run typecheck` dan test yang disebut di task itu lulus sebelum commit.
- Commit message mengikuti Conventional Commits dan diakhiri `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Review Focus

Lima hal yang disiratkan spec tapi tidak dijaga test mana pun hari ini:

1. **Pengeluaran yang tertaut proyek kehilangan nama proyek/item.** `ExpenseRepository.findAll` meng-`include` `rabProject`/`rabItem` dengan `select {id,name}`; kalau include itu ikut terbawa saat pembedahan, daftar pengeluaran berhenti menampilkan kolom proyek. → test di Task 1.
2. **Menu "Proyek (RAB)" hilang untuk semua role non-superadmin.** `FINANCE.PROYEK` tanpa entri `specialMappings` akan dipetakan ke resource `proyek` yang tidak ada di DB. → test di Task 4.
3. **Cron `rab-status-eval` mati senyap.** Route cron mengimpor `RabStatusEvaluationService`; jalur impor yang salah hanya terlihat saat 01:00. → test di Task 2.
4. **Portal investor berhenti menampilkan proyek.** Investor membaca RAB lewat pintu yang pindah (`finance/public-queries` → `proyek/public-queries`). → test di Task 1.
5. **Sisa referensi ke endpoint/pintu lama.** String `"/api/finance/rab-projects"` atau `"@/modules/finance/public-queries"` yang tertinggal baru meledak saat runtime, bukan saat typecheck. → test di Task 5.

---

### Task 1: Pindahkan lapisan modul dan bentuk empat pintu

Task ini atomik dan besar karena memecahnya menciptakan keadaan antara yang melanggar aturan impor internal: begitu `repositories/Rab*` pindah, `services/Rab*` yang masih di finance harus mengimpor internal modul lain.

**Files:**
- Create: `modules/proyek/index.ts`, `modules/proyek/client.ts`, `modules/proyek/public-queries.ts`, `modules/proyek/repositories/prisma-boundary.ts`, `modules/proyek/types/rab.enums.ts`
- Move: 39 file dari `modules/finance/**` → `modules/proyek/**` (daftar di Lampiran A)
- Rewrite: `modules/finance/public-queries.ts`
- Modify: `modules/finance/index.ts`, `modules/finance/client.ts`, `modules/finance/repositories/index.ts`, `modules/finance/services/FinanceService.ts`, `modules/finance/services/FinanceExpenseFacadeService.ts`, `modules/finance/types/invoice.enums.ts`, `lib/validations/rab-project.ts`
- Delete: `modules/finance/validation.ts`
- Modify (importir): `modules/investor/repositories/InvestorPortalRepository.ts`, `modules/investor/repositories/InvestorProfitShareRepository.ts`, `modules/investor/services/InvestorPayoutAdminService.ts`, `modules/investor/services/InvestorProfitShareService.ts`, `modules/investor/services/investor-project-tracking.helpers.ts`, `modules/investor/services/rab-tracking-input.ts`, 13 file di `app/admin/pengeluaran/`, 13 route di `app/api/finance/rab-projects/`, `app/api/cron/rab-status-eval/route.ts`
- Test: `tests/modules/proyek/**` (13 file dipindah dari `tests/modules/finance/`), `tests/modules/finance/ExpenseRepositoryRabInclude.test.ts` (baru), `tests/modules/proyek/public-queries.test.ts` (baru)

**Interfaces:**
- Consumes: `prisma` dari `@/lib/prisma`, `getExpensesByRabProject` dari pintu finance baru (dibuat di task ini), `hasActiveInvestorProfitShare`/`isRabProjectMonthShared` dari `@/modules/investor/public-queries` (sudah ada).
- Produces:
  - `@/modules/proyek` → `RabProjectRouteService`, `RabRevisionRouteService`, `RabApprovalService`, `RabRevisionApprovalService`, `RabApprovalReminderRouteService`, `RabStatusEvaluationService`, `getRabStatusEvaluationService()` (factory yang dipakai route cron; metodenya `evaluateStatuses()`), `ProyekService`, `rabProjectCreateSchema`, `rabProjectUpdateSchema`, `rabActualAchievementSchema`
  - `@/modules/proyek/client` → `buildRABTrackingDataset`, `calculateMonthlySubscribers`, `getInvestorProfitSharePercent`, `PERSEN_BAGI_HASIL_RAB_BAWAAN`, `calculateEffectiveRabTargetSubscribers`, `calculateRabProjectedRevenue`, `calculateRabUnitCosts`, `getRabTargetBasisLabel`, tipe `RabTargetBasis`, `RABTrackingDataset`, `RABTrackingRow`, `RABTrackingTotals`, `RabTrackingItem`, `RabTrackingProject`, `RabTrackingAchievement`, `GrowthSettings`, `CustomGrowthSettings`, `CustomMilestone`, `LinearGrowthSettings`, `PercentageGrowthSettings`, `RABInvestorProfitShareMode`, `RABOpexBufferFundingMode`
  - `@/modules/proyek/public-queries` → `findRabInvestmentSummaries`, `findRabInvestmentList`, `findRabInvestmentDetail`, `findRabInvestmentsWithSite`, `findRabProjectsForProfitShare`, tipe `RabInvestmentFilter`, `RabProjectForProfitShare`
  - `@/modules/finance/public-queries` → `getExpensesByRabProject(projectId: string): Promise<ProjectExpenseRow[]>` dengan `ProjectExpenseRow = { id: string; amount: number; category: string; rabItemId: string | null; description: string | null; rabItem: { id: string; expenseType: string } | null }`

- [ ] **Step 1: Buat kerangka folder modul**

```bash
mkdir -p modules/proyek/domain/entities modules/proyek/domain/ports \
         modules/proyek/repositories/shared modules/proyek/services \
         modules/proyek/utils modules/proyek/validators modules/proyek/types
```

- [ ] **Step 2: Pindahkan 39 file dengan `git mv`**

```bash
git mv modules/finance/domain/entities/RabProjectEntity.ts modules/proyek/domain/entities/
git mv modules/finance/domain/ports/IRabProjectRepository.ts modules/proyek/domain/ports/
git mv modules/finance/repositories/Rab*.ts modules/proyek/repositories/
git mv modules/finance/repositories/rabProject.*.ts modules/proyek/repositories/
git mv modules/finance/repositories/shared/rabInvestmentCalculator.ts modules/proyek/repositories/shared/
git mv modules/finance/services/Rab*.ts modules/proyek/services/
git mv modules/finance/services/rab-*.ts modules/proyek/services/
git mv modules/finance/services/rabProjectRouteSerializers.ts modules/proyek/services/
git mv modules/finance/services/FinanceRabFacadeService.ts modules/proyek/services/ProyekService.ts
git mv modules/finance/utils/rab-tracking modules/proyek/utils/rab-tracking
git mv modules/finance/utils/rab-approval-reminder.ts modules/finance/utils/rab-bottleneck-metrics.ts \
       modules/finance/utils/rab-revision-variance.ts modules/finance/utils/rab-revisions.ts \
       modules/finance/utils/rabTarget.ts modules/proyek/utils/
git mv modules/finance/validators/rabProjectSchemas.ts modules/proyek/validators/
git mv modules/finance/types/rab-revision.types.ts modules/proyek/types/
```

Verifikasi hitungan: `git status --short | grep -c "^R"` harus **39**.

- [ ] **Step 3: Buat `prisma-boundary` dan enum RAB milik proyek**

`modules/proyek/repositories/prisma-boundary.ts`:

```typescript
export {
  Prisma,
  RabExpenseType,
  RabGrowthType,
  RabInvestorProfitShareMode,
  RabItemCategory,
  RabOpexBufferFundingMode,
  RabPaymentType,
  RabTargetBasis,
} from "@prisma/client";
export type { PrismaClient } from "@prisma/client";
```

`modules/proyek/types/rab.enums.ts` — dipindahkan apa adanya dari `modules/finance/types/invoice.enums.ts` (blok `RabExpenseType`, `RabRevisionStatus`, `RabStatus`; ketiganya hanya dipakai file RAB, sudah diverifikasi):

```typescript
export const RabExpenseType = {
  CAPEX: "CAPEX",
  OPEX: "OPEX",
} as const;

export type RabExpenseType =
  (typeof RabExpenseType)[keyof typeof RabExpenseType];

export const RabRevisionStatus = {
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export type RabRevisionStatus =
  (typeof RabRevisionStatus)[keyof typeof RabRevisionStatus];
```

Plus tipe `RabStatus` (union 12 nilai) yang disalin utuh dari `invoice.enums.ts` baris 70 ke bawah — salin apa adanya, jangan ditulis ulang dari ingatan. Setelah disalin, hapus ketiga blok itu dari `modules/finance/types/invoice.enums.ts`.

- [ ] **Step 4: Arahkan impor di dalam modul proyek**

```bash
cd modules/proyek
grep -rl '"\.\./types/invoice\.enums"' . | xargs sed -i '' 's#"\.\./types/invoice\.enums"#"../types/rab.enums"#g'
grep -rl '"\./RouteServiceError"' . | xargs sed -i '' 's#"\./RouteServiceError"#"@/lib/api/route-service-error"#g'
cd ../..
```

Lalu dua suntingan manual:

`modules/proyek/services/ProyekService.ts` — ganti `import { RabProjectRepository } from "../repositories";` menjadi `import { RabProjectRepository } from "../repositories/RabProjectRepository";`, dan ganti nama kelas `FinanceRabFacadeService` → `ProyekService`.

`modules/proyek/services/RabProjectRouteService.ts` — hapus `import { ExpenseRepository } from "../repositories/ExpenseRepository";`, hapus parameter konstruktor `private readonly expenseRepository = new ExpenseRepository(),`, tambahkan `import { getExpensesByRabProject } from "@/modules/finance/public-queries";`, dan ganti pemanggilannya:

```typescript
// sebelum: const expenses = await this.expenseRepository.findProjectExpenses(projectId);
const expenses = await getExpensesByRabProject(projectId);
```

- [ ] **Step 5: Tulis pintu `modules/finance/public-queries.ts` (ganti seluruh isi)**

```typescript
/**
 * Entry publik SEMPIT module finance untuk module proyek yang perlu membaca
 * realisasi pengeluaran sebuah proyek RAB.
 *
 * Sengaja terpisah dari `index.ts`: index finance memuat banyak service, dan
 * `modules/proyek` hanya butuh satu query baca. Pintu ini menjaga arah
 * ketergantungan tetap satu arah dan bebas siklus.
 */
import { ExpenseRepository } from "./repositories/ExpenseRepository";

const expenseQueries = new ExpenseRepository();

export type ProjectExpenseRow = Awaited<
  ReturnType<ExpenseRepository["findProjectExpenses"]>
>[number];

/** Realisasi pengeluaran yang tertaut ke satu proyek RAB. */
export function getExpensesByRabProject(
  projectId: string,
): Promise<ProjectExpenseRow[]> {
  return expenseQueries.findProjectExpenses(projectId);
}
```

- [ ] **Step 6: Tulis pintu `modules/proyek/public-queries.ts`**

Isinya persis isi lama `modules/finance/public-queries.ts` (lihat `git show HEAD:modules/finance/public-queries.ts`), dengan dua perubahan: komentar header menyebut "module proyek … dipakai module investor", dan jalur impor `./repositories/RabInvestorQueryRepository` tetap relatif (file sudah ikut pindah). Lima fungsi dan dua tipe yang diekspor tidak berubah namanya.

- [ ] **Step 7: Tulis `modules/proyek/client.ts`**

```typescript
export {
  calculateEffectiveRabTargetSubscribers,
  calculateRabProjectedRevenue,
  calculateRabUnitCosts,
  getRabTargetBasisLabel,
} from "./utils/rabTarget";
export type { RabTargetBasis } from "./utils/rabTarget";

// Mesin tracking RAB (murni) — dipakai UI admin proyek & perhitungan bagi hasil investor.
export {
  buildRABTrackingDataset,
  calculateMonthlySubscribers,
  getInvestorProfitSharePercent,
  PERSEN_BAGI_HASIL_RAB_BAWAAN,
} from "./utils/rab-tracking";
export type {
  CustomGrowthSettings,
  CustomMilestone,
  GrowthSettings,
  LinearGrowthSettings,
  PercentageGrowthSettings,
  RABInvestorProfitShareMode,
  RABOpexBufferFundingMode,
  RABTrackingDataset,
  RABTrackingRow,
  RABTrackingTotals,
  RabTrackingAchievement,
  RabTrackingItem,
  RabTrackingProject,
} from "./utils/rab-tracking";
```

- [ ] **Step 8: Tulis `modules/proyek/index.ts`**

```typescript
/**
 * Public API module proyek (RAB): anggaran proyek, revisi berjenjang,
 * realisasi bulanan, dan penyertaan modal investor.
 *
 * Server-safe. Helper murni untuk komponen client ada di `./client`.
 * Pintu baca sempit untuk module investor ada di `./public-queries`.
 */
export * from "./services/RabProjectRouteService";
export * from "./services/RabRevisionRouteService";
export * from "./services/RabApprovalService";
export * from "./services/RabRevisionApprovalService";
export * from "./services/RabApprovalReminderRouteService";
export * from "./services/RabStatusEvaluationService";
export * from "./services/ProyekService";

export {
  rabActualAchievementSchema,
  rabProjectCreateSchema,
  rabProjectUpdateSchema,
} from "./validators/rabProjectSchemas";

export {
  calculateEffectiveRabTargetSubscribers,
  calculateRabProjectedRevenue,
  calculateRabUnitCosts,
  getRabTargetBasisLabel,
  type RabTargetBasis,
} from "./client";
```

- [ ] **Step 9: Cabut RAB dari pintu finance**

`modules/finance/index.ts` — hapus baris berikut:

```
export * from "./services/RabApprovalService";
export * from "./services/RabRevisionApprovalService";
export * from "./services/RabStatusEvaluationService";
export * from "./services/RabRevisionRouteService";
export * from "./services/RabApprovalReminderRouteService";
export * from "./services/RabProjectRouteService";
```

dan blok `export { rabActualAchievementSchema, rabProjectCreateSchema, rabProjectUpdateSchema } from "./validation";`, serta empat nama RAB di blok re-export `./client` sehingga tersisa:

```typescript
export { buildDailyExpenseIndicators } from "./client";
```

`modules/finance/client.ts` — sisakan satu baris:

```typescript
export { buildDailyExpenseIndicators } from "./utils/daily-expense-indicators";
```

`modules/finance/repositories/index.ts` — hapus 5 baris `export * from "./Rab*";`.

`modules/finance/repositories/prisma-boundary.ts` — hapus 7 enum `Rab*`, sisakan `Prisma` dan `PrismaClient` (masih dipakai `FinanceService`, `FinanceStatsService`, `FinanceExpenseFacadeService`, `ExpenseRouteService`).

`modules/finance/services/FinanceService.ts` — hapus metode `getRabProjects` dan `createRabProject`, properti `private readonly rabService = new FinanceRabFacadeService()`, impor `FinanceRabFacadeService`, dan 7 enum `Rab*` dari `prisma-boundary`.

`modules/finance/services/FinanceExpenseFacadeService.ts` — hapus 4 sentuhan RAB yang muncul di `grep -n "rab\|Rab"`; pertahankan field `rabProjectId`/`rabItemId` pada payload expense bila ada (itu FK pengeluaran, bukan logika RAB).

```bash
rm modules/finance/validation.ts
```

`lib/validations/rab-project.ts` — arahkan ke `@/modules/proyek`.

- [ ] **Step 10: Arahkan importir di luar finance**

```bash
grep -rl '@/modules/finance/public-queries' modules app lib tests \
  | xargs sed -i '' 's#@/modules/finance/public-queries#@/modules/proyek/public-queries#g'
grep -rl '@/modules/finance/client' modules app lib tests \
  | xargs sed -i '' 's#@/modules/finance/client#@/modules/proyek/client#g'
```

**Jebakan terverifikasi:** `app/admin/pengeluaran/ExpensesClient.tsx:36` mengimpor
`buildDailyExpenseIndicators` dari `@/modules/finance/client` — fungsi itu TETAP di finance.
Sed di atas akan salah mengarahkannya. Setelah menjalankan sed, kembalikan baris itu:

```bash
sed -i '' 's#import { buildDailyExpenseIndicators } from "@/modules/proyek/client";#import { buildDailyExpenseIndicators } from "@/modules/finance/client";#' \
  app/admin/pengeluaran/ExpensesClient.tsx
grep -n "modules/finance/client\|modules/proyek/client" app/admin/pengeluaran/ExpensesClient.tsx
```
Expected: satu baris `@/modules/finance/client` untuk `buildDailyExpenseIndicators`, dan tidak ada
`@/modules/proyek/client` di file itu (impor RAB-nya dihapus di Task 3).

Lalu arahkan 14 route (13 route RAB + 1 cron) dan test API: ganti `from "@/modules/finance"` menjadi `from "@/modules/proyek"` **hanya** di file yang mengimpor simbol RAB:

```bash
grep -rln 'Rab' app/api/finance/rab-projects app/api/cron/rab-status-eval
```

Di `app/api/cron/rab-status-eval/route.ts`, satu-satunya perubahan adalah asal impornya:
`import { getRabStatusEvaluationService } from "@/modules/finance";` menjadi
`import { getRabStatusEvaluationService } from "@/modules/proyek";`. Pemanggilan
`getRabStatusEvaluationService().evaluateStatuses()` tidak berubah, dan path route-nya tetap.

Di `app/api/finance/rab-projects/route.ts`, `FinanceService` diganti `ProyekService`:

```typescript
import { ProyekService } from "@/modules/proyek";
// ...
const proyekService = new ProyekService();
const projects = await proyekService.getRabProjects(params);
```

- [ ] **Step 11: Pindahkan test modul dan arahkan impornya**

```bash
mkdir -p tests/modules/proyek
git mv tests/modules/finance/Rab*.test.ts tests/modules/proyek/
git mv tests/modules/finance/rab-*.test.ts tests/modules/proyek/
git mv tests/lib/rab-approval-reminder.test.ts tests/lib/rab-bottleneck-metrics.test.ts tests/modules/proyek/
git mv tests/lib/finance/rab-revision-variance.test.ts tests/modules/proyek/
grep -rl '@/modules/finance' tests/modules/proyek | xargs sed -i '' 's#@/modules/finance#@/modules/proyek#g'
```

**Jebakan:** `tests/modules/finance/webhookOutboxDurability.test.ts` cocok dengan glob `*rab*` (dari kata "Du**rab**ility"). Jangan pindahkan. Perintah di atas memakai `Rab*`/`rab-*` sehingga file itu tidak tersentuh — verifikasi dengan `ls tests/modules/finance/webhookOutboxDurability.test.ts`.

- [ ] **Step 12: Tulis test baru untuk pintu finance (Review Focus #1)**

`tests/modules/finance/ExpenseRepositoryRabInclude.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

import { ExpenseRepository } from "@/modules/finance/repositories/ExpenseRepository";

describe("ExpenseRepository tetap membawa identitas proyek", () => {
  it("menyertakan nama proyek dan item saat membaca daftar pengeluaran", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new ExpenseRepository({ expense: { findMany } } as never);

    await repo.findManyWithRelations({});

    const include = findMany.mock.calls[0][0].include;
    expect(include.rabProject).toEqual({ select: { id: true, name: true } });
    expect(include.rabItem).toEqual({ select: { id: true, name: true } });
  });

  it("menyaring realisasi pengeluaran berdasarkan proyek", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new ExpenseRepository({ expense: { findMany } } as never);

    await repo.findProjectExpenses("proyek-1");

    expect(findMany.mock.calls[0][0].where).toEqual({ rabProjectId: "proyek-1" });
  });
});
```

Signature sudah diverifikasi: `ExpenseRepository` punya `constructor(private client: PrismaClient = prisma)` dan metode daftarnya bernama `findManyWithRelations(where)`.

- [ ] **Step 13: Jalankan test baru, pastikan lulus**

```bash
npx vitest run tests/modules/finance/ExpenseRepositoryRabInclude.test.ts
```
Expected: 2 passed. Kalau gagal karena bentuk mock, perbaiki mock-nya — bukan produksi; include `rabProject`/`rabItem` harus memang masih ada.

- [ ] **Step 14: Tulis test pintu proyek (Review Focus #4)**

`tests/modules/proyek/public-queries.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import * as proyekPublicQueries from "@/modules/proyek/public-queries";

describe("pintu publik module proyek", () => {
  it("menyediakan lima query yang dipakai module investor", () => {
    expect(typeof proyekPublicQueries.findRabInvestmentSummaries).toBe("function");
    expect(typeof proyekPublicQueries.findRabInvestmentList).toBe("function");
    expect(typeof proyekPublicQueries.findRabInvestmentDetail).toBe("function");
    expect(typeof proyekPublicQueries.findRabInvestmentsWithSite).toBe("function");
    expect(typeof proyekPublicQueries.findRabProjectsForProfitShare).toBe("function");
  });
});
```

- [ ] **Step 15: Perbarui allowlist arsitektur untuk path modul yang baru**

Di `tests/architecture/module-public-api.test.ts`, ganti tiga path:
`modules/finance/services/RabStatusEvaluationService.ts` → `modules/proyek/services/RabStatusEvaluationService.ts`,
`modules/finance/services/RabProjectRouteService.ts` → `modules/proyek/services/RabProjectRouteService.ts`,
`modules/finance/repositories/RabProjectRepository.ts` → `modules/proyek/repositories/RabProjectRepository.ts`.

Allowlist diperbarui di task yang memindahkan filenya, bukan ditunda — kalau ditunda, suite penuh
merah sepanjang task-task berikutnya dan kehilangan daya sebagai gerbang.

- [ ] **Step 16: Verifikasi seluruh lapisan**

```bash
npm run typecheck
npx vitest run tests/modules/proyek tests/modules/finance tests/modules/investor tests/api/finance tests/architecture
```
Expected: typecheck tanpa error; seluruh test lulus. Dua kegagalan yang wajar muncul di sini dan harus diperbaiki sekarang, bukan ditunda: impor `@/modules/finance` yang masih menunjuk simbol RAB, dan mock `vi.mock("@/modules/finance/public-queries")` di test investor yang belum ikut diarahkan.

- [ ] **Step 17: Commit**

```bash
git add -A
git commit -m "$(cat <<'MSG'
refactor(proyek): pindahkan lapisan modul RAB ke modules/proyek

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 2: Pindahkan 13 route API ke `/api/proyek`

**Files:**
- Move: `app/api/finance/rab-projects/**` (13 file) → `app/api/proyek/**`
- Modify: `app/api/cron/rab-status-eval/route.ts` (jalur impor service saja; path route tetap)
- Test: `tests/api/proyek/**` (9 file dipindah dari `tests/api/finance/`), `tests/api/proyek/cron-rab-status-eval.test.ts` (baru)

**Interfaces:**
- Consumes: `@/modules/proyek` (Task 1) — `RabProjectRouteService`, `RabRevisionRouteService`, `RabApprovalService`, `RabRevisionApprovalService`, `RabApprovalReminderRouteService`, `RabStatusEvaluationService`, `ProyekService`, dan tiga schema Zod.
- Produces: endpoint `/api/proyek`, `/api/proyek/dashboard`, `/api/proyek/[id]`, `/api/proyek/[id]/{approve,copy,actuals,reminder,revision-profit-loss}`, `/api/proyek/[id]/revisions`, `/api/proyek/[id]/revisions/[revisionId]{,/submit,/approve,/reject}` — dipakai UI di Task 3.

- [ ] **Step 1: Pindahkan folder route**

```bash
mkdir -p app/api/proyek
git mv app/api/finance/rab-projects/route.ts app/api/proyek/route.ts
git mv app/api/finance/rab-projects/dashboard app/api/proyek/dashboard
git mv "app/api/finance/rab-projects/[id]" "app/api/proyek/[id]"
rmdir app/api/finance/rab-projects
```

Verifikasi: `find app/api/proyek -type f | wc -l` harus **13**, dan `test ! -d app/api/finance/rab-projects`.

- [ ] **Step 2: Pindahkan test API dan arahkan jalurnya**

```bash
mkdir -p tests/api/proyek
git mv tests/api/finance/rab-*.test.ts tests/api/proyek/
grep -rl 'finance/rab-projects' tests/api/proyek \
  | xargs sed -i '' 's#app/api/finance/rab-projects#app/api/proyek#g'
grep -rl '@/modules/finance' tests/api/proyek \
  | xargs sed -i '' 's#@/modules/finance#@/modules/proyek#g'
```

- [ ] **Step 3: Jalankan test API, pastikan lulus**

```bash
npx vitest run tests/api/proyek
```
Expected: 9 file test lulus. Kegagalan yang wajar: `vi.mock` yang masih menunjuk path modul/route lama — perbaiki jalurnya.

- [ ] **Step 4: Tulis test cron (Review Focus #3)**

`tests/api/proyek/cron-rab-status-eval.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

const evaluateStatuses = vi.fn().mockResolvedValue({ evaluated: 0, updated: 0 });

vi.mock("@/modules/proyek", () => ({
  getRabStatusEvaluationService: () => ({ evaluateStatuses }),
}));

describe("route cron evaluasi status proyek", () => {
  it("masih menemukan service-nya setelah modul pindah", async () => {
    const route = await import("@/app/api/cron/rab-status-eval/route");

    expect(typeof route.POST).toBe("function");
    expect(typeof route.GET).toBe("function");
  });
});
```

Yang dijaga test ini: modul route masih bisa dimuat, yaitu jalur impornya sah. Signature sudah diverifikasi — route memakai factory `getRabStatusEvaluationService()` dan metode `evaluateStatuses()`, bukan konstruktor kelas.

- [ ] **Step 5: Jalankan test cron**

```bash
npx vitest run tests/api/proyek/cron-rab-status-eval.test.ts
```
Expected: 1 passed.

- [ ] **Step 6: Perbarui peta otorisasi route**

Di `tests/architecture/financial-route-authorization.test.ts`, ganti 4 path route RAB dari
`app/api/finance/rab-projects/...` menjadi `app/api/proyek/...`, lalu jalankan:

```bash
npx vitest run tests/architecture/financial-route-authorization.test.ts
```
Expected: lulus. Diperbarui di task ini, bukan ditunda ke Task 5, supaya gerbang suite penuh
tidak merah sepanjang task berikutnya.

- [ ] **Step 7: Pastikan tidak ada sisa pemanggil endpoint lama di sisi server**

```bash
grep -rn "finance/rab-projects" --include="*.ts" --include="*.tsx" app modules lib worker scripts tests || echo "BERSIH"
```
Sisa yang muncul hanya boleh di `app/admin/pengeluaran/**` (diselesaikan Task 3). Selain itu harus "BERSIH".

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'MSG'
refactor(proyek): pindahkan route RAB ke /api/proyek

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 3: Pindahkan UI dan pecah `ExpensesClient`

**Files:**
- Create: `app/admin/proyek/page.tsx`, `app/admin/proyek/ProyekClient.tsx`, `types/admin-options.ts`
- Move: 31 file dari `app/admin/pengeluaran/` → `app/admin/proyek/` (daftar di Lampiran B)
- Modify: `app/admin/pengeluaran/ExpensesClient.tsx`, `app/admin/pengeluaran/expenses.types.ts`
- Delete: `app/admin/pengeluaran/rabTracking.ts` (re-export 7 baris; pemakainya diarahkan langsung ke `@/modules/proyek/client`)
- Test: `tests/ui/proyek/**` (8 file dipindah dari `tests/ui/`)

**Interfaces:**
- Consumes: endpoint `/api/proyek/**` (Task 2), `@/modules/proyek/client` (Task 1).
- Produces: halaman `/admin/proyek`; `types/admin-options.ts` mengekspor `interface SiteOption { id: string; name: string }` dan `interface CategoryOption { id: string; name: string; type: string; parentId?: string | null; _count?: { children: number } }` untuk dipakai dua halaman admin.

- [ ] **Step 1: Pindahkan 31 file UI**

```bash
mkdir -p app/admin/proyek
git mv app/admin/pengeluaran/RAB*.tsx app/admin/proyek/
git mv app/admin/pengeluaran/RABForm app/admin/proyek/RABForm
git mv app/admin/pengeluaran/rab-csv.ts app/admin/pengeluaran/rab-formatters.ts \
       app/admin/pengeluaran/rab-pdf.ts app/admin/pengeluaran/rabActualInput.ts \
       app/admin/pengeluaran/rabCalculations.ts app/admin/pengeluaran/rabRevisionTypes.ts \
       app/admin/pengeluaran/rabTypes.ts app/admin/proyek/
git mv app/admin/pengeluaran/rabView.helpers.tsx app/admin/proyek/
git mv app/admin/pengeluaran/ItemDisbursementModal.tsx app/admin/proyek/
git rm app/admin/pengeluaran/rabTracking.ts
```

`ItemDisbursementModal.tsx` tidak cocok dengan glob `RAB*`/`rab*` tetapi hanya dipakai `RABForm` — karena itu dipindah eksplisit. Verifikasi: `find app/admin/proyek -type f | wc -l` harus **31**.

- [ ] **Step 2: Arahkan impor di dalam UI proyek**

```bash
cd app/admin/proyek
grep -rl './rabTracking' . | xargs sed -i '' 's#"\./rabTracking"#"@/modules/proyek/client"#g'
grep -rl '/api/finance/rab-projects' . | xargs sed -i '' 's#/api/finance/rab-projects#/api/proyek#g'
cd ../../..
```

Lalu sunting manual setiap impor `from "./expenses.types"` di `app/admin/proyek/**` (saat ini `RABForm.tsx` mengimpor `SiteOption`) menjadi `from "@/types/admin-options"`.

- [ ] **Step 3: Buat `types/admin-options.ts`**

```typescript
/** Bentuk opsi ringan yang dipakai beberapa halaman admin. */
export interface SiteOption {
  id: string;
  name: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  _count?: { children: number };
}
```

Hapus `SiteOption`, `CategoryOption`, dan `RabBottleneckMetrics` dari `app/admin/pengeluaran/expenses.types.ts`; arahkan `expenses.helpers.tsx` dan `ExpensesClient.tsx` ke `@/types/admin-options`. `ExpenseFormItem.rabProjectId`/`rabItemId` dan `ExpenseItem.rabProject`/`rabItem` **tetap** — pengeluaran memang boleh ditautkan ke proyek.

- [ ] **Step 4: Daftar state bersama sebelum memecah**

Sebelum menyentuh `ExpensesClient.tsx`, tulis daftar: baca file itu dan catat setiap `useState`/`useApi`/handler yang dipakai cabang `activeTab === "rab"` **dan** cabang lain (kandidat yang sudah diketahui: `sites`, kategori, `rabRefreshKey`, `canCreate`, `SiteOption`). Simpan daftar itu di body commit nanti. Langkah ini mencegah state tertinggal di file yang salah.

- [ ] **Step 5: Buat `app/admin/proyek/ProyekClient.tsx`**

Potong dari `ExpensesClient.tsx`: cabang render `activeTab === "rab"` (termasuk blok di sekitar baris 2008), tombol header "Buat RAB Baru", state dan handler RAB (`editingRAB`, `viewingRAB`, `revisioningRAB`, `rabRefreshKey`, `handleEditRAB`, `handleViewRAB`, `handleOpenRABRevision`, `handleOpenRABModal`, pengambilan `/api/proyek` dan `/api/proyek/dashboard`, metrik bottleneck), impor `RABForm`/`RABList`/`RABView`/`RABRevisionForm`/`rabTypes`, dan interface lokal `RabBottleneckMetrics` (baris ~128). Komponen baru tidak punya `activeTab` — ia satu halaman, bukan tab. State bersama dari Step 4 disalin (bukan diimpor dari halaman pengeluaran).

- [ ] **Step 6: Buat `app/admin/proyek/page.tsx`**

```typescript
import { ensurePermission } from "@/lib/rbac";
import ProyekClient from "./ProyekClient";

export const metadata = {
  title: "Proyek (RAB)",
};

export default async function ProyekPage() {
  await ensurePermission("expense:read");
  return <ProyekClient />;
}
```

- [ ] **Step 7: Rampingkan `ExpensesClient.tsx`**

Hapus seluruh sisa RAB: tipe `activeTab` menjadi `"daily" | "coa"`, hilangkan tombol tab RAB, hilangkan percabangan `activeTab === "rab"`, hilangkan impor `RABForm`/`RABList`/`RABView`/`RABRevisionForm`/`rabTypes`/`RabBottleneckMetrics`, dan sederhanakan tombol header yang tadinya bercabang per-tab (`activeTab === "daily" ? handleOpenModal() : handleOpenRABModal()` menjadi `handleOpenModal()`). Verifikasi: `grep -ci "rab" app/admin/pengeluaran/ExpensesClient.tsx` hanya menyisakan kemunculan FK pengeluaran (`rabProjectId`, `rabItemId`, `rabProject`, `rabItem`) — tidak ada lagi komponen atau endpoint RAB.

- [ ] **Step 8: Pindahkan test UI**

```bash
mkdir -p tests/ui/proyek
git mv tests/ui/rab-*.test.ts tests/ui/proyek/
grep -rl 'admin/pengeluaran' tests/ui/proyek \
  | xargs sed -i '' 's#app/admin/pengeluaran#app/admin/proyek#g'
```

- [ ] **Step 9: Perbarui allowlist arsitektur untuk path UI yang baru**

Di `tests/architecture/module-public-api.test.ts`, ganti tiga path UI:
`app/admin/pengeluaran/RABForm.tsx` → `app/admin/proyek/RABForm.tsx`,
`app/admin/pengeluaran/RABView.tsx` → `app/admin/proyek/RABView.tsx`,
`app/admin/pengeluaran/RABList.tsx` → `app/admin/proyek/RABList.tsx`.
Tambahkan `app/admin/proyek/ProyekClient.tsx` bila ukurannya melewati batas yang dipakai file itu.

- [ ] **Step 10: Verifikasi**

```bash
npm run typecheck
npx vitest run tests/ui tests/architecture
grep -rn "finance/rab-projects" --include="*.ts" --include="*.tsx" app modules lib worker scripts tests || echo "BERSIH"
```
Expected: typecheck bersih, test UI dan arsitektur lulus, grep "BERSIH".

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "$(cat <<'MSG'
refactor(proyek): pindahkan UI RAB ke /admin/proyek dan ramping ExpensesClient

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 4: Daftarkan menu "Proyek (RAB)"

**Files:**
- Modify: `lib/menu-config.ts`, `components/layout/admin-sidebar/adminSidebarMenu.ts`, `components/layout/admin-sidebar/adminSidebarIcons.tsx`, `lib/financial-write-permissions.ts`
- Test: `tests/admin/menu-proyek.test.ts` (baru)

**Interfaces:**
- Consumes: halaman `/admin/proyek` (Task 3).
- Produces: entri menu `code: "FINANCE.PROYEK"` dengan resource izin `expense`.

- [ ] **Step 1: Tulis test yang gagal dulu (Review Focus #2)**

`tests/admin/menu-proyek.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { ADMIN_MENU_CONFIG } from "@/lib/menu-config";
import { filterAdminMenuItems } from "@/components/layout/admin-sidebar/adminSidebarMenu";

const findMenuByCode = (code: string) =>
  ADMIN_MENU_CONFIG.flatMap((item) => [item, ...(item.children ?? [])]).find(
    (item) => item.code === code,
  );

describe("menu Proyek (RAB)", () => {
  it("terdaftar dan menunjuk /admin/proyek", () => {
    const menu = findMenuByCode("FINANCE.PROYEK");

    expect(menu).toBeDefined();
    expect(menu?.path).toBe("/admin/proyek");
  });

  it("terlihat oleh role yang hanya punya izin expense:read", () => {
    const codes = filterAdminMenuItems({
      items: ADMIN_MENU_CONFIG,
      hasPermission: (permission) => permission === "expense:read",
      isSuperAdmin: false,
      isFeatureEnabled: (feature) => feature === "finance",
    })
      .find((item) => item.code === "FINANCE")
      ?.children?.map((anak) => anak.code);

    expect(codes).toContain("FINANCE.PROYEK");
  });
});
```

Signature sudah diverifikasi dari `tests/modules/presurvei/menu-presurvei.test.ts`:
`filterAdminMenuItems` menerima satu objek `{ items, hasPermission, isSuperAdmin, isFeatureEnabled }`.
`FINANCE.PROYEK` adalah anak blok `code: "FINANCE"` (`featureModule: "finance"`, section "Keuangan"),
tetangga `FINANCE.EXPENSE`.

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
npx vitest run tests/admin/menu-proyek.test.ts
```
Expected: FAIL — `expect(menu).toBeDefined()` gagal karena menu belum ada.

- [ ] **Step 3: Tambahkan entri menu**

Di `lib/menu-config.ts`, tepat setelah blok `FINANCE.EXPENSE`:

```typescript
      {
        // Di luar /admin/finance: halaman ini cukup `expense:read`, sama seperti
        // FINANCE.EXPENSE, tidak ikut gerbang `finance:read` milik layout finance.
        code: "FINANCE.PROYEK",
        name: "Proyek (RAB)",
        path: "/admin/proyek",
        icon: "HiOutlineClipboardDocumentList",
      },
```

Pastikan `HiOutlineClipboardDocumentList` sudah terdaftar di `components/layout/admin-sidebar/adminSidebarIcons.tsx`; kalau belum, tambahkan importnya ke peta ikon di file itu mengikuti pola tetangganya.

- [ ] **Step 4: Petakan code ke resource izin**

Di `components/layout/admin-sidebar/adminSidebarMenu.ts`, tambahkan ke `specialMappings`:

```typescript
    "FINANCE.PROYEK": "expense",
```

Tanpa baris ini, segmen terakhir `PROYEK` dipakai sebagai resource (`proyek`) yang tidak ada di DB, dan menu hilang untuk semua role non-superadmin.

- [ ] **Step 5: Jalankan test, pastikan lulus**

```bash
npx vitest run tests/admin/menu-proyek.test.ts tests/components/layout/admin-sidebar-menu.test.ts
```
Expected: semua lulus.

- [ ] **Step 6: Catat gerbang halaman baru**

Di `lib/financial-write-permissions.ts`, tambahkan `/admin/proyek` ke dokumentasi gerbang `expense:read` di tempat `/admin/pengeluaran` disebut.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'MSG'
feat(proyek): daftarkan menu Proyek (RAB) di sidebar admin

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

### Task 5: Kunci batas modul, perbarui test arsitektur, tutup dokumentasi

**Files:**
- Create: `tests/architecture/proyek-finance-boundary.test.ts`
- Modify: `docs/CHANGELOG.md`, `docs/project-memory/04-modules.md` (path di `tests/architecture/**` sudah diperbarui di Task 1–3)
- Test: file baru di atas

**Interfaces:**
- Consumes: seluruh hasil Task 1–4.
- Produces: jaring arsitektur yang menolak kembalinya kopling lama.

- [ ] **Step 1: Tulis test batas modul (Review Focus #5)**

`tests/architecture/proyek-finance-boundary.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const collectSourceFiles = (directory: string): string[] => {
  const absoluteDirectory = join(process.cwd(), directory);
  return readdirSync(absoluteDirectory).flatMap((entry) => {
    const absolutePath = join(absoluteDirectory, entry);
    const relativePath = join(directory, entry);

    if (statSync(absolutePath).isDirectory()) {
      return collectSourceFiles(relativePath);
    }

    return /\.(ts|tsx)$/.test(entry) ? [relativePath] : [];
  });
};

const readFile = (filePath: string) =>
  readFileSync(join(process.cwd(), filePath), "utf8");

describe("batas modul proyek dan finance", () => {
  it("finance tidak mengimpor module proyek", () => {
    const offenders = collectSourceFiles("modules/finance").filter((filePath) =>
      /@\/modules\/proyek/.test(readFile(filePath)),
    );

    expect(offenders).toEqual([]);
  });

  it("proyek menyentuh finance hanya lewat public-queries", () => {
    const offenders = collectSourceFiles("modules/proyek").filter((filePath) =>
      /@\/modules\/finance(?!\/public-queries)/.test(readFile(filePath)),
    );

    expect(offenders).toEqual([]);
  });

  it("tidak ada sisa pintu RAB di finance maupun endpoint lama", () => {
    // modules/proyek dikecualikan: ia satu-satunya pemilik sah pintu
    // @/modules/finance/public-queries (aturan kedua di atas yang menjaganya).
    const productionFiles = [
      ...collectSourceFiles("app"),
      ...collectSourceFiles("modules").filter(
        (filePath) => !filePath.startsWith(join("modules", "proyek")),
      ),
      ...collectSourceFiles("lib"),
      ...collectSourceFiles("components"),
    ];

    const staleGateImports = productionFiles.filter((filePath) =>
      /@\/modules\/finance\/(public-queries|validation)/.test(readFile(filePath)),
    );
    const staleEndpoints = productionFiles.filter((filePath) =>
      /finance\/rab-projects/.test(readFile(filePath)),
    );

    expect({ staleGateImports, staleEndpoints }).toEqual({
      staleGateImports: [],
      staleEndpoints: [],
    });
  });
});
```

Catatan: pengecualian `modules/proyek` di aturan ketiga sudah diputuskan di pre-flight, bukan ditinggalkan sebagai pilihan — `modules/proyek` adalah satu-satunya pemilik sah pintu `@/modules/finance/public-queries`, dan aturan kedua yang menjaga arah impornya.

- [ ] **Step 2: Jalankan test batas, pastikan lulus**

```bash
npx vitest run tests/architecture/proyek-finance-boundary.test.ts
```
Expected: 3 passed. Kalau gagal, yang diperbaiki adalah kodenya (sisa impor), bukan test-nya.

- [ ] **Step 3: Pastikan allowlist arsitektur sudah bersih**

Pembaruan path di `tests/architecture/module-public-api.test.ts` dan
`tests/architecture/financial-route-authorization.test.ts` dikerjakan di task yang memindahkan
filenya (Task 1 untuk service/repo, Task 2 untuk route, Task 3 untuk UI). Di sini hanya verifikasi
tidak ada path lama yang tertinggal:

```bash
grep -rn "modules/finance/services/Rab\|modules/finance/repositories/Rab\|admin/pengeluaran/RAB\|finance/rab-projects" tests/architecture || echo "BERSIH"
```
Expected: "BERSIH".

- [ ] **Step 4: Jalankan gerbang penuh**

```bash
npm run typecheck && npm test && npm run lint && npm run build:quick
```
Expected: keempatnya lulus. `npm test` adalah gerbang sesungguhnya di sini — 30 test RAB yang dipindah plus 5 test baru harus hijau tanpa satu pun di-skip.

- [ ] **Step 5: Smoke manual**

Jalankan `npm run dev`, lalu periksa:
`/admin/proyek` → daftar tampil, buat proyek baru, buka detail, ajukan revisi, approve (dengan role ber-`canApproveRab`), input realisasi bulanan, export CSV dan PDF.
`/admin/pengeluaran` → tab harian dan tab kategori jalan, dan baris pengeluaran yang tertaut proyek masih menampilkan nama proyek serta item-nya.
Sidebar → menu "Proyek (RAB)" muncul di section yang sama dengan "Pengeluaran".

- [ ] **Step 6: Tulis entri changelog**

Tambahkan di bagian `[Unreleased]` pada `docs/CHANGELOG.md`:

```markdown
### [2026-10-13] — Ekstraksi RAB (Proyek) menjadi modul proyek mandiri

- **Tipe**: [CHANGED]
- **Scope**: `modules/proyek`, `modules/finance`, `app/admin/proyek`, `app/api/proyek`
- **Author**: agent
- **Deskripsi**: Subsistem RAB (Proyek) dipindahkan keluar dari `modules/finance`
  dan `app/admin/pengeluaran` menjadi `modules/proyek` dengan halaman
  `/admin/proyek`. Kopling dua arah diselesaikan lewat pintu `public-queries` di
  tiap sisi: investor membaca RAB lewat `modules/proyek/public-queries`, dan
  proyek membaca realisasi pengeluaran lewat `modules/finance/public-queries`.
  `ExpensesClient.tsx` susut dari 2.100 baris menjadi dua tab. Perilaku tidak
  berubah; nama model Prisma tetap `Rab*` dan gate izin tetap `expense:*`,
  sehingga tidak ada migration maupun migrasi data role.
- **Files**: `modules/proyek/**`, `app/admin/proyek/**`, `app/api/proyek/**`,
  `modules/finance/{index,client,public-queries}.ts`,
  `app/admin/pengeluaran/ExpensesClient.tsx`, `lib/menu-config.ts`
- **Breaking**: ✅ Ya — endpoint `/api/finance/rab-projects/**` diganti
  `/api/proyek/**`; konsumennya hanya UI admin yang ikut dipindahkan.
```

Perbarui juga `docs/project-memory/04-modules.md`: tambahkan `proyek` ke daftar modul dan koreksi keterangan RAB yang masih menyebutnya bagian finance.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'MSG'
test(proyek): kunci batas modul proyek-finance dan tutup dokumentasi

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Lampiran A — 39 file modul yang pindah

`domain/entities/RabProjectEntity.ts`, `domain/ports/IRabProjectRepository.ts`;
`repositories/`: `RabDisbursementRepository.ts`, `RabInvestorQueryRepository.ts`, `RabInvestorRepository.ts`, `RabItemRepository.ts`, `RabProjectRepository.ts`, `RabProjectUpdateRepository.ts`, `RabWbsRepository.ts`, `rabProject.create-helpers.ts`, `rabProject.repository-helpers.ts`, `rabProject.repository-mutations.ts`, `rabProject.repository-queries.ts`, `rabProject.types.ts`, `rabProject.update-helpers.ts`, `rabProject.update-row-helpers.ts`, `shared/rabInvestmentCalculator.ts`;
`services/`: `RabApprovalReminderRouteService.ts`, `RabApprovalService.ts`, `RabProjectRouteService.ts`, `RabRevisionApprovalService.ts`, `RabRevisionRouteService.ts`, `RabStatusEvaluationService.ts`, `rab-project-route.helpers.ts`, `rab-revision-approval.helpers.ts`, `rab-revision-route.helpers.ts`, `rabProjectRouteSerializers.ts`, `FinanceRabFacadeService.ts` → `ProyekService.ts`;
`utils/`: `rab-approval-reminder.ts`, `rab-bottleneck-metrics.ts`, `rab-revision-variance.ts`, `rab-revisions.ts`, `rabTarget.ts`, `rab-tracking/{index,monthly-subscribers,tracking,types}.ts`;
`validators/rabProjectSchemas.ts`; `types/rab-revision.types.ts`.

## Lampiran B — 31 file UI yang pindah

`RABCompare.tsx`, `RABForm.tsx`, `RABItemsTable.tsx`, `RABList.tsx`, `RABRejectRevisionModal.tsx`, `RABRevisionForm.tsx`, `RABRevisionSummaryCards.tsx`, `RABRevisionTimeline.tsx`, `RABTrackingSection.tsx`, `RABVarianceTable.tsx`, `RABView.tsx`, `ItemDisbursementModal.tsx`;
`RABForm/hooks/{useRABCalculations,useRABExternalData,useRABGrowthModel,useRABItems,useRABTargetRevenue}.ts`;
`RABForm/tabs/{RABFormGrowthTab,RABFormItemsTab}.tsx`;
`RABForm/utils/{rabFormHelpers.tsx,rabFormPayloadBuilder.ts,rabFormValidation.ts}`;
`rab-csv.ts`, `rab-formatters.ts`, `rab-pdf.ts`, `rabActualInput.ts`, `rabCalculations.ts`, `rabRevisionTypes.ts`, `rabTypes.ts`, `rabView.helpers.tsx`.
Dihapus, tidak dipindah: `rabTracking.ts` (re-export 7 baris).
