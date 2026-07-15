# PRD: Admin Map — Site ID Support

| Field | Value |
|-------|-------|
| **ID** | PRD-MAP-SITE-ID-2026-07-15 |
| **Tanggal** | 2026-07-15 |
| **Author** | agent |
| **Status** | Implemented |
| **Scope** | `modules/map`, `app/api/map`, `components/map`, `app/admin/map`, `prisma/schema.prisma` |
| **Related** | Multi-tenant map sudah ada (`tenantId`); entity network inventory (`Odc`, `Odp`, `Pole`, `Pelanggan`, dll.) sudah punya `siteId` |

---

## 1. Latar Belakang

Halaman [`/admin/map`](app/admin/map/page.tsx) menampilkan peta jaringan FTTH (node ODC/ODP/OTB/pole/joinbox + fiber edge).

### Kondisi saat ini

| Aspek | Status |
|-------|--------|
| Multi-tenant (`tenantId`) | ✅ Sudah — filter di repository via `buildTenantWhere` |
| Isolasi data per tenant | ✅ Sudah — non-superadmin wajib `tenantId` |
| Filter / assignment per **site** | ❌ Belum |
| Kolom `siteId` di `MappingNode` / `MappingEdge` / `MapSettings` | ❌ Tidak ada |

### Masalah

1. Satu tenant sering punya **banyak site** (area/cabang). Map menampilkan **semua node tenant** sekaligus → peta ramai, sulit difokuskan per area.
2. Entity inventory network (`Odc`, `Odp`, `Pole`, `Pelanggan`, dll.) sudah punya `siteId`, tapi layer mapping (`MappingNode`) **tidak**. Data inventory dan map tidak bisa di-align per site.
3. Operator lapangan / admin site-level ingin hanya melihat & mengedit network map site mereka.
4. Sync dari inventory → map (jika ada / akan ada) tidak punya target site yang jelas.

### Yang sudah bagus (jangan diubah)

- Isolasi multi-tenant lewat [`modules/map/utils/tenantContext.ts`](modules/map/utils/tenantContext.ts)
- Auto-set `tenantId` saat create node/edge/settings
- Super admin bypass filter tenant
- Permission RBAC: `map:read`, `map:create`, `map:update`, `map:delete` (dan setara)

---

## 2. Tujuan

| # | Tujuan | Success Criteria |
|---|--------|------------------|
| T1 | Setiap `MappingNode` bisa di-assign ke site | Kolom `siteId` ada, nullable, FK ke `Sites` |
| T2 | Admin bisa filter map per site | Query `?siteId=` di API nodes/edges/statistics; UI dropdown filter site |
| T3 | Create/update node bisa set site | Body create/update menerima `siteId`; validasi site milik tenant yang sama |
| T4 | Isolasi multi-tenant tetap utuh | Filter `siteId` selalu **di dalam** scope `tenantId`; cross-tenant site ditolak |
| T5 | Data existing tidak break | `siteId` nullable; node lama tetap tampil (filter "Semua Site") |
| T6 | Edge mengikuti konteks site source (opsional fase 1) | Edge tidak wajib punya `siteId` sendiri di fase 1; filter edge by nodes in site |

---

## 3. Definisi & Aturan Domain

### 3.1 Hierarki

```
Tenant
  └── Site (Sites)
        └── MappingNode (ODC, ODP, OTB, Pole, Joinbox, Customer, ...)
              └── MappingEdge (source → target fiber)
```

- **Tenant** = isolasi data organisasi (sudah ada).
- **Site** = area operasional dalam satu tenant (kantor cabang / POP / cluster).
- **Node** boleh tanpa site (`siteId = null`) = "belum di-assign" / global tenant.

### 3.2 Aturan bisnis

| Aturan | Detail |
|--------|--------|
| R1 | `siteId` **nullable** — node existing & node “belum di-site-kan” valid |
| R2 | Jika `siteId` diisi → site harus exist, `isActive = true` (atau allow inactive untuk read?), dan `site.tenantId === ctx.tenantId` (kecuali super admin) |
| R3 | Super admin: boleh pilih tenant + site; filter site tetap opsional |
| R4 | User non-superadmin: list site hanya dari `session.tenantId` |
| R5 | Filter UI default: **"Semua Site"** (tidak filter `siteId`) — backward compatible |
| R6 | Saat filter site aktif: tampilkan node dengan `siteId = X` **plus opsi** node `siteId = null`? → **Default: hanya node site X** (lebih clean). Toggle "Sertakan node tanpa site" opsional fase 2 |
| R7 | Edge: ditampilkan jika **source ATAU target** (prefer: **keduanya**) berada di set node yang lolos filter site. Rekomendasi fase 1: edge di mana **source node** ada di filtered nodes |
| R8 | `MapSettings` (center zoom): **per tenant dulu**; settings per-site = **fase 2** |
| R9 | Import CSV / sync: dukung kolom `siteId` atau `siteCode` opsional; invalid site → skip row / error row (ikuti pola error import existing) |

### 3.3 Keamanan

- **IDOR**: request dengan `siteId` milik tenant lain harus 404/400, bukan leak data.
- Validasi site ownership di **service layer**, bukan hanya UI.
- Permission map tidak diganti; site filter adalah data isolation tambahan di dalam permission yang sama.
- (Opsional fase 2) batasi user ke `UserSite` assignment — **out of scope fase 1** kecuali sudah trivial.

---

## 4. User Stories

### US-1 — Filter map per site
> Sebagai admin jaringan, saya ingin memilih site di toolbar map supaya hanya node & fiber site tersebut yang tampil, agar peta tidak campur area lain.

### US-2 — Assign site saat buat/edit node
> Sebagai admin, saya ingin set site saat create/edit node (dropdown), supaya asset map terklasifikasi per area.

### US-3 — Node tanpa site tetap ada
> Sebagai admin yang data lawas-nya belum di-site-kan, saya ingin node tanpa site tetap muncul saat filter "Semua Site", dan bisa di-assign site belakangan.

### US-4 — Tenant isolation tetap aman
> Sebagai platform, saya ingin admin tenant A tidak bisa filter/assign site milik tenant B meskipun mengetahui UUID site.

### US-5 — Super admin overview
> Sebagai super admin, saya ingin tetap melihat semua node lintas tenant, dan opsional filter site setelah konteks tenant jelas.

---

## 5. Scope Perubahan

### 5.1 In Scope (Fase 1 — MVP)

#### A. Database / Prisma

**Model terdampak:**

```prisma
model MappingNode {
  // ... existing fields
  tenantId  String?
  siteId    String?   // BARU
  tenant    Tenant?   @relation(...)
  site      Sites?    @relation(fields: [siteId], references: [id], onDelete: SetNull)

  @@index([tenantId])
  @@index([siteId])           // BARU
  @@index([tenantId, siteId]) // BARU (filter komposit)
  @@map("mapping_nodes")
}
```

- Relasi balik di `Sites`: `mappingNodes MappingNode[]`
- **Tidak** ubah `MappingEdge` di fase 1 (filter edge via node set)
- **Tidak** ubah `MapSettings` di fase 1

**Migration wajib** (bukan `db push`):

```
npx prisma migrate dev --name add_site_id_to_mapping_nodes
```

Nama folder migrasi harus deskriptif, contoh: `YYYYMMDDHHMMSS_add_site_id_to_mapping_nodes`.

#### B. Domain & DTO

| File | Perubahan |
|------|-----------|
| `modules/map/domain/entities/MapNode.ts` | + `siteId: string \| null` |
| `modules/map/dto/MapDTO.ts` | + `siteId` di list/detail/create/update DTO |
| `modules/map/types/MappingRepositoryTypes.ts` | + `siteId` di create/update input |
| `modules/map/mappers/MapMapper.ts` | map `siteId` |
| `modules/map/repositories/mapping-repository.helpers.ts` | include `siteId` di create/update payload |

#### C. Repository / Service

| Capability | Detail |
|------------|--------|
| Filter list nodes | `findAllNodes(ctx, { siteId?: string })` |
| Filter list edges | `findAllEdges(ctx, { siteId?: string })` — where source in nodes of site (atau join) |
| Statistics | `getStatistics(ctx, { siteId?: string })` |
| Create/update node | terima `siteId`, validate ownership |
| Helper validasi | `assertSiteBelongsToTenant(siteId, tenantId)` — query `Sites` |

Prefer helper filter:

```ts
// konsep
function buildMapWhere(ctx: TenantContext, filters?: { siteId?: string }) {
  return {
    ...buildTenantWhere(ctx),
    ...(filters?.siteId ? { siteId: filters.siteId } : {}),
  };
}
```

#### D. API

| Endpoint | Perubahan |
|----------|-----------|
| `GET /api/map/nodes` | Query `siteId?` |
| `GET /api/map/edges` | Query `siteId?` |
| `GET /api/map/statistics` | Query `siteId?` |
| `POST /api/map/nodes` | Body `siteId?` |
| `PATCH /api/map/nodes/[nodeId]` | Body `siteId?` (boleh `null` untuk unassign) |
| `POST /api/map/import/csv` | Kolom opsional `siteId` / `siteCode` |
| `POST /api/map/sync` | Jika sync dari entity inventory: copy `siteId` source |

Response node harus include `siteId` (dan opsional `siteName` untuk display — nice-to-have).

#### E. UI Admin Map

| Komponen | Perubahan |
|----------|-----------|
| `components/map/MapToolbar.tsx` (atau Sidebar) | Dropdown filter site: "Semua Site" + list site tenant |
| `components/map/useMapData.ts` | Pass `siteId` ke fetch nodes/edges/stats |
| `components/map/NodeFormModal.tsx` | Field pilih site (create/edit) |
| `components/map/NodePopupContent.tsx` | Tampilkan nama site jika ada |
| `components/map/NodeListTab.tsx` | Kolom/badge site (opsional) |

Sumber list site: endpoint existing admin sites (mis. `/api/admin/sites`) — **reuse**, jangan duplicate.

Persist preferensi filter di `sessionStorage` / `localStorage` key per-user opsional (nice-to-have).

### 5.2 Out of Scope (Fase 2+)

- `siteId` di `MappingEdge` dan `MapSettings` per-site
- Auto-restrict user berdasarkan `UserSite` (hanya site yang di-assign)
- Bulk "assign all selected nodes to site"
- Auto-backfill `siteId` dari matching `Odc`/`Odp` by name/serial
- Multi-select filter (beberapa site sekaligus)
- Warna marker berbeda per site di legend
- Mobile app map filter site

---

## 6. Desain Teknis Ringkas

### 6.1 Flow filter

```
UI SiteFilter ──siteId──► useMapData
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
     GET /nodes?siteId  GET /edges?siteId  GET /statistics?siteId
            │               │               │
            └───────────────┴───────────────┘
                            ▼
                   buildTenantContext(session)
                            ▼
                   buildMapWhere(ctx, { siteId })
                            ▼
                   Prisma findMany (tenant + site)
```

### 6.2 Validasi assign site (create/update)

```
1. Auth + permission map:create|update
2. buildTenantContext
3. Jika body.siteId != null:
   a. Find Sites where id = siteId
   b. Not found → 404 "Site tidak ditemukan"
   c. Jika !isSuperAdmin && site.tenantId !== ctx.tenantId → 400/403
4. Persist node dengan siteId
```

### 6.3 Edge filtering (fase 1)

Opsi A (simple):  
`edges where source IN (nodeIds filtered by site) OR target IN (...)`

Opsi B (strict):  
`edges where source IN (...) AND target IN (...)`

**Keputusan default PRD: Opsi A** — fiber yang nyambung keluar site masih terlihat (berguna untuk backbone antar-site). Document di UI: "Edge ditampilkan jika salah satu ujung ada di site terpilih."

### 6.4 Backfill data existing

Tidak ada backfill otomatis di fase 1. Node lama `siteId = null`.  
Opsional script admin (fase 2): match by name ke `Odc`/`Odp` inventory.

---

## 7. Acceptance Criteria

### AC-1 Schema
- [ ] Migration `add_site_id_to_mapping_nodes` ter-generate & apply
- [ ] `MappingNode.siteId` nullable FK → `Sites.id`, `onDelete: SetNull`
- [ ] Index `[siteId]` dan `[tenantId, siteId]` ada
- [ ] `Sites.mappingNodes` relation ada
- [ ] Entry changelog `[MIGRATION]`

### AC-2 API multi-tenant + site
- [ ] Tanpa `siteId`: behavior sama seperti sekarang (semua node tenant)
- [ ] Dengan `siteId` valid milik tenant: hanya node site itu
- [ ] Dengan `siteId` milik tenant lain: empty / 400 (pilih satu: **400** jika explicit invalid ownership, **empty list** jika prefer silent) — **rekomendasi: 400** saat create/update; **empty list** saat GET filter (hindari enumeration) — final: GET invalid site → empty; POST/PATCH invalid → 400
- [ ] Create node + `siteId` valid → tersimpan
- [ ] Create node + `siteId` cross-tenant → 400
- [ ] Update unassign (`siteId: null`) → sukses
- [ ] Super admin tanpa tenant tetap bisa list (filter tenant existing behavior)

### AC-3 UI
- [ ] Dropdown site di toolbar map
- [ ] Ganti filter → refetch nodes/edges/stats
- [ ] Form node punya field site
- [ ] Popup/list menampilkan site (jika ada)
- [ ] Default filter "Semua Site"

### AC-4 Quality
- [ ] Unit/integration test: filter site + ownership validation
- [ ] `lsp_diagnostics` clean di file diubah
- [ ] Tidak ada regression multi-tenant (test existing tenant isolation tetap pass)
- [ ] Changelog `[ADDED]` di `docs/CHANGELOG.md` `[Unreleased]`

---

## 8. Rencana Implementasi (urutan)

| Step | Task | Est. |
|------|------|------|
| 1 | Prisma schema + migration `add_site_id_to_mapping_nodes` | S |
| 2 | Domain entity, DTO, mapper, repository helpers | S |
| 3 | Repository filter + service validation site ownership | M |
| 4 | API routes (nodes, edges, statistics, import) | M |
| 5 | UI filter dropdown + pass query | M |
| 6 | UI NodeFormModal + popup display | S |
| 7 | Tests (service filter + IDOR site) | M |
| 8 | Changelog + smoke manual di `/admin/map` | S |

**Total estimasi**: ~1–2 hari dev focused.

---

## 9. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Node existing semua null → user bingung "map kosong" setelah pilih site | Default filter = Semua Site; empty state copy: "Tidak ada node di site ini. Ubah filter atau assign site ke node." |
| Edge hilang antar-site | Opsi A filter (OR) di fase 1 |
| Performance list besar + filter | Index komposit `tenantId_siteId` |
| Super admin multi-tenant UX | Site dropdown disabled/empty sampai tenant context jelas; atau load sites by selected tenant (fase 1: load sites session tenant only, super admin = all sites optional) |
| Drift production tanpa migration | Strict policy project: commit schema + migration bersama |

---

## 10. Keputusan yang Perlu Disetujui

| # | Keputusan | Rekomendasi PRD | Alternatif |
|---|-----------|-----------------|------------|
| D1 | `siteId` nullable vs required | **Nullable** | Required + backfill dulu |
| D2 | Edge punya `siteId` sendiri? | **Tidak di fase 1** | Ya, denormalize |
| D3 | MapSettings per site? | **Tidak di fase 1** | Ya |
| D4 | Edge filter OR vs AND | **OR (source atau target)** | AND strict |
| D5 | Batasi user via `UserSite`? | **Tidak di fase 1** | Ya |
| D6 | GET siteId invalid | **Empty list** | 404 |
| D7 | POST/PATCH siteId invalid | **400** | 404 |

> Approval = setuju rekomendasi di atas, atau tulis override per baris D1–D7.

---

## 11. Non-Goals

- Redesign UI map (OpenLayers layers, drawing tools)
- Ubah model permission RBAC map
- Migrasikan inventory ODC/ODP ke MappingNode (tetap dual model)
- Hapus multi-tenant existing

---

## 12. Referensi Kode Existing

| Area | Path |
|------|------|
| Admin page | `app/admin/map/page.tsx` |
| API nodes | `app/api/map/nodes/route.ts` |
| Tenant helper | `modules/map/utils/tenantContext.ts` |
| Repository | `modules/map/repositories/MappingRepository.ts` |
| Entity node | `modules/map/domain/entities/MapNode.ts` |
| Schema map | `prisma/schema.prisma` → `MappingNode`, `MappingEdge`, `MapSettings`, `Sites` |
| UI map | `components/map/*` |
| Pattern multi-site UI | `app/admin/users/components/MultiSiteSelect.tsx` |
| Live map site filter (referensi pola) | `modules/attendance/services/LocationLiveMapService.ts` (`siteId` filter) |

---

## 13. Changelog Entry (template setelah implementasi)

```markdown
### [2026-07-15] — Tambah siteId support di admin map

- **Tipe**: [ADDED] [MIGRATION]
- **Scope**: `modules/map`, `app/api/map`, `components/map`
- **Author**: agent
- **Deskripsi**: MappingNode mendukung siteId opsional; API & UI map
  bisa filter dan assign node per site di dalam scope multi-tenant.
- **Migration**: `YYYYMMDDHHMMSS_add_site_id_to_mapping_nodes`
- **Breaking**: ❌ Tidak
```

---

## 14. Definition of Done

- [ ] Semua AC-1 s/d AC-4 terpenuhi
- [ ] Keputusan D1–D7 di-lock (default rekomendasi jika tidak ada override)
- [ ] Migration file committed bersama schema
- [ ] Manual QA: login tenant multi-site → filter site → create node with site → unassign → cross-tenant ditolak
- [ ] PRD status → **Implemented** + link PR/commit

---

*PRD ini siap diimplementasi setelah approval keputusan D1–D7 (atau "setuju semua rekomendasi").*
`)
