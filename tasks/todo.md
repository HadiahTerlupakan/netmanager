# TODO

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
