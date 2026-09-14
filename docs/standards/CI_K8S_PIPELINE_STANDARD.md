# CI & Kubernetes Pipeline Standard

> **Tujuan:** menjaga pipeline build, migration, dan deploy tetap deterministik, fail-fast, dan konsisten antar perubahan berikutnya.

---

## 1. Prinsip Utama

Pipeline CI/CD untuk `netmanager` harus mengikuti prinsip berikut:

1. **Deterministic** — build harus menghasilkan artifact yang sama dari commit dan lockfile yang sama.
2. **Fail-fast** — langkah penting tidak boleh memakai pola yang menyamarkan error.
3. **Environment-agnostic** — test dan pipeline tidak boleh bergantung pada path lokal developer atau asumsi workspace tertentu.
4. **Explicit ordering** — namespace dan manifest dasar harus diterapkan secara jelas, bukan mengandalkan urutan acak filesystem.
5. **Critical data safety** — backup, migration, dan rollout tidak boleh dianggap sukses jika langkah kritisnya gagal.

---

## 2. Standard Install & Build

### Wajib

- CI dan Docker build menggunakan **`npm ci`**, bukan fallback ke `npm install`.
- `package-lock.json` adalah sumber kebenaran dependency.
- Jika `npm ci` gagal, pipeline **harus gagal**, bukan diam-diam lanjut dengan install lain.

### Dilarang

- `npm ci || npm install`
- fallback registry/install yang mengubah reproducibility tanpa review eksplisit

### Alasan

- fallback `npm install` membuka drift dependency
- hasil build menjadi berbeda antar mesin/run
- bug sulit direproduksi karena artifact tidak lagi benar-benar berasal dari lockfile

---

## 3. Standard Shell Script di Pipeline

### Wajib

Gunakan:

```sh
set -euo pipefail
```

untuk shell block yang:

- memakai pipe (`|`)
- menjalankan backup
- import/load image
- migration/deploy step penting

### Dilarang

- pipeline shell yang tidak memakai `pipefail` tapi bergantung pada hasil pipe
- verifikasi critical dengan `|| true`

### Alasan

Tanpa `pipefail`, command awal dalam pipe bisa gagal tapi stage tetap terlihat sukses.

---

## 4. Standard Manifest Apply Order

### Wajib

Urutan apply harus eksplisit:

1. `namespace.yaml`
2. manifest dasar infra/config yang memang dibutuhkan
3. manifest aplikasi lain secara deterministik

Jika memakai loop, manifest harus diproses dengan urutan stabil, misalnya `find ... | sort | while read ...`.

### Dilarang

- `find ... | xargs kubectl apply` tanpa kontrol urutan
- mengandalkan namespace sudah ada tanpa apply eksplisit

### Alasan

- urutan acak bikin deploy flaky
- object dependency bisa belum tersedia saat manifest lain diterapkan

---

## 5. Standard Migration & Backup

### Wajib

- backup production harus dianggap **langkah kritis**
- migration job harus fail jika step kritis gagal
- script backfill/data-fix harus jelas diklasifikasi:
  - **critical** → fail job jika gagal
  - **optional** → boleh lanjut, tapi harus jelas diberi label dan log
- jika backup production gagal, pipeline harus **stop by default**; override hanya boleh melalui flag eksplisit yang terdokumentasi

### Dilarang

- menyembunyikan failure migration/data-fix penting dengan `|| true` atau `|| echo ... continuing` tanpa justifikasi
- lanjut deploy production tanpa kejelasan backup status

### Alasan

- partial success di migration sering lebih berbahaya daripada hard failure
- data drift sulit dipulihkan kalau pipeline menandai deploy sebagai sukses padahal backfill gagal

---

## 6. Standard Image Distribution

### Wajib

- image harus didistribusikan lewat registry push/pull yang eksplisit
- pipeline harus fail-fast jika konfigurasi registry atau credential belum tersedia
- verifikasi image harus memeriksa **exact image refs/tag** yang benar-benar dipakai workload, bukan grep generik nama project
- `imagePullPolicy` dan strategy distribusi image harus konsisten dengan immutable refs yang dipublish ke registry
- jika registry private dipakai, cluster pull auth (`imagePullSecrets` / registry secret) **wajib tersedia** sebelum workload dinyatakan siap atau rollout dianggap sukses

### Perlu perhatian khusus

- staging dan production tidak boleh bergantung pada import lokal ke node K3s
- backup tag untuk environment image harus berasal dari registry env tag (`*-prev`), bukan dari image lokal node
- reference image di manifest harus dirender oleh pipeline, bukan hardcoded ke placeholder lokal

---

## 7. Standard Rollout Verification

### Wajib

- resource penting harus punya rollout/status check eksplisit
- exception hanya boleh ada jika benar-benar non-critical dan harus didokumentasikan

### Dilarang

- rollout check yang ditoleransi gagal tanpa alasan jelas

---

## 8. Standard Test Portability

### Wajib

- test file-based harus pakai path repo-relative
- gunakan pola seperti:

```ts
join(process.cwd(), 'app', 'admin', 'attendance', 'AttendanceClient.tsx')
```

### Dilarang

- hardcoded path lokal seperti `/Users/...`

### Alasan

- Jenkins, local, dan environment lain punya workspace path berbeda

---

## 9. Review Checklist untuk Perubahan Pipeline

Sebelum merge perubahan Jenkins/K8s/deploy:

- [ ] Apakah install tetap deterministic (`npm ci` only)?
- [ ] Apakah shell block critical memakai `set -euo pipefail`?
- [ ] Apakah tidak ada `|| true` pada langkah penting?
- [ ] Apakah apply order eksplisit dan deterministic?
- [ ] Apakah backup/migration behavior jelas fail-fast atau explicitly optional?
- [ ] Apakah image verification benar-benar memblokir jika image tidak ada?
- [ ] Apakah test/file path portable di CI?
- [ ] Apakah rollout verification masih sesuai criticality service?

---

## 10. Catatan Implementasi Saat Ini

Pipeline berjalan di **Gitea Actions** (`.gitea/workflows/deploy-production.yml`).
Jenkins dihapus pada 14 September 2026; standar di dokumen ini tidak berubah,
hanya subjek yang menegakkannya.

Tiap aturan di atas punya tes yang menjaganya, sehingga pelanggarannya merah di
CI dan bukan ditemukan saat deploy:

| Aturan | Penjaga |
|--------|---------|
| `npm ci` tanpa fallback, Prisma generate eksplisit | `tests/ci/gitea-deploy-workflow-safety.test.ts` |
| Template secret placeholder tidak pernah di-apply | `tests/ci/gitea-deploy-workflow-safety.test.ts` |
| Manifes dirender ke berkas dan bebas placeholder | `tests/ci/gitea-deploy-workflow-safety.test.ts` |
| Image hanya dari registry resmi, didorong sebelum deploy | `tests/ci/gitea-deploy-workflow-safety.test.ts` |
| Preflight kesehatan node, secret registry, secret runtime | `tests/ci/gitea-production-preflight-safety.test.ts` |
| Cadangan pra-migrasi hard-fail dengan override eksplisit | `tests/ci/gitea-production-preflight-safety.test.ts` |
| Batas tunggu migrasi lebih panjang dari deadline Job | `tests/ci/migration-job-safety.test.ts` |
| Secret deploy diperiksa sebelum apa pun dibangun | `tests/ci/deploy-secret-preflight-safety.test.ts` |
| Isi manifes produksi dan wiring registry secret | `tests/ci/production-manifest-safety.test.ts` |
| Cara image dibangun (Dockerfile, .dockerignore) | `tests/ci/docker-image-build-safety.test.ts` |

### Current explicit policies

- production migration backup: **hard-fail by default**, override hanya lewat
  input `allow_migration_without_backup` pada `workflow_dispatch` — push tidak
  bisa mengisinya, jadi deploy otomatis tidak pernah melewati cadangan
- cadangan mencakup keempat basis data (netmanager, radius, billing, mitra),
  disimpan di host produksi `/var/backups/netmanager`, retensi 7 hari
- optional migration scripts: tetap non-critical by default, tetapi dilaporkan
  jelas dan bisa dibuat strict dengan `FAIL_ON_OPTIONAL_MIGRATION_ERRORS=true`
- image distribution: memakai registry refs yang dirender pipeline, bukan
  import lokal ke node K3s
- build berjalan di VPS Gitea, **bukan** sebagai pod di cluster produksi: build
  Next.js pernah menembus 21 GB dan menjatuhkan host produksi ketika keduanya
  berbagi mesin
- deploy memakai SSH ke host produksi, bukan membuka API Kubernetes ke
  internet; port 6443 tetap tertutup dari luar
