# Frontend Plan — Modul Akuntansi (`/admin/akuntansi/`)

**Date**: 2026-05-20
**Scope**: 12 halaman UI + 1 layout + sidebar menu entry
**Pattern**: Mengikuti konvensi existing (`app/admin/finance/`)
- Server page (`page.tsx`): `ensurePermission()` → render Client component
- Client component (`*Client.tsx`): `"use client"`, fetch via `fetch()` atau TanStack Query
- UI: `@/components/ui/` (Button, Modal, ResponsiveTable, Combobox, DateRangePicker, etc.)
- Toast: `react-hot-toast`
- Icons: `react-icons/hi2`
- Permission hook: `usePermission` dari `@/hooks/use-permission`
- Currency format: `formatCurrency` dari `@/lib/utils`

---

## File Structure

```
app/admin/akuntansi/
├── layout.tsx                          # ensureAnyPermission(['accounting:read'])
├── page.tsx                            # redirect → /admin/akuntansi/jurnal
├── coa/
│   ├── page.tsx                        # COA tree manager
│   └── CoaClient.tsx                   # Tree view + CRUD modal
├── jurnal/
│   ├── page.tsx                        # List jurnal
│   ├── JurnalListClient.tsx            # Table + filter + pagination
│   ├── new/
│   │   ├── page.tsx                    # Form manual journal entry
│   │   └── ManualJournalClient.tsx     # Lines editor + balance check
│   ├── [id]/
│   │   ├── page.tsx                    # Detail + reverse button
│   │   └── JurnalDetailClient.tsx
│   └── recurring/
│       ├── page.tsx                    # Recurring templates
│       └── RecurringClient.tsx         # CRUD + preview next run
├── periode/
│   ├── page.tsx                        # List periode + close/reopen
│   └── PeriodeClient.tsx
├── rekonsiliasi/
│   ├── page.tsx                        # List reconciliation sessions
│   ├── RekonsiliasiListClient.tsx
│   └── [id]/
│       ├── page.tsx                    # Detail + matching UI
│       └── RekonsiliasiDetailClient.tsx
└── laporan/
    ├── page.tsx                        # redirect → trial-balance
    ├── trial-balance/
    │   ├── page.tsx
    │   └── TrialBalanceClient.tsx
    ├── laba-rugi/
    │   ├── page.tsx
    │   └── LabaRugiClient.tsx
    ├── neraca/
    │   ├── page.tsx
    │   └── NeracaClient.tsx
    ├── arus-kas/
    │   ├── page.tsx
    │   └── ArusKasClient.tsx
    ├── buku-kas/
    │   ├── page.tsx
    │   └── BukuKasClient.tsx
    └── buku-besar/
        ├── page.tsx
        └── BukuBesarClient.tsx
```

---

## Tasks (13 tasks)

### Task F1: Layout + Sidebar Menu Entry

**Files:**
- Create: `app/admin/akuntansi/layout.tsx`
- Create: `app/admin/akuntansi/page.tsx`
- Modify: `lib/menu-config.ts` (tambah menu "Akuntansi")

**Detail:**
- Layout: `ensureAnyPermission(['accounting:read'])`
- Page: `redirect('/admin/akuntansi/jurnal')`

**Sidebar menu entry** — tambah di `lib/menu-config.ts` setelah FINANCE (line ~401), masih di section `"Keuangan"`:

```ts
{
  code: "ACCOUNTING",
  name: "Akuntansi",
  path: "/admin/akuntansi",
  icon: "HiOutlineCalculator",
  children: [
    { code: "ACCOUNTING.JOURNAL", name: "Jurnal", path: "/admin/akuntansi/jurnal", icon: "HiOutlineDocumentText" },
    { code: "ACCOUNTING.COA", name: "Chart of Accounts", path: "/admin/akuntansi/coa", icon: "HiOutlineListBullet" },
    { code: "ACCOUNTING.PERIOD", name: "Periode", path: "/admin/akuntansi/periode", icon: "HiOutlineCalendarDays" },
    { code: "ACCOUNTING.RECONCILIATION", name: "Rekonsiliasi", path: "/admin/akuntansi/rekonsiliasi", icon: "HiOutlineScale" },
    { code: "ACCOUNTING.REPORTS", name: "Laporan", path: "/admin/akuntansi/laporan", icon: "HiOutlineChartPie" },
  ],
},
```

- Posisi: tepat setelah menu FINANCE, sebelum section "Komunikasi"
- Permission gate: `accounting:read` (via `getPermissionResource` → code "ACCOUNTING" → resource "accounting")
- Icon: `HiOutlineCalculator` (perlu tambah di `adminSidebarIcons.tsx` jika belum ada)

---

### Task F2: COA Tree Manager

**Files:**
- Create: `app/admin/akuntansi/coa/page.tsx`
- Create: `app/admin/akuntansi/coa/CoaClient.tsx`

**Detail:**
- Fetch: `GET /api/admin/accounting/coa` (perlu buat API route ini juga)
- Display: tree view (indent by parentId), columns: Code, Name, Type, Normal Side, Status
- Actions: Add (modal form), Edit (modal), Delete (confirm dialog)
- System accounts: disable delete button, show badge "System"
- Filter: by type (ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE)

**API route needed:**
- Create: `app/api/admin/accounting/coa/route.ts` (GET list, POST create)
- Create: `app/api/admin/accounting/coa/[id]/route.ts` (GET detail, PUT update, DELETE)

---

### Task F3: Jurnal List

**Files:**
- Create: `app/admin/akuntansi/jurnal/page.tsx`
- Create: `app/admin/akuntansi/jurnal/JurnalListClient.tsx`

**Detail:**
- Fetch: `GET /api/admin/accounting/journal` (perlu buat API route)
- Table: Entry Number, Date, Source, Description, Status, Total DR
- Filter: date range, source (dropdown), status
- Pagination: page + limit
- Click row → navigate to detail
- Button "Buat Jurnal Manual" → `/admin/akuntansi/jurnal/new`

**API route needed:**
- Create: `app/api/admin/accounting/journal/route.ts` (GET list, POST create manual)

---

### Task F4: Manual Journal Entry Form

**Files:**
- Create: `app/admin/akuntansi/jurnal/new/page.tsx`
- Create: `app/admin/akuntansi/jurnal/new/ManualJournalClient.tsx`

**Detail:**
- Form fields: entryDate (date picker), description (textarea)
- Lines editor: dynamic rows, each row = COA (searchable select), Side (DR/CR), Amount, Description
- Real-time balance check: show DR total, CR total, difference
- Submit disabled jika DR ≠ CR
- COA select: fetch from `/api/admin/accounting/coa?isActive=true&isPostable=true` (hanya postable)
- On success: redirect to detail page

---

### Task F5: Jurnal Detail + Reverse

**Files:**
- Create: `app/admin/akuntansi/jurnal/[id]/page.tsx`
- Create: `app/admin/akuntansi/jurnal/[id]/JurnalDetailClient.tsx`

**Detail:**
- Fetch: `GET /api/admin/accounting/journal/:id`
- Display: header info + lines table (COA name, DR, CR, description)
- Reverse button: only show if status=POSTED, open modal with reason input
- POST `/api/admin/accounting/journal/:id/reverse` with `{ reason }`
- Show reversal link if status=REVERSED

**API route needed:**
- Create: `app/api/admin/accounting/journal/[id]/route.ts` (GET detail)

---

### Task F6: Periode (Close/Reopen)

**Files:**
- Create: `app/admin/akuntansi/periode/page.tsx`
- Create: `app/admin/akuntansi/periode/PeriodeClient.tsx`

**Detail:**
- Fetch: `GET /api/admin/accounting/period` (perlu buat API route)
- Display: cards per period (month/year, status badge, date range)
- Actions: "Tutup Buku" (OPEN→CLOSED), "Buka Kembali" (CLOSED→REOPENED)
- Confirm dialog sebelum close/reopen
- Permission: close = `accounting:period:close`, reopen = `accounting:period:reopen`

**API route needed:**
- Create: `app/api/admin/accounting/period/route.ts` (GET list)

---

### Task F7: Recurring Templates

**Files:**
- Create: `app/admin/akuntansi/jurnal/recurring/page.tsx`
- Create: `app/admin/akuntansi/jurnal/recurring/RecurringClient.tsx`

**Detail:**
- Fetch: `GET /api/admin/accounting/recurring`
- Table: Name, Frequency, Day of Month, Status (active/inactive), Next Run
- CRUD: Add (modal with lines editor), Edit, Delete, Toggle active
- Lines editor: same pattern as manual journal (COA + side + amount)
- Show "Preview Next Run" date

---

### Task F8: Rekonsiliasi List + Create

**Files:**
- Create: `app/admin/akuntansi/rekonsiliasi/page.tsx`
- Create: `app/admin/akuntansi/rekonsiliasi/RekonsiliasiListClient.tsx`

**Detail:**
- Fetch: `GET /api/admin/accounting/reconciliation`
- Table: Statement Date, COA (bank account), Status, Statement Balance
- Create: modal form (select bank COA, statement date, statement balance, book balance)
- Click row → navigate to detail

---

### Task F9: Rekonsiliasi Detail (Matching UI)

**Files:**
- Create: `app/admin/akuntansi/rekonsiliasi/[id]/page.tsx`
- Create: `app/admin/akuntansi/rekonsiliasi/[id]/RekonsiliasiDetailClient.tsx`

**Detail:**
- 3-column layout: Matched (green), Unmatched Bank (red), Unmatched Book
- CSV upload: file input + format select (BCA/Mandiri/BNI/Generic)
- Auto-match button: POST auto-match endpoint, refresh
- Manual match: drag-drop or click to pair
- Complete button: finalize reconciliation
- Summary cards: matched count, unmatched count, statement vs book balance

---

### Task F10: Laporan — Trial Balance + Laba Rugi

**Files:**
- Create: `app/admin/akuntansi/laporan/page.tsx` (redirect)
- Create: `app/admin/akuntansi/laporan/trial-balance/page.tsx`
- Create: `app/admin/akuntansi/laporan/trial-balance/TrialBalanceClient.tsx`
- Create: `app/admin/akuntansi/laporan/laba-rugi/page.tsx`
- Create: `app/admin/akuntansi/laporan/laba-rugi/LabaRugiClient.tsx`

**Detail Trial Balance:**
- Input: asOfDate (date picker)
- Table: COA Code, COA Name, Type, Debit, Credit, Balance
- Footer: Total DR, Total CR, Balanced indicator (green/red)
- Export: print/PDF button (window.print CSS)

**Detail Laba Rugi:**
- Input: from + to (date range picker)
- Sections: Pendapatan (list + subtotal), Beban (list + subtotal), Laba/Rugi Bersih
- Redirect `/admin/finance/laba-rugi` → `/admin/akuntansi/laporan/laba-rugi`

---

### Task F11: Laporan — Neraca + Arus Kas

**Files:**
- Create: `app/admin/akuntansi/laporan/neraca/page.tsx`
- Create: `app/admin/akuntansi/laporan/neraca/NeracaClient.tsx`
- Create: `app/admin/akuntansi/laporan/arus-kas/page.tsx`
- Create: `app/admin/akuntansi/laporan/arus-kas/ArusKasClient.tsx`

**Detail Neraca:**
- Input: asOfDate
- 2-column layout: Aset (left) | Liabilitas + Ekuitas (right)
- Footer: Total Aset = Total L+E (balanced indicator)

**Detail Arus Kas:**
- Input: from + to
- 3 sections: Operasi, Investasi, Pendanaan
- Footer: Net Change, Opening Cash, Closing Cash

---

### Task F12: Laporan — Buku Kas + Buku Besar

**Files:**
- Create: `app/admin/akuntansi/laporan/buku-kas/page.tsx`
- Create: `app/admin/akuntansi/laporan/buku-kas/BukuKasClient.tsx`
- Create: `app/admin/akuntansi/laporan/buku-besar/page.tsx`
- Create: `app/admin/akuntansi/laporan/buku-besar/BukuBesarClient.tsx`

**Detail Buku Kas:**
- Input: COA select (filter type=ASSET, subtype=CURRENT_ASSET) + date range
- Table: Date, Entry Number, Description, Debit, Credit, Running Balance
- Header: Opening Balance, Footer: Closing Balance

**Detail Buku Besar:**
- Input: COA select (any postable) + date range
- Same table format as Buku Kas but for any account
- Show normal side indicator

---

### Task F13: API Routes COA + Journal + Period (CRUD)

**Files:**
- Create: `app/api/admin/accounting/coa/route.ts`
- Create: `app/api/admin/accounting/coa/[id]/route.ts`
- Create: `app/api/admin/accounting/journal/route.ts`
- Create: `app/api/admin/accounting/journal/[id]/route.ts`
- Create: `app/api/admin/accounting/period/route.ts`

**Detail:**
- COA: GET list (filter type/active), POST create, GET/:id, PUT/:id, DELETE/:id
- Journal: GET list (filter date/source/status, pagination), POST create manual, GET/:id detail
- Period: GET list (ordered by year desc, month desc)
- Semua pakai `createHandler` + factory functions dari `@/modules/accounting`

---

## Dependencies

```
F13 (API routes) → F2, F3, F4, F5, F6 (semua UI butuh API)
F1 (layout) → semua pages
F3 (jurnal list) → F4 (new), F5 (detail)
F8 (rekon list) → F9 (detail)
F10, F11, F12 (laporan) → independent (API sudah ada)
```

## Execution Order

1. **F13** — API routes CRUD (COA, Journal, Period) — prerequisite untuk UI
2. **F1** — Layout + sidebar
3. **F3** → **F4** → **F5** — Jurnal flow (list → create → detail)
4. **F2** — COA tree
5. **F6** — Periode
6. **F7** — Recurring
7. **F8** → **F9** — Rekonsiliasi
8. **F10** → **F11** → **F12** — Laporan (bisa paralel)

## Estimasi

~35-40 files baru, ~2500-3500 LOC frontend. Bisa dikerjakan dalam 2-3 sesi.
