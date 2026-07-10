# PRD — Admin Support: Hardening & Quality Fixes

- **Tanggal**: 2026-07-10
- **Scope**: `app/admin/support/**` (frontend) + `app/api/admin/support-tickets/**` (API) + dependensi terkait (`app/api/uploads`, `modules/pelanggan/services/AdminSupportTicket*`, `lib/authorization/site-restriction`)
- **Sumber temuan**: Code review menyeluruh tanggal 2026-07-10 (lihat lampiran temuan di section "Audit Trail")
- **Status**: Draft — menunggu approval sebelum eksekusi
- **Author**: agent (Sisyphus)
- **Breaking**: ❌ Tidak ada breaking change API publik (semua perbaikan internal/defense-in-depth)

---

## 1. Latar Belakang

Modul Admin Support (tiket dukungan pelanggan) merupakan jalur komunikasi pelanggan↔admin yang membawa side-effect sensitif: pengiriman WhatsApp, transisi status tiket, upload lampiran, dan notifikasi real-time via WebSocket. Code review menyeluruh pada 2026-07-10 menemukan **2 isu Critical (security), 5 High, 8 Medium, dan 10 Low** yang mencakup:

- **Bypass tenancy**: admin dengan permission `support:site_only` tetap bisa membalas tiket pelanggan di luar site-nya karena `checkSiteRestriction` dipanggil dengan session yang tidak membawa `permissions`.
- **XSS potensial** via attachment URL `javascript:` yang dirender sebagai `<a href>` tanpa sanitasi.
- **Validasi input tidak ada** di reply route — body di-trust apa adanya.
- **Rating disimpulkan dari emoji scraping** pesan pelanggan (fragile, tidak Unicode-safe, inkonsisten dengan `stats.avgRating` server).
- **Permission check tidak konsisten** antar route (ada yang pakai `createHandler({ permissions })`, ada yang manual `hasPermission()`).
- **Test coverage 0%** untuk seluruh komponen & hook di area ini.

PRD ini mendefinisikan requirement, acceptance criteria, dan phasing untuk menutup semua temuan di atas.

---

## 2. Tujuan & Non-Tujuan

### 2.1 Tujuan
1. Menutup 2 celah security Critical (site restriction bypass + XSS attachment URL).
2. Menstandarkan pattern permission check & site restriction di seluruh route support.
3. Menghilangkan dependensi pada emoji-scraping untuk rating.
4. Membangun test coverage minimal untuk path kritis (mutation, authz, upload).
5. Mengurangi duplikasi konstanta/status dictionary antara list page & detail page.

### 2.2 Non-Tujuan
- ❌ Tidak melakukan redesign UI/UX besar — perbaikan visual hanya terkait bug.
- ❌ Tidak mengubah skemanotifkasi WhatsApp (template, provider, rate-limit internal service).
- ❌ Tidak menambah fitur baru (mis. assignment multi-admin, SLA timer, macro reply).
- ❌ Tidak migrasi ke state management baru — tetap TanStack Query + `useApi`.
- ❌ Tidak menyentuh modul customer-side (`app/api/customer/tickets/**`) di phase ini (di-scope terpisah kalau diperlukan).

---

## 3. Stakeholder & Kontrak

| Pihak | Peran |
|---|---|
| Admin operator (tenant utama) | Konsumen UI, butuh akses penuh |
| Admin operator (site-scoped, `support:site_only`) | Konsumen UI, **hanya boleh akses tiket site-nya** |
| Pelanggan | Pengirim tiket & lampiran; tidak terkena perubahan API publik |
| Backend service (`AdminSupportTicketService`) | Sumber truth business logic; menerima `allowedSiteIds` dari route |
| Frontend `useTicketActions` / `useFileUpload` | Mutasi & upload; tidak boleh assume shape envelope `unknown` |

**Kontrak API yang dijaga tidak berubah**:
- `GET /api/admin/support-tickets` → `{ tickets, pagination, stats }`
- `GET /api/admin/support-tickets/[id]` → `TicketDetail` (langsung, **bukan** dibungkus `{ ticket }`)
- `PATCH /api/admin/support-tickets/[id]` → `{ ticket, message }`
- `POST /api/admin/support-tickets/[id]/reply` → `{ reply, whatsappSent }`
- `DELETE /api/admin/support-tickets/[id]` → `{ id, message }`
- `GET /api/admin/support-tickets/unread-count` → `{ count }`

---

## 4. Requirement Fungsional

### RF-1 — Site Restriction Berfungsi Penuh di Reply Route
**Sebagai** admin dengan `support:site_only`,
**saya ingin** tidak bisa membalas tiket pelanggan di luar site saya,
**agar** isolation data antar cabang/site tetap terjaga.

**Acceptance criteria**:
- AC1: Saat admin site-scoped POST `/reply` ke tiket pelanggan di site lain → response 403 `{ error: "Anda tidak dapat membalas tiket untuk pelanggan di luar scope Anda" }`.
- AC2: Saat admin site-scoped POST `/reply` ke tiket site-nya sendiri → 200, reply tersimpan.
- AC3: Super admin tetap bisa membalas tiket site manapun.
- AC4: Tidak ada `as never` cast di route — type-safe.

### RF-2 — Sanitasi Attachment URL di Render
**Sebagai** sistem,
**saya ingin** URL lampiran yang dirender sebagai `<a href>` / `<Image src>` hanya boleh `http(s)://`,
**agar** `javascript:` / `data:` URL tidak men-trigger XSS.

**Acceptance criteria**:
- AC1: URL dengan protocol selain `http:`/`https:` di-replace menjadi `#` (link) atau tidak dirender (image).
- AC2: Tidak ada perubahan UX untuk URL valid.
- AC3: Helper `sanitizeAttachmentUrl(url)` di-share antara `MessagesList` dan `ReplyComposer` preview.

### RF-3 — Validasi Body Reply via Zod
**Sebagai** API,
**saya ingin** body `POST /reply` divalidasi schema sebelum sampai service,
**agar** input invalid ditolak di edge dengan 400 (bukan 500 dari runtime error).

**Acceptance criteria**:
- AC1: Schema `z.object({ message: z.string().max(5000).optional(), updateStatus: z.enum(TicketStatus).optional(), sendWhatsApp: z.boolean().optional(), attachments: z.array(z.string().url()).max(10).optional() })`.
- AC2: Body invalid → 400 dengan `fieldErrors`.
- AC3: `ctx.validated` digunakan di handler (tidak ada `await req.json()` manual).

### RF-4 — Rating Sebagai Field DB (bukan emoji scraping)
**Sebagai** sistem,
**saya ingin** rating pelanggan disimpan di kolom numerik `SupportTicket.rating` (nullable Int 1–5),
**agar** tampilan & statistik konsisten, tidak bergantung pada text scraping.

**Acceptance criteria**:
- AC1: Migration Prisma `add_rating_to_support_ticket` menambah kolom `rating Int?` + index.
- AC2: Customer-side close-tickets flow menulis `rating` ke kolom (bukan embed ⭐ di message). *(Catatan: customer-side di-scope terpisah — di phase ini, backend dibuat support baca kolom `rating`, frontend admin baca kolom jika ada, fallback ke emoji-scrape untuk data lama.)*
- AC3: `extractRating` di frontend diganti dengan baca `ticket.rating` (jika ada) atau tetap fallback scrape untuk data lama.
- AC4: `stats.avgRating` server konsisten dengan row-level rating.

### RF-5 — Permission Check Terstandar
**Sebagai** maintainer,
**saya ingin** semua route support pakai `createHandler({ permissions })`,
**agar** tidak ada duplikasi `getServerSession` + `getUserPermissions` per request.

**Acceptance criteria**:
- AC1: 4 route (`route.ts`, `[id]/route.ts`, `[id]/reply/route.ts`, `unread-count/route.ts`) semua deklaratif via `permissions` option.
- AC2: Tidak ada `await hasPermission(...)` manual di handler body.
- AC3: Permission load terjadi tepat 1× per request (verify via logs/Profiling).

### RF-6 — Site Restriction Konsisten (satu tempat kanonik)
**Sebagai** maintainer,
**saya ingin** `checkSiteRestriction` di-call sekali, di route layer, lalu `allowedSiteIds` diteruskan ke service,
**agar** tidak ada double-fetch permission & behavior seragam.

**Acceptance criteria**:
- AC1: Helper `buildSessionWithPermissions(ctx)` dibuat & di-share.
- AC2: Service `AdminSupportTicketRouteService` menerima `allowedSiteIds` dari route (tidak resolve ulang via `resolveScope`).
- AC3: `resolveScope` dihapus atau di-refactor jadi pure-helper tanpa I/O.

### RF-7 — Test Coverage Path Kritis
**Sebagai** maintainer,
**saya ingin** test untuk permission/authz, mutation (reply/close), dan upload validation,
**agar** regression terdeteksi sebelum merge.

**Acceptance criteria**:
- AC1: Integration test untuk reply route: super admin / site-scoped-allowed / site-scoped-denied / closed-ticket / empty-body.
- AC2: Unit test untuk `useTicketActions.sendReply` (success, network error, restore-state-on-fail).
- AC3: Unit test untuk `sanitizeAttachmentUrl` (http, https, javascript, data, empty, weird).
- AC4: Coverage service layer `AdminSupportTicketService.replyToTicket` ≥ 70% (sesuai standar `docs/standards/testing.md`).

---

## 5. Requirement Non-Fungsional

### RNF-1 — Keamanan
- Tidak ada input user yang masuk DB tanpa validasi Zod di edge.
- Tidak ada URL user-controlled yang dirender tanpa sanitasi protocol.
- File upload: server-side wajib cek **magic bytes** (bukan `file.type` dari browser).
- `tel:` / `mailto:` link di-`encodeURIComponent`.

### RNF-2 — Performa
- Tidak ada penambahan DB round-trip baru (justru berkurang karena eliminasi double-fetch permission).
- `unread-count` endpoint mendapat `Cache-Control: private, max-age=30` (cache edge untuk polling sidebar).
- Search query dibatasi `.trim().max(200)` di schema.

### RNF-3 — Maintainability
- Tidak ada file > 400 baris setelah refactor (`SupportContent.tsx` 513 → split).
- Status/priority/category dictionary disatukan di `_components/types.ts` (sumber tunggal).
- Tidak ada `as never` / `as any` di area yang diubah.

### RNF-4 — Kompatibilitas
- API contract publik tidak berubah (lihat section 3).
- Data lama (tiket existing tanpa kolom `rating`) tetap tampil — fallback emoji-scrape untuk rating lama.
- Mobile app (consumer `/api/customer/tickets`) tidak terdampak.

### RNF-5 — Observability
- Log terstruktur (sudah ada via `logger.apiRequest`) dipertahankan.
- Error path menambahkan `code` machine-readable agar FE bisa i18n di masa depan (non-blocking).

---

## 6. Phasing & Milestone

> Setiap phase bersifat independent-mergeable. Urutan dirancang agar Critical dulu, lalu High, lalu pembersihan.

### Phase 1 — Security Critical (target: segera, blokir merge lain)
| Item | AC | File |
|---|---|---|
| 1.1 Fix site restriction bypass di reply route | RF-1 AC1–AC4 | `app/api/admin/support-tickets/[id]/reply/route.ts` |
| 1.2 Sanitize attachment URL di render | RF-2 AC1–AC3 | `app/admin/support/[id]/_components/MessagesList.tsx`, `ReplyComposer.tsx` + helper baru |
| 1.3 Server-side file type validation (magic bytes) | RNF-1 | `modules/pelanggan/services/*Upload*` (verify + fix) |

**Gate**: integration test untuk 1.1 wajib hijau sebelum lanjut.

### Phase 2 — Input Hardening & API Konsistensi
| Item | AC | File |
|---|---|---|
| 2.1 Zod schema untuk reply body | RF-3 | `app/api/admin/support-tickets/[id]/reply/route.ts` |
| 2.2 Standarisasi `createHandler({ permissions })` di 4 route | RF-5 | semua route support |
| 2.3 Helper `buildSessionWithPermissions` + service terima `allowedSiteIds` | RF-6 | `lib/authorization/*`, `modules/pelanggan/services/AdminSupportTicketRouteService.ts` |
| 2.4 `id` param validation di reply route | — | `app/api/admin/support-tickets/[id]/reply/route.ts` |

### Phase 3 — Rating sebagai Field DB
| Item | AC | File |
|---|---|---|
| 3.1 Migration `add_rating_to_support_ticket` | RF-4 AC1 | `prisma/schema.prisma` + `prisma/migrations/...` |
| 3.2 Backend baca `ticket.rating` (fallback scrape untuk lama) | RF-4 AC2–AC4 | service + mapper |
| 3.3 Frontend baca `ticket.rating` | RF-4 AC3 | `SupportContent.tsx`, `_components/types.ts` |

**Catatan**: Customer-side write `rating` saat close-ticket di-scope terpisah (PRD lanjutan), karena melibatkan mobile app. Phase 3 ini hanya menyiapkan kolom & sisi baca admin.

### Phase 4 — UX & Code Quality
| Item | AC | File |
|---|---|---|
| 4.1 Auto-scroll hanya saat user near-bottom | — | `MessagesList.tsx` |
| 4.2 Dropdown status: filter CLOSED / tambah confirm | — | `TicketHeader.tsx` |
| 4.3 Reset `resolution` state saat modal close | — | `CloseTicketModal.tsx` |
| 4.4 Split `SupportContent.tsx` (513 → ~200 baris + sub-komponen) | RNF-3 | `_components/` baru |
| 4.5 Unifikasi status/priority/category dictionary | RNF-3 | `_components/types.ts` |
| 4.6 `unwrapTicket` — hapus dead branch / assert kontrak | — | `SupportDetailClient.tsx` |
| 4.7 Pagination clamp saat `totalPages` berkurang | — | `SupportContent.tsx` |
| 4.8 `sendClosingMessage` atomicity (flag `resolveAfter` di `/reply`) | RF — partial | API + service + hook |
| 4.9 `unread-count` cache header | RNF-2 | `unread-count/route.ts` |
| 4.10 `search` max-length + trim | RNF-2 | `modules/pelanggan/validators/support-ticket.ts` |
| 4.11 Encode `tel:` / `mailto:` | RNF-1 | `CustomerInfoSidebar.tsx` |
| 4.12 Work-order query-string → sessionStorage (description panjang) | — | `CustomerInfoSidebar.tsx` |

### Phase 5 — Test Coverage
| Item | AC | File |
|---|---|---|
| 5.1 Integration test reply route (5 skenario) | RF-7 AC1 | `tests/api/admin/support-tickets/reply.test.ts` |
| 5.2 Unit test `useTicketActions` | RF-7 AC2 | `tests/.../useTicketActions.test.tsx` |
| 5.3 Unit test `sanitizeAttachmentUrl` | RF-7 AC3 | `tests/.../sanitize-url.test.ts` |
| 5.4 Service coverage ≥ 70% | RF-7 AC4 | `tests/.../AdminSupportTicketService.test.ts` |

---

## 7. Acceptance Criteria Global (Definition of Done)

Sebelum PRD ditutup, semua berikut wajib terpenuhi:

- [ ] Phase 1–2 selesai & merged (Critical + High security/correctness).
- [ ] Phase 3 migration di-generate via `npx prisma migrate dev --name add_rating_to_support_ticket`, file migration di-commit bersama `schema.prisma`.
- [ ] `npm run check` (lint + typecheck + build) hijau.
- [ ] `./scripts/setup-test-db.sh` sudah dijalankan; `npm run test:run` hijau untuk test baru.
- [ ] Tidak ada `as any` / `as never` / `@ts-ignore` baru di diff.
- [ ] `docs/CHANGELOG.md` diupdate dengan entry `[SECURITY]` (Phase 1), `[CHANGED]` (Phase 2), `[MIGRATION]` (Phase 3), `[CHANGED]`/`[FIXED]` (Phase 4), `[DOCS]` (PRD ini).
- [ ] Manual QA: buka `/admin/support`, klik tiket, kirim reply (dengan & tanpa lampiran), ganti status, tutup tiket via modal — semua jalan di dev server.
- [ ] Manual QA authz: login sebagai admin site-scoped, pastikan tidak bisa akses tiket site lain via direct URL `/admin/support/[id]`.

---

## 8. Risiko & Mitigasi

| Risiko | Likelihood | Impact | Mitigasi |
|---|---|---|---|
| Migration `rating` kolom nullable tidak di-backfill → stats avgRating drop | Sedang | Sedang | Fallback emoji-scrape untuk data lama; backfill script terpisah kalau diperlukan |
| Helper `buildSessionWithPermissions` break route lain yang juga pakai `checkSiteRestriction` | Rendah | Tinggi | Refactor hanya untuk route support dulu; route lain dibiarkan apa adanya di PR ini |
| Customer-side masih embed ⭐ di message setelah Phase 3 → double source | Tinggi (pasti) | Rendah | Fase 3 hanya sisi admin; customer-side di PRD lanjutan. Dokumentasikan di CHANGELOG |
| Test integration butuh test DB & seed site-scoped user | Sedang | Sedang | Setup di `tests/setup` sudah ada pattern; ikuti `docs/standards/testing.md` |
| `sendClosingMessage` atomicity (4.8) butuh API change → bisa konflik dengan mobile | Sedang | Sedang | Buat flag `resolveAfter` opsional; default behavior tidak berubah |

---

## 9. Out of Scope (Eksplisit)

- Redesign UI support page.
- Fitur macro/template reply.
- SLA timer / auto-escalation.
- Assignment tiket ke multiple admin.
- Migrasi customer-side (`app/api/customer/tickets/**`) — PRD terpisah.
- i18n pesan error server (ditandai sebagai tech-debt, non-blocking).
- WebSocket reliability hardening (`useRealtimeTicketChat`) — di-audit terpisah.

---

## 10. Lampiran: Audit Trail Temuan Review

Diambil dari review 2026-07-10. Severity: 🔴 Critical (2), 🟠 High (5), 🟡 Medium (8), 🔵 Low (10).

### 🔴 Critical
1. **Site restriction bypass** — `app/api/admin/support-tickets/[id]/reply/route.ts:43-47` memanggil `checkSiteRestriction(ctx.session as never, "support")` padahal `ctx.session.user` tidak berisi `permissions` (terpisah di `ctx.permissions`). `isRestricted` selalu `false` → admin site-scoped tetap bisa reply tiket cross-site.
2. **XSS via attachment URL** — `MessagesList.tsx:94-107` merender `<a href={url}>` tanpa sanitasi protocol. URL `javascript:…` (jika upload service tidak validate) → click = XSS.

### 🟠 High
3. Body reply route tidak divalidasi Zod — `reply/route.ts:29-30`.
4. `id` param reply route tidak divalidasi.
5. Permission check manual (duplikasi `getServerSession` + `getUserPermissions`) di `[id]/route.ts` & `unread-count/route.ts`.
6. Site restriction untuk GET/PATCH/DELETE detail dilakukan di service (`resolveScope`) — duplikasi fetch permission.
7. Rating parsing `/(⭐{1,5})/` tidak Unicode-safe (variation selector `⭐️` tidak match) + architectural smell (scrape dari message).

### 🟡 Medium (ringkasan)
8. `SupportContent.tsx` pagination tidak clamp saat `totalPages` berkurang.
9. `unwrapTicket` type-unsafe dead branch.
10. `useFileUpload` hanya validasi client-side (`file.type`), tidak verify server magic bytes.
11. Upload tanpa CSRF/origin check eksplisit.
12. `sendClosingMessage` chain 2 request non-atomic.
13. `CloseTicketModal` `resolution` state tidak reset saat cancel.
14. `MessagesList` auto-scroll paksa walau user sedang baca history.
15. Dropdown status bisa close tanpa confirm (inkonsisten dengan modal).
16. Duplikasi status/priority/category dictionary antara list & detail.

### 🔵 Low (ringkasan)
17. `SupportContent.tsx` 513 baris — split.
18. `void ticket` suppress unused arg di `useTicketActions`.
19. Magic string `"RESOLVED"` / `"CLOSED"` padahal enum tersedia.
20. `tel:` / `mailto:` tanpa `encodeURIComponent`.
21. Work-order query-string bawa `description` full → potensi URL terlalu panjang.
22. `unread-count` tanpa cache header.
23. `search` filter tanpa `.max()` / `.trim()`.
24. Attachment preview `<Image>` butuh domain whitelist di `next.config.ts`.
25. `key={idx}` di attachments map.
26. Test coverage 0% di seluruh area.

---

## 11. Estimasi Effort

| Phase | Estimasi (jam) | Catatan |
|---|---|---|
| 1 — Security Critical | 4–6 | Termasuk test integration untuk authz |
| 2 — Input Hardening | 4–6 | Mayoritas refactor + helper |
| 3 — Rating DB field | 3–4 | Migration + mapper + FE baca kolom |
| 4 — UX & Code Quality | 6–8 | Banyak item kecil, bisa parallel |
| 5 — Test Coverage | 6–8 | Setup + 4 suite test |
| **Total** | **23–32 jam** | Bisa dipecah ke 3–5 PR |

---

*PRD ini living document — update saat eksekusi berjalan jika ada perubahan scope. Setiap perubahan scope wajib catat di section 9 (Out of Scope) atau tambah RF baru.*
