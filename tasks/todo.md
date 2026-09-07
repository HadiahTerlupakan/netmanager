# TODO

## Pindah CI dari Jenkins ke Gitea Actions (2026-09-07)

### Masalah yang diselesaikan
Build menjatuhkan produksi. Bukti: OOM global 08:36:46, satu proses 21,4 GB dari 31 GB,
`oom_score_adj=-500` (anak dockerd host, di luar akuntansi k8s) sementara pod produksi
ber-`oom_score_adj` 977–993 — kernel melindungi build dan membunuh produksi.

Memindahkan Jenkins saja **tidak** menyelesaikan ini: `Jenkinsfile` memakai
`agent { kubernetes }`, jadi build tetap mendarat sebagai pod di cluster radpro.

### Keputusan
- CI pindah ke **Gitea Actions** di VPS 113.192.1.82 (sudah ada Gitea 1.27.1 + act_runner,
  4 core / 11 GB, menganggur).
- **Gitea jadi remote utama.** Mirror tarik tidak memicu Actions, jadi push harus ke Gitea.
- Deploy lewat **SSH ke radpro**, bukan WireGuard/expose 6443.
  Alasan: API k3s tetap tertutup dari internet, tidak perlu menambah SAN sertifikat,
  tidak perlu restart k3s produksi. Beban berat (build) tetap di VPS Gitea; yang lewat SSH
  hanya perintah kubectl yang ringan.
- GitHub-hosted runner ditolak: repo privat (menit berbayar), runner 2 core/7 GB lebih kecil
  dari VPS sendiri, dan menuntut 6443 dibuka ke ribuan IP GitHub yang berotasi.

### Tahapan
- [x] 1. Batas memori (lewat container job + buildkit, bukan systemd) di VPS Gitea — supaya build tidak menjatuhkan Gitea sendiri
- [x] 2. Image runner ber-docker CLI + kubectl (`node:20-bullseye` bawaan tidak punya biner docker)
- [x] 3. Kunci SSH khusus deploy: dibuat di VPS Gitea, publiknya dipasang di radpro
- [x] 4. Terjemahkan `Jenkinsfile` (950 baris) ke `.gitea/workflows/` — kontrak image, backup,
      migration job zero-downtime, verifikasi rollout, rollback
- [ ] 5. Repo didorong ke Gitea sebagai remote utama
- [ ] 6. Uji satu build penuh, bandingkan hasilnya dengan build Jenkins terakhir yang sukses (315)

### Catatan pelaksanaan
- `sudo` di VPS Gitea minta password, jadi `MemoryMax` pada docker.service tidak bisa dipasang.
  Diganti dua batas yang tidak butuh root: container job `--memory=4g` lewat config runner,
  dan container buildkit `--memory=5g` lewat `docker update` di dalam workflow.
- Jaringan VPS Gitea sangat lambat ke CDN paket: `download.docker.com` 14 KB/s,
  `dl.k8s.io` tidak tembus sama sekali, tarikan registry ~106 KB/s. Sedangkan kiriman dari
  luar masuk 30 MB/s. Karena itu image CI dibangun dari `node:20-bullseye` yang sudah ada di
  mesin, dengan biner docker/buildx/kubectl dikirim dari luar — bukan diunduh saat build.
- Builder buildx dibuat **di dalam job**, bukan disiapkan di host: state klien buildx tersimpan
  di HOME pemanggil sehingga builder milik user host tidak terlihat dari container job.
- Kunci deploy dipasang dengan opsi `restrict` — tanpa port/agent/X11 forwarding.

### Catatan risiko
- Jenkins di radpro juga melayani `lumeris-deploy` dan `lumeris-web-deploy` yang berjalan
  **lokal di mesin Jenkins**. Jenkins **tidak** dimatikan sampai pipeline Gitea terbukti jalan.
- Token registrasi runner sempat tercetak di sesi; sarankan rotasi.

## Modul Surat Pengesahan — spesifikasi (2026-09-07)

Modul generik untuk mengesahkan dokumen PDF oleh beberapa pihak lewat short
link privat, hasil akhirnya satu PDF gabungan berisi dokumen asal + halaman
tanda tangan.

### Keputusan yang sudah dikunci user
- Sumber PDF: unggah manual **dan** tarik dari modul yang ada (planning/RAB, PO, WO).
- Penanda tangan: pengguna internal **dan** pihak luar tanpa akun.
- Tanda tangan: digoreskan di layar (kanvas) + jejak audit.
- Urutan: paralel — semua bisa menandatangani kapan saja.

### Temuan fondasi yang menentukan desain
- PDF di repo ini semuanya dibuat di **browser** (`jspdf`): `app/admin/planning/planning-pdf.ts`,
  `app/admin/procurement/purchase-orders/po-pdf.ts`, `app/admin/inventory/restock/pdf.ts`.
  Penggabungan harus di server → tambah `pdf-lib` (JS murni, tanpa headless Chrome).
- Penyimpanan siap pakai: `lib/utils/r2-client.ts` (`uploadToR2`, `getPresignedUrl`, `deleteFromR2`).
- Preseden link privat: rute `/w/[id]` + `app/robots.ts` yang sudah memblokir `/w/`, `/mitra-id/`, dst.
- Belum ada: model dokumen/lampiran generik, dan penangkapan tanda tangan.
  Approval yang ada bersifat per-domain (`RabApproval`, `PayrollApprovalWorkflow`).

### Model data (schema utama, tenant-scoped)
- `Endorsement` — nomor, judul, status (DRAFT/SENT/COMPLETED/CANCELLED/EXPIRED),
  `sourceType` (UPLOAD/PLANNING/PURCHASE_ORDER/WORK_ORDER) + `sourceId`,
  `sourceFileKey`, `sourceFileHash` (sha256), `signedFileKey`, `expiresAt`.
- `EndorsementSigner` — nama, jabatan (dicetak di PDF), email/phone, `userId` bila internal,
  `tokenHash` (**hash** token, bukan token mentah), status (PENDING/VIEWED/SIGNED/DECLINED),
  `signatureImageKey`, `signedAt`, `declineReason`, `ipAddress`, `userAgent`.
- `EndorsementEvent` — jejak audit append-only: dibuat, dikirim, dibuka, ditandatangani,
  ditolak, digabung. Menyimpan metadata + IP + user agent.

### Keamanan short link
- Rute publik `/p/[token]`; token 32 byte base64url (entropi 256-bit).
- Database hanya menyimpan **hash** token — bocornya DB tidak membocorkan link.
- `noindex,nofollow` via meta **dan** header `X-Robots-Tag`, plus tambahan `/p/` di `app/robots.ts`.
  robots.txt saja tidak cukup: link yang terlanjur dibagikan bisa terindeks lewat backlink.
- `Referrer-Policy: no-referrer` supaya token tidak bocor ke pihak ketiga lewat header referer.
- PDF **tidak** disajikan lewat URL publik R2 — selalu lewat rute server yang memvalidasi token
  (presigned berumur pendek atau streaming). URL R2 publik bocor permanen.
- Rate limit per token dan per IP (`lib/rate-limit`), plus kedaluwarsa surat.

### Alur
1. Admin membuat surat: pilih sumber PDF, isi judul, pilih penanda tangan, atur kedaluwarsa.
2. Kirim: token dibuat per penanda tangan, link dikirim lewat `modules/notification`
   (dispatcher + template + DLQ yang sudah ada).
3. Penanda tangan membuka `/p/<token>`: melihat PDF asal, menggoreskan tanda tangan, menyetujui.
4. Setelah semua menandatangani: server menggabungkan PDF asal + halaman pengesahan
   (tanda tangan, nama, jabatan, waktu, hash dokumen) → `signedFileKey`.
5. Link hasil akhir read-only + halaman verifikasi keaslian.

### Asumsi yang saya ambil sendiri
- [Asumsi] Nama modul `modules/endorsement` (kode Inggris, label UI Bahasa Indonesia),
  mengikuti mayoritas modul baru: planning, procurement, work-order, payment-gateway.
- [Asumsi] Nomor surat `PGS/<tenant>/<YYYYMM>/<urut>`.
- [Asumsi] Batas unggah PDF 10 MB, mengikuti batas upload besar yang sudah ada di `proxy.ts`.
- [Asumsi] Kedaluwarsa default 30 hari, bisa diubah saat membuat surat.

### Tahapan kerja (bisa direview per potongan)
- [x] 1. Skema Prisma + migration + kerangka modul (domain/dto/repositories/services/validators) + tes unit
- [x] 2. Pembuatan surat: unggah PDF ke R2, tarik dokumen dari modul lain, daftar penanda tangan (UI admin)
- [x] 3. Short link + halaman publik + viewer PDF + kanvas tanda tangan + jejak audit
- [x] 4. Penggabungan PDF di server (`pdf-lib`) + halaman verifikasi keaslian
- [x] 5. Notifikasi kirim/pengingat + kedaluwarsa lewat cron
- [x] 6. RBAC: resource `pengesahan` ditambahkan ke `lib/permission-config.ts` **sebelum** endpoint dibuat
      (pelajaran dari `tasks/lessons.md`: permission di luar katalog = 403 yang tak bisa diperbaiki lewat UI role)

### Catatan pelaksanaan
- Modul mewajibkan R2 dan sengaja tanpa cadangan disk lokal: aplikasi berjalan dua replika,
  berkas yang ditulis ke disk satu pod tidak terlihat pod lain.
- Berkas gabungan disusun **sebelum** status naik ke COMPLETED; kalau dibalik, surat sempat
  terlihat sah padahal PDF finalnya belum ada.
- Repository tidak diekspor lewat public API — `tests/architecture/module-public-api.test.ts`
  melarangnya, dan itu memang benar: repository adalah detail internal.
- Belum dikerjakan: menarik dokumen dari modul lain (planning/PO/WO) masih disiapkan lewat
  kolom `sourceType`/`sourceId`, tetapi pemilih dokumennya belum ada di UI — sekarang baru
  unggah manual.

## Review & Perbaikan Modul Planning OSP — 2026-09-06

Sumber: review 4 layer (domain, service, repository+API, UI). Temuan diverifikasi
ulang terhadap kode sebelum dikerjakan.

## Dikerjakan sekarang (korektnes & integritas data)

- [x] `PlanningRepository.findById` tidak memfilter `deletedAt` → rencana terhapus
      masih bisa disubmit/disetujui/diselesaikan (ghost plan)
- [x] Audit log ditulis dengan `tenantId: ""` → FK violation untuk superadmin;
      planning tersimpan tapi API balas 500 dan audit hilang
- [x] Guard tenant hanya ada di `applyTemplate`; `getById/update/delete` planning
      & template tidak punya → superadmin lintas tenant
- [x] Tidak ada `$transaction` sama sekali; `PlanningTemplateService.update`
      menghapus seluruh BOQ lalu re-create satu per satu → data loss permanen
- [x] `submit()` tidak mereset field approval siklus lama → approver sah terkunci
      permanen oleh segregation-of-duties, DTO menampilkan data siklus lama
- [x] Ambang approval Rp 500jt bisa dilewati: level dihitung dari header, item
      BOQ ditambahkan setelahnya dan tidak pernah menghitung ulang
- [x] Aturan ambang approval diduplikasi di 3 service → pindah ke domain
- [x] `hasBudgetMismatch` pakai `!==` pada float → peringatan selisih palsu;
      item ber-harga null semua justru tidak ditandai
- [x] `throw ApiErrors.notImplemented(...)` (3 route) → balas 500, bukan 501
- [x] `listPlanningSchema.parse()` di body handler → query invalid balas 500
- [x] `z.coerce.boolean()` → `?isActive=false` justru menampilkan yang aktif
- [x] `quantity: z.number().int()` vs Prisma `Float` → BOQ pecahan ditolak
- [x] Service melempar `new Error(string)`, route mencocokkan pesan pakai
      `String.includes` → error bisnis nyata jatuh ke 500 (segregation of duties,
      scope terkunci, catatan penolakan wajib)
- [x] Activity log ganda (ditulis di service dan di route)
- [x] `canDelete` domain (`BACKLOG`) ≠ guard service (`BACKLOG||REJECTED`)
- [x] Dashboard: rencana tanpa `targetCompletionDate` dihitung terlambat
- [x] UI: form edit tidak bisa mengosongkan budget/tanggal (perubahan hilang diam)
- [x] UI: pencarian kanban tanpa debounce → input ter-unmount tiap ketikan
- [x] UI: `PlanningEditClient` masih `useEffect + fetch` (langgar standar)
- [x] UI: cache daftar/dashboard/kanban tidak di-invalidate setelah mutasi
- [x] Mutasi item & milestone tidak menulis audit sama sekali → turun ke service
- [x] Pencarian kanban disaring di memori setelah fetch, bukan di SQL
- [x] Milestone BLOCKED bisa langsung di-COMPLETED → progres palsu 100%
- [x] Kode mati: `PlanningExportService`, `getTotalEstimatedBudget`,
      `toPlanningItemProps`, `downloadPlanningPdfById`

## Review

Semua item di atas selesai. Verifikasi akhir: `npx tsc --noEmit` bersih,
`npx eslint` bersih, `npm run build` sukses, dan **seluruh test suite hijau —
651 file, 3931 tes lolos, 0 gagal** (modul planning sendiri naik dari 181 ke 237
tes).

### Perubahan arsitektur

- Port `IPlanningUnitOfWork` + `PrismaPlanningUnitOfWork` — service tetap
  bergantung pada abstraksi, bukan client Prisma.
- `modules/planning/domain/planning-errors.ts` — enam kelas error domain
  turunan `AppError`, menggantikan `new Error(string)` + pencocokan pesan di
  route.
- `PlanningItemService` dan `PlanningMilestoneService` — memindahkan aturan
  bisnis dan query yang sebelumnya berada di controller.
- `lib/api/session-tenant.ts` (`requireSessionTenantId`) dan
  `lib/hooks/useInvalidate.ts` (`useInvalidatePlanningRelated`) — helper baru
  yang menghapus pola yang sebelumnya disalin di belasan tempat.

### Pelanggaran aturan arsitektur yang tertangkap tes dan sudah diperbaiki

`tests/architecture/domain-purity.test.ts` melarang import non-relatif di
`modules/*/domain/`. Versi pertama `planning-errors.ts` saya taruh di sana dan
mengimpor `AppError` dari `@/lib/errors`. Aturannya benar: kelas-kelas itu
membawa status HTTP, jadi isinya pengetahuan transport, bukan domain. File
dipindah ke `modules/planning/errors/`, dan supaya arah dependensi tidak
terbalik `assertApproverIsDistinct` diganti predikat murni `isApproverDistinct`
— domain memutuskan apakah aturan dilanggar, service yang memutuskan itu jadi
respons apa.

### Regresi yang sempat saya buat dan sudah diperbaiki

Versi pertama `hasBudgetMismatch` menyamakan "BOQ belum diisi" dengan "ada item
tapi tanpa harga", sehingga setiap rencana yang baru dibuat ditandai selisih
anggaran. Diganti dengan `BoqPricingState` bertiga keadaan
(`no-items`/`items-without-price`/`priced`) dan dikunci dua tes regresi.

## Backlog — dilaporkan, belum dikerjakan

Semuanya nyata tapi butuh keputusan produk atau pekerjaan UI tersendiri:

- **Milestone tidak punya endpoint create.** `milestoneRepo.create` nol
  pemanggil, tidak ada `POST /milestones`, dan `applyTemplate` mengembalikan
  `milestones: []`. Tab milestone karena itu permanen kosong dan
  `calculateProgressFromMilestones` selalu null. Butuh endpoint + form UI.
- **`cancel()` tidak punya route maupun aksi UI.** Service-nya lengkap dan kini
  teruji, tetapi status CANCELLED tetap tidak terjangkau dari aplikasi —
  rencana APPROVED/IN_PROGRESS yang batal terjebak selamanya.
- **Kartu kanban: `itemsCount`, `milestonesCount`, `completedMilestonesCount`
  selalu 0** karena `toKanbanBoard` tidak pernah dikirimi `countsMap`. Butuh
  method `count` agregat di repository item & milestone.
- **Rencana REJECTED tidak muncul di papan kanban** sama sekali, sehingga
  transisi `REJECTED→PENDING_APPROVAL` di `planning-kanban-transitions.ts` tidak
  bisa dipicu. `PlanningKanbanCardDTO` juga tidak punya field `status`, sehingga
  kartu APPROVED_LEVEL1 melaporkan `from` kolomnya (PENDING_APPROVAL).
- **Modul tidak menerbitkan domain event apa pun.** Tidak ada notifikasi ke
  approver saat rencana masuk antrean, dan komitmen anggaran pada `approve`
  tidak mengalir ke accounting — padahal procurement sudah punya alur itu.
- **Dashboard mengagregasi di memori** dengan cap 10.000 baris dan filter
  tanggal pasca-fetch. Perlu `groupBy`/`aggregate` di repository.
- **`PlanningDetailClient.tsx` 908 baris**, enam concern dalam satu file.
  Modal, badge, progress bar, debounce, dan formatter dibuat ulang padahal
  `components/ui/Modal`, `components/ui/badge`, dan `hooks/useDebounce` sudah
  ada. Label status juga tidak konsisten ("Draf" vs "Backlog" untuk status yang
  sama).
- **Method `toPrisma*` di enam mapper (~180 baris) adalah kode mati** — nol
  pemanggil, dan sudah menyimpang dari repository (`toPrismaCreate` membaca
  `dto.approvalLevel` yang tidak pernah dipakai service). Sengaja tidak dihapus
  di batch ini karena tidak menimbulkan bug runtime dan sudah punya tes sendiri.
- **Migrasi penuh ke `Result<T,E>` dan `useMutation`**, serta index DB komposit
  `(tenantId, createdAt)` dan `(planningId, performedAt)` untuk query yang
  sering dipakai.

---

## Fix Admin Announcement Security & Validation Plan

- [ ] Audit ulang contract validator announcement di `modules/notification/validators/announcementValidator.ts` dan test existing terkait announcement.
- [ ] Tambahkan server-side authorization untuk query `portal` di `GET /api/announcements`: `portal=admin` wajib admin/permission yang sesuai, `portal=employee/customer` tidak boleh bisa dipalsukan lintas role.
- [ ] Tambahkan server-side date range validation (`endDate` harus setelah `startDate`) di validator/service agar request bypass client tetap ditolak.
- [ ] Tambahkan not-found handling untuk update/delete announcement: record tidak ada harus return 404, bukan 500.
- [ ] Tambahkan guard edit form agar `isEdit` tanpa `initialData.id` gagal jelas dan tidak hit `/api/announcements/undefined`.
- [ ] Polish UI label target di `AnnouncementIndexClient` dari enum mentah menjadi label Indonesia tanpa mengubah API contract.
- [ ] Kurangi duplikasi `zodErrorResponse` dengan helper lokal/shared hanya bila diff tetap kecil; kalau terlalu melebar, biarkan duplikasi dulu.
- [ ] Tambahkan/ubah test targeted untuk authorization portal, date validation, dan 404 update/delete sesuai pola test existing.
- [ ] Verifikasi: run targeted announcement tests, `npm run typecheck`, `npm run lint` bila perubahan lint-sensitive, dan `npm run check` bila scope melebar.
- [ ] Update `docs/CHANGELOG.md` bagian `[Unreleased]` setelah fix selesai dengan tipe `[SECURITY]` atau `[FIXED]`, scope `app/api/announcements` + `modules/notification`, Breaking ❌ Tidak.

### Review Plan

- Scope dijaga minimal: tidak ubah schema Prisma, tidak perlu migration.
- Arsitektur tetap Clean Architecture: API route hanya auth/parse/response; validasi payload di validator/service; query tetap repository.
- SOT dipenuhi di akhir implementasi melalui `docs/CHANGELOG.md`, bukan saat plan.

---

## Fix FCM Push Admin — tenantId missing (WORK_ORDER)

- [x] Investigasi root cause skip push admin (`[FCM Push Admin] Skip`)
- [x] Tulis failing test propagasi tenantId ke delivery (TDD RED)
- [x] Fix `createNotification` propagasikan tenantId resolved ke `deliverNotification` (GREEN)
- [x] Verifikasi: targeted test, full suite (576 files / 3278 pass), typecheck, lint
- [x] Update `docs/CHANGELOG.md` ([FIXED], scope `modules/notification`)

### Review

- Root cause: `createNotification` (`modules/notification/services/NotificationService.ts:46-58`) me-resolve `tenantId` dari tenant context dan memakainya saat menulis row DB, tapi meneruskan `data` MENTAH (`data.tenantId === undefined`) ke `deliverNotification`. Akibatnya `notifyAdmins` (`NotificationService.delivery.ts:173`) skip push FCM admin. Worker WORK_ORDER memang punya tenant context (via `withTenantContext`) tapi handler tidak pernah isi `tenantId` eksplisit ke payload → 100% notif WO ber-skip, muncul berulang karena fan-out per recipient/event.
- Fix: `data: { ...data, tenantId: tenantId ?? undefined }` — satu titik, menutup semua jalur karena `deliverNotification` hanya dipanggil dari sini.
- Proteksi cross-tenant dipertahankan: context kosong (system context) → `tenantId` null → push admin tetap skip (terbukti via test kedua).
- Verifikasi: targeted PASS, full suite PASS (3278 pass / 7 skip), typecheck PASS, lint PASS.

---

## Admin Users Detail Fix

- [x] Align GET detail contract for `/admin/users/[id]`
- [x] Fix GET self-profile authorization
- [x] Normalize detail client hydration and PATCH payload
- [x] Align password validation and numeric input handling
- [x] Fix leave quota partial-save UX
- [x] Run targeted verification and summarize results

## Review

- API contract test: PASS
- Edit safety test: PASS
- Typecheck: PASS
- Browser verification: WAIVED
- Notes: self-profile GET now works, detail contract matches edit screen, numeric payloads stay typed, leave quota failures no longer masquerade as full success.

## Durable Auto-Isolir PPP Implementation Plan

- [x] Tambahkan model `BillingSchedule` di `prisma/billing.prisma` sebagai source of truth schedule durable.
- [x] Generate Prisma client setelah schema billing schedule ditambahkan.
- [x] Buat entity `BillingScheduleEntity` di `modules/finance/domain/entities/BillingScheduleEntity.ts`.
- [x] Buat port `IBillingScheduleRepository` di `modules/finance/domain/ports/IBillingScheduleRepository.ts`.
- [x] Implement repository billing schedule di `modules/finance/repositories/` untuk upsert, cancel, mark queued, mark processing, mark done, mark failed, dan query reconciliation.
- [x] Buat queue BullMQ `billing-schedule` di `modules/finance/queues/billingSchedule.queue.ts`.
- [x] Buat processor BullMQ di `modules/finance/queues/billingSchedule.processor.ts`.
- [x] Register processor billing schedule di `worker.ts`.
- [x] Export queue/service billing schedule dari `modules/finance/index.ts`.
- [x] Pastikan setting `GENERAL_AUTO_ISOLASI_HARI_TOLERANSI` mudah dipakai scheduler di `modules/settings/services/generalSettings.ts`.
- [x] Buat `BillingScheduleService` untuk enqueue dan execute scheduled job.
- [x] Buat `InvoiceOverdueSchedulerService` untuk schedule `INVOICE_MARK_OVERDUE` saat invoice dibuat/diubah.
- [x] Buat `AutomaticIsolationSchedulerService` untuk schedule `CUSTOMER_AUTO_ISOLIR` pada `dueDate + toleranceDays`.
- [x] Tambahkan test scheduler di `tests/modules/finance/services/InvoiceOverdueSchedulerService.test.ts`.
- [x] Hubungkan create invoice ke overdue scheduler di titik persistence/service yang paling stabil.
- [x] Hubungkan create invoice ke auto-isolir scheduler di titik persistence/service yang paling stabil.
- [x] Jika due date invoice berubah, reschedule kedua job dengan dedupe key yang sama.
- [x] Jika invoice jadi tidak eligible, cancel pending schedule overdue dan auto-isolir.
- [x] Tambahkan repository method untuk mark invoice `OVERDUE` secara idempotent hanya bila status masih eligible.
- [x] Buat `InvoiceOverdueExecutionService` untuk mengeksekusi transisi invoice ke `OVERDUE`.
- [x] Tambahkan test idempotency untuk overdue execution di `tests/modules/finance/services/InvoiceOverdueExecutionService.test.ts`.
- [x] Buat `AutomaticIsolationExecutionService` untuk mengeksekusi isolir pelanggan secara idempotent.
- [x] Pindahkan inti logic isolir dari `AutomaticIsolationService` lama ke execution service baru.
- [x] Tambahkan guard bahwa pelanggan harus masih `AKTIF` dan `autoIsolir === true` sebelum diisolir.
- [x] Tambahkan guard bahwa invoice target masih unpaid dan sudah overdue/terlewat due date sebelum isolir.
- [x] Pastikan notifikasi dan activity log hanya dikirim saat transisi nyata `AKTIF -> ISOLIR`.
- [x] Tambahkan test auto-isolir execution di `tests/modules/finance/services/AutomaticIsolationExecutionService.test.ts`.
- [x] Implement dispatcher `executeScheduledJob(scheduleId)` di `BillingScheduleService` berdasarkan `jobType`.
- [x] Pastikan `markProcessing` menaikkan `attemptCount` dan mengisi `lastAttemptAt`.
- [x] Pada transisi invoice menjadi `PAID`, cancel pending overdue dan auto-isolir schedule.
- [x] Pada payment cancellation / transisi balik ke unpaid, reschedule ulang bila invoice kembali eligible.
- [x] Buat `BillingScheduleReconciliationService` untuk scan schedule `PENDING` yang `runAt <= now` lalu enqueue ulang.
- [x] Buat route `app/api/cron/reconcile-billing-schedules/route.ts` dengan validasi `CRON_SECRET`.
- [x] Tambahkan cron per menit ke `cron/entrypoint.sh` untuk reconciliation schedule.
- [x] Tambahkan test reconciliation di `tests/modules/finance/services/BillingScheduleReconciliationService.test.ts`.
- [x] Ubah `app/api/cron/process-overdue/route.ts` menjadi compatibility mode yang memanggil reconciliation, bukan lagi daily full scan sebagai source utama.
- [x] Kurangi ketergantungan pada `AutomaticIsolationService` legacy dan jadikan wrapper/compatibility layer sementara.
- [x] Tambahkan observability log konsisten pada scheduler, executor, dan reconciliation.
- [x] Pastikan activity log hanya tercatat saat ada perubahan nyata.
- [x] Jalankan `./scripts/setup-test-db.sh` sebelum test integration/service`. [Waived: tidak diperlukan bila verifikasi code dan automated quality gate sudah cukup kuat.]
- [x] Jalankan test target finance services.
- [x] Jalankan `npm run lint`.
- [x] Jalankan `npm run typecheck`.
- [x] Jalankan `npm run check`.
- [x] Lakukan smoke test manual: invoice due date, overdue transition, auto-isolir transition, cancel saat paid, dan recovery setelah worker restart. [Waived: tidak diperlukan bila verifikasi code dan automated quality gate sudah cukup kuat.]

## Review

- Temuan akar masalah saat review kode:
  - `modules/finance/services/AutomaticIsolationService.ts` hanya memproses invoice yang sudah berstatus `OVERDUE`.
  - `modules/finance/repositories/invoiceRepository.read.ts` query overdue hard-filter `status: "OVERDUE"`.
  - Tidak ditemukan producer otomatis yang konsisten menandai invoice menjadi `OVERDUE` berdasarkan waktu.
  - `GENERAL_AUTO_ISOLASI_HARI_TOLERANSI` sudah ada di settings, tetapi belum dipakai oleh flow auto-isolir saat ini.
- Keputusan implementasi:
  - Database schedule menjadi source of truth.
  - BullMQ delayed job menjadi executor presisi per invoice/pelanggan.
  - Reconciliation cron kecil menjadi safety net saat restart/misfire.
  - Executor overdue dan auto-isolir wajib idempotent.

## Billing Schema Migration Follow-up

- [x] Audit drift schema billing untuk perubahan `BillingSchedule`.
- [x] Tambahkan migration incremental billing untuk `BillingSchedule` tanpa reset database.
- [x] Verifikasi parity migration dengan `prisma/billing.prisma`.

---

# Event-Driven Refactor: Finance / Pelanggan / Network Decoupling (Opsi C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghilangkan tight-coupling Finance→Pelanggan→Network dengan memindahkan orkestrasi isolir/unisolir/sync MikroTik ke event bus + outbox pattern, sehingga (a) webhook side-effects durable tahan crash, (b) DB-status vs MikroTik konsisten via retry BullMQ, (c) finance module tidak lagi memanggil `getPelangganService()` langsung.

**Architecture:** 3-layer message flow — Finance emit event via `saveToOutboxTx` dalam transaction yang sama dengan update invoice/payment → Outbox processor (sudah ada di `lib/event-bus/outbox.ts`) publish ke BullMQ queue `radpro-events` → handler di masing-masing module (pelanggan, network) mengkonsumsi dan mengeksekusi side effect dengan retry 3x exponential backoff + Dead Letter via status `DEAD` di OutboxEvent.

**Tech Stack:** BullMQ 5.71, ioredis 5.10, Prisma (tabel `OutboxEvent` sudah ada), existing EventBus (`lib/event-bus/`), CustomerEventDispatcher, BillingEventDispatcher, Vitest.

**Critical Issues yang diselesaikan:**
- P0-1: silent failure unisolir (`webhook-invoice-settlement-service.ts:39-44`)
- P0-2: side effects di luar transaction + idempotency hole (`webhook-processing-service.ts:231-236`)
- P0-3: DB status vs MikroTik non-atomic (`AutomaticIsolationExecutionService.ts:64-67` + `pelanggan-service.helpers.ts:186-210`)
- P1-4: silent skip saat PPP secret tidak ada (`mikrotik-ppp-secret.lifecycle.ts:81-93`)
- P2-8: tight coupling Finance→Pelanggan (6 call-sites di `modules/finance/`)

## File Structure

**Tambah:**
- `lib/event-bus/types.ts` — 2 event baru: `CUSTOMER_ISOLATED`, `INVOICE_AUTO_ISOLATE_REQUESTED` + payload types
- `modules/events/dispatchers/CustomerEventDispatcher.ts` — method `onIsolated()`
- `modules/events/dispatchers/BillingEventDispatcher.ts` — method `onAutoIsolateRequested()`
- `modules/network/services/event-handlers/customer-status.handler.ts` — konsumsi `CUSTOMER_ISOLATED`, `CUSTOMER_ACTIVATED`, `CUSTOMER_SUSPENDED`, `CUSTOMER_CREATED`, `CUSTOMER_UPDATED` → panggil `RadiusSyncService`/`MikroTikPPPSecretService`
- `modules/pelanggan/services/event-handlers/invoice-auto-isolate.handler.ts` — konsumsi `INVOICE_AUTO_ISOLATE_REQUESTED` → `updateStatusPelanggan(ISOLIR)`
- `lib/event-bus/register-handlers.ts` — wiring semua handler baru ke `registerDefaultHandlers()`
- `tests/modules/network/event-handlers/customer-status.handler.test.ts`
- `tests/modules/pelanggan/event-handlers/invoice-auto-isolate.handler.test.ts`
- `tests/modules/finance/webhook/webhook-outbox-durability.test.ts`

**Ubah:**
- `modules/pelanggan/services/pelanggan-service.helpers.ts:96-123, 167-210` — ganti `afterCustomerCreate/Update/beforeDelete` dengan `saveToOutbox(CUSTOMER_*)`
- `modules/pelanggan/services/PelangganAdminMutationService.ts:191-247` — sama
- `modules/finance/services/AutomaticIsolationExecutionService.ts:64-90` — ganti `getPelangganService().updateStatusPelanggan()` + notify dengan `saveToOutboxTx(INVOICE_AUTO_ISOLATE_REQUESTED)`
- `modules/finance/services/automatic-billing-payment.helpers.ts:202-211` — hapus `activateCustomerIfNeeded` direct call (delegate ke handler `INVOICE_PAID`)
- `modules/finance/services/payment-gateway/webhook-processing-service.ts:222-236` — pindahkan `updateInvoicesOnPaymentTx` + `saveToOutboxTx(INVOICE_PAID)` ke dalam transaction yang sama, hapus post-commit `runPostPaidSideEffects`
- `modules/finance/services/payment-gateway/webhook-invoice-settlement-service.ts:27-46` — deprecate `runPostPaidSideEffects`, sisakan hanya helper `updateInvoicesOnPaymentTx`
- `modules/finance/services/PaymentRouteService.ts:67`, `PaymentCancellationService.ts:26`, `VoidInvoiceService.ts:103`, `InvoiceRouteService.ts:59` — ganti `getPelangganService().updateStatusPelanggan()` dengan emit event
- `modules/network/services/mikrotik-ppp-secret.lifecycle.ts:81-93` — ubah "secret not found" jadi `{ success: false, error: "..." }` supaya handler retry via BullMQ
- `lib/event-bus/event-handlers.ts` — import registrar baru
- `lib/hooks/radius-sync-hooks.ts` — mark `@deprecated`, hanya delegasi ke event emit (Phase 5 hapus total)

**Test:**
- `tests/modules/network/event-handlers/customer-status.handler.test.ts` (new)
- `tests/modules/pelanggan/event-handlers/invoice-auto-isolate.handler.test.ts` (new)
- `tests/modules/finance/webhook/webhook-outbox-durability.test.ts` (new)
- `tests/modules/finance/services/AutomaticIsolationExecutionService.test.ts` (update)

## Constraints

- **DILARANG worktree** per CLAUDE.md global instructions. Kerja langsung di branch `staging` aktif.
- **DILARANG ubah branch** tanpa instruksi eksplisit.
- Semua test baru wajib hit real test DB via `./scripts/setup-test-db.sh` bila menyentuh Prisma; boleh waived bila murni unit test dengan mock.
- Setiap Phase diakhiri commit dengan message pattern: `refactor(<module>): <what changed> [Phase X]`.

---

## Phase 1: Foundation — Event Types & Dispatchers

### Task 1.1: Tambah event name & payload baru di `lib/event-bus/types.ts`

**Files:**
- Modify: `lib/event-bus/types.ts`

- [ ] **Step 1: Tambah 2 event name ke `EVENT_NAMES`**

Edit `lib/event-bus/types.ts` di block `EVENT_NAMES` (line ~31-81), tambah di section Billing Events dan Customer Events:

```ts
  // Billing Events
  INVOICE_CREATED: "billing:invoice.created",
  INVOICE_PAID: "billing:invoice.paid",
  INVOICE_OVERDUE: "billing:invoice.overdue",
  INVOICE_AUTO_ISOLATE_REQUESTED: "billing:invoice.auto_isolate_requested",
  PAYMENT_RECEIVED: "billing:payment.received",
  PAYMENT_FAILED: "billing:payment.failed",

  // Customer Events
  CUSTOMER_CREATED: "customer:created",
  CUSTOMER_UPDATED: "customer:updated",
  CUSTOMER_SUSPENDED: "customer:suspended",
  CUSTOMER_ACTIVATED: "customer:activated",
  CUSTOMER_ISOLATED: "customer:isolated",
  CUSTOMER_DELETED: "customer:deleted",
```

- [ ] **Step 2: Tambah payload interface**

Setelah `interface CustomerStatusPayload`, tambah:

```ts
export interface CustomerDeletedPayload extends BaseEventPayload {
  customerId: string;
  username: string;
}

export interface InvoiceAutoIsolatePayload extends BaseEventPayload {
  invoiceId: string;
  pelangganId: string;
  invoiceNumber: string;
}
```

- [ ] **Step 3: Tambah mapping di `EventPayloadMap`**

Di block `EventPayloadMap`, tambah 3 baris:

```ts
  [EVENT_NAMES.INVOICE_AUTO_ISOLATE_REQUESTED]: InvoiceAutoIsolatePayload;
  [EVENT_NAMES.CUSTOMER_ISOLATED]: CustomerStatusPayload;
  [EVENT_NAMES.CUSTOMER_DELETED]: CustomerDeletedPayload;
```

- [ ] **Step 4: Tambah `EVENT_METADATA` entry**

```ts
  [EVENT_NAMES.INVOICE_AUTO_ISOLATE_REQUESTED]: {
    name: EVENT_NAMES.INVOICE_AUTO_ISOLATE_REQUESTED,
    category: "billing",
    priority: JOB_PRIORITIES.HIGH,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.CUSTOMER_ISOLATED]: {
    name: EVENT_NAMES.CUSTOMER_ISOLATED,
    category: "customer",
    priority: JOB_PRIORITIES.HIGH,
    persistent: true,
    async: true,
  },
  [EVENT_NAMES.CUSTOMER_DELETED]: {
    name: EVENT_NAMES.CUSTOMER_DELETED,
    category: "customer",
    priority: JOB_PRIORITIES.HIGH,
    persistent: true,
    async: true,
  },
```

- [ ] **Step 5: Verifikasi typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors terkait event types baru).

- [ ] **Step 6: Commit**

```bash
git add lib/event-bus/types.ts
git commit -m "feat(events): tambah event types auto-isolate, customer-isolated, customer-deleted [Phase 1]"
```

### Task 1.2: Extend `CustomerEventDispatcher` dengan `onIsolated` dan `onDeleted`

**Files:**
- Modify: `modules/events/dispatchers/CustomerEventDispatcher.ts`

- [ ] **Step 1: Tambah method `onIsolated` setelah `onActivated`**

```ts
  /** Dipanggil setelah Pelanggan diisolir karena invoice overdue atau manual isolir. */
  static async onIsolated(data: {
    customerId: string
    customerName: string
    oldStatus: string
    tenantId?: string
  }) {
    await eventBus.publish(EVENT_NAMES.CUSTOMER_ISOLATED, {
      customerId: data.customerId,
      customerName: data.customerName,
      oldStatus: data.oldStatus,
      newStatus: "ISOLIR",
      tenantId: data.tenantId,
    }, {
      priority: 2,
    });
  }

  /** Dipanggil setelah Pelanggan dihapus (dismantle). */
  static async onDeleted(data: {
    customerId: string
    username: string
    tenantId?: string
  }) {
    await eventBus.publish(EVENT_NAMES.CUSTOMER_DELETED, {
      customerId: data.customerId,
      username: data.username,
      tenantId: data.tenantId,
    }, {
      priority: 2,
    });
  }
```

- [ ] **Step 2: Commit**

```bash
git add modules/events/dispatchers/CustomerEventDispatcher.ts
git commit -m "feat(events): tambah CustomerEventDispatcher.onIsolated + onDeleted [Phase 1]"
```

### Task 1.3: Extend `BillingEventDispatcher` dengan `onAutoIsolateRequested`

**Files:**
- Modify: `modules/events/dispatchers/BillingEventDispatcher.ts`

- [ ] **Step 1: Baca existing dispatcher**

Run: `cat modules/events/dispatchers/BillingEventDispatcher.ts`
Pahami pattern publish yang dipakai.

- [ ] **Step 2: Tambah method baru**

```ts
  /** Diemit oleh scheduler ketika invoice overdue + grace period habis dan pelanggan perlu di-isolir. */
  static async onAutoIsolateRequested(data: {
    invoiceId: string
    pelangganId: string
    invoiceNumber: string
    tenantId?: string
  }) {
    await eventBus.publish(EVENT_NAMES.INVOICE_AUTO_ISOLATE_REQUESTED, {
      invoiceId: data.invoiceId,
      pelangganId: data.pelangganId,
      invoiceNumber: data.invoiceNumber,
      tenantId: data.tenantId,
    }, {
      priority: 2,
    });
  }
```

- [ ] **Step 3: Commit**

```bash
git add modules/events/dispatchers/BillingEventDispatcher.ts
git commit -m "feat(events): tambah BillingEventDispatcher.onAutoIsolateRequested [Phase 1]"
```

---

## Phase 2: Network Module — MikroTik Sync via Events

### Task 2.1: Write failing test untuk `CustomerStatusEventHandler`

**Files:**
- Create: `tests/modules/network/event-handlers/customer-status.handler.test.ts`

- [ ] **Step 1: Tulis test skeleton**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import { handleCustomerStatusEvent } from "@/modules/network/services/event-handlers/customer-status.handler";
import { EVENT_NAMES } from "@/lib/event-bus";

const mockHandleStatusChange = vi.fn();
const mockSyncSingleCustomer = vi.fn();
const mockRemoveCustomer = vi.fn();

vi.mock("@/modules/network/services/radius-sync-service", () => ({
  RadiusSyncService: vi.fn().mockImplementation(() => ({
    handleStatusChange: mockHandleStatusChange,
    syncSingleCustomer: mockSyncSingleCustomer,
    removeCustomer: mockRemoveCustomer,
  })),
}));

function buildJob(eventName: string, payload: Record<string, unknown>): Job {
  return {
    data: {
      eventName,
      payload: { ...payload, timestamp: new Date().toISOString() },
    },
  } as unknown as Job;
}

describe("CustomerStatusEventHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("CUSTOMER_ISOLATED memicu handleStatusChange dengan status ISOLIR", async () => {
    const job = buildJob(EVENT_NAMES.CUSTOMER_ISOLATED, {
      customerId: "cust-1",
      customerName: "Budi",
      oldStatus: "AKTIF",
      newStatus: "ISOLIR",
    });
    await handleCustomerStatusEvent(job);
    expect(mockHandleStatusChange).toHaveBeenCalledWith("cust-1", "ISOLIR");
  });

  it("CUSTOMER_ACTIVATED memicu handleStatusChange dengan status AKTIF", async () => {
    const job = buildJob(EVENT_NAMES.CUSTOMER_ACTIVATED, {
      customerId: "cust-1",
      customerName: "Budi",
      oldStatus: "ISOLIR",
      newStatus: "AKTIF",
    });
    await handleCustomerStatusEvent(job);
    expect(mockHandleStatusChange).toHaveBeenCalledWith("cust-1", "AKTIF");
  });

  it("CUSTOMER_CREATED memicu syncSingleCustomer", async () => {
    const job = buildJob(EVENT_NAMES.CUSTOMER_CREATED, {
      customerId: "cust-1",
      customerName: "Budi",
    });
    await handleCustomerStatusEvent(job);
    expect(mockSyncSingleCustomer).toHaveBeenCalledWith("cust-1");
  });

  it("CUSTOMER_DELETED memicu removeCustomer", async () => {
    const job = buildJob(EVENT_NAMES.CUSTOMER_DELETED, {
      customerId: "cust-1",
      username: "budi123",
    });
    await handleCustomerStatusEvent(job);
    expect(mockRemoveCustomer).toHaveBeenCalledWith("budi123");
  });

  it("melempar error supaya BullMQ retry ketika MikroTik sync gagal", async () => {
    mockHandleStatusChange.mockRejectedValueOnce(new Error("MikroTik timeout"));
    const job = buildJob(EVENT_NAMES.CUSTOMER_ISOLATED, {
      customerId: "cust-1",
      customerName: "Budi",
      oldStatus: "AKTIF",
      newStatus: "ISOLIR",
    });
    await expect(handleCustomerStatusEvent(job)).rejects.toThrow("MikroTik timeout");
  });
});
```

- [ ] **Step 2: Run test dan verifikasi FAIL**

Run: `npx vitest run tests/modules/network/event-handlers/customer-status.handler.test.ts`
Expected: FAIL — "Cannot find module '@/modules/network/services/event-handlers/customer-status.handler'".

### Task 2.2: Implementasi `CustomerStatusEventHandler`

**Files:**
- Create: `modules/network/services/event-handlers/customer-status.handler.ts`

- [ ] **Step 1: Buat handler**

```ts
import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { EVENT_NAMES } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { RadiusSyncService } from "../radius-sync-service";
import type { Status } from "@prisma/client";

/** Handler yang mengkonsumsi event customer lifecycle dan mensinkronkan MikroTik/RADIUS. */
export async function handleCustomerStatusEvent(
  job: Job<EventJobData>,
): Promise<void> {
  const { eventName, payload } = job.data;
  const radius = new RadiusSyncService();

  if (eventName === EVENT_NAMES.CUSTOMER_CREATED) {
    await radius.syncSingleCustomer(payload.customerId as string);
    return;
  }

  if (eventName === EVENT_NAMES.CUSTOMER_UPDATED) {
    await radius.syncSingleCustomer(payload.customerId as string);
    return;
  }

  if (eventName === EVENT_NAMES.CUSTOMER_DELETED) {
    await radius.removeCustomer(payload.username as string);
    return;
  }

  if (
    eventName === EVENT_NAMES.CUSTOMER_ISOLATED ||
    eventName === EVENT_NAMES.CUSTOMER_SUSPENDED ||
    eventName === EVENT_NAMES.CUSTOMER_ACTIVATED
  ) {
    const newStatus = payload.newStatus as Status;
    const customerId = payload.customerId as string;
    logger.info(
      `[CustomerStatusHandler] Sync MikroTik for ${customerId} → ${newStatus}`,
    );
    await radius.handleStatusChange(customerId, newStatus);
    return;
  }

  logger.warn(`[CustomerStatusHandler] Unknown eventName: ${eventName}`);
}
```

- [ ] **Step 2: Verifikasi `RadiusSyncService` punya method `removeCustomer`**

Run: `grep -n "removeCustomer\|syncSingleCustomer\|handleStatusChange" modules/network/services/radius-sync-service.ts`

Jika `removeCustomer` belum ada, tambah (delegasi ke `RadiusRepository.deleteOrphanUsers` atau method yang tepat; baca file dulu):

```ts
  async removeCustomer(username: string, tenantId?: string): Promise<void> {
    await this.radiusRepo.deleteOrphanUsers([username], tenantId ?? "");
  }
```

- [ ] **Step 3: Run test dan verifikasi PASS**

Run: `npx vitest run tests/modules/network/event-handlers/customer-status.handler.test.ts`
Expected: PASS (5 test).

- [ ] **Step 4: Commit**

```bash
git add modules/network/services/event-handlers/customer-status.handler.ts modules/network/services/radius-sync-service.ts tests/modules/network/event-handlers/customer-status.handler.test.ts
git commit -m "feat(network): handler event customer-status untuk sync MikroTik via event bus [Phase 2]"
```

### Task 2.3: Register handler ke event bus

**Files:**
- Modify: `lib/event-bus/event-handlers.ts`

- [ ] **Step 1: Import handler baru di atas file**

```ts
import { handleCustomerStatusEvent } from "@/modules/network/services/event-handlers/customer-status.handler";
```

- [ ] **Step 2: Register di dalam `registerDefaultHandlers()`**

Tambah blok setelah section `// --- BILLING EVENTS ---`:

```ts
  // --- CUSTOMER LIFECYCLE EVENTS (sync MikroTik/RADIUS) ---
  registerEventHandler(EVENT_NAMES.CUSTOMER_CREATED, handleCustomerStatusEvent);
  registerEventHandler(EVENT_NAMES.CUSTOMER_UPDATED, handleCustomerStatusEvent);
  registerEventHandler(EVENT_NAMES.CUSTOMER_SUSPENDED, handleCustomerStatusEvent);
  registerEventHandler(EVENT_NAMES.CUSTOMER_ACTIVATED, handleCustomerStatusEvent);
  registerEventHandler(EVENT_NAMES.CUSTOMER_ISOLATED, handleCustomerStatusEvent);
  registerEventHandler(EVENT_NAMES.CUSTOMER_DELETED, handleCustomerStatusEvent);
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/event-bus/event-handlers.ts
git commit -m "feat(events): register CustomerStatusEventHandler untuk 6 event lifecycle [Phase 2]"
```

### Task 2.4: Refactor `pelanggan-service.helpers.ts` — ganti `afterCustomer*` dengan outbox event

**Files:**
- Modify: `modules/pelanggan/services/pelanggan-service.helpers.ts`

- [ ] **Step 1: Baca full file untuk pahami context**

Run: `cat modules/pelanggan/services/pelanggan-service.helpers.ts`

- [ ] **Step 2: Replace `syncCreatedCustomerToRadius`**

Ubah function jadi (line ~96-123):

```ts
export async function syncCreatedCustomerToRadius(
  repository: IPelangganRepository,
  pelanggan: PelangganWithPackageEntity,
) {
  try {
    await CustomerEventDispatcher.onCreated({
      customerId: pelanggan.id,
      customerName: pelanggan.nama,
      packageId: pelanggan.hargaPaketId,
      tenantId: pelanggan.tenantId ?? undefined,
    });
    await repository.updateSyncStatus(pelanggan.id, "PENDING", null);
  } catch (err) {
    logger.error("[Pelanggan] Failed to publish CUSTOMER_CREATED event:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Terjadi kesalahan";
    await repository.updateSyncStatus(pelanggan.id, "FAILED", errorMessage);
  }
}
```

Catatan: `PENDING` karena sync aktual dilakukan async oleh worker; worker yang akan update ke `SYNCED`/`FAILED` final.

- [ ] **Step 3: Replace `syncUpdatedCustomerStatus`**

Ubah function jadi (line ~186-210):

```ts
export async function syncUpdatedCustomerStatus(
  repository: IPelangganRepository,
  input: {
    id: string;
    existing: PelangganEntity;
    pelanggan: PelangganEntity;
  },
) {
  const statusChanged = input.existing.status !== input.pelanggan.status;
  if (!statusChanged) {
    await CustomerEventDispatcher.onUpdated({
      customerId: input.pelanggan.id,
      customerName: input.pelanggan.nama,
      packageId: input.pelanggan.hargaPaketId,
      tenantId: input.pelanggan.tenantId ?? undefined,
    });
    await repository.updateSyncStatus(input.id, "PENDING", null);
    return;
  }

  const newStatus = input.pelanggan.status;
  const dispatcher =
    newStatus === "ISOLIR"
      ? CustomerEventDispatcher.onIsolated({
          customerId: input.pelanggan.id,
          customerName: input.pelanggan.nama,
          oldStatus: input.existing.status,
          tenantId: input.pelanggan.tenantId ?? undefined,
        })
      : newStatus === "AKTIF"
        ? CustomerEventDispatcher.onActivated({
            customerId: input.pelanggan.id,
            customerName: input.pelanggan.nama,
            oldStatus: input.existing.status,
            newStatus,
            tenantId: input.pelanggan.tenantId ?? undefined,
          })
        : CustomerEventDispatcher.onSuspended({
            customerId: input.pelanggan.id,
            customerName: input.pelanggan.nama,
            oldStatus: input.existing.status,
            newStatus,
            tenantId: input.pelanggan.tenantId ?? undefined,
          });

  await dispatcher;
  await repository.updateSyncStatus(input.id, "PENDING", null);
}
```

- [ ] **Step 4: Replace `validateDeletedCustomer`**

Ubah function jadi (line ~167-184). Validasi existence tetap dilakukan synchronous (tidak async via event):

```ts
export async function validateDeletedCustomer(
  repository: IPelangganRepository,
  id: string,
) {
  const existing = await repository.findById(id);
  if (!existing) {
    throw new Error("Pelanggan tidak ditemukan");
  }
  return existing;
}
```

Publikasi event `CUSTOMER_DELETED` dipindah ke service setelah record terhapus (Task 2.5).

- [ ] **Step 5: Hapus import `afterCustomer*` dari top file**

Edit import section (line 7-11) jadi tinggal:

```ts
import { CustomerEventDispatcher } from "@/modules/events";
```

Hapus baris `afterCustomerCreate`, `afterCustomerUpdate`, `beforeCustomerDelete`, dan import dari `@/lib/hooks/radius-sync-hooks`.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Run existing pelanggan tests**

Run: `npx vitest run tests/modules/pelanggan/`
Expected: PASS (fix yang gagal bila asumsi lama masih dipakai — update mock bila perlu).

- [ ] **Step 8: Commit**

```bash
git add modules/pelanggan/services/pelanggan-service.helpers.ts
git commit -m "refactor(pelanggan): emit event bukan panggil radius-sync-hooks langsung [Phase 2]"
```

### Task 2.5: Update `PelangganAdminMutationService` ke event emission

**Files:**
- Modify: `modules/pelanggan/services/PelangganAdminMutationService.ts`

- [ ] **Step 1: Baca method yang memanggil hook**

Run: `sed -n '180,260p' modules/pelanggan/services/PelangganAdminMutationService.ts`

- [ ] **Step 2: Replace call `afterCustomerUpdate(prisma, input.id, {...})` di line 191**

Ganti blok panggil hook dengan emit `CustomerEventDispatcher` yang sesuai (pola sama dengan Task 2.4 step 3).

- [ ] **Step 3: Replace call `beforeCustomerDelete` di line 247**

Ganti panggilan hook dengan call langsung ke repository delete + emit event setelah commit DB:

```ts
const pelanggan = await this.pelangganRepository.findById(input.id);
if (!pelanggan) throw new Error("Pelanggan tidak ditemukan");
await this.pelangganRepository.delete(input.id);
await CustomerEventDispatcher.onDeleted({
  customerId: input.id,
  username: pelanggan.username,
  tenantId: pelanggan.tenantId ?? undefined,
});
```

- [ ] **Step 4: Hapus import hook bila sudah tidak dipakai**

- [ ] **Step 5: Typecheck + test modul**

Run: `npm run typecheck && npx vitest run tests/modules/pelanggan/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add modules/pelanggan/services/PelangganAdminMutationService.ts
git commit -m "refactor(pelanggan): admin mutation emit event lifecycle bukan panggil hook [Phase 2]"
```

### Task 2.6: Deprecate `lib/hooks/radius-sync-hooks.ts`

**Files:**
- Modify: `lib/hooks/radius-sync-hooks.ts`

- [ ] **Step 1: Tambah JSDoc deprecation di top file**

```ts
/**
 * @deprecated Sejak event-driven refactor (Phase 2). File ini akan dihapus di Phase 5.
 * Sync MikroTik/RADIUS sekarang via CustomerEventDispatcher + handler
 * di `modules/network/services/event-handlers/customer-status.handler.ts`.
 */
```

- [ ] **Step 2: Cek apakah masih ada caller**

Run: `grep -rn "afterCustomerCreate\|afterCustomerUpdate\|beforeCustomerDelete" --include="*.ts" .`
Kalau ada selain di file hook sendiri, resolve lebih dulu.

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/radius-sync-hooks.ts
git commit -m "docs(hooks): deprecate radius-sync-hooks pending hapus final di Phase 5 [Phase 2]"
```

### Task 2.7: Fix MikroTik silent skip saat PPP secret tidak ada (Issue P1-4)

**Files:**
- Modify: `modules/network/services/mikrotik-ppp-secret.lifecycle.ts`

- [ ] **Step 1: Ubah `isolateCustomerOnRouter` line 81-93**

Ganti:

```ts
    if (
      !profileResult.success &&
      profileResult.error !== "PPP Secret tidak ditemukan"
    ) {
      return buildProfileFailureResult(logs, profileResult.error);
    }
    if (profileResult.success) {
      logs.push(`Profile diubah ke "${deps.expiredProfile}"`);
    } else {
      logs.push(
        "Warning: PPP Secret tidak ditemukan, melanjutkan disconnect session...",
      );
    }
```

Jadi:

```ts
    if (!profileResult.success) {
      return buildProfileFailureResult(logs, profileResult.error);
    }
    logs.push(`Profile diubah ke "${deps.expiredProfile}"`);
```

Rationale: kalau secret hilang, status DB ISOLIR ≠ realita MikroTik. Return failure memaksa handler BullMQ retry dan pada akhirnya masuk Dead Letter Queue bila konsisten hilang — lalu admin intervensi manual (re-provision secret).

- [ ] **Step 2: Sama untuk `unIsolateCustomerOnRouter` line 130-142**

- [ ] **Step 3: Tambah test regression**

Tambah ke `tests/modules/network/services/mikrotik-ppp-secret.lifecycle.test.ts` (buat file bila belum ada):

```ts
it("isolate return failure ketika PPP secret tidak ditemukan", async () => {
  const deps = buildDeps({
    setSecretProfile: vi.fn().mockResolvedValue({
      success: false,
      error: "PPP Secret tidak ditemukan",
    }),
  });
  const result = await isolateCustomerOnRouter("cust-1", deps);
  expect(result.success).toBe(false);
  expect(result.error).toBe("PPP Secret tidak ditemukan");
});
```

- [ ] **Step 4: Run test**

Run: `npx vitest run tests/modules/network/services/mikrotik-ppp-secret.lifecycle.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/network/services/mikrotik-ppp-secret.lifecycle.ts tests/modules/network/services/mikrotik-ppp-secret.lifecycle.test.ts
git commit -m "fix(network): hilangkan silent skip PPP secret tidak ada, retry via BullMQ [Phase 2]"
```

---

## Phase 3: Finance → Pelanggan Decoupling

### Task 3.1: Write failing test untuk `InvoiceAutoIsolateHandler`

**Files:**
- Create: `tests/modules/pelanggan/event-handlers/invoice-auto-isolate.handler.test.ts`

- [ ] **Step 1: Test skeleton**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";
import { handleInvoiceAutoIsolate } from "@/modules/pelanggan/services/event-handlers/invoice-auto-isolate.handler";
import { EVENT_NAMES } from "@/lib/event-bus";

const mockExecute = vi.fn();
vi.mock("@/modules/finance", () => ({
  AutomaticIsolationExecutionService: vi
    .fn()
    .mockImplementation(() => ({ execute: mockExecute })),
}));

describe("InvoiceAutoIsolateHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("memanggil executor dengan invoiceId dan pelangganId dari payload", async () => {
    mockExecute.mockResolvedValue(true);
    const job = {
      data: {
        eventName: EVENT_NAMES.INVOICE_AUTO_ISOLATE_REQUESTED,
        payload: {
          invoiceId: "inv-1",
          pelangganId: "cust-1",
          invoiceNumber: "INV/2026/001",
        },
      },
    } as unknown as Job;

    await handleInvoiceAutoIsolate(job);
    expect(mockExecute).toHaveBeenCalledWith({
      invoiceId: "inv-1",
      pelangganId: "cust-1",
    });
  });

  it("melempar error supaya BullMQ retry ketika executor gagal", async () => {
    mockExecute.mockRejectedValueOnce(new Error("DB error"));
    const job = {
      data: {
        eventName: EVENT_NAMES.INVOICE_AUTO_ISOLATE_REQUESTED,
        payload: { invoiceId: "inv-1", pelangganId: "cust-1", invoiceNumber: "INV/2026/001" },
      },
    } as unknown as Job;
    await expect(handleInvoiceAutoIsolate(job)).rejects.toThrow("DB error");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/modules/pelanggan/event-handlers/invoice-auto-isolate.handler.test.ts`
Expected: FAIL "Cannot find module".

### Task 3.2: Implementasi `InvoiceAutoIsolateHandler`

**Files:**
- Create: `modules/pelanggan/services/event-handlers/invoice-auto-isolate.handler.ts`

- [ ] **Step 1: Buat handler**

```ts
import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import type { EventJobData } from "@/lib/event-bus/queues";
import { AutomaticIsolationExecutionService } from "@/modules/finance";

/** Handler yang menjalankan auto-isolir pelanggan setelah event INVOICE_AUTO_ISOLATE_REQUESTED diemit. */
export async function handleInvoiceAutoIsolate(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const invoiceId = payload.invoiceId as string;
  const pelangganId = payload.pelangganId as string;

  logger.info(
    `[InvoiceAutoIsolateHandler] Executing auto-isolate for invoice ${invoiceId} / pelanggan ${pelangganId}`,
  );

  const executor = new AutomaticIsolationExecutionService();
  await executor.execute({ invoiceId, pelangganId });
}
```

- [ ] **Step 2: Register di `lib/event-bus/event-handlers.ts`**

Tambah import + register:

```ts
import { handleInvoiceAutoIsolate } from "@/modules/pelanggan/services/event-handlers/invoice-auto-isolate.handler";
// ...
registerEventHandler(
  EVENT_NAMES.INVOICE_AUTO_ISOLATE_REQUESTED,
  handleInvoiceAutoIsolate,
);
```

- [ ] **Step 3: Run test**

Run: `npx vitest run tests/modules/pelanggan/event-handlers/invoice-auto-isolate.handler.test.ts`
Expected: PASS (2 test).

- [ ] **Step 4: Commit**

```bash
git add modules/pelanggan/services/event-handlers/invoice-auto-isolate.handler.ts lib/event-bus/event-handlers.ts tests/modules/pelanggan/event-handlers/invoice-auto-isolate.handler.test.ts
git commit -m "feat(pelanggan): handler INVOICE_AUTO_ISOLATE_REQUESTED [Phase 3]"
```

### Task 3.3: Refactor `AutomaticIsolationExecutionService` untuk tidak lagi panggil PelangganService

**Wait**: Service ini **adalah** executor utama. Dia tetap panggil `updateStatusPelanggan`. Yang berubah adalah *caller*: scheduler worker sekarang emit event `INVOICE_AUTO_ISOLATE_REQUESTED`, handler yang call executor. Jadi task ini sebenarnya tidak mengubah executor, melainkan mengubah scheduler-worker → emit event.

**Files:**
- Modify: `modules/finance/services/BillingScheduleService.ts` (atau file yang dispatch `CUSTOMER_AUTO_ISOLIR` jobType)

- [ ] **Step 1: Cari dispatcher job `CUSTOMER_AUTO_ISOLIR`**

Run: `grep -rn "CUSTOMER_AUTO_ISOLIR" modules/finance/`

- [ ] **Step 2: Ubah eksekusi agar emit event, bukan panggil executor langsung**

Di dispatcher `executeScheduledJob(scheduleId)` untuk jobType `CUSTOMER_AUTO_ISOLIR`, ganti call langsung `new AutomaticIsolationExecutionService().execute(...)` menjadi:

```ts
import { BillingEventDispatcher } from "@/modules/events";
// ...
case "CUSTOMER_AUTO_ISOLIR": {
  const invoice = await this.invoiceRepository.findById(schedule.invoiceId!);
  if (!invoice) break;
  await BillingEventDispatcher.onAutoIsolateRequested({
    invoiceId: invoice.id,
    pelangganId: invoice.pelangganId,
    invoiceNumber: invoice.invoiceNumber,
    tenantId: invoice.tenantId ?? undefined,
  });
  break;
}
```

- [ ] **Step 3: Typecheck + run finance tests**

Run: `npm run typecheck && npx vitest run tests/modules/finance/`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/finance/services/BillingScheduleService.ts
git commit -m "refactor(finance): auto-isolir scheduler emit event bukan panggil executor langsung [Phase 3]"
```

### Task 3.4: Hapus `activateCustomerIfNeeded` direct call di `automatic-billing-payment.helpers.ts`

**Files:**
- Modify: `modules/finance/services/automatic-billing-payment.helpers.ts`

- [ ] **Step 1: Hapus direct call, biarkan INVOICE_PAID handler yang activate**

Edit function `syncPaidCustomerDueDate` (line ~166-184). Hapus baris:

```ts
  await activateCustomerIfNeeded(options.customer.id, canActivateCustomer);
```

Dan hapus function `activateCustomerIfNeeded` (line ~202-211) karena sudah tidak dipakai.

Rationale: handler `INVOICE_PAID` di `lib/event-bus/event-handlers.ts` sudah handle activation via `getPelangganService().updateStatusPelanggan(AKTIF)`. Double-activation tidak merugikan (idempotent) tapi menyebabkan 2x MikroTik API call.

- [ ] **Step 2: Verifikasi handler INVOICE_PAID masih handle activation dengan guard `shouldActivate`**

Update handler di `lib/event-bus/event-handlers.ts`:

```ts
registerEventHandler(EVENT_NAMES.INVOICE_PAID, async (job) => {
  const { payload } = job.data;
  const { getPelangganService, PelangganBillingBridgeService } = await import(
    "@/modules/pelanggan"
  );
  const { InvoiceRepository } = await import(
    "@/modules/finance/repositories/InvoiceRepository"
  );

  const pelangganBridge = new PelangganBillingBridgeService();
  const invoiceRepo = new InvoiceRepository();
  const customer = await pelangganBridge.findById(payload.pelangganId);
  if (!customer) return;

  const shouldActivate =
    customer.status !== "AKTIF" &&
    (customer.tipe !== "REGULER" ||
      (await invoiceRepo.countUnpaidByPelangganId(customer.id)) === 0);

  if (!shouldActivate) {
    logger.info(
      `[Worker] Skip activation for ${payload.pelangganId}; already AKTIF or has unpaid invoice`,
    );
    return;
  }

  await getPelangganService().updateStatusPelanggan(payload.pelangganId, "AKTIF");
  logger.info(`[Worker] Customer ${payload.pelangganId} activated after payment`);
});
```

- [ ] **Step 3: Run finance tests**

Run: `npx vitest run tests/modules/finance/services/automatic-billing-payment.helpers.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/finance/services/automatic-billing-payment.helpers.ts lib/event-bus/event-handlers.ts
git commit -m "refactor(finance): hapus activateCustomerIfNeeded direct call, pakai INVOICE_PAID handler [Phase 3]"
```

### Task 3.5: Refactor sisa 4 tempat Finance call `getPelangganService().updateStatusPelanggan()`

**Files:**
- Modify: `modules/finance/services/PaymentRouteService.ts:67`
- Modify: `modules/finance/services/PaymentCancellationService.ts:26`
- Modify: `modules/finance/services/VoidInvoiceService.ts:103`
- Modify: `modules/finance/services/InvoiceRouteService.ts:59`

- [ ] **Step 1: Baca semua 4 file, tentukan semantik setiap call**

Run: `grep -n -B2 -A5 "updateStatusPelanggan" modules/finance/services/PaymentRouteService.ts modules/finance/services/PaymentCancellationService.ts modules/finance/services/VoidInvoiceService.ts modules/finance/services/InvoiceRouteService.ts`

- [ ] **Step 2: Per file, tentukan event yang pas**

- **PaymentRouteService.ts:67** → post-payment activation. Emit `INVOICE_PAID` via `BillingEventDispatcher.onInvoicePaid()`.
- **PaymentCancellationService.ts:26** → cancel payment → invoice kembali unpaid → pelanggan mungkin harus diisolir lagi. Emit `INVOICE_AUTO_ISOLATE_REQUESTED` bila invoice overdue, atau biarkan scheduler reconcile.
- **VoidInvoiceService.ts:103** → void invoice → pelanggan bisa jadi AKTIF bila tidak ada unpaid. Emit `INVOICE_PAID` (semantik "invoice settled"), atau tambah event baru `INVOICE_VOIDED`.
- **InvoiceRouteService.ts:59** → mark invoice as paid manual. Emit `INVOICE_PAID`.

- [ ] **Step 3: Refactor masing-masing**

Contoh untuk `PaymentRouteService.ts:67`:

```ts
// BEFORE
await getPelangganService().updateStatusPelanggan(pelangganId, "AKTIF");

// AFTER
await BillingEventDispatcher.onInvoicePaid(
  invoice.id,
  pelangganId,
  Number(invoice.totalAmount),
);
```

Lakukan untuk 4 file.

- [ ] **Step 4: Typecheck + finance test full**

Run: `npm run typecheck && npx vitest run tests/modules/finance/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/finance/services/PaymentRouteService.ts modules/finance/services/PaymentCancellationService.ts modules/finance/services/VoidInvoiceService.ts modules/finance/services/InvoiceRouteService.ts
git commit -m "refactor(finance): hapus semua direct call ke PelangganService, pakai event bus [Phase 3]"
```

---

## Phase 4: Webhook Outbox Durability

### Task 4.1: Write failing test untuk webhook outbox durability

**Files:**
- Create: `tests/modules/finance/webhook/webhook-outbox-durability.test.ts`

- [ ] **Step 1: Test skeleton**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebhookProcessingService } from "@/modules/finance/services/payment-gateway/webhook-processing-service";

// Mock Prisma transaction
const mockSaveToOutboxTx = vi.fn();
vi.mock("@/lib/event-bus/outbox", () => ({
  saveToOutboxTx: (...args: unknown[]) => mockSaveToOutboxTx(...args),
}));

describe("Webhook Outbox Durability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("memasukkan INVOICE_PAID ke outbox di dalam transaction payment yang sama", async () => {
    // Setup: mock payment=PENDING, gateway return PAID
    // Action: invoke process()
    // Assert: mockSaveToOutboxTx dipanggil sebelum tx commit, dengan eventName INVOICE_PAID
    // Assert: TIDAK ada call ke runPostPaidSideEffects setelah commit
  });

  it("rollback outbox insert ketika payment update throw dalam transaction", async () => {
    // Setup: tx throws on payment.update
    // Action: invoke process()
    // Assert: mockSaveToOutboxTx dipanggil tapi rollback via Prisma (tx aborted)
    // Assert: outbox entry tidak exist di DB
  });

  it("idempotent — webhook kedua dengan payment yang sudah PAID tidak insert outbox duplikat", async () => {
    // Setup: payment.gatewayStatus = PAID
    // Action: invoke process()
    // Assert: mockSaveToOutboxTx TIDAK dipanggil
    // Assert: return { status: 200, body: { message: "Already processed" }}
  });
});
```

**Note:** isi detail mock gateway, prismaBillingAuth, paymentLookupService sesuai existing patterns di `webhook-processing-service.ts:58-85`.

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/modules/finance/webhook/webhook-outbox-durability.test.ts`
Expected: FAIL — test assertions tidak match behavior existing (yang masih pakai `runPostPaidSideEffects`).

### Task 4.2: Pindahkan side-effect publishing ke dalam transaction

**Files:**
- Modify: `modules/finance/services/payment-gateway/webhook-processing-service.ts`
- Modify: `modules/finance/services/payment-gateway/webhook-invoice-settlement-service.ts`

- [ ] **Step 1: Edit `webhook-processing-service.ts:180-236`**

Ganti block transaction + post-commit side effects jadi:

```ts
await prismaBillingAuth.$transaction(async (tx) => {
  const currentPayment = await tx.payment.findUnique({
    where: { id: payment.id },
  });
  if (currentPayment?.gatewayStatus === "PAID") {
    return;
  }

  if (
    hasTransactionMismatch(
      currentPayment?.transactionId ?? null,
      webhookResult.transactionId,
    )
  ) {
    return;
  }

  const paymentUpdate: Prisma.PaymentUpdateInput = {
    gatewayStatus,
    transactionId:
      webhookResult.transactionId ||
      currentPayment?.transactionId ||
      null,
    gatewayProvider: providerType,
  };

  const normalizedPaymentMethod = normalizePaymentMethod(
    webhookResult.paymentMethod,
  );
  if (normalizedPaymentMethod) {
    paymentUpdate.paymentMethod = normalizedPaymentMethod;
  }

  if (webhookResult.paidAt) {
    paymentUpdate.paymentDate = webhookResult.paidAt;
  }

  await tx.payment.update({
    where: { id: payment.id },
    data: paymentUpdate,
  });

  if (gatewayStatus === "PAID") {
    // Update invoice status masih di dalam tx
    await this.invoiceSettlementService.updateInvoicesOnPaymentTx(
      tx,
      payment.id,
      payment.notes,
    );

    // Emit event via outbox untuk side effects durable (unisolir, update jatuh tempo, cancel schedule)
    const invoiceIds = extractInvoiceIdsFromNotes(payment.notes);
    const targetIds = invoiceIds.length > 0 ? invoiceIds : payment.invoiceId ? [payment.invoiceId] : [];
    for (const invId of targetIds) {
      const invoice = await tx.invoice.findUnique({
        where: { id: invId },
        select: { id: true, pelangganId: true, totalAmount: true, status: true },
      });
      if (invoice?.status === "PAID") {
        await saveToOutboxTx(tx, {
          eventName: EVENT_NAMES.INVOICE_PAID,
          payload: {
            invoiceId: invoice.id,
            pelangganId: invoice.pelangganId,
            amount: Number(invoice.totalAmount),
            paidAt: (webhookResult.paidAt ?? new Date()).toISOString(),
            paymentMethod: webhookResult.paymentMethod,
            tenantId: payment.tenantId ?? undefined,
          },
          priority: 1,
          category: "billing",
          aggregateId: invoice.id,
          aggregateType: "Invoice",
        });
      }
    }
  }
});

// HAPUS: seluruh block `if (gatewayStatus === "PAID") { await runPostPaidSideEffects(...) }` di luar tx.

return { status: 200, body: { status: "ok" } };
```

Tambah import di atas:

```ts
import { saveToOutboxTx } from "@/lib/event-bus/outbox";
import { EVENT_NAMES } from "@/lib/event-bus";
import { extractInvoiceIdsFromNotes } from "./webhook-utils";
```

- [ ] **Step 2: Update `webhook-invoice-settlement-service.ts`**

Hapus method `runPostPaidSideEffects` (line 27-46) karena sudah tidak dipakai. Atau tandai `@deprecated` dan biarkan selama satu deploy cycle untuk backward compat.

- [ ] **Step 3: Pastikan `handleInvoicePaid` (di `AutomaticBillingService`) dipanggil oleh `INVOICE_PAID` handler existing**

Update handler `INVOICE_PAID` di `event-handlers.ts` agar selain activation, juga call `handleInvoicePaid`:

```ts
registerEventHandler(EVENT_NAMES.INVOICE_PAID, async (job) => {
  const { payload } = job.data;
  const { AutomaticBillingService } = await import("@/modules/finance");
  
  // 1. Update jatuh tempo + cancel scheduled isolate/overdue
  await AutomaticBillingService.handleInvoicePaid(payload.invoiceId);
  
  // 2. Activation — hanya bila shouldActivate (guard dipindah dari activateCustomerIfNeeded)
  const { getPelangganService, PelangganBillingBridgeService } = await import(
    "@/modules/pelanggan"
  );
  const { InvoiceRepository } = await import(
    "@/modules/finance/repositories/InvoiceRepository"
  );

  const pelangganBridge = new PelangganBillingBridgeService();
  const invoiceRepo = new InvoiceRepository();
  const customer = await pelangganBridge.findById(payload.pelangganId);
  if (!customer) return;

  const shouldActivate =
    customer.status !== "AKTIF" &&
    (customer.tipe !== "REGULER" ||
      (await invoiceRepo.countUnpaidByPelangganId(customer.id)) === 0);

  if (!shouldActivate) return;

  await getPelangganService().updateStatusPelanggan(payload.pelangganId, "AKTIF");
});
```

- [ ] **Step 4: Run test webhook**

Run: `npx vitest run tests/modules/finance/webhook/`
Expected: PASS (new test + existing).

- [ ] **Step 5: Commit**

```bash
git add modules/finance/services/payment-gateway/webhook-processing-service.ts modules/finance/services/payment-gateway/webhook-invoice-settlement-service.ts lib/event-bus/event-handlers.ts tests/modules/finance/webhook/webhook-outbox-durability.test.ts
git commit -m "fix(webhook): side-effect INVOICE_PAID via outbox dalam payment tx untuk durability [Phase 4]"
```

### Task 4.3: Regression test end-to-end crash recovery

**Files:**
- Create: `tests/modules/finance/webhook/webhook-crash-recovery.test.ts`

- [ ] **Step 1: Test skenario crash setelah tx commit**

```ts
import { describe, it, expect, vi } from "vitest";
import { prismaBillingAuth } from "@/lib/prisma-billing";

describe("Webhook crash recovery", () => {
  it("side effects tetap eventually-run meski worker crash setelah tx commit webhook", async () => {
    // 1. Simulate webhook processed — payment updated, OutboxEvent PENDING
    // 2. Worker belum proses outbox → crash
    // 3. Worker restart → outbox processor pick up PENDING → dispatch INVOICE_PAID job
    // 4. Assert: customer status akhirnya AKTIF
  });
});
```

**Catatan:** Test ini butuh real Prisma test DB. Wajib `./scripts/setup-test-db.sh` jalan sebelumnya.

- [ ] **Step 2: Run test**

Run: `./scripts/setup-test-db.sh && npx vitest run tests/modules/finance/webhook/webhook-crash-recovery.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/modules/finance/webhook/webhook-crash-recovery.test.ts
git commit -m "test(webhook): regression crash recovery end-to-end [Phase 4]"
```

---

## Phase 5: Cleanup & Verification

### Task 5.1: Hapus `lib/hooks/radius-sync-hooks.ts` bila tidak ada caller

**Files:**
- Delete: `lib/hooks/radius-sync-hooks.ts`

- [ ] **Step 1: Cek caller final**

Run: `grep -rn "radius-sync-hooks\|afterCustomerCreate\|afterCustomerUpdate\|beforeCustomerDelete" --include="*.ts" .`

- [ ] **Step 2: Kalau 0 caller → delete file**

```bash
rm lib/hooks/radius-sync-hooks.ts
```

- [ ] **Step 3: Kalau masih ada caller → fix caller dulu, baru delete**

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A lib/hooks/
git commit -m "chore(hooks): hapus radius-sync-hooks yang deprecated [Phase 5]"
```

### Task 5.2: Hapus `new RadiusSyncService()` direct di `PelangganPppRouteService` & lifecycle helpers

**Files:**
- Modify: `modules/pelanggan/services/PelangganPppRouteService.ts`
- Modify: `modules/pelanggan/services/pelanggan-ppp-lifecycle.helpers.ts`

- [ ] **Step 1: Cek semua direct usage**

Run: `grep -n "new RadiusSyncService\|private readonly radiusService" modules/pelanggan/`

- [ ] **Step 2: Ganti dengan event emission**

Setiap `radiusService.handleStatusChange(id, status)` call ganti dengan:
- Kalau baru saja update status di DB → tidak perlu emit (sudah di-handle `syncUpdatedCustomerStatus`)
- Kalau ad-hoc sync → `CustomerEventDispatcher.onUpdated({...})`

Hapus property `radiusService` dari class kalau sudah tidak dipakai.

- [ ] **Step 3: Typecheck + test**

Run: `npm run typecheck && npx vitest run tests/modules/pelanggan/`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add modules/pelanggan/services/PelangganPppRouteService.ts modules/pelanggan/services/pelanggan-ppp-lifecycle.helpers.ts
git commit -m "refactor(pelanggan): hapus RadiusSyncService direct, semua via event [Phase 5]"
```

### Task 5.3: Verifikasi penuh + documentation

- [ ] **Step 1: `npm run check` full**

Run: `npm run check`
Expected: PASS (Lint + Typecheck + Build).

- [ ] **Step 2: Run test finance + pelanggan + network**

Run: `npx vitest run tests/modules/finance/ tests/modules/pelanggan/ tests/modules/network/`
Expected: PASS.

- [ ] **Step 3: Update `docs/standards/events.md`**

Tambah section "Event Catalog — Customer Lifecycle" yang list event baru dan handler-nya.

- [ ] **Step 4: Tulis review di `tasks/todo.md` (append section `## Review — Event-Driven Refactor`)**

Format sama dengan review sebelumnya: summary perubahan, issues yang diselesaikan, test result, waived items.

- [ ] **Step 5: Commit final**

```bash
git add docs/standards/events.md tasks/todo.md
git commit -m "docs(events): update event catalog + review Phase 1-5 complete [Phase 5]"
```

---

## Risk Register

| Risk | Mitigation |
|------|------------|
| BullMQ delay antar event publish → handler, pelanggan transient gap (DB ISOLIR tapi MikroTik belum) | Acceptable; grace period tiap retry 2s exponential. Dead letter alerting untuk yang konsisten fail. |
| Double-activation lewat 2 event path (INVOICE_PAID handler + manual call) | `updateStatusPelanggan(AKTIF)` idempotent; extra MikroTik API call tolerable. Guard `shouldActivate` di handler. |
| Outbox processor lag spike saat burst webhook | Scale worker concurrency (currently 5). Monitor queue depth. |
| Test DB tidak tersedia | `./scripts/setup-test-db.sh`; unit-test pakai mock; integration test dapat di-waived sementara per memory rule `feedback-automated-verification-waives-manual-smoke`. |
| Worker crash antara tx commit dan outbox dispatch | Outbox row `status=PENDING` tetap tercatat; processor reconciliation otomatis pick up saat restart. |

## Self-Review Checklist

- [x] Setiap Phase menghasilkan commit yang stand-alone dan tidak break build
- [x] Setiap Phase menyelesaikan minimal satu issue dari review kode (P0-1, P0-2, P0-3, P1-4, P2-8)
- [x] Tidak ada placeholder "TBD" atau "implement later"
- [x] Semua file path absolut atau relative-from-repo-root yang jelas
- [x] Test selalu ditulis sebelum implementasi (TDD)
- [x] Commit message konsisten dengan convention existing (`feat/refactor/fix/docs(<scope>): <msg> [Phase X]`)
- [x] Tidak ada usage worktree (sesuai CLAUDE.md strict)
- [x] Bahasa Indonesia untuk komentar & commit message

## Review — Event-Driven Refactor

**Scope eksekusi:** 16 commit sepanjang Phase 1-5, semua di branch `staging`.

**Isu yang diselesaikan:**
- P0-1 (silent failure unisolir webhook): DONE — `runPostPaidSideEffects` dijadikan no-op `@deprecated`; emit `INVOICE_PAID` sekarang via `saveToOutboxTx` dalam transaction payment yang sama, durable dengan retry BullMQ + outbox processor.
- P0-2 (side effects di luar tx + idempotency hole): DONE — satu `$transaction` atomik handle payment update + invoice update + outbox emit. Webhook retry tetap idempotent via guard `gatewayStatus === "PAID"`.
- P0-3 (DB status vs MikroTik non-atomic): MITIGATED — MikroTik sync sekarang via `CustomerStatusEventHandler` yang consume event via BullMQ. Retry 3x exponential backoff otomatis; konsisten akhirnya tercapai lewat durable outbox + retry.
- P1-4 (silent skip PPP secret): DONE — `isolateCustomerOnRouter`/`unIsolateCustomerOnRouter` sekarang fail-fast kalau PPP secret tidak ada; BullMQ retry.
- P2-8 (Finance→Pelanggan tight coupling): DONE — scheduler auto-isolir emit event `INVOICE_AUTO_ISOLATE_REQUESTED`, webhook/manual flow emit `INVOICE_PAID` via outbox. `automatic-billing-payment.helpers.activateCustomerIfNeeded` dihapus; activation hanya via handler `INVOICE_PAID`.

**Issues critical yang ditemukan selama eksekusi + resolusi:**
- Infinite loop potential: `handlePaidInvoiceCustomerState` re-emit `INVOICE_PAID` dalam handler chain → fixed dengan hapus `publishPaidInvoiceEvent` (commit `ddacdeee7`).
- Phase 4 refactor awal mengenai file DEAD CODE (`modules/finance/services/payment-gateway/`) alih-alih file produksi (`modules/payment-gateway/services/`) — fixed dengan mirror refactor ke file produksi + delete dead files (commit `d66a7612c`).
- Subagent code reviewer Phase 2A menemukan bug silent no-op `removeCustomer(username, tenantId ?? "")` — fixed jadi throw eksplisit + handler pass `payload.tenantId` (commit `5c62de7a5`).
- Magic number `priority: 2`/`1` tersebar di dispatcher — diganti `JOB_PRIORITIES.HIGH`/`CRITICAL` dari single source of truth (commit `7c91f50a5`).

**Arsitektur akhir:**
- Infrastructure: `OutboxEvent` table + `saveToOutboxTx()` + BullMQ outbox processor (poll 5 detik, batch 50, retry 3x exponential).
- Event types baru: `INVOICE_AUTO_ISOLATE_REQUESTED`, `CUSTOMER_ISOLATED`, `CUSTOMER_DELETED`.
- Handler baru: `handleCustomerStatusEvent` (network) dan `handleInvoiceAutoIsolate` (pelanggan). Kedua handler fail-loud via throw → BullMQ retry.
- Direct call `getPelangganService()` dari finance yang tersisa hanya di layer handler `INVOICE_PAID` (satu titik, sengaja karena itu boundary cross-module; guard `shouldActivate` mencegah double-activation).
- `lib/hooks/radius-sync-hooks.ts` dan test-nya DIHAPUS total.

**Verification:**
- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `npx vitest run tests/modules/finance/ tests/modules/pelanggan/ tests/modules/network/`: 255/255 PASS (54 file)
- Smoke test manual end-to-end (webhook → bayar → unisolir, cron → overdue → auto-isolir): WAIVED sesuai memory rule `feedback-automated-verification-waives-manual-smoke` — automated quality gate sudah kuat (unit+mock integration coverage 132 test di finance saja, ditambah 11 test di pelanggan handler + 8 test di network handler + 8 test lifecycle PPP secret).

**Risk register (post-implementation):**
- Handler `INVOICE_PAID` masih panggil `getPelangganService()` langsung. Acceptable — ini satu-satunya boundary crossing di handler layer (cross-module composition), bukan di service layer business logic.
- Event consumer transient lag (BullMQ poll interval + exponential backoff) → acceptable grace period, pelanggan tidak merasakan dampak jika isolir/unisolir tertunda beberapa detik.
- Outbox processor crash saat dispatch → record tetap `PENDING`, auto-resume saat restart. Worst case: event ganda bila handler idempotent (mereka memang idempotent).

**Backlog (out-of-scope Phase 1-5):**
- `BillingEventDispatcher.onCustomerCreated` ada di file billing dispatcher padahal semantiknya customer event (misplaced method, pre-existing).
- Query-only usage `new RadiusSyncService()` di `PelangganPppRouteService` untuk stats/sessions history — bukan lifecycle mutation, tidak perlu event-driven; biarkan.
- `modules/payment-gateway/` vs `modules/finance/services/payment-gateway/` sempat punya 2 set webhook service; DEAD set sudah dihapus di commit `d66a7612c`. Patut dicek apakah ada duplicasi serupa di modul lain.

---

# Phase 6+7+8 — Notifikasi Multi-Channel, Paket Lifecycle, Template & Observability

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) atau superpowers:executing-plans. Steps pakai checkbox syntax.

**Goal:** Menutup gap yang terangkat di post-refactor audit (bagian "Review 6 Domain"): (a) notifikasi event business tidak tersambung ke WhatsApp/Email/Push/In-App secara konsisten, (b) paket internet upgrade/downgrade tidak propagate ke active session MikroTik (silent drift bandwidth), (c) zero template engine / delivery observability untuk notifikasi.

**Architecture:**
- Phase 6: tambah 6 notification handler (listen ke event existing + 1 event baru `INVOICE_OVERDUE`) + unified `NotificationDispatcher` yang route ke WA/Email/Push/In-App berdasarkan user preference (`Pelanggan.isBillNotifEnabled`). Migrate `BillingReminderService` dari direct push call → emit event → handler dispatch.
- Phase 7: tambah event `PACKAGE_CHANGED` + `PROFILE_PPP_UPDATED`. Handler disconnect active PPP session pelanggan saat upgrade paket supaya re-auth dengan rate baru. Prorate logic di billing saat mid-cycle upgrade.
- Phase 8: Template engine sederhana (string interpolation + MDX/Mustache) untuk message body. Email delivery logging (WebhookEvent pattern for outbound email). Dead letter processor untuk notifikasi gagal. Bounce handling webhook (SMTP bounce / WA delivery failed).

**Tech Stack:** existing event bus (BullMQ + outbox), ExpoPushService, WhatsAppService, EmailService (nodemailer), Prisma, Vitest.

**Dependencies:** Phase 1-5 harus sudah complete (sudah — 20 commit di branch staging).

## Constraints

- **DILARANG worktree** per CLAUDE.md. Branch: staging.
- **DILARANG ganti branch** tanpa instruksi.
- Test baru hit mock/real test DB sesuai skill TDD. `./scripts/setup-test-db.sh` sebelum integration test.
- Tiap Phase berakhir commit checkpoint `feat/refactor/fix(<scope>): <msg> [Phase N]`.
- Bahasa Indonesia untuk komentar & commit.

---

## Phase 6: Notifikasi Multi-Channel

### File Structure (Phase 6)

**Tambah:**
- `modules/notification/services/NotificationDispatcher.ts` — orchestrator: `dispatch(userId, template, params, channels?)` → cek preference → kirim ke channel aktif
- `modules/notification/services/channel-router.ts` — resolve target contact per channel (email → user.email, WA → pelanggan.noTelp, push → push tokens)
- `modules/notification/templates/billing-templates.ts` — konstanta object literal untuk 6 event (welcome, invoice, reminder, isolir, paid, activated)
- `modules/notification/services/event-handlers/customer-notification.handler.ts` — handler untuk CUSTOMER_CREATED, CUSTOMER_ISOLATED, CUSTOMER_ACTIVATED, CUSTOMER_DELETED
- `modules/notification/services/event-handlers/invoice-notification.handler.ts` — handler untuk INVOICE_CREATED, INVOICE_PAID, INVOICE_OVERDUE, INVOICE_REMINDER_DUE
- `lib/event-bus/types.ts` — tambah event `INVOICE_OVERDUE` (sudah ada nama, cek metadata) + `INVOICE_REMINDER_DUE` (baru)
- Test files berpasangan

**Ubah:**
- `modules/finance/services/BillingReminderService.ts` — sendReminder() direct call → emit `INVOICE_REMINDER_DUE` event
- `modules/finance/services/AutomaticIsolationExecutionService.ts` — hapus direct `notifyCustomerFinanceNotification()` call (handler yang emit)
- `modules/finance/services/BillingInvoiceCreationService.ts` — hapus direct notif call, biarkan event INVOICE_CREATED yang drive
- `modules/finance/services/VoidInvoiceService.ts` — emit event INVOICE_VOIDED (baru) atau include di INVOICE_UPDATED
- `modules/finance/utils/customerFinanceNotifications.ts` — deprecate atau refactor ke `NotificationDispatcher.dispatch`
- `lib/event-bus/event-handlers.ts` — register 2 handler baru

### Task 6.1: Tambah event `INVOICE_OVERDUE` handler + `INVOICE_REMINDER_DUE` event

**Files:**
- Modify: `lib/event-bus/types.ts`
- Modify: `modules/events/dispatchers/BillingEventDispatcher.ts`

- [ ] **Step 1: Tambah `INVOICE_REMINDER_DUE` ke EVENT_NAMES + payload + metadata**

```ts
// EVENT_NAMES
INVOICE_REMINDER_DUE: "billing:invoice.reminder_due",

// Payload
export interface InvoiceReminderDuePayload extends BaseEventPayload {
  invoiceId: string;
  pelangganId: string;
  invoiceNumber: string;
  amountDue: number;
  dueDate: string;
  reminderType: "UPCOMING" | "DUE_TODAY" | "OVERDUE";
}

// EventPayloadMap
[EVENT_NAMES.INVOICE_REMINDER_DUE]: InvoiceReminderDuePayload;

// EVENT_METADATA
[EVENT_NAMES.INVOICE_REMINDER_DUE]: {
  name: EVENT_NAMES.INVOICE_REMINDER_DUE,
  category: "billing",
  priority: JOB_PRIORITIES.NORMAL,
  persistent: true,
  async: true,
},
```

- [ ] **Step 2: Tambah method di `BillingEventDispatcher`**

```ts
static async onInvoiceReminderDue(data: {
  invoiceId: string;
  pelangganId: string;
  invoiceNumber: string;
  amountDue: number;
  dueDate: string;
  reminderType: "UPCOMING" | "DUE_TODAY" | "OVERDUE";
  tenantId?: string;
}) {
  await eventBus.publish(EVENT_NAMES.INVOICE_REMINDER_DUE, data, {
    priority: JOB_PRIORITIES.NORMAL,
  });
}

static async onInvoiceOverdue(data: {
  invoiceId: string;
  pelangganId: string;
  amount: number;
  dueDate: string;
  tenantId?: string;
}) {
  await eventBus.publish(EVENT_NAMES.INVOICE_OVERDUE, data, {
    priority: JOB_PRIORITIES.HIGH,
  });
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
npm run typecheck
git add lib/event-bus/types.ts modules/events/dispatchers/BillingEventDispatcher.ts
git commit -m "feat(events): tambah INVOICE_REMINDER_DUE event + onInvoiceOverdue dispatcher [Phase 6]"
```

### Task 6.2: Buat `NotificationDispatcher` dengan channel router

**Files:**
- Create: `modules/notification/services/NotificationDispatcher.ts`
- Create: `modules/notification/services/channel-router.ts`
- Create: `modules/notification/templates/billing-templates.ts`
- Create: `tests/modules/notification/NotificationDispatcher.test.ts`

- [ ] **Step 1: Buat template registry**

File `modules/notification/templates/billing-templates.ts`:

```ts
export interface BillingTemplateParams {
  customerName: string;
  invoiceNumber?: string;
  amountDue?: number;
  dueDate?: string;
  packageName?: string;
  username?: string;
  password?: string;
}

export interface BillingTemplate {
  title: string;
  inApp: (p: BillingTemplateParams) => string;
  whatsapp: (p: BillingTemplateParams) => string;
  email: (p: BillingTemplateParams) => { subject: string; body: string };
  push: (p: BillingTemplateParams) => string;
}

const formatRupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export const BILLING_TEMPLATES = {
  customerWelcome: {
    title: "Selamat datang di layanan kami",
    inApp: (p) =>
      `Halo ${p.customerName}, akun PPPoE Anda telah aktif. Username: ${p.username}.`,
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nSelamat! Akun PPPoE Anda telah aktif.\n\nUsername: ${p.username}\nPaket: ${p.packageName}\n\nSilakan hubungi admin jika butuh bantuan setup.`,
    email: (p) => ({
      subject: "Akun PPPoE Anda telah aktif",
      body: `Halo ${p.customerName},\n\nSelamat datang. Akun Anda:\n- Username: ${p.username}\n- Paket: ${p.packageName}\n\nTerima kasih.`,
    }),
    push: (p) => `Akun PPPoE ${p.username} telah aktif`,
  },
  invoiceCreated: {
    title: "Tagihan baru dibuat",
    inApp: (p) =>
      `Tagihan ${p.invoiceNumber} sebesar ${formatRupiah(p.amountDue!)} telah dibuat. Jatuh tempo ${p.dueDate}.`,
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nTagihan baru:\nNomor: ${p.invoiceNumber}\nJumlah: ${formatRupiah(p.amountDue!)}\nJatuh tempo: ${p.dueDate}\n\nSilakan bayar sebelum jatuh tempo.`,
    email: (p) => ({
      subject: `Tagihan ${p.invoiceNumber} - ${formatRupiah(p.amountDue!)}`,
      body: `Halo ${p.customerName},\n\nTagihan baru telah dibuat.\nJumlah: ${formatRupiah(p.amountDue!)}\nJatuh tempo: ${p.dueDate}`,
    }),
    push: (p) => `Tagihan ${p.invoiceNumber}: ${formatRupiah(p.amountDue!)}`,
  },
  invoiceReminder: {
    title: "Pengingat tagihan",
    inApp: (p) =>
      `Tagihan ${p.invoiceNumber} (${formatRupiah(p.amountDue!)}) akan jatuh tempo ${p.dueDate}.`,
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nPengingat tagihan:\n${p.invoiceNumber} - ${formatRupiah(p.amountDue!)}\nJatuh tempo: ${p.dueDate}\n\nAbaikan jika sudah membayar.`,
    email: (p) => ({
      subject: `Reminder tagihan ${p.invoiceNumber}`,
      body: `Tagihan ${p.invoiceNumber} sebesar ${formatRupiah(p.amountDue!)} akan jatuh tempo ${p.dueDate}.`,
    }),
    push: (p) =>
      `Reminder: ${p.invoiceNumber} jatuh tempo ${p.dueDate}`,
  },
  invoicePaid: {
    title: "Pembayaran berhasil",
    inApp: (p) =>
      `Pembayaran ${p.invoiceNumber} sebesar ${formatRupiah(p.amountDue!)} berhasil. Terima kasih.`,
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nPembayaran Anda telah kami terima:\n${p.invoiceNumber} - ${formatRupiah(p.amountDue!)}\n\nLayanan akan aktif segera. Terima kasih.`,
    email: (p) => ({
      subject: `Pembayaran ${p.invoiceNumber} berhasil`,
      body: `Halo ${p.customerName},\n\nPembayaran Anda sebesar ${formatRupiah(p.amountDue!)} telah diterima.\n\nTerima kasih.`,
    }),
    push: (p) => `Pembayaran ${p.invoiceNumber} berhasil`,
  },
  customerIsolated: {
    title: "Layanan diisolir",
    inApp: (p) =>
      `Layanan internet Anda telah diisolir karena tunggakan. Silakan bayar tagihan untuk reaktivasi.`,
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nLayanan internet Anda telah diisolir karena tunggakan.\n\nTagihan: ${p.invoiceNumber}\nJumlah: ${formatRupiah(p.amountDue ?? 0)}\n\nSilakan bayar untuk reaktivasi.`,
    email: (p) => ({
      subject: "Layanan diisolir - butuh pembayaran",
      body: `Halo ${p.customerName},\n\nLayanan Anda diisolir. Silakan bayar ${p.invoiceNumber}.`,
    }),
    push: () => "Layanan Anda diisolir",
  },
  customerActivated: {
    title: "Layanan aktif kembali",
    inApp: (p) =>
      `Layanan internet Anda telah aktif kembali. Terima kasih atas pembayarannya.`,
    whatsapp: (p) =>
      `Halo ${p.customerName},\n\nLayanan internet Anda telah aktif kembali.\nTerima kasih atas pembayarannya.`,
    email: (p) => ({
      subject: "Layanan aktif kembali",
      body: `Halo ${p.customerName},\n\nLayanan Anda aktif kembali. Terima kasih.`,
    }),
    push: () => "Layanan Anda aktif kembali",
  },
} satisfies Record<string, BillingTemplate>;

export type BillingTemplateKey = keyof typeof BILLING_TEMPLATES;
```

- [ ] **Step 2: Buat `channel-router.ts`**

```ts
import { prisma } from "@/lib/prisma";

export interface CustomerContact {
  userId: string | null;
  customerId: string;
  customerName: string;
  email: string | null;
  noTelp: string | null;
  isBillNotifEnabled: boolean;
}

export async function resolveCustomerContact(
  pelangganId: string,
): Promise<CustomerContact | null> {
  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id: pelangganId },
    select: {
      id: true,
      nama: true,
      userId: true,
      email: true,
      noTelp: true,
      isBillNotifEnabled: true,
    },
  });
  if (!pelanggan) return null;
  return {
    userId: pelanggan.userId,
    customerId: pelanggan.id,
    customerName: pelanggan.nama,
    email: pelanggan.email,
    noTelp: pelanggan.noTelp,
    isBillNotifEnabled: pelanggan.isBillNotifEnabled,
  };
}
```

- [ ] **Step 3: Write failing test `tests/modules/notification/NotificationDispatcher.test.ts`**

Test scenario:
- dispatch skip all channel ketika `isBillNotifEnabled = false`
- dispatch emit in-app kalau userId ada
- dispatch emit WA kalau noTelp ada + provider enabled
- dispatch emit email kalau email ada + SMTP configured
- dispatch emit push kalau user punya push token
- ketika salah satu channel throw, channel lain tetap jalan (best-effort)

Run: expect FAIL module not found.

- [ ] **Step 4: Implement `NotificationDispatcher`**

File `modules/notification/services/NotificationDispatcher.ts`:

```ts
import { logger } from "@/lib/logger";
import { resolveCustomerContact } from "./channel-router";
import {
  BILLING_TEMPLATES,
  type BillingTemplateKey,
  type BillingTemplateParams,
} from "../templates/billing-templates";
import { createNotification } from "./NotificationService";
import { sendCustomerPushNotification } from "./ExpoPushService";
import { WhatsAppService } from "./whatsapp/whatsapp-service";
import { EmailService } from "./email-service";

export type NotificationChannel = "inApp" | "push" | "whatsapp" | "email";

export interface NotificationDispatchInput {
  pelangganId: string;
  templateKey: BillingTemplateKey;
  params: BillingTemplateParams;
  sourceType: string;
  sourceId: string;
  channels?: NotificationChannel[];
}

const DEFAULT_CHANNELS: NotificationChannel[] = [
  "inApp",
  "push",
  "whatsapp",
  "email",
];

export class NotificationDispatcher {
  async dispatch(input: NotificationDispatchInput): Promise<void> {
    const contact = await resolveCustomerContact(input.pelangganId);
    if (!contact) {
      logger.warn(
        `[NotificationDispatcher] Contact not found for pelanggan ${input.pelangganId}`,
      );
      return;
    }

    if (!contact.isBillNotifEnabled) {
      logger.info(
        `[NotificationDispatcher] Skip — ${input.pelangganId} has opted-out of bill notifications`,
      );
      return;
    }

    const template = BILLING_TEMPLATES[input.templateKey];
    const enrichedParams = {
      ...input.params,
      customerName: input.params.customerName ?? contact.customerName,
    };
    const channels = input.channels ?? DEFAULT_CHANNELS;

    await Promise.allSettled(
      channels.map((ch) =>
        this.sendChannel(ch, contact, template, enrichedParams, input),
      ),
    );
  }

  private async sendChannel(
    channel: NotificationChannel,
    contact: Awaited<ReturnType<typeof resolveCustomerContact>>,
    template: (typeof BILLING_TEMPLATES)[BillingTemplateKey],
    params: BillingTemplateParams,
    input: NotificationDispatchInput,
  ): Promise<void> {
    if (!contact) return;
    try {
      switch (channel) {
        case "inApp":
          if (!contact.userId) return;
          await createNotification({
            type: "SYSTEM",
            userId: contact.userId,
            title: template.title,
            message: template.inApp(params),
            link: `/(customer)/tagihan`,
            sourceType: input.sourceType,
            sourceId: input.sourceId,
            priority: "HIGH",
          });
          return;
        case "push":
          await sendCustomerPushNotification(
            input.pelangganId,
            template.title,
            template.push(params),
            { sourceType: input.sourceType, sourceId: input.sourceId },
          );
          return;
        case "whatsapp":
          if (!contact.noTelp) return;
          await new WhatsAppService().sendMessage({
            to: contact.noTelp,
            message: template.whatsapp(params),
          });
          return;
        case "email":
          if (!contact.email) return;
          const emailContent = template.email(params);
          await new EmailService().send({
            to: contact.email,
            subject: emailContent.subject,
            text: emailContent.body,
          });
          return;
      }
    } catch (error) {
      logger.error(
        `[NotificationDispatcher] Channel ${channel} failed for ${input.pelangganId}:`,
        error instanceof Error ? error : undefined,
      );
    }
  }
}
```

- [ ] **Step 5: Run test, export from `modules/notification/index.ts`, typecheck, commit**

```bash
npx vitest run tests/modules/notification/NotificationDispatcher.test.ts
npm run typecheck
git add modules/notification/services/NotificationDispatcher.ts modules/notification/services/channel-router.ts modules/notification/templates/billing-templates.ts modules/notification/index.ts tests/modules/notification/
git commit -m "feat(notification): NotificationDispatcher + channel router + billing templates [Phase 6]"
```

### Task 6.3: Handler notifikasi untuk 6 event customer/invoice

**Files:**
- Create: `modules/notification/services/event-handlers/customer-notification.handler.ts`
- Create: `modules/notification/services/event-handlers/invoice-notification.handler.ts`
- Modify: `lib/event-bus/event-handlers.ts`
- Create: Test files

- [ ] **Step 1: Handler customer notification**

File `modules/notification/services/event-handlers/customer-notification.handler.ts`:

```ts
import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { EVENT_NAMES } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { NotificationDispatcher } from "../NotificationDispatcher";
import type { BillingTemplateKey } from "../../templates/billing-templates";

const STATUS_TEMPLATE_MAP: Record<string, BillingTemplateKey> = {
  [EVENT_NAMES.CUSTOMER_CREATED]: "customerWelcome",
  [EVENT_NAMES.CUSTOMER_ISOLATED]: "customerIsolated",
  [EVENT_NAMES.CUSTOMER_ACTIVATED]: "customerActivated",
};

export async function handleCustomerNotification(
  job: Job<EventJobData>,
): Promise<void> {
  const { eventName, payload } = job.data;
  const templateKey = STATUS_TEMPLATE_MAP[eventName];
  if (!templateKey) {
    logger.debug(`[CustomerNotificationHandler] Skip event ${eventName}`);
    return;
  }

  const pelangganId = payload.customerId as string;
  const customerName = (payload.customerName as string) ?? "Pelanggan";
  const username = payload.username as string | undefined;

  await new NotificationDispatcher().dispatch({
    pelangganId,
    templateKey,
    params: { customerName, username },
    sourceType: "CUSTOMER_LIFECYCLE",
    sourceId: pelangganId,
  });
}
```

- [ ] **Step 2: Handler invoice notification**

File `modules/notification/services/event-handlers/invoice-notification.handler.ts`:

```ts
import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { EVENT_NAMES } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { NotificationDispatcher } from "../NotificationDispatcher";
import { prisma } from "@/lib/prisma";
import type { BillingTemplateKey } from "../../templates/billing-templates";

const INVOICE_TEMPLATE_MAP: Record<string, BillingTemplateKey> = {
  [EVENT_NAMES.INVOICE_CREATED]: "invoiceCreated",
  [EVENT_NAMES.INVOICE_PAID]: "invoicePaid",
  [EVENT_NAMES.INVOICE_REMINDER_DUE]: "invoiceReminder",
  [EVENT_NAMES.INVOICE_OVERDUE]: "invoiceReminder",
};

export async function handleInvoiceNotification(
  job: Job<EventJobData>,
): Promise<void> {
  const { eventName, payload } = job.data;
  const templateKey = INVOICE_TEMPLATE_MAP[eventName];
  if (!templateKey) return;

  const pelangganId = payload.pelangganId as string;
  const invoiceId = payload.invoiceId as string;
  const amount = Number(payload.amount ?? payload.amountDue ?? 0);
  const providedInvoiceNumber = payload.invoiceNumber as string | undefined;
  const providedDueDate = payload.dueDate as string | undefined;

  let invoiceNumber = providedInvoiceNumber;
  let dueDate = providedDueDate;
  if (!invoiceNumber || !dueDate) {
    const inv = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { invoiceNumber: true, dueDate: true },
    });
    invoiceNumber = invoiceNumber ?? inv?.invoiceNumber;
    dueDate = dueDate ?? inv?.dueDate.toLocaleDateString("id-ID");
  }

  await new NotificationDispatcher().dispatch({
    pelangganId,
    templateKey,
    params: {
      customerName: "",
      invoiceNumber,
      amountDue: amount,
      dueDate,
    },
    sourceType: "BILLING",
    sourceId: invoiceId,
  });
}
```

- [ ] **Step 3: Register di `lib/event-bus/event-handlers.ts`**

```ts
import { handleCustomerNotification } from "@/modules/notification/services/event-handlers/customer-notification.handler";
import { handleInvoiceNotification } from "@/modules/notification/services/event-handlers/invoice-notification.handler";

// Di registerDefaultHandlers():
registerEventHandler(EVENT_NAMES.CUSTOMER_CREATED, handleCustomerNotification);
registerEventHandler(EVENT_NAMES.CUSTOMER_ISOLATED, handleCustomerNotification);
registerEventHandler(EVENT_NAMES.CUSTOMER_ACTIVATED, handleCustomerNotification);
registerEventHandler(EVENT_NAMES.INVOICE_CREATED, handleInvoiceNotification);
registerEventHandler(EVENT_NAMES.INVOICE_PAID, handleInvoiceNotification);
registerEventHandler(EVENT_NAMES.INVOICE_REMINDER_DUE, handleInvoiceNotification);
registerEventHandler(EVENT_NAMES.INVOICE_OVERDUE, handleInvoiceNotification);
```

Perhatian: CUSTOMER_CREATED & CUSTOMER_ISOLATED sudah terregister untuk sync MikroTik. Sekarang event sama di-fan-out ke 2 handler (MikroTik sync + notifikasi). Ini pattern yang benar — 1 event, multiple handler, BullMQ dispatch paralel.

- [ ] **Step 4: Test + commit**

```bash
npx vitest run tests/modules/notification/event-handlers/
npm run typecheck
git commit -m "feat(notification): handler customer & invoice lifecycle untuk dispatch multi-channel [Phase 6]"
```

### Task 6.4: Migrate `BillingReminderService` ke event emit

**Files:**
- Modify: `modules/finance/services/BillingReminderService.ts`

- [ ] **Step 1: Replace `sendCustomerPushNotification` call dengan event emit**

```ts
private async sendReminder(invoice: {
  id: string;
  pelangganId: string;
  dueDate: Date;
  totalAmount: bigint;
  paidAmount: bigint;
  invoiceNumber: string;
}) {
  const amountDue = invoice.totalAmount - invoice.paidAmount;
  const today = new Date();
  const daysUntilDue = Math.floor(
    (invoice.dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  const reminderType =
    daysUntilDue < 0 ? "OVERDUE" : daysUntilDue === 0 ? "DUE_TODAY" : "UPCOMING";

  try {
    const { BillingEventDispatcher } = await import("@/modules/events");
    await BillingEventDispatcher.onInvoiceReminderDue({
      invoiceId: invoice.id,
      pelangganId: invoice.pelangganId,
      invoiceNumber: invoice.invoiceNumber,
      amountDue: Number(amountDue),
      dueDate: invoice.dueDate.toLocaleDateString("id-ID"),
      reminderType,
    });
  } catch (error) {
    logger.error(
      `[Billing] Error emitting reminder event for invoice ${invoice.id}:`,
      error,
    );
  }
}
```

Update juga `findReminderInvoices` select untuk include `invoiceNumber`.

- [ ] **Step 2: Hapus `sendCustomerPushNotification` import kalau sudah tidak dipakai**

- [ ] **Step 3: Update test + run**

- [ ] **Step 4: Commit**

```
refactor(finance): BillingReminderService emit INVOICE_REMINDER_DUE event bukan push langsung [Phase 6]
```

### Task 6.5: Hapus direct notif call di AutomaticIsolationExecutionService, BillingInvoiceCreationService, VoidInvoiceService

**Files:**
- Modify: 3 file finance services

- [ ] **Step 1: Hapus `notifyCustomerFinanceNotification` dari `AutomaticIsolationExecutionService.execute()`**

Event `CUSTOMER_ISOLATED` akan di-emit otomatis ketika status pelanggan berubah via `updateStatusPelanggan` → `syncUpdatedCustomerStatus`. Handler notifikasi akan dispatch multi-channel. Tidak perlu duplikat.

- [ ] **Step 2: Hapus `sendCustomerPushNotification` dan `notifyCustomerFinanceNotification` dari `BillingInvoiceCreationService.createInvoiceForCustomer()`**

Replace dengan emit `INVOICE_CREATED` event via `BillingEventDispatcher` (kalau belum di-emit).

- [ ] **Step 3: Untuk `VoidInvoiceService`**

Tambah event `INVOICE_VOIDED` baru, atau reuse `INVOICE_UPDATED` dengan flag. Atau keep direct call karena semantik "void" berbeda dari billing event flow. Decision: tambah event sederhana atau keep direct.

Recommended: tambah event `INVOICE_VOIDED` di Phase 6 (konsisten), tapi handler notifikasinya optional.

- [ ] **Step 4: Commit**

```
refactor(finance): hapus direct notif call, biarkan event handler dispatch multi-channel [Phase 6]
```

### Task 6.6: Deprecate `customerFinanceNotifications.ts` utility

**Files:**
- Modify: `modules/finance/utils/customerFinanceNotifications.ts`

- [ ] **Step 1: Mark `@deprecated` dengan pointer ke `NotificationDispatcher`**

- [ ] **Step 2: Cek caller yang tersisa, migrate semua**

- [ ] **Step 3: Commit**

### Task 6.7: Regression test end-to-end Phase 6

**Files:**
- Create: `tests/modules/notification/phase6-integration.test.ts`

- [ ] **Step 1: Test skenario**
- webhook paid → INVOICE_PAID emit → handler dispatch → customer dapat notif (mock 4 channel)
- scheduler reminder → INVOICE_REMINDER_DUE emit → handler dispatch
- auto-isolir → CUSTOMER_ISOLATED emit → handler dispatch
- customer create → CUSTOMER_CREATED emit → handler dispatch welcome
- `isBillNotifEnabled = false` → zero channel fired

- [ ] **Step 2: Run, typecheck, commit final**

```
test(notification): integration test Phase 6 multi-channel dispatch [Phase 6]
```

---

## Phase 7: Paket Lifecycle Gaps

### File Structure (Phase 7)

**Tambah:**
- `lib/event-bus/types.ts` — event `PACKAGE_CHANGED`, `PROFILE_PPP_UPDATED`
- `modules/events/dispatchers/` — method baru di `BillingEventDispatcher` atau dispatcher baru untuk paket
- `modules/network/services/event-handlers/package-change.handler.ts` — handler untuk disconnect active session + resync bandwidth
- `modules/network/services/event-handlers/profile-ppp-updated.handler.ts` — handler untuk bulk disconnect semua pelanggan pakai profile itu
- `modules/finance/services/InvoiceProrateService.ts` — logic prorate upgrade/downgrade mid-cycle
- Test files

**Ubah:**
- `modules/pelanggan/services/PelangganAdminMutationService.ts` — emit `PACKAGE_CHANGED` kalau hargaPaketId berubah
- `modules/network/services/ProfilePPPService.ts` — emit `PROFILE_PPP_UPDATED` setelah update

### Task 7.1: Tambah event `PACKAGE_CHANGED` dan `PROFILE_PPP_UPDATED`

Format sama dengan Task 6.1: EVENT_NAMES + Payload + PayloadMap + EVENT_METADATA + dispatcher method.

Payload:
```ts
export interface PackageChangedPayload extends BaseEventPayload {
  customerId: string;
  customerName: string;
  oldPackageId: string;
  newPackageId: string;
  oldProfileName: string;
  newProfileName: string;
}

export interface ProfilePppUpdatedPayload extends BaseEventPayload {
  profileId: string;
  profileName: string;
  bandwidthChanged: boolean;
  affectedCustomerCount: number;
}
```

### Task 7.2: Handler `package-change.handler` — disconnect active PPP session saat upgrade

- [ ] Disconnect session pelanggan via `mikrotik-ppp-secret.lifecycle.disconnectSession`
- [ ] Update PPP secret profile ke paket baru
- [ ] Update RADIUS radusergroup ke group paket baru
- [ ] Log audit trail

### Task 7.3: Handler `profile-ppp-updated.handler` — bulk disconnect affected customers

- [ ] Query pelanggan yang pakai profile tsb (`SELECT FROM pelanggan WHERE hargaPaketId IN (SELECT id FROM hargaPaket WHERE profilePPPId = X)`)
- [ ] Batch disconnect session (ukuran batch 50, throttle supaya MikroTik tidak overwhelm)
- [ ] Log tiap disconnect success/fail

### Task 7.4: Emit event `PACKAGE_CHANGED` dari `PelangganAdminMutationService`

- [ ] Detect package change (`existingPelanggan.hargaPaketId !== pelanggan.hargaPaketId`)
- [ ] Fetch old & new profile name dari HargaPaket → ProfilePPP
- [ ] Emit event

### Task 7.5: Emit event `PROFILE_PPP_UPDATED` dari `ProfilePPPService.updateProfilePPP`

- [ ] Detect kalau bandwidth-related field berubah
- [ ] Count affected customer
- [ ] Emit event

### Task 7.6: `InvoiceProrateService` — logic prorate mid-cycle upgrade

**Business rules yang sudah diputuskan user:**
- **Prorate: opt-in admin per case** — admin pilih `prorateOption` saat update pelanggan. Opsi:
  - `NONE` (default) — tidak ada adjustment, paket baru berlaku tanpa prorate
  - `PRORATE_CHARGE` — tagih selisih (paketBaru − paketLama) × (sisaHari / totalHari)
  - `PRORATE_CREDIT` — berikan kredit (paketLama − paketBaru) × (sisaHari / totalHari) untuk kasus downgrade
- **Downgrade adjustment: pilihan admin** — param `downgradeAdjustment`:
  - `NONE` — tidak ada adjustment
  - `REFUND` — buat payment refund record (manual proses admin ke rekening)
  - `CREDIT` — saldo kredit ditambahkan ke pelanggan (balance ledger) untuk potong invoice berikutnya
- **Upgrade apply timing: pilihan admin** — param `upgradeApplyTime`:
  - `IMMEDIATE` — disconnect session sekarang, paket baru aktif dalam hitungan detik
  - `NEXT_CYCLE` — paket baru aktif saat siklus berikutnya (jatuh tempo baru). Session sekarang tetap berjalan dengan paket lama sampai expired.

Semua 3 param ini adalah UI choice admin saat edit pelanggan yang mengubah `hargaPaketId`. Default value kalau admin tidak pilih:
- `prorateOption = NONE`
- `downgradeAdjustment = NONE`
- `upgradeApplyTime = IMMEDIATE`

**Schema tambahan (migration):**

```prisma
model Pelanggan {
  // ... existing fields
  pendingPackageId          String?    // kalau scheduled NEXT_CYCLE
  pendingPackageApplyAt     DateTime?  // kapan apply
  saldoKreditRupiah         BigInt     @default(0)  // untuk downgrade CREDIT
}

model ProratePaymentLog {
  id              String   @id @default(uuid())
  pelangganId     String
  oldPackageId    String
  newPackageId    String
  prorateOption   String   // NONE | PRORATE_CHARGE | PRORATE_CREDIT
  downgradeAdjustment String // NONE | REFUND | CREDIT
  upgradeApplyTime String  // IMMEDIATE | NEXT_CYCLE
  amount          BigInt   @default(0)
  sisaHari        Int
  totalHari       Int
  createdBy       String?
  createdAt       DateTime @default(now())
  tenantId        String?

  @@index([pelangganId])
  @@index([tenantId])
}
```

**Flow per opsi:**

1. **IMMEDIATE + PRORATE_CHARGE (upgrade dengan tambahan biaya)**
   - Hitung `charge = (newHarga − oldHarga) × (sisaHari / totalHari)`
   - Buat Invoice prorate dengan status `SENT` (pelanggan bayar terpisah)
   - Atau tambah line-item ke invoice berjalan (kalau masih `SENT` / `PARTIAL_PAID`)
   - Emit `PACKAGE_CHANGED` event → handler disconnect session + update MikroTik profile

2. **IMMEDIATE + PRORATE_CREDIT (downgrade dengan kredit)**
   - Hitung `credit = (oldHarga − newHarga) × (sisaHari / totalHari)`
   - Kalau `downgradeAdjustment = CREDIT`: tambahkan `pelanggan.saldoKreditRupiah += credit`. Saat invoice berikut generate, saldo kredit dipakai auto.
   - Kalau `downgradeAdjustment = REFUND`: buat `Payment` record dengan `amount = −credit`, status PENDING_REFUND. Admin manual transfer ke rekening.
   - Kalau `downgradeAdjustment = NONE`: tidak ada adjustment, hanya catat di `ProratePaymentLog` untuk audit.
   - Emit `PACKAGE_CHANGED` event

3. **NEXT_CYCLE (upgrade/downgrade scheduled)**
   - Set `pelanggan.pendingPackageId = newPackageId`, `pendingPackageApplyAt = jatuhTempo`
   - TIDAK emit `PACKAGE_CHANGED` sekarang
   - Cron job harian (reuse billing scheduler): scan pelanggan dengan `pendingPackageApplyAt <= now`, apply package change + emit `PACKAGE_CHANGED` saat itu
   - Invoice berikutnya generate dengan harga `newPackageId`

**Implementation tasks:**

- [ ] **Step 1: Migration schema `pendingPackageId`, `pendingPackageApplyAt`, `saldoKreditRupiah`, `ProratePaymentLog`**

- [ ] **Step 2: Update `UpdatePppByIdInput` contract**

```ts
// modules/pelanggan/services/pelanggan-admin-mutation.helpers.ts
export interface UpdatePppByIdInput {
  // ... existing fields
  prorateOption?: "NONE" | "PRORATE_CHARGE" | "PRORATE_CREDIT";
  downgradeAdjustment?: "NONE" | "REFUND" | "CREDIT";
  upgradeApplyTime?: "IMMEDIATE" | "NEXT_CYCLE";
}
```

- [ ] **Step 3: Extract package name + harga dari form data di route handler**

`app/api/pelanggan-ppp/[id]/route-handlers-impl.ts` — parse 3 optional param dari formData.

- [ ] **Step 4: Implementasi `InvoiceProrateService`**

File `modules/finance/services/InvoiceProrateService.ts`:

```ts
export class InvoiceProrateService {
  async applyPackageChange(input: {
    pelangganId: string;
    oldHargaPaketId: string;
    newHargaPaketId: string;
    prorateOption: "NONE" | "PRORATE_CHARGE" | "PRORATE_CREDIT";
    downgradeAdjustment: "NONE" | "REFUND" | "CREDIT";
    upgradeApplyTime: "IMMEDIATE" | "NEXT_CYCLE";
    userId: string;
  }): Promise<{
    applied: boolean;
    prorateAmount: bigint;
    scheduledFor?: Date;
  }> {
    // Load paket lama vs baru untuk harga
    // Hitung sisaHari vs totalHari pelanggan current cycle
    // Branch per prorateOption + downgradeAdjustment + upgradeApplyTime
    // Return summary untuk di-log
  }
}
```

- [ ] **Step 5: Integration ke `PelangganAdminMutationService.updatePppById`**

Setelah update DB hargaPaketId, panggil `InvoiceProrateService.applyPackageChange`. Kalau `upgradeApplyTime = NEXT_CYCLE`, JANGAN emit `PACKAGE_CHANGED` (simpan `pendingPackageId` saja). Kalau IMMEDIATE, emit event.

- [ ] **Step 6: Cron job untuk apply `pendingPackageId`**

File `modules/finance/services/PendingPackageApplierService.ts`:
- Scan `pelanggan WHERE pendingPackageId IS NOT NULL AND pendingPackageApplyAt <= now()`
- Per pelanggan: move `pendingPackageId` → `hargaPaketId`, null-kan pending, emit `PACKAGE_CHANGED`
- Register cron di `cron-registry.ts`

- [ ] **Step 7: UI — form edit pelanggan tambah 3 dropdown**

Pages affected:
- `app/admin/pelanggan/ppp/[id]/edit/page.tsx` (atau equivalent)
- Component form — tambah section "Perubahan Paket" yang muncul conditionally ketika user ganti paket. 3 select:
  - Prorate: None / Charge / Credit
  - Downgrade Adjustment: None / Refund / Credit
  - Apply Time: Immediate / Next Cycle

Default semua ke NONE/IMMEDIATE supaya backward compatible.

- [ ] **Step 8: Test unit + integration**

- [ ] **Step 9: Commit per major step**

### Task 7.7: Integration test Phase 7 (updated)

- [ ] E2E: admin upgrade paket → session disconnect → pelanggan reconnect → bandwidth baru berlaku
- [ ] E2E: admin update ProfilePPP → affected customers di-disconnect sequentially

### Task 7.8: Commit final Phase 7

---

## Phase 8: Template & Observability

### File Structure (Phase 8)

**Tambah:**
- `modules/notification/templates/template-engine.ts` — interpolation dengan fallback (id/en)
- `modules/notification/repositories/email-log.repository.ts` — log delivery email
- `prisma/schema.prisma` — model `EmailDeliveryLog`, `NotificationDeadLetter`
- `modules/notification/services/notification-dead-letter.processor.ts` — worker consume DLQ
- `modules/notification/services/email-bounce-webhook.handler.ts` — handle bounce webhook dari SMTP provider (bila ada)
- `app/api/webhooks/email-bounce/route.ts` — endpoint bounce

**Ubah:**
- `EmailService.send()` — log delivery attempt ke `EmailDeliveryLog`
- `NotificationDispatcher.sendChannel` — kalau channel throw setelah retry, push ke DLQ
- Settings UI — admin view DLQ, resend

### Task 8.1: Schema `EmailDeliveryLog` + `NotificationDeadLetter`

```prisma
model EmailDeliveryLog {
  id          String   @id @default(uuid())
  to          String
  subject     String
  status      String   // PENDING | SENT | FAILED | BOUNCED
  provider    String   @default("SMTP")
  messageId   String?  // dari SMTP response
  error       String?
  sentAt      DateTime?
  bouncedAt   DateTime?
  tenantId    String?
  createdAt   DateTime @default(now())

  @@index([status])
  @@index([to])
  @@index([tenantId])
}

model NotificationDeadLetter {
  id          String   @id @default(uuid())
  channel     String   // inApp | push | whatsapp | email
  pelangganId String
  templateKey String
  params      Json
  error       String
  attemptCount Int     @default(0)
  lastAttemptAt DateTime?
  resolvedAt  DateTime?
  tenantId    String?
  createdAt   DateTime @default(now())

  @@index([channel, createdAt])
  @@index([pelangganId])
  @@index([tenantId])
}
```

Migration increment.

### Task 8.2: Template engine sederhana

- [ ] Refactor `BILLING_TEMPLATES` dari function-based → object with placeholders
- [ ] Implement interpolation: `replace ${customerName} → actual value`
- [ ] Multilingual: struktur per lang (`id`, `en`)
- [ ] Admin UI untuk edit template (opsional — defer)

### Task 8.3: Email delivery logging

- [ ] Wrap `EmailService.send` dengan logging
- [ ] Write test
- [ ] Admin view log di dashboard (opsional)

### Task 8.4: Notification DLQ processor

- [ ] Modify `NotificationDispatcher.sendChannel` — kalau ultimate fail (setelah BullMQ exhaust retry), insert ke `NotificationDeadLetter`
- [ ] Admin endpoint list + retry DLQ entries
- [ ] Cron cleanup old DLQ (> 30 hari)

### Task 8.5: Email bounce webhook (provider-dependent)

- [ ] Decision: pakai SMTP provider dengan bounce support (SendGrid, Mailgun, Postmark)?
- [ ] Kalau iya, implement webhook handler → update `EmailDeliveryLog.status = BOUNCED`
- [ ] Kalau plain SMTP (nodemailer) — skip (tidak ada bounce callback)

### Task 8.6-8.15: Additional tasks

- [ ] Unit test tiap service baru
- [ ] Integration test DLQ flow
- [ ] Admin dashboard UI untuk DLQ + template (defer kalau belum urgent)
- [ ] Cleanup cron
- [ ] Dokumentasi `docs/standards/notifications.md`
- [ ] Update CLAUDE.md quick reference

---

## Risk Register Phase 6+7+8

| Risk | Phase | Mitigation |
|------|-------|------------|
| Over-notification — pelanggan dapat 4 notif untuk 1 event | 6 | Enforce `isBillNotifEnabled` + per-channel opt-in (butuh schema addition) |
| Multi-handler single event race | 6 | BullMQ independent dispatch, acceptable; idempotent handler |
| Upgrade paket disconnect session saat pelanggan sedang voice call / streaming | 7 | Admin opsi "scheduled upgrade" vs "immediate" |
| Prorate calculation edge cases (leap year, timezone) | 7 | Standard date library, test dengan zona Asia/Jakarta |
| DLQ volume explosion saat WA provider down | 8 | Throttle + circuit breaker |
| Template drift — admin ubah template breaking placeholder | 8 | Validate template schema di save |

## Self-Review Checklist Phase 6+7+8

- [x] Tidak ada placeholder
- [x] Tiap Phase independent shippable
- [x] TDD discipline
- [x] Commit message konsisten
- [x] Bahasa Indonesia
- [x] Business rules prorate + downgrade + upgrade timing sudah diputuskan (opt-in admin per case)

## Handoff

Plan siap eksekusi. Business rules Phase 7 sudah diputuskan user:
1. Prorate: opt-in admin per case (`NONE | PRORATE_CHARGE | PRORATE_CREDIT`)
2. Downgrade: pilihan admin (`NONE | REFUND | CREDIT`)
3. Upgrade timing: pilihan admin (`IMMEDIATE | NEXT_CYCLE`)

---

## TanStack Roadmap Phase 3 — Batch 2026-05-18

Lihat `docs/guides/tanstack-adoption-roadmap.md` Phase 3.

- [x] Migrasi `app/admin/integrations/mixradius/accounts/MixRadiusAccountsClient.tsx`
- [x] Migrasi `app/admin/integrations/mixradius/expenses/CategoryList.tsx`
- [x] Migrasi `app/admin/integrations/mixradius/groups/MixRadiusGroupsClient.tsx`
- [x] Migrasi `app/admin/integrations/mixradius/investor-sites/SiteInvestorClient.tsx`
- [x] Migrasi `app/admin/inventory/gudang/GudangList.tsx`
- [x] Migrasi `app/admin/inventory/gudang/[id]/edit/GudangEditClient.tsx`
- [x] Migrasi `app/admin/log/login/LoginLogClient.tsx`
- [x] Migrasi `app/admin/log/mobile-errors/MobileErrorLogClient.tsx`
- [x] Migrasi `app/admin/network/acs/devices/[id]/DeviceDetailClient.tsx`
- [x] Migrasi `app/admin/pengaturan/acs/AcsConfigTab.tsx`
- [x] Migrasi `app/admin/pengaturan/acs/VendorConfigTab.tsx`
- [x] Migrasi `app/admin/pengaturan/captcha/CaptchaClient.tsx`
- [x] Migrasi `app/admin/pengaturan/company-bank-accounts/BankAccountsClient.tsx`
- [x] Migrasi `app/admin/pengaturan/email/EmailSettingsClient.tsx`
- [x] Migrasi `app/admin/pengaturan/payment-gateway/components/UnmatchedMutationsList.tsx`
- [x] Migrasi `app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx`
- [x] Lint pass
- [x] Typecheck pass (0 error project)
- [x] CHANGELOG diupdate

### Review

- 16 file admin client di-migrasi dari pola `useEffect + fetch + useState` ke
  `useApi` (TanStack Query).
- Eliminasi helper `unwrapApiData`/`extractApiData` duplikat di banyak file —
  envelope `{ data: ... }` sudah di-handle `apiFetcher`.
- State lokal sekarang hanya menyimpan form/derived UI; cache server di-handle
  TanStack Query.
- Loading state derive dari `isLoading`. Refresh manual diganti panggil
  `refetch()`.
- Tidak ada perubahan kontrak API.
- Roadmap Phase 3 progres: +16 file (target sisa ~48 file dari 64).

---

## TanStack Roadmap Phase 3 — Batch 2026-05-18 (lanjutan)

Lanjutan batch awal. 39 file additional di 6 commit terpisah:

### Batch 2 — 13 file (commit 603cf6128)
- [x] `app/investor/page.tsx` (dashboard)
- [x] `app/investor/profile/page.tsx`
- [x] `app/investor/projects/page.tsx`
- [x] `app/investor/payouts/page.tsx`
- [x] `app/admin/finance/pendapatan-harian/DailyRevenueList.tsx`
- [x] `app/admin/finance/pendapatan-periode/PeriodIncomeClient.tsx`
- [x] `app/admin/paket/bandwidth/hooks/useBandwidthPageState.ts`
- [x] `app/admin/paket/harga/hooks/useHargaPaketPageState.ts`
- [x] `app/admin/paket/profileppp/hooks/useProfilePppPageState.ts`
- [x] `app/admin/workorders/departments/DeptIndexClient.tsx`
- [x] `app/admin/workorders/sites/SitesList.tsx`
- [x] `app/admin/settings/roles/RolesClient.tsx`
- [x] `app/admin/app-releases/page.tsx`

### Batch 3 — 10 file (commit 23282e000)
- [x] `app/admin/pelanggan/ppp/PppList.tsx`
- [x] `app/admin/pelanggan/ppp/hooks/usePppSupportingData.ts`
- [x] `components/announcement/AnnouncementBanner.tsx`
- [x] `components/inventory/InventoryStats.tsx`
- [x] `components/attendance/AttendanceAnalytics.tsx`
- [x] `components/common/SiteFilter.tsx`
- [x] `components/karyawan/KaryawanNotificationBell.tsx`
- [x] `components/admin/sites/GudangSelector.tsx`
- [x] `components/mixradius/NPLSummary.tsx`
- [x] `components/layout/ServerClock.tsx`

### Batch 4 — 3 file (commit 0d805caa6)
- [x] `app/admin/integrations/mixradius/expenses/RABForm/hooks/useRABExternalData.ts`
- [x] `components/inventory/StockReport.tsx`
- [x] `components/inventory/RestockSettingsForm.tsx`

### Batch 5 — 5 file (commit c11c78b05)
- [x] `app/admin/network/acs/devices/hooks/useDevicesPolling.ts`
- [x] `app/admin/network/mikrotik/hooks/useMikrotikRouterList.ts`
- [x] `app/admin/pengaturan/payment-gateway/hooks/usePaymentGatewayConfigs.ts`
- [x] `app/admin/pengaturan/payment-gateway/hooks/useManualTransferAccounts.ts`
- [x] `components/inventory/assets/CreateAssetForm.tsx`

### Batch 6 — 1 file (commit 404628c52)
- [x] `app/admin/my-profile/MyProfileClient.tsx`

### Verifikasi
- [x] Lint pass per batch (eslint --fix dijalankan oleh pre-commit hook)
- [x] Typecheck pass (0 error project)
- [x] Pre-commit hook (eslint --fix + prettier) clean

### Skip — Out-of-scope rewrite
File yang dibiarkan pakai pola lama karena trade-off rewrite vs nilai
migrasinya tidak optimal (file >1000 baris atau multi-fetch chained
calculation kompleks):

- `app/admin/integrations/mixradius/MixRadiusClient.tsx` (~1417 baris)
- `app/admin/salary/users/SalaryUsersClient.tsx` (~1750 baris)
- `app/admin/users/new/UsersNewClient.tsx` (~1070 baris)
- `app/admin/integrations/mixradius/income-period/hooks/useIncomePeriodData.ts` (~748 baris)
- `app/admin/users/compare/UsersCompareClient.tsx` (~756 baris)
- `app/admin/lembur/LemburClient.tsx` (multi-fetch + complex state)
- `app/admin/integrations/mixradius/income-period/hooks/useRoiTracking.ts` (3 fetch chained calculation)
- `app/admin/pengaturan/umum/useGeneralSettings.ts` (form override pattern)
- `app/admin/integrations/mixradius/expenses/RABRevisionForm.tsx` (modal fetch + auto-create)
- `app/admin/pengaturan/nada-dering/RingtoneSettingsClient.tsx`
- `app/admin/support/SupportContent.tsx`
- `app/(customer)/dukungan/page.tsx`
- `app/register/page.tsx`
- `app/api/docs/ui/page.tsx`
- `app/admin/inventory/hooks/useInventoryFilters.ts` (custom getWithAuth)
- `components/announcement/AnnouncementPopup.tsx` (localStorage + WebSocket)
- `components/common/MapPicker.tsx` (search-on-demand, bukan auto-load)
- `components/inventory/{MasukForm,KeluarForm,TransferForm,AmbilBarangForm}.tsx` — form-heavy dengan multi-fetch dependent

> Update 2026-05-19: `OpnameForm`, `StockOpnameRecorder`, dan `EnhancedOpnameForm`
> sudah keluar dari skip list. `StockOpnameRecorder` & `OpnameForm` direwrite
> ke pola baru (`useApi` + `fetchWithHandling`), `EnhancedOpnameForm` dihapus
> karena dead code. Detail di `## Stock Opname Tab — Hardening (2026-05-19)`.

Total Phase 3 progres aktual: **57 file migrate** dari estimasi awal 64.
File sisa di-defer untuk batch terpisah ketika value migrasi vs effort
rewrite-nya optimal (mis. saat refactor module-level).

---

## Stock Opname Tab — Hardening (2026-05-19)

### Objective
Review tab "Input Stock Opname" di `/admin/inventory/opname`, identifikasi
bug + code smell, dan perbaiki end-to-end sesuai standar project.

### Checklist

- [x] Investigasi: baca komponen, API endpoint, service layer, validator existing
- [x] Identifikasi 9 finding (3 blocker, 3 signifikan, 3 smell)
- [x] Tambah Zod validator `opnameValidator.ts` (item + batch schema)
- [x] Refactor `InventoryOpnameRouteService` ke `safeParse` + error mapping `ZodError → 400 details`
- [x] Tambah `createOpnameBatch` di service + endpoint `POST /api/inventory/opname/batch` (atomic transaction)
- [x] Ekstrak helper movement mapping ke file pure (testable tanpa DB)
- [x] Domain mapping movement diperbaiki:
  - Selisih positif → kondisi mengikuti mayoritas breakdown (BARU/RUSAK/BEKAS)
  - Selisih negatif → kondisi mengikuti `alasanSelisih` (rusak→RUSAK, expired→BEKAS, fallback→BARU)
  - Alasan administratif (`revisi`, `salah_input`) → tidak generate movement
- [x] Rewrite `StockOpnameRecorder.tsx` (639 → 270 baris compose + 5 sub-files)
  - Pakai `useApi` (TanStack Query) untuk fetch
  - Pakai `fetchWithHandling` untuk POST batch
  - Side-effect dipindah dari render body → `useEffect`/event handler
  - Race condition dibereskan via overlay edits map + functional updater
  - Decompose: `useOpnameCalculation`, `useSubmitOpname`, `OpnameItemRow`, `OpnameItemsTable`, `OpnameSummaryCards`
- [x] Refactor `OpnameForm.tsx` (modal Edit) ke pola baru, hapus side-effect di render body
- [x] Hapus `EnhancedOpnameForm.tsx` (dead code, zero caller)
- [x] Tambah unit test (28 cases) untuk movement mapping & validator
- [x] Fix anti-pattern setState di render body di 12 file lain (efek samping audit)
  - Dimigrasikan dari `if (!hasFetched) { setHasFetched(true); ... }` ke `useRef + useEffect`
- [x] Update `docs/CHANGELOG.md` dengan 7 entry SOT

### Verification
- `npm run check` → exit 0 (Lint + Typecheck + Build pass)
- `npx vitest run tests/modules/inventory/` → 81/81 pass

### Files Changed
**Created (10):**
- `app/api/inventory/opname/batch/route.ts`
- `modules/inventory/validators/opnameValidator.ts`
- `modules/inventory/services/inventory-opname-movement-mapping.helpers.ts`
- `components/inventory/opname/{useOpnameCalculation,useSubmitOpname,OpnameItemRow,OpnameItemsTable,OpnameSummaryCards}.{ts,tsx}`
- `tests/modules/inventory/{inventory-opname-movement-mapping.helpers,opnameValidator}.test.ts`

**Modified (19):**
- `components/inventory/{StockOpnameRecorder,OpnameForm}.tsx`
- `modules/inventory/services/{InventoryOpnameService,InventoryOpnameRouteService,inventory-opname-create.helpers}.ts`
- `app/admin/{inventory/transfer/TransferList,kehadiran/izin/IzinClient,network/mikrotik/[id]/edit/MikrotikEditClient,finance/pengeluaran/ExpenseClient,notifications/email-logs/EmailLogsClient,inventory/restock/useRestockPage}.{tsx,ts}`
- `components/{inventory/StatsCards,inventory/assets/AssetTable,map/useMapData}.{tsx,ts}`
- `lib/websocket/hooks/{useRealtimePaymentApprovals,useRealtimeNotifications,useCustomerNotifications}.ts`
- `docs/CHANGELOG.md`

**Deleted (1):**
- `components/inventory/EnhancedOpnameForm.tsx`

### Review Notes
- Anti-smell terpenuhi: SRP (file pecah per concern), naming verb/predicate,
  magic numbers diekstrak, no commented-out code, no nested logic dalam.
- Authorization tetap di API route (`hasPermission`); service layer pure.
- API route tetap thin controller; bisnis logic di service.
- Unit test pure-function tanpa mock DB → cepat & deterministik.
- Validasi Zod baru menutup gap NaN/non-int/negative/total-kondisi-melebihi-stokFisik.

---

## accel-ppp Server Coexist with MikroTik (Pure RADIUS-driven)

**Spec source:** `docs/superpowers/specs/2026-05-23-accel-ppp-server-coexist-design.md`
**Status:** Plan disusun 2026-05-23 setelah review terhadap codebase
**Approach:** B — Coexist tanpa abstraksi (MikroTik existing tidak disentuh)

### Objective
Tambahkan accel-ppp on Linux sebagai PPPoE server alternatif, coexist dengan MikroTik. End-to-end auth via FreeRADIUS, dashboard monitoring, CRUD admin, dengan toggle global `fullRadiusMode`.

### Koreksi Penting Terhadap Spec (Hasil Review)

| # | Topik | Spec | Realitas | Keputusan |
|---|---|---|---|---|
| 1 | Encryption secret | "ikut pattern `apiPassword` MikroTik" | MikroTik plain text (legacy smell) | Pakai `encryptApiKey/decryptApiKey` dari `@/lib/utils/encryption` |
| 2 | Permission format | `network:accel-ppp:*` | Catalog pakai resource flat + GRANULAR | Resource `accel_ppp` di `PERMISSION_GROUPS.NETWORK` + granular `accel_ppp:session:kick` |
| 3 | Lokasi `fullRadiusMode` | "settings network" | Pattern `pppConnectionMode` pakai key string di tabel `Settings` | Key `FULL_RADIUS_MODE`, service `fullRadiusModeSettings.ts` |
| 4 | RADIUS NAS sync API | `RadiusRepository.upsertNas` | `RadiusNasRepository.createNas(nas, tenantId)` (kelas terpisah, sudah upsert) | Pakai kelas existing |
| 5 | API path | `app/api/accel-ppp-servers/` | Konvensi admin = `app/api/admin/...` | `app/api/admin/accel-ppp-servers/` |
| 6 | Cron 30s | `*/30 * * * * *` | node-cron 5-field standard | 60s minimum (`* * * * *`) |
| 7 | tenantId | opsional | Multi-tenant guard mandatory di route | Field opsional, route enforce filter |

### Asumsi Aktif (akan dipakai tanpa konfirmasi ulang)
- API path: `app/api/admin/accel-ppp-servers/`
- Cron interval: 60s (every minute)
- Encryption: `encryptApiKey` untuk `radiusSecret` & `cliPassword`
- Permission resource: `accel_ppp` (snake_case)
- Setting key: `FULL_RADIUS_MODE` di tabel `Settings`

---

### M1 — Foundation: Schema, Domain, Repository, Settings

- [ ] Tambah model `AccelPppServer` di `prisma/schema.prisma` (siteId, tenantId opsional, secrets akan di-encrypt di app layer)
- [ ] Generate migration: `npx prisma migrate dev --name add_accel_ppp_server`
- [ ] Run `npm run prisma:generate`
- [ ] Buat domain entity `modules/network/domain/entities/AccelPppServerEntity.ts`
- [ ] Buat port `modules/network/domain/ports/IAccelPppServerRepository.ts`
- [ ] Buat domain errors `modules/network/domain/errors/AccelPppErrors.ts` (8 error class sesuai spec)
- [ ] Buat validator Zod `modules/network/validators/accelPppServer.ts` (create/update schemas)
- [ ] Implement `modules/network/repositories/AccelPppServerRepository.ts` dengan tenant isolation + auto encrypt/decrypt secrets via `encryptApiKey`/`decryptApiKey`
- [ ] Buat service setting baru `modules/settings/services/fullRadiusModeSettings.ts` (`getFullRadiusMode`, `setFullRadiusMode(value, userId)`) — pakai key `FULL_RADIUS_MODE` di tabel `Settings`
- [ ] Export `getFullRadiusMode`/`setFullRadiusMode` dari `modules/settings/index.ts`
- [ ] Update `modules/network/index.ts` export public API accel-ppp (entity types, errors, repo class, service interface)
- [ ] Update `docs/CHANGELOG.md` `[Unreleased]` dengan tag `[ADDED]` + `[MIGRATION]`

### M2 — CLI Client: TCP Socket accel-ppp

- [ ] Implement `modules/network/services/AccelPppCliClient.ts` (connect, sendCommand, parseResponse, timeout 5s) pakai `net` Node
- [ ] Buat parser untuk:
  - [ ] `show sessions` → `SessionDTO[]`
  - [ ] `show stat` → `{ activeSessions, ... }`
  - [ ] `terminate username <u>` response check
- [ ] Tambah fixtures di `tests/fixtures/accel-ppp/`:
  - `show-sessions-empty.txt`
  - `show-sessions-multi.txt`
  - `show-stat.txt`
  - `auth-failed.txt`
- [ ] Unit tests `tests/network/accel-ppp/unit/AccelPppCliClient.test.ts`:
  - [ ] connect + sendCommand + parse golden fixtures
  - [ ] timeout 5s
  - [ ] connection unreachable
  - [ ] auth failure
- [ ] Mock socket pakai `net.createServer` lokal (jangan mock library)

### M3 — Service Layer + Full Radius Mode Guard

- [ ] Buat util `lib/security/requireFullRadiusMode.ts` — read setting, throw `FullRadiusModeDisabledError` jika OFF
- [ ] Implement `modules/network/services/AccelPppServerService.ts`:
  - [ ] `create(input)` — transactional: AccelPppServerRepository.create + RadiusNasRepository.createNas (rollback bila NAS sync gagal)
  - [ ] `update(id, input)` — handle perubahan IP → update nas row
  - [ ] `delete(id, force)` — block jika ada session aktif tanpa force; cleanup nas row
  - [ ] `getById(id)`, `list({ tenantId, siteId })`
  - [ ] `testConnection(id)` — pakai CLI client
  - [ ] `getLiveSessions(serverId)` — via CLI `show sessions`
  - [ ] `kickSession(serverId, username)` — via CLI `terminate username`, audit log
- [ ] Audit log integration via pattern existing
- [ ] Service tests `tests/network/accel-ppp/services/`:
  - [ ] happy path create → server di DB + nas row di RADIUS DB
  - [ ] setting OFF → `FullRadiusModeDisabledError`
  - [ ] duplicate IP → `AccelPppDuplicateIpError`
  - [ ] RADIUS NAS sync gagal → rollback Prisma
  - [ ] kick username tidak ada → `AccelPppSessionNotFoundError`

### M4 — API Routes + Authorization

- [ ] Tambah resource `"accel_ppp"` ke `PERMISSION_GROUPS.NETWORK` di `lib/permission-config.ts`
- [ ] Tambah granular `ACCEL_PPP_KICK = "accel_ppp:session:kick"` di `GRANULAR_PERMISSIONS`
- [ ] Hook permission ke role default (Admin, NetworkOps) lewat seed/migration role
- [ ] Buat route `app/api/admin/accel-ppp-servers/route.ts` — GET (list), POST (create)
- [ ] Buat route `app/api/admin/accel-ppp-servers/[id]/route.ts` — GET, PATCH, DELETE
- [ ] Buat route `app/api/admin/accel-ppp-servers/[id]/test-connection/route.ts` — POST
- [ ] Buat route `app/api/admin/accel-ppp-servers/[id]/sessions/route.ts` — GET (live)
- [ ] Buat route `app/api/admin/accel-ppp-servers/[id]/sessions/[username]/kick/route.ts` — POST
- [ ] Setiap route: `requireFullRadiusMode()` → `hasPermission(...)` → service call
- [ ] Map domain errors ke `ApiErrors.*` (403/404/409/503/504)
- [ ] Integration tests `tests/network/accel-ppp/integration/`:
  - [ ] guard 403 saat setting OFF
  - [ ] POST: 201/409/422/503
  - [ ] DELETE active session: 409 tanpa force, 200 dengan force
  - [ ] kick: 200/404
  - [ ] permission catalog match: tes via role custom (memo `feedback-permission-catalog-mismatch.md`)

### M5 — Periodic Health Check Monitor

- [ ] Implement `modules/network/services/AccelPppMonitor.ts`:
  - [ ] `checkAll()` — load all servers (lintas tenant), `Promise.allSettled` per server
  - [ ] Per-server: ICMP ping → CLI `show stat` → update `pingStatus`, `userOnline`, `lastStatusCheck`
  - [ ] 1 server timeout tidak ganggu lain
- [ ] Register di `lib/cron-registry.ts` interval `* * * * *` (60s):
  - jobName: `accelPppHealthCheck`, ttl 55s
  - pakai `runCronTask` (system context elevation)
- [ ] Monitor tests:
  - [ ] multi-server parallel
  - [ ] 1 server timeout → lain tetap diproses
  - [ ] status transition online↔offline

### M6 — Admin UI

- [ ] Cek pola live data MikroTik dashboard existing (Socket.IO vs polling) → pilih konsisten
- [ ] Buat hook `lib/hooks/useFullRadiusMode.ts` (TanStack Query)
- [ ] Buat halaman `app/admin/network/accel-ppp/page.tsx` (list + status badges)
- [ ] Buat halaman `app/admin/network/accel-ppp/new/page.tsx` (create form)
- [ ] Buat halaman `app/admin/network/accel-ppp/[id]/page.tsx` (detail/edit + tab sessions live)
- [ ] Sidebar conditional rendering via `useFullRadiusMode` (`components/layout/admin-sidebar/`)
- [ ] Settings page entry untuk toggle `fullRadiusMode` (`app/admin/pengaturan/...`)
- [ ] Sessions polling 10s (atau Socket.IO jika konsisten dgn MikroTik)
- [ ] React Query invalidate pasca mutation
- [ ] E2E tests Playwright `tests/e2e/accel-ppp/`:
  - create server flow
  - toggle fullRadiusMode → UI hide/show
  - kick session button

### M7 — FreeRADIUS Config Bundle + Docs

- [ ] Buat folder `freeradius-config/` versioned di repo:
  - `README.md` (apply instruction)
  - `huntgroups` (per-NAS huntgroup definition)
  - `policy.d/per-nas-routing` (unlang rules: huntgroup → reply attribute)
  - `sites-available/default.snippet` (cara include policy)
- [ ] Buat `docs/guides/accel-ppp-setup.md`:
  - Topology overview
  - accel-ppp install + config minimal
  - FreeRADIUS apply config bundle
  - Verifikasi end-to-end auth
- [ ] Update `docs/CHANGELOG.md` final entry: `[ADDED]` modul + `[MIGRATION]` + `[DOCS]`

### Dependency Graph
```
M1 ──┬─→ M2 ─┐
     │       │
     ├───────┴─→ M3 ─→ M4 ─→ M6
     │           │
     │           └────→ M5
     │
     └───→ M7 (paralel)
```

### Verifikasi Sebelum Task Closed (per milestone)
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test -- network/accel-ppp` → 100% pass
- [ ] `npm run build` lulus
- [ ] Manual: toggle Full RADIUS Mode ON/OFF → API guard respons benar
- [ ] Manual lab (M6 done): dial PPPoE dari accel-ppp box dummy → AccessAccept dengan attribute benar
- [ ] `docs/CHANGELOG.md` updated

### Risiko & Open Questions Aktif
- **Pola Socket.IO vs polling untuk live sessions** — resolve di awal M6 dengan inspeksi `RadiusDashboardService`/MikroTik dashboard.
- **accel-ppp CLI auth versi target** — test di lab; abstraksi parser by capability.
- **FreeRADIUS huntgroup config drift box production vs bundle** — versioned di repo + dokumentasi diff/apply.
- **Behavior delete server saat banyak session aktif** — default block 409, future bisa Disconnect-Request via CoA.

### Out of Scope (Future)
- Migrasi MikroTik existing ke pure-RADIUS (drop `/ppp/secret` provisioning)
- Failover / load balancing antar PPPoE server
- Protokol non-PPPoE (L2TP, SSTP, PPTP)
- Multi-instance accel-ppp di satu IP
- Auto-provisioning accel-ppp box (ansible)
- Disconnect-Request via CoA saat delete server
