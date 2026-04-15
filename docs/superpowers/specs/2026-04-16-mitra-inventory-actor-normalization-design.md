# Mitra Inventory Actor Normalization Design

Tanggal: 2026-04-16
Status: Draft disetujui user untuk lanjut ke planning
Area: `netmanager` mobile inventory, inventory persistence, audit logging, asset assignment

## Ringkasan

RBAC mobile inventory sudah diperketat pada layer route dan frontend guard, tetapi flow Mitra masih fail-closed pada mutation dan history karena persistence utama masih user-centric. Saat ini `SystemLog`, `BarangMasuk`, `BarangKeluar`, dan assignment asset mengasumsikan actor adalah `User`. Sementara itu actor Mitra berasal dari jalur `prismaMitra` dan tidak memiliki model relasi di schema Prisma utama `netmanager`.

Desain ini menormalisasi actor persistence dengan field generik `actorType` dan `actorId`, sambil mempertahankan `userId` legacy hanya untuk flow yang memang actor-nya `User`. Pendekatan ini memungkinkan inventory mobile untuk Mitra dibuka kembali tanpa memaksa Mitra menyamar sebagai `User`, tanpa membuat relasi Prisma palsu, dan tanpa rewrite besar pada seluruh modul inventory.

## Masalah yang Diselesaikan

1. Flow inventory mobile Mitra belum dapat dibuka dengan aman karena write path masih menerima `userId`.
2. History inventory masih di-scope berdasarkan `userId`, sehingga actor non-user tidak punya source of truth persistence.
3. Logging aktivitas dan auth masih user-centric, sehingga audit trail Mitra akan salah atau hilang jika flow dibuka sekarang.
4. Assignment asset pada stock keluar masih menulis `assignedTo` sebagai user-only field.

## Tujuan

1. Menjadikan actor persistence inventory dan logging actor-aware untuk `user` dan `mitra`.
2. Mempertahankan backward compatibility untuk flow employee/admin yang sudah berjalan.
3. Membuka kembali mutation dan history inventory mobile untuk Mitra setelah persistence aman.
4. Membatasi blast radius ke inventory mobile, logging, repository inventory, dan mapper/DTO minimum yang terdampak.

## Non-Goals

1. Tidak melakukan redesign penuh seluruh modul asset.
2. Tidak melakukan migrasi penuh seluruh data historis pada batch ini.
3. Tidak menambah relasi Prisma langsung ke entitas Mitra di schema utama.
4. Tidak merombak seluruh consumer admin/web yang belum membutuhkan actor generik.

## Pendekatan yang Dipilih

Pendekatan yang dipilih adalah **generic actor fields + legacy compatibility**.

### Kenapa pendekatan ini dipilih

- Aman terhadap kenyataan bahwa `Mitra` tidak ada di schema Prisma utama.
- Tidak memaksa fake foreign key ke `User`.
- Memungkinkan rollout bertahap: write path baru, read path transisional.
- Lebih kecil blast radius-nya dibanding redesign total actor model.

### Pendekatan yang tidak dipilih

- **Tetap user-centric dan biarkan Mitra fail-closed lebih lama**: terlalu defensif dan tidak menyelesaikan kebutuhan bisnis.
- **Redesign total semua actor reference sekaligus**: terlalu besar untuk batch remediation ini dan berisiko regression luas.

## Desain Data

### 1. Generic actor source of truth

Source of truth actor baru untuk persistence adalah:

- `actorType`
- `actorId`

Field legacy `userId` tetap ada, tetapi berubah fungsi menjadi compatibility field khusus actor `user`, bukan identitas actor universal.

### 2. Tabel yang diubah

#### `SystemLog`

- Pertahankan `userId`
- Tambah `actorType String?`
- Tambah `actorId String?`
- Tambah index gabungan `(actorType, actorId)`

Catatan: perubahan ini sudah mulai masuk dan menjadi dasar untuk logger actor-aware.

#### `BarangMasuk`

- Pertahankan `userId`
- Tambah `actorType String?`
- Tambah `actorId String?`
- Tambah index gabungan `(actorType, actorId)`

#### `BarangKeluar`

- Pertahankan `userId`
- Tambah `actorType String?`
- Tambah `actorId String?`
- Tambah index gabungan `(actorType, actorId)`

#### `Asset`

- Pertahankan `assignedTo` legacy
- Tambah `assignedActorType String?`
- Tambah `assignedActorId String?`

Alasan: `assignedTo` saat ini masih punya semantik user-only. Meng-overload field itu untuk Mitra akan membuat data ambiguity dan merusak consumer lama. Karena itu source of truth baru untuk assignment actor adalah pasangan `assignedActorType` + `assignedActorId`, sedangkan `assignedTo` legacy tetap dipakai hanya saat actor adalah `user`.

## Desain Kontrak Antar Layer

### 1. Logger

File target: `lib/logger.ts`

`logActivity`, `logAuth`, dan `logActivitySafe` diubah agar menerima actor generik.

Kontrak write:

- actor user
  - `userId = user.id`
  - `actorType = 'user'`
  - `actorId = user.id`
- actor mitra
  - `userId = null`
  - `actorType = 'mitra'`
  - `actorId = mitra.id`

Prinsip penting:

- Tidak ada coercion actor Mitra ke `userId`
- Tidak ada fallback diam-diam dari actor generik ke field legacy

### 2. Inventory Repository Interface

File target: `modules/inventory/repositories/IInventoryRepository.ts`

Input repository diubah dari user-centric menjadi actor-aware dengan object kecil yang eksplisit:

```ts
actor: {
  type: 'user' | 'mitra'
  id: string
  userId?: string
}
```

Alasan:

- Mencegah kombinasi field yang invalid
- Membuat call site lebih jelas daripada mengirim `userId`, `actorType`, dan `actorId` secara terpisah
- Menjaga future extension tetap terkontrol

Aturan:

- `userId` hanya boleh diisi ketika `type === 'user'`
- Actor `mitra` tidak boleh membawa `userId`

### 3. Inventory Repository Implementation

File target: `modules/inventory/repositories/InventoryRepository.ts`

#### Write path `BarangMasuk`
- Selalu isi `actorType` dan `actorId`
- Isi `userId` hanya jika actor adalah user

#### Write path `BarangKeluar`
- Selalu isi `actorType` dan `actorId`
- Isi `userId` hanya jika actor adalah user

#### Side effect asset assignment
- Isi `assignedActorType` dan `assignedActorId`
- Isi `assignedTo` hanya jika actor adalah user

Hasil yang diinginkan:

- User flow lama tetap berjalan
- Mitra flow baru punya actor persistence yang benar
- Side effect asset tetap backward-compatible

### 4. DTO dan Mapper Asset

File target:
- `modules/inventory/dto/AssetDTO.ts`
- `modules/inventory/mappers/AssetMapper.ts`

Tambahkan representasi actor assignment generik:

```ts
assignedActor: {
  type: 'user' | 'mitra'
  id: string
  name?: string | null
} | null
```

Aturan kompatibilitas:

- `assignedTo` legacy tetap dipertahankan untuk consumer lama
- `assignedActor` menjadi source of truth baru untuk assignment
- Untuk actor user, keduanya dapat terisi
- Untuk actor mitra, `assignedTo` boleh `null`, tetapi `assignedActor` harus akurat

## Data Flow Route Mobile

### `app/api/mobile/inventory/masuk/route.ts`

1. Resolve actor dari mobile auth payload
2. Jalankan permission check fail-fast
3. Jalankan validasi site/gudang seperti batch sebelumnya
4. Kirim actor object ke repository
5. Logging aktivitas menggunakan actor-aware logger

### `app/api/mobile/inventory/keluar/route.ts`

1. Resolve actor dari mobile auth payload
2. Permission dan site validation tetap sama
3. Repository menulis mutasi dengan actor generik
4. Assignment asset memakai actor generik
5. Logging aktivitas actor-aware

### `app/api/mobile/inventory/riwayat/route.ts`

Read path baru:

- user actor: baca record `actorType='user' && actorId=user.id`
- mitra actor: baca record `actorType='mitra' && actorId=mitra.id`

Read path transisional:

- row lama user-centric tetap dapat terbaca untuk user melalui `userId=user.id`

Tujuan read path transisional ini adalah agar deploy bisa bertahap tanpa backfill data historis pada batch yang sama.

## Fail-Safe Rules

1. Jika actor object tidak valid, request ditolak `403`.
2. Jika actor type bukan `user|mitra`, request ditolak `403`.
3. Tidak ada fallback dari actor Mitra ke `userId` legacy.
4. Jika ada side effect yang masih bergantung penuh pada user-only model dan belum dipatch, flow harus fail-closed secara eksplisit.
5. Semua permission dan site restriction yang sudah diperketat pada batch sebelumnya tetap dipertahankan.

## Strategi Migrasi dan Kompatibilitas

### Write path

- Semua write baru memakai `actorType` + `actorId`
- `userId` hanya diisi untuk actor user
- Assignment asset baru memakai `assignedActorType` + `assignedActorId`
- `assignedTo` hanya diisi untuk actor user

### Read path

- Support row lama dan row baru selama masa transisi
- Tidak perlu backfill penuh pada batch ini

### Backfill opsional pasca-batch

Jika nanti dibutuhkan untuk reporting atau query simplification, dapat ditambahkan migration/backfill terpisah:

- `actorType = 'user'`
- `actorId = userId`

untuk row historis yang masih kosong actor generic-nya.

## Rencana Testing

### Logger tests

- User actor menyimpan `userId`, `actorType='user'`, `actorId=userId`
- Mitra actor menyimpan `userId=null`, `actorType='mitra'`, `actorId=mitraId`

### Repository tests

- Add stock user menulis legacy + generic fields dengan benar
- Add stock mitra menulis generic fields tanpa memaksa `userId`
- Remove stock mitra menulis assignment actor generik dengan benar

### Route tests

- Mitra inventory masuk sukses jika permission dan site valid
- Mitra inventory keluar sukses jika permission dan site valid
- Mitra inventory history sukses dan hanya melihat data actor-nya sendiri
- Request tanpa permission tetap `403`
- Request dengan site/gudang di luar scope tetap `403`

### Mapper/DTO tests

- Consumer lama masih menerima `assignedTo` untuk actor user
- Consumer baru menerima `assignedActor` untuk user maupun mitra

## Scope Batch Implementasi

Batch implementasi yang akan dibuat dari desain ini dibatasi ke:

1. Prisma schema untuk inventory/logging/asset assignment actor generic
2. Logger actor-aware
3. Inventory repository interface dan implementation
4. Mobile inventory routes: `masuk`, `keluar`, `riwayat`
5. DTO/mapper asset minimum yang terdampak
6. Targeted tests terkait persistence actor dan route authorization

Di luar scope batch ini:

- Refactor penuh modul asset admin/web
- Cleanup total seluruh consumer yang masih membaca legacy field
- Backfill penuh data historis

## Risiko dan Mitigasi

### Risiko: consumer lama membaca field legacy saja
Mitigasi:
- Pertahankan `userId` dan `assignedTo` untuk flow user
- Tambahkan `assignedActor` tanpa menghapus contract lama pada batch ini

### Risiko: query riwayat jadi bercabang antara legacy dan new records
Mitigasi:
- Batasi branching hanya di read path transisional
- Gunakan helper kecil bila perlu agar route tetap tipis

### Risiko: asset assignment Mitra belum punya nama actor untuk UI tertentu
Mitigasi:
- `assignedActor.name` boleh nullable pada batch ini
- Jangan mengunci desain pada join lintas database yang belum tersedia

## Hasil Akhir yang Diharapkan

Setelah batch implementasi selesai:

1. Inventory mobile Mitra dapat dibuka kembali dengan persistence yang benar.
2. Audit log menyimpan actor user dan mitra secara akurat.
3. History inventory tidak lagi bergantung eksklusif pada `userId`.
4. Assignment asset tidak lagi memaksa actor non-user masuk ke field user-only.
5. Flow user lama tetap kompatibel selama masa transisi.

## Catatan Keputusan

- `actorType` dan `actorId` menjadi source of truth baru untuk actor persistence.
- `userId` tetap dipertahankan hanya untuk compatibility dan relasi user yang memang valid.
- Tidak akan dibuat relasi Prisma langsung ke Mitra di schema utama.
- Tidak akan dilakukan fake mapping Mitra ke User.
- Route Mitra hanya dibuka kembali setelah write path dan read path actor-aware selesai.