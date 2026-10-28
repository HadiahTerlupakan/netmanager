# Generate Invoice Contoh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin-only, fully separate module that generates watermarked SAMPLE paid invoices (one PDF each, zipped) from packages, a map area and date rules, with history per mitra and identical re-download.

**Architecture:** A new `modules/sample-invoice` holds a pure generator (seedable RNG, no I/O), a jsPDF renderer and an adm-zip packer, a repository over one new tenant-scoped Prisma model, and a service that ties them together. The browser fetches named streets from Overpass (the production pod cannot reach it) and posts them with the form; the server validates, stores the generated set, and builds ZIPs on demand from the stored set, split into parts of at most 2,000 PDFs.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (main `prisma/schema.prisma`), jsPDF 4 (server-side), adm-zip, Vitest, existing `PetaUniversal` map.

**Spec:** `docs/superpowers/specs/2026-10-28-generate-invoice-contoh-design.md` (mockup: `docs/superpowers/specs/2026-10-28-generate-invoice-contoh-mockup.html`)

## Global Constraints

- Every PDF carries the red band text `CONTOH — BUKAN TAGIHAN ASLI`, a diagonal `CONTOH` watermark, and the footer `Dokumen ini dibuat otomatis sebagai contoh format. Nama, alamat, dan transaksi bersifat fiktif.` No option, flag or parameter may turn these off.
- The module never reads from or writes to billing (`Invoice`, `Payment`, `Pelanggan`), accounting, tax or regulatory tables, and emits no events.
- Phone numbers are never generated or stored in full: only `<prefix>-****-<4 digits>`, prefixes `0812, 0813, 0821, 0852, 0857, 0878, 0896`.
- Invoice number `CTH/YYYY/MM/NNNN`; customer code `CTH-NNNN` (NNNN = customer's 1-based position, zero-padded to 4).
- Payment methods: `Transfer bank`, `QRIS`, `E-wallet`, `Tunai`, equal odds.
- PPN 11%: `none` prints no PPN line; `inclusive` DPP = round(price / 1.11), PPN = price − DPP; `exclusive` DPP = price, PPN = round(price × 0.11), total = DPP + PPN. Rounding to whole rupiah, half up.
- No coordinates on the PDF. No logo.
- Months may not be after the current month (Asia/Jakarta). Due day 1–28 within the billing month. Random pay date: day 1 .. last day of the month, capped at today for the current month. Fixed pay date: day 1–28; rejected for the current month if that day is after today.
- Limits are per-tenant settings, defaults `maxCustomers 500`, `maxMonths 12`, `maxPdfs 2000`. The only fixed limit is `ZIP_PART_MAX_PDFS = 2000` per ZIP file.
- Radius 200 m – 10 km. At least 5 named streets required.
- Permission resource `invoice_contoh` with actions `read`, `create`, `update`, `delete`; not auto-granted to any role. Menu code `FINANCE.SAMPLE_INVOICES`, name `Invoice Contoh`, path `/admin/finance/invoice-contoh`.
- All user-facing copy in Indonesian. Work on branch `feat/invoice-contoh`; do not push to `main` (it deploys production) until the owner approves.
- Typecheck with `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck`; a plain run can crash out of memory locally and look like a pass. Ignore errors whose path starts with `.next/`.

## Review Focus

1. Re-download months later must print the stored generation date and identical content, not today's date — Task 1 pins dates to `generatedAt`; Task 5 test re-builds a ZIP and compares extracted text.
2. A stale or tampered street list from the browser (empty names, 10,000 entries, HTML in names) must be rejected or sanitized server-side — Task 5 validation tests.
3. A month in the range that is the current month, with a fixed pay day still in the future, must be rejected with a clear message, not silently produce a future payment date — Task 1 and Task 5 tests.
4. A tenant without `TaxConfig.companyName` must still get a usable form (empty issuer fields the admin fills) — Task 7 test on the issuer prefill endpoint.
5. Overpass returning zero named streets, timing out, or rate-limiting (HTTP 429) must leave the generate button disabled with a message, never a crash — Task 6 parser test for empty and error payloads.

---

### Task 1: Pure generator

**Files:**
- Create: `modules/sample-invoice/domain/types.ts`, `modules/sample-invoice/domain/indonesian-names.ts`, `modules/sample-invoice/domain/random.ts`, `modules/sample-invoice/domain/generate-sample-set.ts`, `modules/sample-invoice/domain/money.ts`
- Test: `tests/modules/sample-invoice/generate-sample-set.test.ts`, `tests/modules/sample-invoice/money.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type SamplePackage = { name: string; speed: string; price: number };
  type SampleStreet = { name: string; village?: string; district?: string; city?: string };
  type PpnMode = "none" | "inclusive" | "exclusive";
  type PayDateRule = { mode: "random" } | { mode: "fixed"; day: number };
  type SampleIssuer = { name: string; address: string; phone: string };
  type SampleGenerateInput = {
    mitraId: string; mitraName: string; issuer: SampleIssuer;
    packages: SamplePackage[]; customerCount: number;
    fromMonth: string; toMonth: string;            // "YYYY-MM"
    center: { lat: number; lng: number }; radiusM: number;
    dueDay: number; payDate: PayDateRule; ppn: PpnMode;
    streets: SampleStreet[];
  };
  type PaymentMethod = "Transfer bank" | "QRIS" | "E-wallet" | "Tunai";
  type SampleCustomer = { code: string; name: string; address: string; phoneMasked: string; packageIndex: number };
  type SampleInvoice = { number: string; customerIndex: number; month: string; dueDate: string; paidDate: string; method: PaymentMethod; dpp: number; ppn: number; total: number };
  type SampleSet = { customers: SampleCustomer[]; invoices: SampleInvoice[] };
  function monthsInRange(fromMonth: string, toMonth: string): string[];
  function splitPpn(price: number, mode: PpnMode): { dpp: number; ppn: number; total: number };
  function createRandom(seed: number): () => number;   // deterministic, [0,1)
  function generateSampleSet(input: SampleGenerateInput, opts: { today: string /* "YYYY-MM-DD" WIB */; random: () => number }): SampleSet;
  ```
  Dates in `SampleInvoice` are `"YYYY-MM-DD"` strings. Invoices are ordered by month, then customer.

- [ ] **Step 1: Write the failing tests**

`money.test.ts`:
```ts
expect(splitPpn(250000, "inclusive")).toEqual({ dpp: 225225, ppn: 24775, total: 250000 });
expect(splitPpn(250000, "exclusive")).toEqual({ dpp: 250000, ppn: 27500, total: 277500 });
expect(splitPpn(150000, "none")).toEqual({ dpp: 150000, ppn: 0, total: 150000 });
expect(monthsInRange("2026-11", "2027-02")).toEqual(["2026-11","2026-12","2027-01","2027-02"]);
```
`generate-sample-set.test.ts` (use `createRandom(42)`, 2 packages, 5 streets, 10 customers, `2026-08`..`2026-10`, today `2026-10-28`):
- `it("one invoice per customer per month, customer data fixed across months")`: 30 invoices; for each customer, all 3 invoices share `customerIndex` and the customer's `packageIndex` drives `dpp/ppn/total`.
- `it("numbers and codes use the CTH prefix and customer position")`: `customers[6].code === "CTH-0007"`; the September invoice of customer 7 has `number === "CTH/2026/09/0007"`.
- `it("masks every phone number")`: every `phoneMasked` matches `/^(0812|0813|0821|0852|0857|0878|0896)-\*\*\*\*-\d{4}$/`.
- `it("addresses use only the given streets")`: every address starts with `Jl. ` or the street name as given, contains one of the 5 street names, a house number 1–200, and the street's village/district/city when present, comma separated.
- `it("random pay dates stay inside the month and not after today")`: October dates ≤ `2026-10-28`; August dates within `2026-08-01..2026-08-31`.
- `it("fixed pay day is used for every invoice")`: `{mode:"fixed", day: 5}` → every `paidDate` ends with `-05`.
- `it("due date is the due day of the billing month")`: `dueDay 10` → `dueDate === "2026-09-10"` for September.
- `it("same seed gives the same set")`: two runs with `createRandom(42)` are deep-equal; `createRandom(43)` differs.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/modules/sample-invoice`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the five files**

`createRandom`: mulberry32. `indonesian-names.ts`: at least 60 first names and 60 family names, mixed regions and genders, exported as two arrays. Address format: `"<street> No. <n>, <village>, <district>, <city>"`, omitting missing parts; prefix `Jl. ` only when the OSM name does not already start with `Jl`/`Jalan`/`Gg`/`Gang`. `generateSampleSet` does no validation (Task 5 does); it assumes valid input.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/modules/sample-invoice`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git checkout -b feat/invoice-contoh
git add modules/sample-invoice/domain tests/modules/sample-invoice
git commit -m "feat(invoice-contoh): pure sample invoice generator"
```

### Task 2: PDF renderer and ZIP packer

**Files:**
- Create: `modules/sample-invoice/services/render-sample-pdf.ts`, `modules/sample-invoice/services/pack-sample-zip.ts`
- Test: `tests/modules/sample-invoice/render-and-pack.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces:
  ```ts
  const ZIP_PART_MAX_PDFS = 2000;
  type ZipPart = { key: string; label: string; invoiceNumbers: string[] }; // key "2026-09" or "2026-09-2"
  function planZipParts(invoices: SampleInvoice[]): ZipPart[];
  function renderSamplePdf(args: { issuer: SampleIssuer; customer: SampleCustomer; pkg: SamplePackage; invoice: SampleInvoice; ppn: PpnMode }): Buffer;
  function packSampleZip(args: { set: SampleSet; packages: SamplePackage[]; issuer: SampleIssuer; ppn: PpnMode; part: ZipPart }): Buffer;
  function zipFileName(mitraName: string, part: ZipPart, fromMonth: string, toMonth: string, single: boolean): string;
  ```

- [ ] **Step 1: Write the failing tests**

- `planZipParts`: 3 months × 10 invoices → one part `{ key: "all" }` when total ≤ 2000; 3 months × 900 → three parts keyed `2026-08`, `2026-09`, `2026-10`; one month × 4500 → `2026-10-1`, `2026-10-2`, `2026-10-3` with 2000/2000/500 numbers.
- `renderSamplePdf` output (jsPDF's default uncompressed content stream, read as latin1; search ASCII fragments, so check `BUKAN TAGIHAN ASLI` rather than the em dash) contains `BUKAN TAGIHAN ASLI`, `CONTOH`, `LUNAS`, the invoice number, the masked phone, the footer sentence, and for `ppn: "none"` does NOT contain `PPN`; never contains the strings `lat`, `lng` or a coordinate pattern `/-?\d+\.\d{4,}/`.
- `packSampleZip`: entries named `YYYY-MM/CTH-NNNN.pdf`, count equals `part.invoiceNumbers.length`.
- `zipFileName("Mitra Selawangi", {key:"all"...}, "2026-05","2026-10", true) === "contoh-invoice-mitra-selawangi-202605-202610.zip"`; for a part: `"contoh-invoice-mitra-selawangi-2026-09.zip"`.

- [ ] **Step 2: Run tests, expect FAIL**

Run: `npx vitest run tests/modules/sample-invoice/render-and-pack.test.ts`

- [ ] **Step 3: Implement**

jsPDF on the server: `new jsPDF({ unit: "mm", format: "a4" })`, built-in Helvetica (no font files). Watermark via `doc.saveGraphicsState(); doc.setGState(new doc.GState({ opacity: 0.15 }))`, rotated text. Layout follows the mockup's right panel. Rupiah format `Rp250.000` (dot thousands, no decimals). Dates printed `10 Sep 2026` (Indonesian month abbreviations). ZIP via `new AdmZip()`, `addFile`, `toBuffer()`.

- [ ] **Step 4: Run tests, expect PASS**

- [ ] **Step 5: Commit** — `feat(invoice-contoh): watermarked PDF renderer and ZIP packer`

### Task 3: Model, migration, repository

**Files:**
- Modify: `prisma/schema.prisma` (new model; add `sampleInvoiceBatches SampleInvoiceBatch[]` to `Tenant`)
- Create: `prisma/migrations/20261029090000_add_sample_invoice_batches/migration.sql`, `modules/sample-invoice/repositories/SampleInvoiceBatchRepository.ts`
- Test: `tests/modules/sample-invoice/repository.test.ts`

**Interfaces:**
- Produces:
  ```prisma
  model SampleInvoiceBatch {
    id          String   @id @default(uuid())
    tenantId    String
    mitraId     String
    mitraName   String
    createdById String
    createdByName String
    generatedAt DateTime                 // the "today" used to generate; all printed dates derive from the set
    input       Json                     // SampleGenerateInput without streets
    sampleSet   Json                     // SampleSet
    customerCount Int
    invoiceCount  Int
    fromMonth   String
    toMonth     String
    createdAt   DateTime @default(now())
    tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
    @@index([tenantId, mitraId, createdAt])
    @@map("sample_invoice_batches")
  }
  ```
  ```ts
  class SampleInvoiceBatchRepository {
    create(data: Omit<SampleInvoiceBatchRow, "id" | "createdAt">): Promise<SampleInvoiceBatchRow>;
    list(filter: { mitraId?: string; page: number; limit: number }): Promise<{ items: SampleInvoiceBatchSummary[]; total: number }>;
    findById(id: string): Promise<SampleInvoiceBatchRow | null>;
    delete(id: string): Promise<void>;
  }
  ```
  `SampleInvoiceBatchSummary` omits `input` and `sampleSet`. No `mitraId` foreign key (mitra lives in another database).

- [ ] **Step 1: Write the failing test** — repository with mocked `@/lib/prisma`: `list` selects without `sampleSet`/`input`, orders by `createdAt desc`, filters `mitraId` when given; `delete` calls `deleteMany({ where: { id } })` so tenant isolation applies.
- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Add model, write migration SQL by hand (CREATE TABLE, index, FK to tenants ON DELETE CASCADE), run `npx prisma generate`, implement repository with the tenant-isolated `prisma` from `@/lib/prisma`.** Do not add the model to `lib/prisma-ignore-models.ts`.
- [ ] **Step 4: Apply the migration to local Postgres (`docker exec -i netmanager-postgres-app psql ... < migration.sql`), run tests, expect PASS.**
- [ ] **Step 5: Commit** — `feat(invoice-contoh): sample invoice batch model and repository`

### Task 4: Limits settings

**Files:**
- Create: `modules/sample-invoice/services/sample-invoice-limits.ts`
- Test: `tests/modules/sample-invoice/limits.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type SampleInvoiceLimits = { maxCustomers: number; maxMonths: number; maxPdfs: number };
  const DEFAULT_SAMPLE_INVOICE_LIMITS: SampleInvoiceLimits = { maxCustomers: 500, maxMonths: 12, maxPdfs: 2000 };
  function getSampleInvoiceLimits(tenantId: string): Promise<SampleInvoiceLimits>;
  function saveSampleInvoiceLimits(tenantId: string, limits: SampleInvoiceLimits): Promise<SampleInvoiceLimits>;
  ```
  Stored in `Settings` with key `invoice_contoh.limits`, `value` = JSON string, scoped by `tenantId`.

- [ ] **Step 1: Failing tests** — missing row → defaults; stored partial/invalid JSON → defaults for the bad fields; save rejects values < 1 or non-integers with a thrown `Error` whose message is Indonesian; save upserts by `(tenantId, key)`.
- [ ] **Step 2: Run, FAIL** — **Step 3: Implement** — **Step 4: Run, PASS**
- [ ] **Step 5: Commit** — `feat(invoice-contoh): per-tenant generate limits`

### Task 5: Service and API routes

**Files:**
- Create: `modules/sample-invoice/services/SampleInvoiceService.ts`, `modules/sample-invoice/validators/generate-input.ts`, `modules/sample-invoice/index.ts`
- Create routes: `app/api/admin/sample-invoices/route.ts` (GET list, POST generate), `app/api/admin/sample-invoices/[id]/route.ts` (DELETE), `app/api/admin/sample-invoices/[id]/download/route.ts` (GET `?part=<key>`), `app/api/admin/sample-invoices/limits/route.ts` (GET, PUT), `app/api/admin/sample-invoices/issuer/route.ts` (GET prefill)
- Test: `tests/modules/sample-invoice/service.test.ts`, `tests/api/admin-sample-invoices.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces (service):
  ```ts
  generateSampleBatch(tenantId: string, actor: { id: string; name: string }, raw: unknown, now?: Date): Promise<{ batchId: string; parts: ZipPart[] }>;
  listSampleBatches(filter: { mitraId?: string; page: number; limit: number });
  getSampleBatchParts(id: string): Promise<ZipPart[] | null>;
  buildSampleBatchZip(id: string, partKey: string): Promise<{ fileName: string; buffer: Buffer } | null>;
  deleteSampleBatch(id: string): Promise<void>;
  getIssuerPrefill(tenantId: string): Promise<SampleIssuer>; // name from TaxConfig.companyName or "", address/phone ""
  ```
  POST returns `{ batchId, parts }`; the UI then downloads each part via the download route.
  Permissions: GET list/download/issuer → `invoice_contoh:read`; POST → `invoice_contoh:create`; PUT limits → `invoice_contoh:update`; DELETE → `invoice_contoh:delete`.

- [ ] **Step 1: Failing tests (zod validator + service with mocked repo/limits):**
  - rejects `toMonth` after the current WIB month; rejects `fromMonth > toMonth`;
  - rejects `customerCount > limits.maxCustomers`, month count `> maxMonths`, `customerCount × months > maxPdfs`, each with a message naming the limit and the requested number;
  - rejects fixed pay day after today when the range includes the current month;
  - rejects `radiusM` outside 200–10000, `dueDay` outside 1–28, empty `packages`, non-positive or non-integer prices;
  - streets: trims names, strips `<`, `>`, drops empty names, dedupes, caps at 2,000 entries; rejects when fewer than 5 remain;
  - stores `generatedAt = now`, `input` without `streets`, and a seed-derived set; `buildSampleBatchZip` twice on the same batch yields ZIPs whose extracted PDF texts are equal (Review Focus 1);
  - nothing in the service imports from `@/modules/finance`, `@/modules/accounting`, `@/modules/tax`, `@/modules/regulatory` or `@/lib/event-bus` (static check in the test by reading the module's files).
- [ ] **Step 2: Run, FAIL**
- [ ] **Step 3: Implement.** Seed: random 32-bit int stored inside `input.seed`, so re-download can regenerate PDFs from `sampleSet` without re-randomising. Download route responds `Content-Type: application/zip` and `Content-Disposition: attachment; filename="<zipFileName>"`. Route handlers follow `app/api/admin/payment-gateway/transactions/route.ts` (`createHandler`, `apiSuccess`).
- [ ] **Step 4: Run, PASS**
- [ ] **Step 5: Commit** — `feat(invoice-contoh): generate, history, download and limits API`

### Task 6: Overpass street fetch (browser)

**Files:**
- Create: `app/admin/finance/invoice-contoh/overpass.ts`
- Test: `tests/admin/invoice-contoh/overpass.test.ts` with a recorded fixture `tests/admin/invoice-contoh/fixtures/overpass-cariu.json`

**Interfaces:**
- Produces:
  ```ts
  function buildOverpassQuery(center: { lat: number; lng: number }, radiusM: number): string;
  function parseOverpassStreets(json: unknown): SampleStreet[];
  function fetchStreets(center, radiusM, signal?: AbortSignal): Promise<{ ok: true; streets: SampleStreet[] } | { ok: false; message: string }>;
  ```
  Endpoint `https://overpass-api.de/api/interpreter` (POST, `data=` form body), 30 s timeout. Admin levels used: 7 → village, 6 → district, 5 → city.

- [ ] **Step 1: Record the fixture** by running the query against the live endpoint for center `-6.5091, 107.1352`, radius 2000; keep at most 40 streets in the fixture.
- [ ] **Step 2: Failing tests** — fixture → ≥5 streets with names and at least one with `village`; deduped by `name+village`; unnamed ways ignored; `parseOverpassStreets({})` → `[]`; `fetchStreets` maps HTTP 429 and timeout to `{ ok: false, message }` in Indonesian (mock `fetch`).
- [ ] **Step 3: Implement.** The query must return, for each named highway way in the radius, its name and the admin areas (levels 5–7) containing one of its nodes; verify against the live endpoint before committing.
- [ ] **Step 4: Run, PASS** — **Step 5: Commit** — `feat(invoice-contoh): fetch named streets from OpenStreetMap`

### Task 7: Admin page, menu and permission

**Files:**
- Create: `app/admin/finance/invoice-contoh/page.tsx`, `InvoiceContohClient.tsx`, `GenerateForm.tsx`, `BatchHistory.tsx`, `LimitsPanel.tsx`
- Modify: `lib/menu-config.ts` (after `FINANCE.PAYMENT_GATEWAY_TRANSACTIONS`), `components/layout/admin-sidebar/adminSidebarMenu.ts` (`"FINANCE.SAMPLE_INVOICES": "invoice_contoh"`), `lib/permission-config.ts` (add `"invoice_contoh"` to the KEUANGAN group), `lib/resource-capabilities.ts` (`invoice_contoh: { actions: ["read","create","update","delete"], description: "Invoice contoh untuk demo dan contoh format" }`)
- Test: `tests/admin/invoice-contoh/generate-form.test.tsx`, `tests/lib/menu-permission-invoice-contoh.test.ts`

**Interfaces:**
- Consumes: Task 5 routes, Task 6 `fetchStreets`, `PetaUniversal` (`onKlik(lat,lng)`), `GET /api/admin/mitra`.

- [ ] **Step 1: Failing tests**
  - menu test: the menu entry exists with the pinned code/name/path, maps to `invoice_contoh`, and the resource is in KEUANGAN with the four actions.
  - form test (Testing Library, mocked fetch): generate button disabled until a mitra, ≥1 package, a map point and ≥5 streets exist; shows "Jumlah PDF: N" live; shows the limit message when N exceeds `maxPdfs`; issuer fields prefilled from `/issuer` and empty-but-editable when the prefill name is `""` (Review Focus 4); Overpass failure message is shown and the button stays disabled (Review Focus 5).
- [ ] **Step 2: Run, FAIL**
- [ ] **Step 3: Implement** the page (`ensurePermission("invoice_contoh:read")`, layout as `app/admin/finance/payment-gateway/page.tsx`), form per mockup (packages table with add/remove rows, radius input with a circle when the map engine supports children, otherwise a centre marker and the radius value), history table with mitra filter, per-part download buttons, delete with an in-page confirm (no `window.confirm`), limits panel shown only with `invoice_contoh:update`. Toasts via the existing `components/ui/Toast.tsx`.
- [ ] **Step 4: Run, PASS; then typecheck, lint, prettier on changed files.**
- [ ] **Step 5: Commit** — `feat(invoice-contoh): admin page, menu and permission`

### Task 8: End-to-end check

- [ ] Run the full suite (`npx vitest run`) and typecheck (see Global Constraints); re-run any timeout failures alone.
- [ ] Start the app locally, grant `invoice_contoh` to a local admin role, generate 20 customers × 3 months, download, open three PDFs and confirm band, watermark, LUNAS, masked phone, no coordinates; re-download and compare.
- [ ] Generate 700 customers × 3 months with limits raised, confirm three ZIP parts.
- [ ] Report to the owner; push only after approval.
