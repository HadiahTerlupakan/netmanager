# PRD — Perbaikan Alur Procurement (PR → PO → Bayar)

**Tanggal**: 2026-07-14  
**Status**: Approved for implementation  
**Author**: agent  
**Scope**: restock (PR), procurement (PO), finance (pembayaran)

---

## 1. Latar Belakang

Diskusi produk menemukan gap di alur pengadaan:

1. **Restock (PR)** untuk jasa sempat menampilkan input harga — padahal sifat menu adalah pengajuan kebutuhan, bukan penawaran harga.
2. **PO auto-generate dari PR** menghasilkan `unitPrice = 0` dan supplier kosong, tapi halaman detail PO **tidak bisa edit** supplier maupun harga.
3. **Jasa tidak masuk PO** sama sekali — `generatePOFromPRs` hanya iterate `purchaseRequest.items` (barang).
4. **Menu "Tagihan Belum Bayar"** (`/admin/finance/unpaid`) ada dan berfungsi, tapi **tidak terdaftar di sidebar** (`lib/menu-config.ts`).

Akibatnya: admin tidak bisa mengisi harga/vendor pada PO hasil generate, total PO = Rp 0, GRN & accounting ikut salah, dan pembayaran PO sulit ditemukan di UI.

---

## 2. Tujuan

| # | Tujuan | Success Criteria |
|---|--------|------------------|
| T1 | PR (barang & jasa) murni pengajuan — tanpa harga | Form restock jasa tidak tampilkan harga; detail/list tidak tampilkan harga |
| T2 | Admin bisa set supplier + harga di PO (termasuk hasil auto-generate) | Edit supplier + unitPrice di `/admin/procurement/purchase-orders/[id]`; total recalculate |
| T3 | Jasa ikut masuk PO | `generatePOFromPRs` include `jasaItems`; PO detail tampil & bisa edit harga jasa |
| T4 | Status bayar mudah diakses | Menu `FINANCE.UNPAID` muncul di sidebar jika user punya `finance:read` |

---

## 3. Definisi Alur Standar

```
PR (restock)                    PO (procurement)                 Finance
─────────────                   ────────────────                 ───────
Staff: barang/jasa + qty        Admin: supplier + unitPrice      Bayar PO
Harga: TIDAK                    (edit di halaman PO)             finance/unpaid
Vendor: TIDAK                   → totalAmount, grandTotal        → UNPAID→PARTIAL→PAID
  ↓ APPROVED                      ↓ ORDERED                        ↓
Generate PO ──────────────────► GRN (barang) / Konfirmasi jasa    Expense + jurnal
```

**Aturan harga**:
- **PR** = tanpa harga (default 0, tidak ditampilkan di UI).
- **PO** = tempat admin input harga aktual + pilih vendor.
- **Bayar** = di Finance → Tagihan Belum Bayar (sudah ada, tinggal expose di menu).

---

## 4. Scope Perubahan

### 4.1 Sudah dikerjakan (sesi ini, sebelum PRD)
- [x] Hapus input Harga/Unit di `RestockFormModal` untuk jasa
- [x] Hapus auto-fill `hargaEstimasi` saat pilih jasa
- [x] Hapus tampilan harga di `RestockDetailModal`
- [x] Payload restock jasa tidak kirim `hargaPerUnit`

### 4.2 Yang diimplementasi sekarang

#### A. Sidebar Finance — Tagihan Belum Bayar
- **File**: `lib/menu-config.ts`
- **Change**: tambah child `FINANCE.UNPAID` → `/admin/finance/unpaid`
- **Permission**: `finance:read` (via `getPermissionResource` default = last segment `UNPAID` → perlu special mapping ke `finance`)

#### B. Edit supplier + harga di PO (barang)
- **Validator**: `updatePurchaseOrderSchema` + `supplierId` + `items: [{ id, unitPrice }]`
- **Port/Repo**: extend `PurchaseOrderMetadataUpdate` + `updateMetadata` recalculate `totalAmount`, `ppnAmount`, `grandTotal`
- **Service**: validasi supplier ACTIVE, resolve `vendorNpwp` snapshot
- **UI**: `PurchaseOrderEditClient` — dropdown supplier, input unitPrice per item, live total

#### C. Jasa masuk PO
- **Schema**: model `PurchaseOrderJasaItem` (jasaId, quantity, unitPrice, totalPrice) + relasi di `PurchaseOrder` & `Jasa`
- **Migration**: `add_purchase_order_jasa_items`
- **Generate**: `ProcurementService.generatePOFromPRs` include `jasaItems` dari PR
- **Repo create/read/update**: include jasa items; recalculate total = barang + jasa
- **UI**: section "Item Jasa" di detail PO, editable unitPrice

### 4.3 Out of Scope (iterasi berikutnya)
- Auto expense/jurnal khusus saat konfirmasi jasa selesai (saat ini bayar lewat flow PO payment yang sudah ada)
- 3-way match formal invoice vendor vs PO vs GRN/konfirmasi
- Ubah status bayar di halaman PO (tetap di Finance)

---

## 5. User Stories

### US-1 — Admin set harga PO hasil generate
> Sebagai admin procurement, saya ingin mengubah supplier dan harga item pada PO yang di-generate dari PR, supaya total PO benar sebelum GRN/pembayaran.

### US-2 — Jasa ikut di-order
> Sebagai admin, saya ingin item jasa dari PR muncul di PO dengan harga yang bisa saya isi, supaya jasa bisa dibayar lewat Tagihan Belum Bayar.

### US-3 — Temukan menu bayar PO
> Sebagai finance staff, saya ingin melihat menu "Tagihan Belum Bayar" di sidebar Keuangan bila saya punya izin finance, supaya bisa bayar PO tanpa hafal URL.

### US-4 — Staff tidak isi harga di restock
> Sebagai staff yang buat PR, saya hanya isi barang/jasa + jumlah (tanpa harga), karena harga ditentukan procurement di PO.

---

## 6. Acceptance Criteria

| ID | Kriteria | Verifikasi |
|----|----------|------------|
| AC1 | Form restock jasa tidak menampilkan field harga | UI inspection + test |
| AC2 | Detail PR jasa tidak menampilkan @Rp / total | UI inspection |
| AC3 | PO detail bisa ganti supplier (status ≠ PAID) | Manual + API PATCH |
| AC4 | PO detail bisa edit unitPrice barang → total recalculate | Manual + API |
| AC5 | Generate PO dari PR yang punya jasaItems → PO punya jasaItems | Unit/integration |
| AC6 | PO detail tampil jasa + bisa edit unitPrice jasa | Manual |
| AC7 | Menu "Tagihan Belum Bayar" muncul di sidebar jika `finance:read` | UI + RBAC |
| AC8 | Bayar PO dari finance/unpaid tetap berfungsi (regresi) | Manual smoke |
| AC9 | Migration Prisma ter-generate dan tercatat di CHANGELOG | File check |

---

## 7. Desain Teknis Ringkas

### 7.1 Schema baru
```prisma
model PurchaseOrderJasaItem {
  id              String   @id @default(uuid())
  purchaseOrderId String
  jasaId          String
  quantity        Int
  unitPrice       Float
  totalPrice      Float
  tenantId        String?
  // relations: purchaseOrder, jasa, tenant
  @@map("purchase_order_jasa_items")
}
```

### 7.2 API contract PATCH PO
```json
{
  "supplierId": "uuid | null",
  "expectedDate": "date | null",
  "notes": "string | null",
  "vendorNpwp": "15-16 digit | null",
  "fakturPajakNo": "string | null",
  "fakturPajakDate": "date | null",
  "items": [{ "id": "poItemId", "unitPrice": 15000 }],
  "jasaItems": [{ "id": "poJasaItemId", "unitPrice": 500000 }]
}
```

### 7.3 Recalc formula
```
totalAmount = Σ(barang.qty * unitPrice) + Σ(jasa.qty * unitPrice)
ppnAmount   = totalAmount * (ppnRate / 100)
grandTotal  = totalAmount + ppnAmount
```

### 7.4 Guard edit
- Tolak edit jika `paymentStatus === "PAID"`
- Supplier harus `ACTIVE` jika di-set
- `unitPrice >= 0`

---

## 8. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| PO existing dengan unitPrice 0 | Admin edit harga sebelum GRN/bayar |
| Migration di production | Wajib `prisma migrate deploy`, file migration di commit |
| Permission menu UNPAID salah resource | Special mapping `FINANCE.UNPAID` → `finance` di sidebar |
| Jasa di PO tanpa GRN path | Jasa tidak butuh GRN; konfirmasi tetap di restock; bayar via PO payment |

---

## 9. Rencana Implementasi (urutan)

1. Menu `FINANCE.UNPAID` + special mapping
2. Extend schema + migration `PurchaseOrderJasaItem`
3. Extend validator/port/repo/service update PO (supplier + harga barang + jasa)
4. Extend `generatePOFromPRs` include jasa
5. Update UI `PurchaseOrderEditClient`
6. CHANGELOG + verifikasi typecheck/test

---

## 10. Non-Goals

- Tidak mengubah alur payment status (tetap di Finance)
- Tidak memaksa harga di PR
- Tidak rebuild UI procurement dari nol
- Tidak auto-create journal khusus jasa di luar event `PURCHASE_ORDER_PAID` yang sudah ada
