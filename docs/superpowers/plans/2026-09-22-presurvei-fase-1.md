# Modul Presurvei — Rencana Implementasi Fase 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tim sales dan marketing bisa mencatat kegiatan lapangan maupun kantor lewat API, dan setiap kegiatan yang membuahkan minat otomatis menghasilkan prospek yang bisa di-follow-up berulang.

**Architecture:** Modul `modules/presurvei` berdiri sendiri mengikuti pola modul terbaru di repo (`modules/endorsement`): domain murni tanpa import framework, repository di balik port, service dengan constructor DI, route tipis lewat `createHandler`. Fase 1 membangun skema penuh empat tabel plus dua agregat yang dipakai lebih dulu — Kegiatan dan Prospek. Iklan, Target, event registrasi, dan promosi ke Canvasing menyusul di Fase 2.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma + PostgreSQL, Zod, Vitest.

**Spec:** `docs/architecture/presurvei-module-design.md`

## Global Constraints

Berlaku untuk setiap task, tanpa perlu diulang di masing-masing:

- **Bahasa**: komentar kode, pesan error, dan pesan validasi ditulis dalam Bahasa Indonesia.
- **Error handling**: service melempar `AppError` dari `@/lib/errors` — `new AppError(message, statusCode, code)`. Jangan pakai pola `Result<T, E>`. `createHandler` memetakan `AppError` ke HTTP secara otomatis.
- **Klien Prisma**: `import { prisma } from "@/modules/database"` — **bukan** `@/lib/prisma`. Klien ini sudah punya ekstensi isolasi tenant, jadi **jangan menulis filter `tenantId` manual** di repository.
- **Module boundary**: modul lain hanya boleh mengimpor dari `modules/presurvei/index.ts`. Repository dan mapper **tidak** diekspor dari sana.
- **Domain murni**: file di `domain/` tidak boleh mengimpor apa pun dari luar folder `domain/` — tanpa Prisma, tanpa framework.
- **Komentar**: setiap fungsi publik wajib punya brief comment satu baris tentang tujuannya.
- **Penamaan**: fungsi adalah verb (`buatProspek`, `validasiTransisi`); boolean berprefix `is`/`has`/`can` (`isFinal`, `canPromosikan`). Tidak ada magic number — gunakan named constant.
- **Nullable**: field opsional di domain entity ditulis `| null`, bukan `?`. `Date` tetap `Date` di domain, dikonversi ke ISO string hanya di DTO.
- **Test**: semua file test di `tests/modules/presurvei/`. Service diuji dengan me-mock port repository; repository diuji dengan me-mock `@/modules/database`. Waktu selalu di-inject supaya deterministik.
- **Migration**: `npx prisma migrate dev --name <deskriptif>`. `prisma db push` **dilarang**. Commit `schema.prisma` dan folder migration dalam satu commit.
- **Commit**: Conventional Commits — `feat(presurvei): ...`, `test(presurvei): ...`.

---

## Struktur File

| File | Tanggung jawab |
|---|---|
| `prisma/schema.prisma` | 4 model + 5 enum + relasi balik di `User`, `Tenant`, `Sites` |
| `modules/presurvei/domain/entities/Prospek.ts` | Const array status/sumber, union type, entity prospek |
| `modules/presurvei/domain/entities/Kegiatan.ts` | Const array jenis/hasil, union type, entity kegiatan |
| `modules/presurvei/domain/prospek-rules.ts` | Transisi status yang sah, syarat promosi — fungsi murni |
| `modules/presurvei/domain/kegiatan-rules.ts` | Kolom mana boleh terisi per jenis kegiatan, kapan kegiatan melahirkan prospek |
| `modules/presurvei/domain/ports/IProspekRepository.ts` | Kontrak akses data prospek + tipe input/filter |
| `modules/presurvei/domain/ports/IKegiatanRepository.ts` | Kontrak akses data kegiatan + tipe input/filter |
| `modules/presurvei/mappers/prospek.mapper.ts` | Row Prisma → entity prospek |
| `modules/presurvei/mappers/kegiatan.mapper.ts` | Row Prisma → entity kegiatan |
| `modules/presurvei/repositories/ProspekRepository.ts` | Query Prisma prospek |
| `modules/presurvei/repositories/KegiatanRepository.ts` | Query Prisma kegiatan, termasuk transaksi kegiatan+prospek |
| `modules/presurvei/validators/prospek.validator.ts` | Skema Zod prospek |
| `modules/presurvei/validators/kegiatan.validator.ts` | Skema Zod kegiatan + refine konsistensi jenis |
| `modules/presurvei/services/ProspekService.ts` | Orkestrasi prospek: daftar, detail, buat, ubah status |
| `modules/presurvei/services/KegiatanService.ts` | Orkestrasi kegiatan + pembuatan prospek otomatis |
| `modules/presurvei/dto/prospek.dto.ts` | DTO prospek + konversi entity → DTO |
| `modules/presurvei/dto/kegiatan.dto.ts` | DTO kegiatan + konversi entity → DTO |
| `modules/presurvei/index.ts` | Public API modul |
| `app/api/presurvei/prospek/route.ts` | GET daftar, POST buat prospek |
| `app/api/presurvei/prospek/[id]/route.ts` | GET detail, PATCH ubah prospek |
| `app/api/presurvei/kegiatan/route.ts` | GET daftar, POST catat kegiatan |
| `app/api/presurvei/kegiatan/[id]/route.ts` | GET detail kegiatan |
| `lib/permissions.ts`, `lib/permission-config.ts`, `lib/resource-capabilities.ts`, `lib/role-templates.ts` | Pendaftaran permission |
| `scripts/seed-presurvei-permissions.ts` | Seed permission ke role |

---

### Task 1: Skema Prisma & migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_presurvei_module/migration.sql` (dihasilkan Prisma)

**Interfaces:**
- Consumes: —
- Produces: model Prisma `PresurveiKegiatan`, `PresurveiProspek`, `PresurveiIklan`, `PresurveiTarget`; enum `PresurveiJenisKegiatan`, `PresurveiHasilKegiatan`, `PresurveiSumberProspek`, `PresurveiStatusProspek`, `PresurveiChannelIklan`. Semua task berikutnya bergantung pada tipe hasil `prisma generate`.

- [ ] **Step 1: Tambahkan lima enum di akhir blok enum `schema.prisma`**

Letakkan setelah `enum PointClaimStatus` (sekitar baris 4489) agar berdekatan dengan enum marketing:

```prisma
enum PresurveiJenisKegiatan {
  KUNJUNGAN
  SURVEI_LOKASI
  TELEPON
  CHAT
  IKLAN
}

enum PresurveiHasilKegiatan {
  TERTARIK
  PERLU_FOLLOWUP
  TIDAK_MINAT
  TIDAK_ADA_ORANG
  DEAL
}

enum PresurveiSumberProspek {
  LAPANGAN
  IKLAN
  WEBSITE
  REFERRAL
  WALK_IN
}

enum PresurveiStatusProspek {
  BARU
  DIHUBUNGI
  TERTARIK
  NEGOSIASI
  DEAL
  TIDAK_MINAT
  TIDAK_LAYAK
}

enum PresurveiChannelIklan {
  META
  GOOGLE
  TIKTOK
  WHATSAPP
  OFFLINE
  LAINNYA
}
```

- [ ] **Step 2: Tambahkan empat model, letakkan setelah `model PointClaim`**

```prisma
model PresurveiKegiatan {
  id String @id @default(uuid())

  jenis  PresurveiJenisKegiatan
  userId String

  prospekId String?
  iklanId   String?

  waktuMulai   DateTime
  waktuSelesai DateTime?

  latitude         Float?
  longitude        Float?
  alamatDikunjungi String?

  ditemuiNama String?
  hasil       PresurveiHasilKegiatan
  catatan     String?
  fotoUrls    String[]

  odpTerdekat        String?
  estimasiKabelMeter Int?
  catatanTeknis      String?

  siteId   String?
  tenantId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user    User              @relation("UserPresurveiKegiatan", fields: [userId], references: [id])
  prospek PresurveiProspek? @relation(fields: [prospekId], references: [id])
  iklan   PresurveiIklan?   @relation(fields: [iklanId], references: [id])
  site    Sites?            @relation(fields: [siteId], references: [id])
  tenant  Tenant?           @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  @@index([userId, waktuMulai])
  @@index([prospekId])
  @@index([iklanId])
  @@index([tenantId])
  @@index([jenis, hasil])
  @@map("presurvei_kegiatan")
}

model PresurveiProspek {
  id String @id @default(uuid())

  nama      String
  noTelp    String
  email     String?
  alamat    String
  latitude  Float?
  longitude Float?
  shareloc  String?

  sumber         PresurveiSumberProspek
  iklanId        String?
  registrationId String?                @unique
  referralNama   String?

  status        PresurveiStatusProspek @default(BARU)
  pemilikId     String?
  paketDiminati String?
  catatan       String?

  canvasingId String?   @unique
  konversiAt  DateTime?

  siteId   String?
  tenantId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  iklan    PresurveiIklan?     @relation(fields: [iklanId], references: [id])
  pemilik  User?               @relation("UserPresurveiProspek", fields: [pemilikId], references: [id])
  site     Sites?              @relation(fields: [siteId], references: [id])
  tenant   Tenant?             @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  kegiatan PresurveiKegiatan[]

  @@index([pemilikId, status])
  @@index([sumber])
  @@index([tenantId])
  @@index([createdAt])
  @@map("presurvei_prospek")
}

model PresurveiIklan {
  id   String @id @default(uuid())
  nama String
  kode String

  channel        PresurveiChannelIklan
  tanggalMulai   DateTime
  tanggalSelesai DateTime?
  biaya          Decimal?              @db.Decimal(15, 2)

  penanggungJawabId String?
  isAktif           Boolean @default(true)

  tenantId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  penanggungJawab User?               @relation("UserPresurveiIklan", fields: [penanggungJawabId], references: [id])
  tenant          Tenant?             @relation(fields: [tenantId], references: [id], onDelete: Restrict)
  prospek         PresurveiProspek[]
  kegiatan        PresurveiKegiatan[]

  @@unique([kode, tenantId])
  @@index([tenantId])
  @@index([isAktif, tanggalMulai])
  @@map("presurvei_iklan")
}

model PresurveiTarget {
  id     String @id @default(uuid())
  userId String

  periodeTahun Int
  periodeBulan Int

  targetKunjungan Int @default(0)
  targetProspek   Int @default(0)
  targetKonversi  Int @default(0)

  tenantId String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user   User    @relation("UserPresurveiTarget", fields: [userId], references: [id])
  tenant Tenant? @relation(fields: [tenantId], references: [id], onDelete: Restrict)

  @@unique([userId, periodeTahun, periodeBulan, tenantId])
  @@index([tenantId])
  @@map("presurvei_target")
}
```

- [ ] **Step 3: Tambahkan relasi balik di model `User`**

Sisipkan setelah baris `salesCanvasing ... @relation("UserSalesCanvasing")` (sekitar baris 1475):

```prisma
  presurveiKegiatan                          PresurveiKegiatan[]         @relation("UserPresurveiKegiatan")
  presurveiProspek                           PresurveiProspek[]          @relation("UserPresurveiProspek")
  presurveiIklan                             PresurveiIklan[]            @relation("UserPresurveiIklan")
  presurveiTarget                            PresurveiTarget[]           @relation("UserPresurveiTarget")
```

- [ ] **Step 4: Tambahkan relasi balik di model `Tenant`**

Sisipkan dekat baris `canvasing Canvasing[]` (sekitar baris 3887):

```prisma
  presurveiKegiatan         PresurveiKegiatan[]
  presurveiProspek          PresurveiProspek[]
  presurveiIklan            PresurveiIklan[]
  presurveiTarget           PresurveiTarget[]
```

- [ ] **Step 5: Tambahkan relasi balik di model `Sites`**

Sisipkan di antara daftar relasi `Sites` (mulai sekitar baris 2133, urut alfabetis dengan relasi lain):

```prisma
  presurveiKegiatan PresurveiKegiatan[]
  presurveiProspek  PresurveiProspek[]
```

- [ ] **Step 6: Validasi skema sebelum membuat migration**

Run: `npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

Bila gagal karena relasi balik kurang, Prisma akan menyebut nama relasi yang belum berpasangan — tambahkan pasangannya lalu ulangi.

- [ ] **Step 7: Buat migration**

Run: `npx prisma migrate dev --name add_presurvei_module`
Expected: folder baru `prisma/migrations/<timestamp>_add_presurvei_module/` dengan `migration.sql`.

- [ ] **Step 8: Verifikasi isi migration**

Run: `cat prisma/migrations/*_add_presurvei_module/migration.sql | head -60`

Yang harus ada: lima `CREATE TYPE` untuk enum, empat `CREATE TABLE`, dan `CREATE UNIQUE INDEX` untuk `presurvei_prospek.registrationId`, `presurvei_prospek.canvasingId`, serta `presurvei_iklan(kode, tenantId)`.

Yang **tidak boleh ada**: `DROP TABLE`, `DROP COLUMN`, atau `ALTER TABLE ... DROP` apa pun. Migration ini murni menambah. Bila muncul, berarti ada drift skema lokal — hentikan dan laporkan, jangan lanjut.

- [ ] **Step 9: Generate Prisma client**

Run: `npm run prisma:generate`
Expected: selesai tanpa error.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(presurvei): tambah skema kegiatan, prospek, iklan, dan target"
```

---

### Task 2: Domain prospek — entity dan aturan

**Files:**
- Create: `modules/presurvei/domain/entities/Prospek.ts`
- Create: `modules/presurvei/domain/prospek-rules.ts`
- Test: `tests/modules/presurvei/prospek-rules.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `PROSPEK_STATUSES`, `PROSPEK_SUMBER` (const array), `ProspekStatus`, `ProspekSumber` (union type)
  - `ProspekEntity` (interface)
  - `getStatusLanjutan(status: ProspekStatus): ProspekStatus[]`
  - `isTransisiStatusSah(dari: ProspekStatus, ke: ProspekStatus): boolean`
  - `isStatusFinal(status: ProspekStatus): boolean`
  - `canPromosikanKeCanvasing(prospek: Pick<ProspekEntity, "status" | "canvasingId" | "noTelp" | "alamat">): boolean`

- [ ] **Step 1: Tulis entity prospek**

Create `modules/presurvei/domain/entities/Prospek.ts`:

```ts
/**
 * Entitas domain prospek presurvei.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain.
 */

export const PROSPEK_STATUSES = [
  "BARU",
  "DIHUBUNGI",
  "TERTARIK",
  "NEGOSIASI",
  "DEAL",
  "TIDAK_MINAT",
  "TIDAK_LAYAK",
] as const;

export type ProspekStatus = (typeof PROSPEK_STATUSES)[number];

export const PROSPEK_SUMBER = [
  "LAPANGAN",
  "IKLAN",
  "WEBSITE",
  "REFERRAL",
  "WALK_IN",
] as const;

export type ProspekSumber = (typeof PROSPEK_SUMBER)[number];

export interface ProspekEntity {
  id: string;
  nama: string;
  noTelp: string;
  email: string | null;
  alamat: string;
  latitude: number | null;
  longitude: number | null;
  shareloc: string | null;
  sumber: ProspekSumber;
  iklanId: string | null;
  registrationId: string | null;
  referralNama: string | null;
  status: ProspekStatus;
  pemilikId: string | null;
  paketDiminati: string | null;
  catatan: string | null;
  canvasingId: string | null;
  konversiAt: Date | null;
  siteId: string | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2: Tulis test aturan prospek lebih dulu**

Create `tests/modules/presurvei/prospek-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";

/**
 * Aturan "kapan prospek boleh pindah status" hanya boleh punya satu definisi.
 * Kalau tersebar di service dan UI, prospek bisa berpindah lewat jalur yang
 * tidak diizinkan — misalnya langsung dari BARU ke DEAL tanpa pernah dihubungi.
 */

import {
  canPromosikanKeCanvasing,
  getStatusLanjutan,
  isStatusFinal,
  isTransisiStatusSah,
} from "@/modules/presurvei/domain/prospek-rules";

describe("isTransisiStatusSah", () => {
  it("mengizinkan alur maju satu langkah", () => {
    expect(isTransisiStatusSah("BARU", "DIHUBUNGI")).toBe(true);
    expect(isTransisiStatusSah("DIHUBUNGI", "TERTARIK")).toBe(true);
    expect(isTransisiStatusSah("TERTARIK", "NEGOSIASI")).toBe(true);
    expect(isTransisiStatusSah("NEGOSIASI", "DEAL")).toBe(true);
  });

  it("menolak lompatan yang melewati tahap", () => {
    expect(isTransisiStatusSah("BARU", "DEAL")).toBe(false);
    expect(isTransisiStatusSah("BARU", "NEGOSIASI")).toBe(false);
    expect(isTransisiStatusSah("DIHUBUNGI", "DEAL")).toBe(false);
  });

  it("mengizinkan penolakan dari tahap mana pun sebelum DEAL", () => {
    expect(isTransisiStatusSah("BARU", "TIDAK_MINAT")).toBe(true);
    expect(isTransisiStatusSah("DIHUBUNGI", "TIDAK_LAYAK")).toBe(true);
    expect(isTransisiStatusSah("NEGOSIASI", "TIDAK_MINAT")).toBe(true);
  });

  it("belum menganggap prospek baru tidak layak sebelum dihubungi", () => {
    expect(isTransisiStatusSah("BARU", "TIDAK_LAYAK")).toBe(false);
  });

  it("mengizinkan prospek yang menolak dibuka kembali", () => {
    expect(isTransisiStatusSah("TIDAK_MINAT", "DIHUBUNGI")).toBe(true);
  });

  it("mengunci status final", () => {
    expect(isTransisiStatusSah("DEAL", "NEGOSIASI")).toBe(false);
    expect(isTransisiStatusSah("TIDAK_LAYAK", "DIHUBUNGI")).toBe(false);
  });

  it("menolak transisi ke status yang sama", () => {
    expect(isTransisiStatusSah("TERTARIK", "TERTARIK")).toBe(false);
  });
});

describe("isStatusFinal", () => {
  it("menandai DEAL dan TIDAK_LAYAK sebagai final", () => {
    expect(isStatusFinal("DEAL")).toBe(true);
    expect(isStatusFinal("TIDAK_LAYAK")).toBe(true);
  });

  it("tidak menandai TIDAK_MINAT sebagai final karena bisa dibuka lagi", () => {
    expect(isStatusFinal("TIDAK_MINAT")).toBe(false);
  });
});

describe("getStatusLanjutan", () => {
  it("mengembalikan daftar kosong untuk status final", () => {
    expect(getStatusLanjutan("DEAL")).toEqual([]);
    expect(getStatusLanjutan("TIDAK_LAYAK")).toEqual([]);
  });

  it("mengembalikan semua tujuan yang sah dari NEGOSIASI", () => {
    expect(getStatusLanjutan("NEGOSIASI").sort()).toEqual(
      ["DEAL", "TIDAK_LAYAK", "TIDAK_MINAT"].sort(),
    );
  });
});

describe("canPromosikanKeCanvasing", () => {
  const prospekSiap = {
    status: "DEAL" as const,
    canvasingId: null,
    noTelp: "081234567890",
    alamat: "Jl. Merdeka 10",
  };

  it("mengizinkan prospek DEAL yang datanya lengkap", () => {
    expect(canPromosikanKeCanvasing(prospekSiap)).toBe(true);
  });

  it("menolak prospek yang belum DEAL", () => {
    expect(
      canPromosikanKeCanvasing({ ...prospekSiap, status: "NEGOSIASI" }),
    ).toBe(false);
  });

  it("menolak prospek yang sudah pernah dipromosikan", () => {
    expect(
      canPromosikanKeCanvasing({ ...prospekSiap, canvasingId: "canvasing-1" }),
    ).toBe(false);
  });

  it("menolak prospek tanpa nomor telepon atau alamat", () => {
    expect(canPromosikanKeCanvasing({ ...prospekSiap, noTelp: "" })).toBe(false);
    expect(canPromosikanKeCanvasing({ ...prospekSiap, alamat: "  " })).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2b: Jalankan test untuk memastikan gagal**

Run: `npx vitest run tests/modules/presurvei/prospek-rules.test.ts`
Expected: FAIL — `Failed to resolve import "@/modules/presurvei/domain/prospek-rules"`

- [ ] **Step 3: Tulis aturan prospek**

Create `modules/presurvei/domain/prospek-rules.ts`:

```ts
import type { ProspekEntity, ProspekStatus } from "./entities/Prospek";

/**
 * Aturan bisnis prospek presurvei — fungsi murni, tanpa I/O.
 *
 * Ditaruh terpisah dari service supaya bisa diuji tanpa database dan supaya
 * satu-satunya definisi "kapan prospek boleh pindah status" tidak tersebar.
 */

const TRANSISI_SAH: Record<ProspekStatus, ProspekStatus[]> = {
  BARU: ["DIHUBUNGI", "TIDAK_MINAT"],
  DIHUBUNGI: ["TERTARIK", "TIDAK_MINAT", "TIDAK_LAYAK"],
  TERTARIK: ["NEGOSIASI", "TIDAK_MINAT", "TIDAK_LAYAK"],
  NEGOSIASI: ["DEAL", "TIDAK_MINAT", "TIDAK_LAYAK"],
  DEAL: [],
  TIDAK_MINAT: ["DIHUBUNGI"],
  TIDAK_LAYAK: [],
};

/** Daftar status yang boleh dituju dari status saat ini. */
export function getStatusLanjutan(status: ProspekStatus): ProspekStatus[] {
  return TRANSISI_SAH[status];
}

/** Apakah perpindahan status prospek diizinkan aturan funnel. */
export function isTransisiStatusSah(
  dari: ProspekStatus,
  ke: ProspekStatus,
): boolean {
  return TRANSISI_SAH[dari].includes(ke);
}

/** Apakah prospek sudah mencapai akhir perjalanannya dan tidak bisa berubah lagi. */
export function isStatusFinal(status: ProspekStatus): boolean {
  return TRANSISI_SAH[status].length === 0;
}

/**
 * Apakah prospek siap dipromosikan menjadi canvasing.
 *
 * Syaratnya: sudah DEAL, belum pernah dipromosikan, dan data minimal untuk
 * membuat canvasing sudah terisi.
 */
export function canPromosikanKeCanvasing(
  prospek: Pick<
    ProspekEntity,
    "status" | "canvasingId" | "noTelp" | "alamat"
  >,
): boolean {
  if (prospek.status !== "DEAL") return false;
  if (prospek.canvasingId) return false;
  if (prospek.noTelp.trim().length === 0) return false;
  if (prospek.alamat.trim().length === 0) return false;
  return true;
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `npx vitest run tests/modules/presurvei/prospek-rules.test.ts`
Expected: PASS — 14 test lulus.

- [ ] **Step 5: Commit**

```bash
git add modules/presurvei/domain tests/modules/presurvei/prospek-rules.test.ts
git commit -m "feat(presurvei): tambah entity dan aturan transisi status prospek"
```

---

### Task 3: Domain kegiatan — entity dan aturan konsistensi

**Files:**
- Create: `modules/presurvei/domain/entities/Kegiatan.ts`
- Create: `modules/presurvei/domain/kegiatan-rules.ts`
- Test: `tests/modules/presurvei/kegiatan-rules.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `KEGIATAN_JENIS`, `KEGIATAN_HASIL` (const array), `KegiatanJenis`, `KegiatanHasil` (union type)
  - `KegiatanEntity` (interface)
  - `isButuhLokasi(jenis: KegiatanJenis): boolean`
  - `isButuhDataTeknis(jenis: KegiatanJenis): boolean`
  - `isButuhIklan(jenis: KegiatanJenis): boolean`
  - `isHasilMelahirkanProspek(hasil: KegiatanHasil): boolean`

- [ ] **Step 1: Tulis entity kegiatan**

Create `modules/presurvei/domain/entities/Kegiatan.ts`:

```ts
/**
 * Entitas domain kegiatan presurvei.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain.
 */

export const KEGIATAN_JENIS = [
  "KUNJUNGAN",
  "SURVEI_LOKASI",
  "TELEPON",
  "CHAT",
  "IKLAN",
] as const;

export type KegiatanJenis = (typeof KEGIATAN_JENIS)[number];

export const KEGIATAN_HASIL = [
  "TERTARIK",
  "PERLU_FOLLOWUP",
  "TIDAK_MINAT",
  "TIDAK_ADA_ORANG",
  "DEAL",
] as const;

export type KegiatanHasil = (typeof KEGIATAN_HASIL)[number];

export interface KegiatanEntity {
  id: string;
  jenis: KegiatanJenis;
  userId: string;
  prospekId: string | null;
  iklanId: string | null;
  waktuMulai: Date;
  waktuSelesai: Date | null;
  latitude: number | null;
  longitude: number | null;
  alamatDikunjungi: string | null;
  ditemuiNama: string | null;
  hasil: KegiatanHasil;
  catatan: string | null;
  fotoUrls: string[];
  odpTerdekat: string | null;
  estimasiKabelMeter: number | null;
  catatanTeknis: string | null;
  siteId: string | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 2: Tulis test aturan kegiatan lebih dulu**

Create `tests/modules/presurvei/kegiatan-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";

/**
 * Jenis kegiatan menentukan kolom mana yang masuk akal terisi. Tanpa aturan
 * terpusat, kegiatan TELEPON bisa menyimpan estimasi kabel dan laporan lapangan
 * jadi tidak bisa dipercaya.
 */

import {
  isButuhDataTeknis,
  isButuhIklan,
  isButuhLokasi,
  isHasilMelahirkanProspek,
} from "@/modules/presurvei/domain/kegiatan-rules";

describe("isButuhLokasi", () => {
  it("menuntut lokasi untuk kegiatan yang terjadi di lapangan", () => {
    expect(isButuhLokasi("KUNJUNGAN")).toBe(true);
    expect(isButuhLokasi("SURVEI_LOKASI")).toBe(true);
  });

  it("tidak menuntut lokasi untuk kegiatan jarak jauh", () => {
    expect(isButuhLokasi("TELEPON")).toBe(false);
    expect(isButuhLokasi("CHAT")).toBe(false);
    expect(isButuhLokasi("IKLAN")).toBe(false);
  });
});

describe("isButuhDataTeknis", () => {
  it("hanya survei lokasi yang membawa data teknis", () => {
    expect(isButuhDataTeknis("SURVEI_LOKASI")).toBe(true);
    expect(isButuhDataTeknis("KUNJUNGAN")).toBe(false);
    expect(isButuhDataTeknis("TELEPON")).toBe(false);
  });
});

describe("isButuhIklan", () => {
  it("hanya kegiatan iklan yang menunjuk ke sebuah iklan", () => {
    expect(isButuhIklan("IKLAN")).toBe(true);
    expect(isButuhIklan("KUNJUNGAN")).toBe(false);
  });
});

describe("isHasilMelahirkanProspek", () => {
  it("menganggap minat nyata sebagai prospek", () => {
    expect(isHasilMelahirkanProspek("TERTARIK")).toBe(true);
    expect(isHasilMelahirkanProspek("DEAL")).toBe(true);
  });

  it("tidak melahirkan prospek dari kunjungan yang belum membuahkan minat", () => {
    expect(isHasilMelahirkanProspek("PERLU_FOLLOWUP")).toBe(false);
    expect(isHasilMelahirkanProspek("TIDAK_MINAT")).toBe(false);
    expect(isHasilMelahirkanProspek("TIDAK_ADA_ORANG")).toBe(false);
  });
});
```

- [ ] **Step 2b: Jalankan test untuk memastikan gagal**

Run: `npx vitest run tests/modules/presurvei/kegiatan-rules.test.ts`
Expected: FAIL — `Failed to resolve import "@/modules/presurvei/domain/kegiatan-rules"`

- [ ] **Step 3: Tulis aturan kegiatan**

Create `modules/presurvei/domain/kegiatan-rules.ts`:

```ts
import type { KegiatanHasil, KegiatanJenis } from "./entities/Kegiatan";

/**
 * Aturan bisnis kegiatan presurvei — fungsi murni, tanpa I/O.
 *
 * Menentukan kolom mana yang masuk akal terisi untuk tiap jenis kegiatan, dan
 * kapan sebuah kegiatan pantas melahirkan prospek baru.
 */

const JENIS_DI_LAPANGAN: KegiatanJenis[] = ["KUNJUNGAN", "SURVEI_LOKASI"];
const JENIS_BERDATA_TEKNIS: KegiatanJenis[] = ["SURVEI_LOKASI"];
const JENIS_TERKAIT_IKLAN: KegiatanJenis[] = ["IKLAN"];
const HASIL_BERMINAT: KegiatanHasil[] = ["TERTARIK", "DEAL"];

/** Apakah jenis kegiatan ini terjadi di lokasi sehingga butuh koordinat. */
export function isButuhLokasi(jenis: KegiatanJenis): boolean {
  return JENIS_DI_LAPANGAN.includes(jenis);
}

/** Apakah jenis kegiatan ini boleh membawa hasil survei teknis. */
export function isButuhDataTeknis(jenis: KegiatanJenis): boolean {
  return JENIS_BERDATA_TEKNIS.includes(jenis);
}

/** Apakah jenis kegiatan ini harus menunjuk ke sebuah iklan. */
export function isButuhIklan(jenis: KegiatanJenis): boolean {
  return JENIS_TERKAIT_IKLAN.includes(jenis);
}

/** Apakah hasil kegiatan menunjukkan minat yang layak dicatat sebagai prospek. */
export function isHasilMelahirkanProspek(hasil: KegiatanHasil): boolean {
  return HASIL_BERMINAT.includes(hasil);
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `npx vitest run tests/modules/presurvei/kegiatan-rules.test.ts`
Expected: PASS — 8 test lulus.

- [ ] **Step 5: Commit**

```bash
git add modules/presurvei/domain tests/modules/presurvei/kegiatan-rules.test.ts
git commit -m "feat(presurvei): tambah entity dan aturan konsistensi kegiatan"
```

---

### Task 4: Port, mapper, dan repository prospek

**Files:**
- Create: `modules/presurvei/domain/ports/IProspekRepository.ts`
- Create: `modules/presurvei/mappers/prospek.mapper.ts`
- Create: `modules/presurvei/repositories/ProspekRepository.ts`
- Test: `tests/modules/presurvei/prospek-repository.test.ts`

**Interfaces:**
- Consumes: `ProspekEntity`, `ProspekStatus`, `ProspekSumber` (Task 2)
- Produces:
  - `IProspekRepository` dengan metode `findMany`, `findById`, `create`, `update`
  - `ProspekListFilters { status?, sumber?, pemilikId?, search?, page, limit }`
  - `CreateProspekInput`, `UpdateProspekInput`
  - `toProspekEntity(row: ProspekRow): ProspekEntity`
  - `class ProspekRepository implements IProspekRepository`

- [ ] **Step 1: Tulis port**

Create `modules/presurvei/domain/ports/IProspekRepository.ts`:

```ts
import type {
  ProspekEntity,
  ProspekStatus,
  ProspekSumber,
} from "../entities/Prospek";

/**
 * Kontrak akses data prospek presurvei.
 *
 * Service hanya bergantung pada antarmuka ini supaya aturan bisnisnya bisa
 * diuji tanpa database.
 */

export interface ProspekListFilters {
  status?: ProspekStatus;
  sumber?: ProspekSumber;
  pemilikId?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface CreateProspekInput {
  nama: string;
  noTelp: string;
  email?: string | null;
  alamat: string;
  latitude?: number | null;
  longitude?: number | null;
  shareloc?: string | null;
  sumber: ProspekSumber;
  iklanId?: string | null;
  registrationId?: string | null;
  referralNama?: string | null;
  pemilikId?: string | null;
  paketDiminati?: string | null;
  catatan?: string | null;
  siteId?: string | null;
}

export interface UpdateProspekInput {
  nama?: string;
  noTelp?: string;
  email?: string | null;
  alamat?: string;
  latitude?: number | null;
  longitude?: number | null;
  shareloc?: string | null;
  status?: ProspekStatus;
  pemilikId?: string | null;
  paketDiminati?: string | null;
  catatan?: string | null;
}

export interface IProspekRepository {
  findMany(
    filters: ProspekListFilters,
  ): Promise<{ items: ProspekEntity[]; total: number }>;
  findById(id: string): Promise<ProspekEntity | null>;
  create(input: CreateProspekInput): Promise<ProspekEntity>;
  update(id: string, input: UpdateProspekInput): Promise<ProspekEntity>;
}
```

- [ ] **Step 2: Tulis mapper**

Create `modules/presurvei/mappers/prospek.mapper.ts`:

```ts
import type {
  ProspekEntity,
  ProspekStatus,
  ProspekSumber,
} from "../domain/entities/Prospek";

/**
 * Pemetaan baris Prisma ke entitas domain prospek.
 *
 * Bentuk baris dideklarasikan struktural supaya folder mapper tidak perlu
 * mengimpor tipe Prisma, sehingga domain tetap bebas dari detail penyimpanan.
 */

export interface ProspekRow {
  id: string;
  nama: string;
  noTelp: string;
  email: string | null;
  alamat: string;
  latitude: number | null;
  longitude: number | null;
  shareloc: string | null;
  sumber: string;
  iklanId: string | null;
  registrationId: string | null;
  referralNama: string | null;
  status: string;
  pemilikId: string | null;
  paketDiminati: string | null;
  catatan: string | null;
  canvasingId: string | null;
  konversiAt: Date | null;
  siteId: string | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Ubah satu baris prospek dari database menjadi entitas domain. */
export function toProspekEntity(row: ProspekRow): ProspekEntity {
  return {
    id: row.id,
    nama: row.nama,
    noTelp: row.noTelp,
    email: row.email,
    alamat: row.alamat,
    latitude: row.latitude,
    longitude: row.longitude,
    shareloc: row.shareloc,
    sumber: row.sumber as ProspekSumber,
    iklanId: row.iklanId,
    registrationId: row.registrationId,
    referralNama: row.referralNama,
    status: row.status as ProspekStatus,
    pemilikId: row.pemilikId,
    paketDiminati: row.paketDiminati,
    catatan: row.catatan,
    canvasingId: row.canvasingId,
    konversiAt: row.konversiAt,
    siteId: row.siteId,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
```

- [ ] **Step 3: Tulis test repository lebih dulu**

Create `tests/modules/presurvei/prospek-repository.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Repository diuji dengan me-mock klien Prisma: yang diperiksa adalah bentuk
 * query yang dikirim (filter, paginasi, urutan), bukan perilaku database.
 * Filter tenantId sengaja tidak diperiksa karena ditegakkan oleh ekstensi
 * Prisma di lapisan database, bukan oleh repository.
 */

vi.mock("@/modules/database", () => ({
  prisma: {
    presurveiProspek: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/modules/database";
import { ProspekRepository } from "@/modules/presurvei/repositories/ProspekRepository";

const barisProspek = (over: Record<string, unknown> = {}) => ({
  id: "prospek-1",
  nama: "Budi",
  noTelp: "081234567890",
  email: null,
  alamat: "Jl. Merdeka 10",
  latitude: null,
  longitude: null,
  shareloc: null,
  sumber: "LAPANGAN",
  iklanId: null,
  registrationId: null,
  referralNama: null,
  status: "BARU",
  pemilikId: "user-1",
  paketDiminati: null,
  catatan: null,
  canvasingId: null,
  konversiAt: null,
  siteId: null,
  tenantId: "tenant-1",
  createdAt: new Date("2026-09-22T00:00:00.000Z"),
  updatedAt: new Date("2026-09-22T00:00:00.000Z"),
  ...over,
});

describe("ProspekRepository.findMany", () => {
  let repository: ProspekRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ProspekRepository();
  });

  it("menghitung lompatan halaman dari nomor halaman", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiProspek.count).mockResolvedValue(0 as never);

    await repository.findMany({ page: 3, limit: 20 });

    expect(prisma.presurveiProspek.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
  });

  it("mencari pada nama, nomor telepon, dan alamat sekaligus", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiProspek.count).mockResolvedValue(0 as never);

    await repository.findMany({ page: 1, limit: 10, search: "budi" });

    const argumen = vi.mocked(prisma.presurveiProspek.findMany).mock.calls[0][0];
    expect(argumen?.where?.OR).toHaveLength(3);
  });

  it("tidak menyaring apa pun saat tidak ada filter", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiProspek.count).mockResolvedValue(0 as never);

    await repository.findMany({ page: 1, limit: 10 });

    const argumen = vi.mocked(prisma.presurveiProspek.findMany).mock.calls[0][0];
    expect(argumen?.where).toEqual({});
  });

  it("mengembalikan entitas domain, bukan baris mentah", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([
      barisProspek(),
    ] as never);
    vi.mocked(prisma.presurveiProspek.count).mockResolvedValue(1 as never);

    const hasil = await repository.findMany({ page: 1, limit: 10 });

    expect(hasil.total).toBe(1);
    expect(hasil.items[0]).toMatchObject({ id: "prospek-1", status: "BARU" });
  });
});

describe("ProspekRepository.findById", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mengembalikan null saat prospek tidak ada", async () => {
    vi.mocked(prisma.presurveiProspek.findUnique).mockResolvedValue(
      null as never,
    );

    const hasil = await new ProspekRepository().findById("tidak-ada");

    expect(hasil).toBeNull();
  });
});
```

- [ ] **Step 3b: Jalankan test untuk memastikan gagal**

Run: `npx vitest run tests/modules/presurvei/prospek-repository.test.ts`
Expected: FAIL — `Failed to resolve import "@/modules/presurvei/repositories/ProspekRepository"`

- [ ] **Step 4: Tulis repository**

Create `modules/presurvei/repositories/ProspekRepository.ts`:

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import type { ProspekEntity } from "../domain/entities/Prospek";
import type {
  CreateProspekInput,
  IProspekRepository,
  ProspekListFilters,
  UpdateProspekInput,
} from "../domain/ports/IProspekRepository";
import { toProspekEntity, type ProspekRow } from "../mappers/prospek.mapper";

/**
 * Akses data prospek presurvei.
 *
 * Memakai klien Prisma ber-ekstensi isolasi tenant, sehingga penyaringan
 * tenantId ditegakkan di lapisan database dan tidak ditulis ulang di sini.
 */
export class ProspekRepository implements IProspekRepository {
  /** Ambil satu halaman prospek beserta jumlah totalnya. */
  async findMany(
    filters: ProspekListFilters,
  ): Promise<{ items: ProspekEntity[]; total: number }> {
    const where = this.bangunFilter(filters);

    const [rows, total] = await Promise.all([
      prisma.presurveiProspek.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.presurveiProspek.count({ where }),
    ]);

    return {
      items: rows.map((row) => toProspekEntity(row as ProspekRow)),
      total,
    };
  }

  /** Ambil satu prospek berdasarkan id, null bila tidak ditemukan. */
  async findById(id: string): Promise<ProspekEntity | null> {
    const row = await prisma.presurveiProspek.findUnique({ where: { id } });
    return row ? toProspekEntity(row as ProspekRow) : null;
  }

  /** Simpan prospek baru. */
  async create(input: CreateProspekInput): Promise<ProspekEntity> {
    const row = await prisma.presurveiProspek.create({ data: input });
    return toProspekEntity(row as ProspekRow);
  }

  /** Perbarui prospek yang sudah ada. */
  async update(
    id: string,
    input: UpdateProspekInput,
  ): Promise<ProspekEntity> {
    const row = await prisma.presurveiProspek.update({
      where: { id },
      data: input,
    });
    return toProspekEntity(row as ProspekRow);
  }

  private bangunFilter(
    filters: ProspekListFilters,
  ): Prisma.PresurveiProspekWhereInput {
    return {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.sumber ? { sumber: filters.sumber } : {}),
      ...(filters.pemilikId ? { pemilikId: filters.pemilikId } : {}),
      ...(filters.search
        ? {
            OR: [
              { nama: { contains: filters.search, mode: "insensitive" } },
              { noTelp: { contains: filters.search, mode: "insensitive" } },
              { alamat: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }
}
```

- [ ] **Step 5: Jalankan test untuk memastikan lulus**

Run: `npx vitest run tests/modules/presurvei/prospek-repository.test.ts`
Expected: PASS — 5 test lulus.

- [ ] **Step 6: Commit**

```bash
git add modules/presurvei tests/modules/presurvei/prospek-repository.test.ts
git commit -m "feat(presurvei): tambah port, mapper, dan repository prospek"
```

---

### Task 5: Port, mapper, dan repository kegiatan

**Files:**
- Create: `modules/presurvei/domain/ports/IKegiatanRepository.ts`
- Create: `modules/presurvei/mappers/kegiatan.mapper.ts`
- Create: `modules/presurvei/repositories/KegiatanRepository.ts`
- Test: `tests/modules/presurvei/kegiatan-repository.test.ts`

**Interfaces:**
- Consumes: `KegiatanEntity`, `KegiatanJenis`, `KegiatanHasil` (Task 3); `ProspekEntity`, `CreateProspekInput` (Task 2, Task 4)
- Produces:
  - `IKegiatanRepository` dengan `findMany`, `findById`, `create`, `createDenganProspek`
  - `KegiatanListFilters { userId?, jenis?, hasil?, prospekId?, dariTanggal?, sampaiTanggal?, page, limit }`
  - `CreateKegiatanInput`
  - `toKegiatanEntity(row: KegiatanRow): KegiatanEntity`
  - `class KegiatanRepository implements IKegiatanRepository`

`createDenganProspek` menyimpan kegiatan dan prospek dalam satu transaksi Prisma lalu menautkan keduanya — inilah alasan repository kegiatan punya metode di luar CRUD biasa.

- [ ] **Step 1: Tulis port**

Create `modules/presurvei/domain/ports/IKegiatanRepository.ts`:

```ts
import type {
  KegiatanEntity,
  KegiatanHasil,
  KegiatanJenis,
} from "../entities/Kegiatan";
import type { ProspekEntity } from "../entities/Prospek";
import type { CreateProspekInput } from "./IProspekRepository";

/**
 * Kontrak akses data kegiatan presurvei.
 *
 * Service hanya bergantung pada antarmuka ini supaya aturan bisnisnya bisa
 * diuji tanpa database.
 */

export interface KegiatanListFilters {
  userId?: string;
  jenis?: KegiatanJenis;
  hasil?: KegiatanHasil;
  prospekId?: string;
  dariTanggal?: Date;
  sampaiTanggal?: Date;
  page: number;
  limit: number;
}

export interface CreateKegiatanInput {
  jenis: KegiatanJenis;
  userId: string;
  prospekId?: string | null;
  iklanId?: string | null;
  waktuMulai: Date;
  waktuSelesai?: Date | null;
  latitude?: number | null;
  longitude?: number | null;
  alamatDikunjungi?: string | null;
  ditemuiNama?: string | null;
  hasil: KegiatanHasil;
  catatan?: string | null;
  fotoUrls?: string[];
  odpTerdekat?: string | null;
  estimasiKabelMeter?: number | null;
  catatanTeknis?: string | null;
  siteId?: string | null;
}

export interface IKegiatanRepository {
  findMany(
    filters: KegiatanListFilters,
  ): Promise<{ items: KegiatanEntity[]; total: number }>;
  findById(id: string): Promise<KegiatanEntity | null>;
  create(input: CreateKegiatanInput): Promise<KegiatanEntity>;
  /** Simpan kegiatan dan prospek barunya dalam satu transaksi, lalu tautkan. */
  createDenganProspek(
    kegiatan: CreateKegiatanInput,
    prospek: CreateProspekInput,
  ): Promise<{ kegiatan: KegiatanEntity; prospek: ProspekEntity }>;
}
```

- [ ] **Step 2: Tulis mapper**

Create `modules/presurvei/mappers/kegiatan.mapper.ts`:

```ts
import type {
  KegiatanEntity,
  KegiatanHasil,
  KegiatanJenis,
} from "../domain/entities/Kegiatan";

/**
 * Pemetaan baris Prisma ke entitas domain kegiatan.
 *
 * Bentuk baris dideklarasikan struktural supaya folder mapper tidak perlu
 * mengimpor tipe Prisma.
 */

export interface KegiatanRow {
  id: string;
  jenis: string;
  userId: string;
  prospekId: string | null;
  iklanId: string | null;
  waktuMulai: Date;
  waktuSelesai: Date | null;
  latitude: number | null;
  longitude: number | null;
  alamatDikunjungi: string | null;
  ditemuiNama: string | null;
  hasil: string;
  catatan: string | null;
  fotoUrls: string[];
  odpTerdekat: string | null;
  estimasiKabelMeter: number | null;
  catatanTeknis: string | null;
  siteId: string | null;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Ubah satu baris kegiatan dari database menjadi entitas domain. */
export function toKegiatanEntity(row: KegiatanRow): KegiatanEntity {
  return {
    id: row.id,
    jenis: row.jenis as KegiatanJenis,
    userId: row.userId,
    prospekId: row.prospekId,
    iklanId: row.iklanId,
    waktuMulai: row.waktuMulai,
    waktuSelesai: row.waktuSelesai,
    latitude: row.latitude,
    longitude: row.longitude,
    alamatDikunjungi: row.alamatDikunjungi,
    ditemuiNama: row.ditemuiNama,
    hasil: row.hasil as KegiatanHasil,
    catatan: row.catatan,
    fotoUrls: row.fotoUrls,
    odpTerdekat: row.odpTerdekat,
    estimasiKabelMeter: row.estimasiKabelMeter,
    catatanTeknis: row.catatanTeknis,
    siteId: row.siteId,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
```

- [ ] **Step 3: Tulis test repository lebih dulu**

Create `tests/modules/presurvei/kegiatan-repository.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kegiatan dan prospek yang lahir darinya harus tersimpan bersama atau tidak
 * sama sekali. Kalau kegiatan tersimpan tapi prospeknya gagal, laporan sales
 * menunjukkan kunjungan berhasil tanpa prospek yang bisa di-follow-up.
 */

const transaksiTerpanggil = vi.fn();

vi.mock("@/modules/database", () => ({
  prisma: {
    presurveiKegiatan: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: (jalankan: (tx: unknown) => Promise<unknown>) => {
      transaksiTerpanggil();
      return jalankan({
        presurveiProspek: {
          create: vi.fn().mockResolvedValue({
            id: "prospek-baru",
            nama: "Budi",
            noTelp: "081234567890",
            email: null,
            alamat: "Jl. Merdeka 10",
            latitude: null,
            longitude: null,
            shareloc: null,
            sumber: "LAPANGAN",
            iklanId: null,
            registrationId: null,
            referralNama: null,
            status: "BARU",
            pemilikId: "user-1",
            paketDiminati: null,
            catatan: null,
            canvasingId: null,
            konversiAt: null,
            siteId: null,
            tenantId: "tenant-1",
            createdAt: new Date("2026-09-22T00:00:00.000Z"),
            updatedAt: new Date("2026-09-22T00:00:00.000Z"),
          }),
        },
        presurveiKegiatan: {
          create: vi.fn().mockResolvedValue({
            id: "kegiatan-baru",
            jenis: "KUNJUNGAN",
            userId: "user-1",
            prospekId: "prospek-baru",
            iklanId: null,
            waktuMulai: new Date("2026-09-22T01:00:00.000Z"),
            waktuSelesai: null,
            latitude: -6.2,
            longitude: 106.8,
            alamatDikunjungi: "Jl. Merdeka 10",
            ditemuiNama: "Budi",
            hasil: "TERTARIK",
            catatan: null,
            fotoUrls: [],
            odpTerdekat: null,
            estimasiKabelMeter: null,
            catatanTeknis: null,
            siteId: null,
            tenantId: "tenant-1",
            createdAt: new Date("2026-09-22T01:00:00.000Z"),
            updatedAt: new Date("2026-09-22T01:00:00.000Z"),
          }),
        },
      });
    },
  },
}));

import { prisma } from "@/modules/database";
import { KegiatanRepository } from "@/modules/presurvei/repositories/KegiatanRepository";

describe("KegiatanRepository.findMany", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menyaring rentang tanggal pada waktu mulai", async () => {
    vi.mocked(prisma.presurveiKegiatan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiKegiatan.count).mockResolvedValue(0 as never);

    await new KegiatanRepository().findMany({
      page: 1,
      limit: 10,
      dariTanggal: new Date("2026-09-01T00:00:00.000Z"),
      sampaiTanggal: new Date("2026-09-30T00:00:00.000Z"),
    });

    const argumen = vi.mocked(prisma.presurveiKegiatan.findMany).mock.calls[0][0];
    expect(argumen?.where?.waktuMulai).toEqual({
      gte: new Date("2026-09-01T00:00:00.000Z"),
      lte: new Date("2026-09-30T00:00:00.000Z"),
    });
  });

  it("mengurutkan kegiatan terbaru lebih dulu", async () => {
    vi.mocked(prisma.presurveiKegiatan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiKegiatan.count).mockResolvedValue(0 as never);

    await new KegiatanRepository().findMany({ page: 1, limit: 10 });

    const argumen = vi.mocked(prisma.presurveiKegiatan.findMany).mock.calls[0][0];
    expect(argumen?.orderBy).toEqual({ waktuMulai: "desc" });
  });
});

describe("KegiatanRepository.createDenganProspek", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menyimpan keduanya dalam satu transaksi dan menautkan prospek ke kegiatan", async () => {
    const hasil = await new KegiatanRepository().createDenganProspek(
      {
        jenis: "KUNJUNGAN",
        userId: "user-1",
        waktuMulai: new Date("2026-09-22T01:00:00.000Z"),
        hasil: "TERTARIK",
      },
      {
        nama: "Budi",
        noTelp: "081234567890",
        alamat: "Jl. Merdeka 10",
        sumber: "LAPANGAN",
        pemilikId: "user-1",
      },
    );

    expect(transaksiTerpanggil).toHaveBeenCalledOnce();
    expect(hasil.prospek.id).toBe("prospek-baru");
    expect(hasil.kegiatan.prospekId).toBe("prospek-baru");
  });
});
```

- [ ] **Step 3b: Jalankan test untuk memastikan gagal**

Run: `npx vitest run tests/modules/presurvei/kegiatan-repository.test.ts`
Expected: FAIL — `Failed to resolve import "@/modules/presurvei/repositories/KegiatanRepository"`

- [ ] **Step 4: Tulis repository**

Create `modules/presurvei/repositories/KegiatanRepository.ts`:

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import type { KegiatanEntity } from "../domain/entities/Kegiatan";
import type { ProspekEntity } from "../domain/entities/Prospek";
import type {
  CreateKegiatanInput,
  IKegiatanRepository,
  KegiatanListFilters,
} from "../domain/ports/IKegiatanRepository";
import type { CreateProspekInput } from "../domain/ports/IProspekRepository";
import { toKegiatanEntity, type KegiatanRow } from "../mappers/kegiatan.mapper";
import { toProspekEntity, type ProspekRow } from "../mappers/prospek.mapper";

/**
 * Akses data kegiatan presurvei.
 *
 * Memakai klien Prisma ber-ekstensi isolasi tenant, sehingga penyaringan
 * tenantId ditegakkan di lapisan database dan tidak ditulis ulang di sini.
 */
export class KegiatanRepository implements IKegiatanRepository {
  /** Ambil satu halaman kegiatan beserta jumlah totalnya. */
  async findMany(
    filters: KegiatanListFilters,
  ): Promise<{ items: KegiatanEntity[]; total: number }> {
    const where = this.bangunFilter(filters);

    const [rows, total] = await Promise.all([
      prisma.presurveiKegiatan.findMany({
        where,
        orderBy: { waktuMulai: "desc" },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.presurveiKegiatan.count({ where }),
    ]);

    return {
      items: rows.map((row) => toKegiatanEntity(row as KegiatanRow)),
      total,
    };
  }

  /** Ambil satu kegiatan berdasarkan id, null bila tidak ditemukan. */
  async findById(id: string): Promise<KegiatanEntity | null> {
    const row = await prisma.presurveiKegiatan.findUnique({ where: { id } });
    return row ? toKegiatanEntity(row as KegiatanRow) : null;
  }

  /** Simpan kegiatan baru tanpa membuat prospek. */
  async create(input: CreateKegiatanInput): Promise<KegiatanEntity> {
    const row = await prisma.presurveiKegiatan.create({ data: input });
    return toKegiatanEntity(row as KegiatanRow);
  }

  /**
   * Simpan kegiatan beserta prospek yang lahir darinya dalam satu transaksi.
   *
   * Keduanya berada di modul yang sama sehingga cukup satu transaksi Prisma —
   * tidak perlu pola kompensasi seperti pada operasi lintas modul.
   */
  async createDenganProspek(
    kegiatan: CreateKegiatanInput,
    prospek: CreateProspekInput,
  ): Promise<{ kegiatan: KegiatanEntity; prospek: ProspekEntity }> {
    return prisma.$transaction(async (tx) => {
      const barisProspek = await tx.presurveiProspek.create({ data: prospek });
      const barisKegiatan = await tx.presurveiKegiatan.create({
        data: { ...kegiatan, prospekId: barisProspek.id },
      });

      return {
        kegiatan: toKegiatanEntity(barisKegiatan as KegiatanRow),
        prospek: toProspekEntity(barisProspek as ProspekRow),
      };
    });
  }

  private bangunFilter(
    filters: KegiatanListFilters,
  ): Prisma.PresurveiKegiatanWhereInput {
    const rentangWaktu =
      filters.dariTanggal || filters.sampaiTanggal
        ? {
            waktuMulai: {
              ...(filters.dariTanggal ? { gte: filters.dariTanggal } : {}),
              ...(filters.sampaiTanggal ? { lte: filters.sampaiTanggal } : {}),
            },
          }
        : {};

    return {
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.jenis ? { jenis: filters.jenis } : {}),
      ...(filters.hasil ? { hasil: filters.hasil } : {}),
      ...(filters.prospekId ? { prospekId: filters.prospekId } : {}),
      ...rentangWaktu,
    };
  }
}
```

- [ ] **Step 5: Jalankan test untuk memastikan lulus**

Run: `npx vitest run tests/modules/presurvei/kegiatan-repository.test.ts`
Expected: PASS — 3 test lulus.

- [ ] **Step 6: Commit**

```bash
git add modules/presurvei tests/modules/presurvei/kegiatan-repository.test.ts
git commit -m "feat(presurvei): tambah port, mapper, dan repository kegiatan"
```

---

### Task 6: Validator dan ProspekService

**Files:**
- Create: `modules/presurvei/validators/prospek.validator.ts`
- Create: `modules/presurvei/services/ProspekService.ts`
- Test: `tests/modules/presurvei/prospek-service.test.ts`

**Interfaces:**
- Consumes: `IProspekRepository`, `ProspekListFilters`, `CreateProspekInput`, `UpdateProspekInput` (Task 4); `isTransisiStatusSah` (Task 2)
- Produces:
  - `buatProspekSchema`, `ubahProspekSchema`, `daftarProspekSchema` (Zod)
  - `class ProspekService` dengan `daftar(filters)`, `detail(id)`, `buat(input)`, `ubah(id, input)`

- [ ] **Step 1: Tulis validator**

Create `modules/presurvei/validators/prospek.validator.ts`:

```ts
import { z } from "zod";
import {
  PROSPEK_STATUSES,
  PROSPEK_SUMBER,
} from "../domain/entities/Prospek";

/**
 * Validasi masukan prospek presurvei.
 *
 * Nilai enum diturunkan dari const array domain supaya tidak ada dua definisi
 * status yang bisa berbeda.
 */

const PANJANG_NAMA_MIN = 2;
const PANJANG_NAMA_MAKS = 120;
const PANJANG_TELP_MIN = 8;
const PANJANG_TELP_MAKS = 20;
const PANJANG_ALAMAT_MIN = 5;
const PANJANG_ALAMAT_MAKS = 500;
const PANJANG_CATATAN_MAKS = 1000;
const BATAS_HALAMAN_MAKS = 100;
const ISI_HALAMAN_BAWAAN = 20;

export const buatProspekSchema = z.object({
  nama: z.string().min(PANJANG_NAMA_MIN).max(PANJANG_NAMA_MAKS),
  noTelp: z
    .string()
    .min(PANJANG_TELP_MIN, "Nomor telepon minimal 8 digit")
    .max(PANJANG_TELP_MAKS),
  email: z.string().email("Format email tidak valid").optional().nullable(),
  alamat: z.string().min(PANJANG_ALAMAT_MIN).max(PANJANG_ALAMAT_MAKS),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  shareloc: z.string().url("Tautan lokasi tidak valid").optional().nullable(),
  sumber: z.enum(PROSPEK_SUMBER),
  iklanId: z.string().optional().nullable(),
  referralNama: z.string().max(PANJANG_NAMA_MAKS).optional().nullable(),
  pemilikId: z.string().optional().nullable(),
  paketDiminati: z.string().max(PANJANG_NAMA_MAKS).optional().nullable(),
  catatan: z.string().max(PANJANG_CATATAN_MAKS).optional().nullable(),
  siteId: z.string().optional().nullable(),
});

export const ubahProspekSchema = z.object({
  nama: z.string().min(PANJANG_NAMA_MIN).max(PANJANG_NAMA_MAKS).optional(),
  noTelp: z.string().min(PANJANG_TELP_MIN).max(PANJANG_TELP_MAKS).optional(),
  email: z.string().email().optional().nullable(),
  alamat: z.string().min(PANJANG_ALAMAT_MIN).max(PANJANG_ALAMAT_MAKS).optional(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  shareloc: z.string().url().optional().nullable(),
  status: z.enum(PROSPEK_STATUSES).optional(),
  pemilikId: z.string().optional().nullable(),
  paketDiminati: z.string().max(PANJANG_NAMA_MAKS).optional().nullable(),
  catatan: z.string().max(PANJANG_CATATAN_MAKS).optional().nullable(),
});

export const daftarProspekSchema = z.object({
  status: z.enum(PROSPEK_STATUSES).optional(),
  sumber: z.enum(PROSPEK_SUMBER).optional(),
  pemilikId: z.string().optional(),
  search: z.string().max(PANJANG_NAMA_MAKS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(BATAS_HALAMAN_MAKS)
    .default(ISI_HALAMAN_BAWAAN),
});
```

- [ ] **Step 2: Tulis test service lebih dulu**

Create `tests/modules/presurvei/prospek-service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Service prospek adalah satu-satunya penjaga aturan funnel. Kalau perubahan
 * status bisa menembusnya, prospek bisa melompat dari BARU ke DEAL tanpa
 * pernah dihubungi dan laporan konversi jadi menyesatkan.
 */

import { ProspekService } from "@/modules/presurvei/services/ProspekService";
import type { IProspekRepository } from "@/modules/presurvei/domain/ports/IProspekRepository";
import type { ProspekEntity } from "@/modules/presurvei/domain/entities/Prospek";

const prospek = (over: Partial<ProspekEntity> = {}): ProspekEntity => ({
  id: "prospek-1",
  nama: "Budi",
  noTelp: "081234567890",
  email: null,
  alamat: "Jl. Merdeka 10",
  latitude: null,
  longitude: null,
  shareloc: null,
  sumber: "LAPANGAN",
  iklanId: null,
  registrationId: null,
  referralNama: null,
  status: "BARU",
  pemilikId: "user-1",
  paketDiminati: null,
  catatan: null,
  canvasingId: null,
  konversiAt: null,
  siteId: null,
  tenantId: "tenant-1",
  createdAt: new Date("2026-09-22T00:00:00.000Z"),
  updatedAt: new Date("2026-09-22T00:00:00.000Z"),
  ...over,
});

const bangunRepository = (): IProspekRepository => ({
  findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  findById: vi.fn().mockResolvedValue(null),
  create: vi.fn(),
  update: vi.fn(),
});

describe("ProspekService.detail", () => {
  let repository: IProspekRepository;

  beforeEach(() => {
    repository = bangunRepository();
  });

  it("melempar 404 saat prospek tidak ditemukan", async () => {
    const service = new ProspekService(repository);

    await expect(service.detail("tidak-ada")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });

  it("mengembalikan prospek yang ditemukan", async () => {
    vi.mocked(repository.findById).mockResolvedValue(prospek());
    const service = new ProspekService(repository);

    const hasil = await service.detail("prospek-1");

    expect(hasil.id).toBe("prospek-1");
  });
});

describe("ProspekService.ubah", () => {
  let repository: IProspekRepository;

  beforeEach(() => {
    repository = bangunRepository();
  });

  it("menolak lompatan status yang melanggar aturan funnel", async () => {
    vi.mocked(repository.findById).mockResolvedValue(prospek({ status: "BARU" }));
    const service = new ProspekService(repository);

    await expect(
      service.ubah("prospek-1", { status: "DEAL" }),
    ).rejects.toMatchObject({ statusCode: 409, code: "INVALID_STATE" });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("mengizinkan perpindahan status satu langkah", async () => {
    vi.mocked(repository.findById).mockResolvedValue(prospek({ status: "BARU" }));
    vi.mocked(repository.update).mockResolvedValue(
      prospek({ status: "DIHUBUNGI" }),
    );
    const service = new ProspekService(repository);

    const hasil = await service.ubah("prospek-1", { status: "DIHUBUNGI" });

    expect(hasil.status).toBe("DIHUBUNGI");
    expect(repository.update).toHaveBeenCalledWith("prospek-1", {
      status: "DIHUBUNGI",
    });
  });

  it("melewati pemeriksaan status saat yang diubah hanya data kontak", async () => {
    vi.mocked(repository.findById).mockResolvedValue(prospek({ status: "DEAL" }));
    vi.mocked(repository.update).mockResolvedValue(
      prospek({ status: "DEAL", catatan: "sudah dihubungi ulang" }),
    );
    const service = new ProspekService(repository);

    await service.ubah("prospek-1", { catatan: "sudah dihubungi ulang" });

    expect(repository.update).toHaveBeenCalledOnce();
  });

  it("melempar 404 saat prospek yang diubah tidak ada", async () => {
    const service = new ProspekService(repository);

    await expect(
      service.ubah("tidak-ada", { catatan: "apa pun" }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("ProspekService.buat", () => {
  it("meneruskan masukan apa adanya ke repository", async () => {
    const repository = bangunRepository();
    vi.mocked(repository.create).mockResolvedValue(prospek());
    const service = new ProspekService(repository);

    await service.buat({
      nama: "Budi",
      noTelp: "081234567890",
      alamat: "Jl. Merdeka 10",
      sumber: "WALK_IN",
      pemilikId: "user-1",
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ sumber: "WALK_IN" }),
    );
  });
});
```

- [ ] **Step 2b: Jalankan test untuk memastikan gagal**

Run: `npx vitest run tests/modules/presurvei/prospek-service.test.ts`
Expected: FAIL — `Failed to resolve import "@/modules/presurvei/services/ProspekService"`

- [ ] **Step 3: Tulis service**

Create `modules/presurvei/services/ProspekService.ts`:

```ts
import { AppError } from "@/lib/errors";
import type { ProspekEntity } from "../domain/entities/Prospek";
import { isTransisiStatusSah } from "../domain/prospek-rules";
import type {
  CreateProspekInput,
  IProspekRepository,
  ProspekListFilters,
  UpdateProspekInput,
} from "../domain/ports/IProspekRepository";
import { ProspekRepository } from "../repositories/ProspekRepository";

/**
 * Orkestrasi prospek presurvei.
 *
 * Menjaga agar perpindahan status hanya terjadi lewat jalur yang diizinkan
 * aturan funnel di domain.
 */
export class ProspekService {
  constructor(
    private readonly repository: IProspekRepository = new ProspekRepository(),
  ) {}

  /** Ambil satu halaman prospek sesuai filter. */
  async daftar(
    filters: ProspekListFilters,
  ): Promise<{ items: ProspekEntity[]; total: number }> {
    return this.repository.findMany(filters);
  }

  /** Ambil satu prospek, melempar 404 bila tidak ada. */
  async detail(id: string): Promise<ProspekEntity> {
    const prospek = await this.repository.findById(id);
    if (!prospek) {
      throw new AppError("Prospek tidak ditemukan", 404, "NOT_FOUND");
    }
    return prospek;
  }

  /** Simpan prospek baru. */
  async buat(input: CreateProspekInput): Promise<ProspekEntity> {
    return this.repository.create(input);
  }

  /** Perbarui prospek, menolak perpindahan status yang tidak sah. */
  async ubah(id: string, input: UpdateProspekInput): Promise<ProspekEntity> {
    const prospek = await this.detail(id);

    if (input.status && input.status !== prospek.status) {
      if (!isTransisiStatusSah(prospek.status, input.status)) {
        throw new AppError(
          `Prospek berstatus ${prospek.status} tidak bisa langsung dipindah ke ${input.status}`,
          409,
          "INVALID_STATE",
        );
      }
    }

    return this.repository.update(id, input);
  }
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `npx vitest run tests/modules/presurvei/prospek-service.test.ts`
Expected: PASS — 7 test lulus.

- [ ] **Step 5: Commit**

```bash
git add modules/presurvei tests/modules/presurvei/prospek-service.test.ts
git commit -m "feat(presurvei): tambah validator dan service prospek"
```

---

### Task 7: Validator dan KegiatanService

**Files:**
- Create: `modules/presurvei/validators/kegiatan.validator.ts`
- Create: `modules/presurvei/services/KegiatanService.ts`
- Test: `tests/modules/presurvei/kegiatan-service.test.ts`

**Interfaces:**
- Consumes: `IKegiatanRepository`, `CreateKegiatanInput`, `KegiatanListFilters` (Task 5); `isButuhDataTeknis`, `isButuhIklan`, `isButuhLokasi`, `isHasilMelahirkanProspek` (Task 3)
- Produces:
  - `catatKegiatanSchema`, `daftarKegiatanSchema` (Zod)
  - `class KegiatanService` dengan `daftar(filters)`, `detail(id)`, `catat(input, prospekBaru?)`
  - `CatatKegiatanInput = CreateKegiatanInput & { prospekBaru?: DataProspekBaru }`
  - `DataProspekBaru { nama, noTelp, alamat, email?, paketDiminati? }`

- [ ] **Step 1: Tulis validator**

Create `modules/presurvei/validators/kegiatan.validator.ts`:

```ts
import { z } from "zod";
import {
  KEGIATAN_HASIL,
  KEGIATAN_JENIS,
} from "../domain/entities/Kegiatan";
import {
  isButuhDataTeknis,
  isButuhIklan,
  isButuhLokasi,
} from "../domain/kegiatan-rules";

/**
 * Validasi masukan kegiatan presurvei.
 *
 * Selain memeriksa tiap field, skema ini menegakkan konsistensi antara jenis
 * kegiatan dan kolom yang menyertainya: kunjungan wajib berkoordinat, data
 * teknis hanya boleh ikut pada survei lokasi.
 */

const PANJANG_NAMA_MAKS = 120;
const PANJANG_ALAMAT_MAKS = 500;
const PANJANG_CATATAN_MAKS = 1000;
const JUMLAH_FOTO_MAKS = 6;
const KABEL_METER_MAKS = 5000;
const BATAS_HALAMAN_MAKS = 100;
const ISI_HALAMAN_BAWAAN = 20;

const dataProspekBaruSchema = z.object({
  nama: z.string().min(2).max(PANJANG_NAMA_MAKS),
  noTelp: z.string().min(8).max(20),
  alamat: z.string().min(5).max(PANJANG_ALAMAT_MAKS),
  email: z.string().email().optional().nullable(),
  paketDiminati: z.string().max(PANJANG_NAMA_MAKS).optional().nullable(),
});

export const catatKegiatanSchema = z
  .object({
    jenis: z.enum(KEGIATAN_JENIS),
    prospekId: z.string().optional().nullable(),
    iklanId: z.string().optional().nullable(),
    waktuMulai: z.coerce.date(),
    waktuSelesai: z.coerce.date().optional().nullable(),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    alamatDikunjungi: z.string().max(PANJANG_ALAMAT_MAKS).optional().nullable(),
    ditemuiNama: z.string().max(PANJANG_NAMA_MAKS).optional().nullable(),
    hasil: z.enum(KEGIATAN_HASIL),
    catatan: z.string().max(PANJANG_CATATAN_MAKS).optional().nullable(),
    fotoUrls: z.array(z.string().url()).max(JUMLAH_FOTO_MAKS).default([]),
    odpTerdekat: z.string().max(PANJANG_NAMA_MAKS).optional().nullable(),
    estimasiKabelMeter: z
      .number()
      .int()
      .min(0)
      .max(KABEL_METER_MAKS)
      .optional()
      .nullable(),
    catatanTeknis: z.string().max(PANJANG_CATATAN_MAKS).optional().nullable(),
    siteId: z.string().optional().nullable(),
    prospekBaru: dataProspekBaruSchema.optional(),
  })
  .refine(
    (kegiatan) =>
      !isButuhLokasi(kegiatan.jenis) ||
      (kegiatan.latitude !== null &&
        kegiatan.latitude !== undefined &&
        kegiatan.longitude !== null &&
        kegiatan.longitude !== undefined),
    { message: "Kunjungan dan survei lokasi wajib menyertakan koordinat" },
  )
  .refine(
    (kegiatan) =>
      isButuhDataTeknis(kegiatan.jenis) ||
      (!kegiatan.odpTerdekat &&
        !kegiatan.estimasiKabelMeter &&
        !kegiatan.catatanTeknis),
    { message: "Data teknis hanya boleh diisi pada survei lokasi" },
  )
  .refine(
    (kegiatan) => !isButuhIklan(kegiatan.jenis) || Boolean(kegiatan.iklanId),
    { message: "Kegiatan iklan wajib menunjuk ke sebuah iklan" },
  );

export const daftarKegiatanSchema = z.object({
  userId: z.string().optional(),
  jenis: z.enum(KEGIATAN_JENIS).optional(),
  hasil: z.enum(KEGIATAN_HASIL).optional(),
  prospekId: z.string().optional(),
  dariTanggal: z.coerce.date().optional(),
  sampaiTanggal: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(BATAS_HALAMAN_MAKS)
    .default(ISI_HALAMAN_BAWAAN),
});
```

- [ ] **Step 2: Tulis test service lebih dulu**

Create `tests/modules/presurvei/kegiatan-service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kunjungan yang membuahkan minat harus langsung melahirkan prospek. Kalau
 * tidak, sales harus mengetik ulang data yang sama dan prospeknya sering tidak
 * pernah dibuat — kunjungan berhasil pun hilang jejaknya.
 */

import { KegiatanService } from "@/modules/presurvei/services/KegiatanService";
import type { IKegiatanRepository } from "@/modules/presurvei/domain/ports/IKegiatanRepository";
import type { KegiatanEntity } from "@/modules/presurvei/domain/entities/Kegiatan";
import type { ProspekEntity } from "@/modules/presurvei/domain/entities/Prospek";

const WAKTU_KUNJUNGAN = new Date("2026-09-22T01:00:00.000Z");

const kegiatan = (over: Partial<KegiatanEntity> = {}): KegiatanEntity => ({
  id: "kegiatan-1",
  jenis: "KUNJUNGAN",
  userId: "user-1",
  prospekId: null,
  iklanId: null,
  waktuMulai: WAKTU_KUNJUNGAN,
  waktuSelesai: null,
  latitude: -6.2,
  longitude: 106.8,
  alamatDikunjungi: "Jl. Merdeka 10",
  ditemuiNama: "Budi",
  hasil: "PERLU_FOLLOWUP",
  catatan: null,
  fotoUrls: [],
  odpTerdekat: null,
  estimasiKabelMeter: null,
  catatanTeknis: null,
  siteId: null,
  tenantId: "tenant-1",
  createdAt: WAKTU_KUNJUNGAN,
  updatedAt: WAKTU_KUNJUNGAN,
  ...over,
});

const prospek = (over: Partial<ProspekEntity> = {}): ProspekEntity =>
  ({
    id: "prospek-1",
    nama: "Budi",
    noTelp: "081234567890",
    alamat: "Jl. Merdeka 10",
    sumber: "LAPANGAN",
    status: "BARU",
    pemilikId: "user-1",
    tenantId: "tenant-1",
    createdAt: WAKTU_KUNJUNGAN,
    updatedAt: WAKTU_KUNJUNGAN,
    ...over,
  }) as ProspekEntity;

const bangunRepository = (): IKegiatanRepository => ({
  findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  findById: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue(kegiatan()),
  createDenganProspek: vi
    .fn()
    .mockResolvedValue({ kegiatan: kegiatan(), prospek: prospek() }),
});

const masukanKunjungan = {
  jenis: "KUNJUNGAN" as const,
  userId: "user-1",
  waktuMulai: WAKTU_KUNJUNGAN,
  latitude: -6.2,
  longitude: 106.8,
  alamatDikunjungi: "Jl. Merdeka 10",
  ditemuiNama: "Budi",
  hasil: "PERLU_FOLLOWUP" as const,
};

describe("KegiatanService.catat", () => {
  let repository: IKegiatanRepository;

  beforeEach(() => {
    repository = bangunRepository();
  });

  it("menyimpan kegiatan saja saat hasilnya belum menunjukkan minat", async () => {
    const service = new KegiatanService(repository);

    await service.catat(masukanKunjungan);

    expect(repository.create).toHaveBeenCalledOnce();
    expect(repository.createDenganProspek).not.toHaveBeenCalled();
  });

  it("membuat prospek saat hasilnya TERTARIK dan data prospek disertakan", async () => {
    const service = new KegiatanService(repository);

    const hasil = await service.catat({
      ...masukanKunjungan,
      hasil: "TERTARIK",
      prospekBaru: {
        nama: "Budi",
        noTelp: "081234567890",
        alamat: "Jl. Merdeka 10",
      },
    });

    expect(repository.createDenganProspek).toHaveBeenCalledOnce();
    expect(hasil.prospek?.id).toBe("prospek-1");
  });

  it("menurunkan sumber prospek dari jenis kegiatan lapangan", async () => {
    const service = new KegiatanService(repository);

    await service.catat({
      ...masukanKunjungan,
      hasil: "DEAL",
      prospekBaru: {
        nama: "Budi",
        noTelp: "081234567890",
        alamat: "Jl. Merdeka 10",
      },
    });

    const [, prospekDibuat] = vi.mocked(repository.createDenganProspek).mock
      .calls[0];
    expect(prospekDibuat).toMatchObject({
      sumber: "LAPANGAN",
      pemilikId: "user-1",
    });
  });

  it("tetap menyimpan kegiatan tanpa prospek saat data prospek tidak disertakan", async () => {
    const service = new KegiatanService(repository);

    const hasil = await service.catat({
      ...masukanKunjungan,
      hasil: "TERTARIK",
    });

    expect(repository.create).toHaveBeenCalledOnce();
    expect(repository.createDenganProspek).not.toHaveBeenCalled();
    expect(hasil.prospek).toBeNull();
  });

  it("tidak membuat prospek baru saat kegiatan sudah menempel ke prospek lama", async () => {
    const service = new KegiatanService(repository);

    await service.catat({
      ...masukanKunjungan,
      hasil: "TERTARIK",
      prospekId: "prospek-lama",
      prospekBaru: {
        nama: "Budi",
        noTelp: "081234567890",
        alamat: "Jl. Merdeka 10",
      },
    });

    expect(repository.create).toHaveBeenCalledOnce();
    expect(repository.createDenganProspek).not.toHaveBeenCalled();
  });
});

describe("KegiatanService.detail", () => {
  it("melempar 404 saat kegiatan tidak ditemukan", async () => {
    const service = new KegiatanService(bangunRepository());

    await expect(service.detail("tidak-ada")).rejects.toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
  });
});
```

- [ ] **Step 2b: Jalankan test untuk memastikan gagal**

Run: `npx vitest run tests/modules/presurvei/kegiatan-service.test.ts`
Expected: FAIL — `Failed to resolve import "@/modules/presurvei/services/KegiatanService"`

- [ ] **Step 3: Tulis service**

Create `modules/presurvei/services/KegiatanService.ts`:

```ts
import { AppError } from "@/lib/errors";
import type { KegiatanEntity } from "../domain/entities/Kegiatan";
import type {
  ProspekEntity,
  ProspekSumber,
} from "../domain/entities/Prospek";
import { isHasilMelahirkanProspek } from "../domain/kegiatan-rules";
import type {
  CreateKegiatanInput,
  IKegiatanRepository,
  KegiatanListFilters,
} from "../domain/ports/IKegiatanRepository";
import type { CreateProspekInput } from "../domain/ports/IProspekRepository";
import { KegiatanRepository } from "../repositories/KegiatanRepository";

/** Data minimal untuk melahirkan prospek dari sebuah kegiatan. */
export interface DataProspekBaru {
  nama: string;
  noTelp: string;
  alamat: string;
  email?: string | null;
  paketDiminati?: string | null;
}

export type CatatKegiatanInput = CreateKegiatanInput & {
  prospekBaru?: DataProspekBaru;
};

/** Hasil pencatatan kegiatan: prospek terisi hanya bila kegiatan melahirkan satu. */
export interface HasilCatatKegiatan {
  kegiatan: KegiatanEntity;
  prospek: ProspekEntity | null;
}

const SUMBER_PER_JENIS: Record<string, ProspekSumber> = {
  KUNJUNGAN: "LAPANGAN",
  SURVEI_LOKASI: "LAPANGAN",
  TELEPON: "WALK_IN",
  CHAT: "WALK_IN",
  IKLAN: "IKLAN",
};

/**
 * Orkestrasi kegiatan presurvei.
 *
 * Kegiatan yang membuahkan minat dan membawa data calon pelanggan langsung
 * melahirkan prospek, supaya sales tidak perlu mengetik ulang data yang sama.
 */
export class KegiatanService {
  constructor(
    private readonly repository: IKegiatanRepository = new KegiatanRepository(),
  ) {}

  /** Ambil satu halaman kegiatan sesuai filter. */
  async daftar(
    filters: KegiatanListFilters,
  ): Promise<{ items: KegiatanEntity[]; total: number }> {
    return this.repository.findMany(filters);
  }

  /** Ambil satu kegiatan, melempar 404 bila tidak ada. */
  async detail(id: string): Promise<KegiatanEntity> {
    const kegiatan = await this.repository.findById(id);
    if (!kegiatan) {
      throw new AppError("Kegiatan tidak ditemukan", 404, "NOT_FOUND");
    }
    return kegiatan;
  }

  /**
   * Catat kegiatan, sekaligus melahirkan prospek bila layak.
   *
   * Prospek hanya dibuat saat hasilnya menunjukkan minat, kegiatan belum
   * menempel ke prospek lain, dan data calon pelanggan disertakan.
   */
  async catat(input: CatatKegiatanInput): Promise<HasilCatatKegiatan> {
    const { prospekBaru, ...kegiatan } = input;

    if (!prospekBaru || !this.isLayakMelahirkanProspek(input)) {
      return { kegiatan: await this.repository.create(kegiatan), prospek: null };
    }

    const hasil = await this.repository.createDenganProspek(
      kegiatan,
      this.bangunProspek(input, prospekBaru),
    );

    return { kegiatan: hasil.kegiatan, prospek: hasil.prospek };
  }

  private isLayakMelahirkanProspek(input: CatatKegiatanInput): boolean {
    if (input.prospekId) return false;
    return isHasilMelahirkanProspek(input.hasil);
  }

  private bangunProspek(
    kegiatan: CatatKegiatanInput,
    data: DataProspekBaru,
  ): CreateProspekInput {
    return {
      nama: data.nama,
      noTelp: data.noTelp,
      alamat: data.alamat,
      email: data.email ?? null,
      paketDiminati: data.paketDiminati ?? null,
      latitude: kegiatan.latitude ?? null,
      longitude: kegiatan.longitude ?? null,
      sumber: SUMBER_PER_JENIS[kegiatan.jenis],
      iklanId: kegiatan.iklanId ?? null,
      pemilikId: kegiatan.userId,
      siteId: kegiatan.siteId ?? null,
    };
  }
}
```

- [ ] **Step 4: Jalankan test untuk memastikan lulus**

Run: `npx vitest run tests/modules/presurvei/kegiatan-service.test.ts`
Expected: PASS — 6 test lulus.

- [ ] **Step 5: Commit**

```bash
git add modules/presurvei tests/modules/presurvei/kegiatan-service.test.ts
git commit -m "feat(presurvei): tambah validator dan service kegiatan"
```

---

### Task 8: DTO dan public API modul

**Files:**
- Create: `modules/presurvei/dto/prospek.dto.ts`
- Create: `modules/presurvei/dto/kegiatan.dto.ts`
- Create: `modules/presurvei/index.ts`
- Test: `tests/modules/presurvei/presurvei-dto.test.ts`

**Interfaces:**
- Consumes: `ProspekEntity` (Task 2), `KegiatanEntity` (Task 3)
- Produces:
  - `toProspekListItem(p: ProspekEntity): ProspekListItemDto`
  - `toProspekDetail(p: ProspekEntity): ProspekDetailDto`
  - `toKegiatanListItem(k: KegiatanEntity): KegiatanListItemDto`
  - `toKegiatanDetail(k: KegiatanEntity): KegiatanDetailDto`
  - Public API `@/modules/presurvei`

> **Urutan pengerjaan:** kerjakan **Step 0 lebih dulu** (test), baru Step 1 dan
> seterusnya. Blok test sengaja ditempatkan setelah blok DTO di dokumen ini supaya
> bentuk DTO yang diuji mudah dirujuk sambil menulis test — tapi test tetap ditulis
> dan dijalankan lebih dulu sampai merah.

- [ ] **Step 0: Tulis test DTO dan pastikan gagal**

Salin blok test dari Step 3 di bawah ke `tests/modules/presurvei/presurvei-dto.test.ts`, lalu jalankan:

Run: `npx vitest run tests/modules/presurvei/presurvei-dto.test.ts`
Expected: FAIL — `Failed to resolve import "@/modules/presurvei/dto/prospek.dto"`

- [ ] **Step 1: Tulis DTO prospek**

Create `modules/presurvei/dto/prospek.dto.ts`:

```ts
import type { ProspekEntity } from "../domain/entities/Prospek";
import { canPromosikanKeCanvasing } from "../domain/prospek-rules";

/**
 * Bentuk data prospek yang dikirim ke klien.
 *
 * Tanggal dikirim sebagai ISO string supaya aman melewati JSON, dan kesiapan
 * promosi dihitung di sini supaya UI tidak perlu menyalin aturan domain.
 */

export interface ProspekListItemDto {
  id: string;
  nama: string;
  noTelp: string;
  alamat: string;
  sumber: string;
  status: string;
  pemilikId: string | null;
  paketDiminati: string | null;
  createdAt: string;
}

export interface ProspekDetailDto extends ProspekListItemDto {
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  shareloc: string | null;
  iklanId: string | null;
  registrationId: string | null;
  referralNama: string | null;
  catatan: string | null;
  canvasingId: string | null;
  konversiAt: string | null;
  isSiapDipromosikan: boolean;
  updatedAt: string;
}

/** Ringkasan prospek untuk tampilan daftar. */
export function toProspekListItem(prospek: ProspekEntity): ProspekListItemDto {
  return {
    id: prospek.id,
    nama: prospek.nama,
    noTelp: prospek.noTelp,
    alamat: prospek.alamat,
    sumber: prospek.sumber,
    status: prospek.status,
    pemilikId: prospek.pemilikId,
    paketDiminati: prospek.paketDiminati,
    createdAt: prospek.createdAt.toISOString(),
  };
}

/** Rincian lengkap prospek untuk halaman detail. */
export function toProspekDetail(prospek: ProspekEntity): ProspekDetailDto {
  return {
    ...toProspekListItem(prospek),
    email: prospek.email,
    latitude: prospek.latitude,
    longitude: prospek.longitude,
    shareloc: prospek.shareloc,
    iklanId: prospek.iklanId,
    registrationId: prospek.registrationId,
    referralNama: prospek.referralNama,
    catatan: prospek.catatan,
    canvasingId: prospek.canvasingId,
    konversiAt: prospek.konversiAt?.toISOString() ?? null,
    isSiapDipromosikan: canPromosikanKeCanvasing(prospek),
    updatedAt: prospek.updatedAt.toISOString(),
  };
}
```

- [ ] **Step 2: Tulis DTO kegiatan**

Create `modules/presurvei/dto/kegiatan.dto.ts`:

```ts
import type { KegiatanEntity } from "../domain/entities/Kegiatan";

/**
 * Bentuk data kegiatan yang dikirim ke klien.
 *
 * Tanggal dikirim sebagai ISO string, dan data teknis dikelompokkan terpisah
 * supaya UI bisa menyembunyikannya untuk kegiatan yang bukan survei.
 */

export interface KegiatanListItemDto {
  id: string;
  jenis: string;
  userId: string;
  prospekId: string | null;
  waktuMulai: string;
  alamatDikunjungi: string | null;
  ditemuiNama: string | null;
  hasil: string;
  jumlahFoto: number;
}

export interface KegiatanDetailDto extends KegiatanListItemDto {
  iklanId: string | null;
  waktuSelesai: string | null;
  latitude: number | null;
  longitude: number | null;
  catatan: string | null;
  fotoUrls: string[];
  dataTeknis: {
    odpTerdekat: string | null;
    estimasiKabelMeter: number | null;
    catatanTeknis: string | null;
  } | null;
  createdAt: string;
}

/** Ringkasan kegiatan untuk tampilan daftar. */
export function toKegiatanListItem(
  kegiatan: KegiatanEntity,
): KegiatanListItemDto {
  return {
    id: kegiatan.id,
    jenis: kegiatan.jenis,
    userId: kegiatan.userId,
    prospekId: kegiatan.prospekId,
    waktuMulai: kegiatan.waktuMulai.toISOString(),
    alamatDikunjungi: kegiatan.alamatDikunjungi,
    ditemuiNama: kegiatan.ditemuiNama,
    hasil: kegiatan.hasil,
    jumlahFoto: kegiatan.fotoUrls.length,
  };
}

/** Rincian lengkap kegiatan untuk halaman detail. */
export function toKegiatanDetail(
  kegiatan: KegiatanEntity,
): KegiatanDetailDto {
  const punyaDataTeknis =
    kegiatan.odpTerdekat !== null ||
    kegiatan.estimasiKabelMeter !== null ||
    kegiatan.catatanTeknis !== null;

  return {
    ...toKegiatanListItem(kegiatan),
    iklanId: kegiatan.iklanId,
    waktuSelesai: kegiatan.waktuSelesai?.toISOString() ?? null,
    latitude: kegiatan.latitude,
    longitude: kegiatan.longitude,
    catatan: kegiatan.catatan,
    fotoUrls: kegiatan.fotoUrls,
    dataTeknis: punyaDataTeknis
      ? {
          odpTerdekat: kegiatan.odpTerdekat,
          estimasiKabelMeter: kegiatan.estimasiKabelMeter,
          catatanTeknis: kegiatan.catatanTeknis,
        }
      : null,
    createdAt: kegiatan.createdAt.toISOString(),
  };
}
```

- [ ] **Step 3: Jalankan test DTO sampai hijau**

Ini isi berkas `tests/modules/presurvei/presurvei-dto.test.ts` yang sudah ditulis di Step 0:

```ts
import { describe, expect, it } from "vitest";

/**
 * DTO adalah batas antara domain dan klien. Tanggal harus keluar sebagai ISO
 * string, dan kesiapan promosi dihitung di sini supaya UI tidak menyalin ulang
 * aturan domain dan berisiko berbeda pendapat dengan server.
 */

import {
  toProspekDetail,
  toProspekListItem,
} from "@/modules/presurvei/dto/prospek.dto";
import { toKegiatanDetail } from "@/modules/presurvei/dto/kegiatan.dto";
import type { ProspekEntity } from "@/modules/presurvei/domain/entities/Prospek";
import type { KegiatanEntity } from "@/modules/presurvei/domain/entities/Kegiatan";

const WAKTU = new Date("2026-09-22T01:00:00.000Z");

const prospek = (over: Partial<ProspekEntity> = {}): ProspekEntity =>
  ({
    id: "prospek-1",
    nama: "Budi",
    noTelp: "081234567890",
    email: null,
    alamat: "Jl. Merdeka 10",
    latitude: null,
    longitude: null,
    shareloc: null,
    sumber: "LAPANGAN",
    iklanId: null,
    registrationId: null,
    referralNama: null,
    status: "BARU",
    pemilikId: "user-1",
    paketDiminati: null,
    catatan: null,
    canvasingId: null,
    konversiAt: null,
    siteId: null,
    tenantId: "tenant-1",
    createdAt: WAKTU,
    updatedAt: WAKTU,
    ...over,
  }) as ProspekEntity;

const kegiatan = (over: Partial<KegiatanEntity> = {}): KegiatanEntity =>
  ({
    id: "kegiatan-1",
    jenis: "KUNJUNGAN",
    userId: "user-1",
    prospekId: null,
    iklanId: null,
    waktuMulai: WAKTU,
    waktuSelesai: null,
    latitude: -6.2,
    longitude: 106.8,
    alamatDikunjungi: "Jl. Merdeka 10",
    ditemuiNama: "Budi",
    hasil: "TERTARIK",
    catatan: null,
    fotoUrls: ["https://contoh.id/a.webp", "https://contoh.id/b.webp"],
    odpTerdekat: null,
    estimasiKabelMeter: null,
    catatanTeknis: null,
    siteId: null,
    tenantId: "tenant-1",
    createdAt: WAKTU,
    updatedAt: WAKTU,
    ...over,
  }) as KegiatanEntity;

describe("toProspekListItem", () => {
  it("mengubah tanggal menjadi ISO string", () => {
    expect(toProspekListItem(prospek()).createdAt).toBe(
      "2026-09-22T01:00:00.000Z",
    );
  });
});

describe("toProspekDetail", () => {
  it("menandai prospek DEAL berdata lengkap sebagai siap dipromosikan", () => {
    expect(toProspekDetail(prospek({ status: "DEAL" })).isSiapDipromosikan).toBe(
      true,
    );
  });

  it("tidak menandai prospek yang belum DEAL", () => {
    expect(toProspekDetail(prospek()).isSiapDipromosikan).toBe(false);
  });
});

describe("toKegiatanDetail", () => {
  it("menghitung jumlah foto tanpa membocorkan urutan penyimpanan", () => {
    expect(toKegiatanDetail(kegiatan()).jumlahFoto).toBe(2);
  });

  it("mengosongkan blok data teknis untuk kegiatan bukan survei", () => {
    expect(toKegiatanDetail(kegiatan()).dataTeknis).toBeNull();
  });

  it("mengisi blok data teknis untuk survei lokasi", () => {
    const hasil = toKegiatanDetail(
      kegiatan({
        jenis: "SURVEI_LOKASI",
        odpTerdekat: "ODP-12",
        estimasiKabelMeter: 120,
      }),
    );

    expect(hasil.dataTeknis).toMatchObject({
      odpTerdekat: "ODP-12",
      estimasiKabelMeter: 120,
    });
  });
});
```

Run: `npx vitest run tests/modules/presurvei/presurvei-dto.test.ts`
Expected: PASS — 6 test lulus.

- [ ] **Step 4: Tulis public API modul**

Create `modules/presurvei/index.ts`:

```ts
/**
 * Public API modul presurvei.
 *
 * Modul lain hanya boleh mengimpor dari berkas ini.
 */

export {
  KEGIATAN_HASIL,
  KEGIATAN_JENIS,
  type KegiatanEntity,
  type KegiatanHasil,
  type KegiatanJenis,
} from "./domain/entities/Kegiatan";

export {
  PROSPEK_STATUSES,
  PROSPEK_SUMBER,
  type ProspekEntity,
  type ProspekStatus,
  type ProspekSumber,
} from "./domain/entities/Prospek";

export {
  canPromosikanKeCanvasing,
  getStatusLanjutan,
  isStatusFinal,
  isTransisiStatusSah,
} from "./domain/prospek-rules";

export {
  isButuhDataTeknis,
  isButuhIklan,
  isButuhLokasi,
  isHasilMelahirkanProspek,
} from "./domain/kegiatan-rules";

export {
  catatKegiatanSchema,
  daftarKegiatanSchema,
} from "./validators/kegiatan.validator";

export {
  buatProspekSchema,
  daftarProspekSchema,
  ubahProspekSchema,
} from "./validators/prospek.validator";

export {
  KegiatanService,
  type CatatKegiatanInput,
  type DataProspekBaru,
  type HasilCatatKegiatan,
} from "./services/KegiatanService";

export { ProspekService } from "./services/ProspekService";

export {
  toKegiatanDetail,
  toKegiatanListItem,
  type KegiatanDetailDto,
  type KegiatanListItemDto,
} from "./dto/kegiatan.dto";

export {
  toProspekDetail,
  toProspekListItem,
  type ProspekDetailDto,
  type ProspekListItemDto,
} from "./dto/prospek.dto";

// NOTE: ProspekRepository dan KegiatanRepository sengaja TIDAK diekspor
// (detail implementasi internal).
// NOTE: prospek.mapper dan kegiatan.mapper sengaja TIDAK diekspor (internal).
```

- [ ] **Step 5: Jalankan seluruh test modul**

Run: `npx vitest run tests/modules/presurvei/`
Expected: PASS — seluruh berkas test modul lulus.

- [ ] **Step 6: Commit**

```bash
git add modules/presurvei tests/modules/presurvei/presurvei-dto.test.ts
git commit -m "feat(presurvei): tambah DTO dan public API modul"
```

---

### Task 9: Route API prospek dan kegiatan

**Files:**
- Create: `app/api/presurvei/prospek/route.ts`
- Create: `app/api/presurvei/prospek/[id]/route.ts`
- Create: `app/api/presurvei/kegiatan/route.ts`
- Create: `app/api/presurvei/kegiatan/[id]/route.ts`

**Interfaces:**
- Consumes: seluruh export dari `@/modules/presurvei` (Task 8)
- Produces: empat route yang melayani web admin dan mobile sekaligus lewat `createHandler`

Route adalah thin controller: parse, panggil service, kembalikan DTO. Tidak ada logika bisnis di sini.

**Kenapa tiap route menyebut dua permission**: `createHandler` memeriksa daftar
`permissions` dengan `.some()` (`lib/api/handler.ts:238`) — jadi daftar itu bersifat
**ATAU**, bukan DAN. Satu route karenanya bisa melayani admin web yang memegang
`presurvei:read` sekaligus sales mobile yang memegang `m_presurvei:read`, tanpa
perlu endpoint kembar. Bila hanya `presurvei:read` yang disebut, sales di lapangan
akan tertolak 403.

- [ ] **Step 1: Tulis route daftar dan buat prospek**

Create `app/api/presurvei/prospek/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { apiPaginated, apiSuccess, createHandler } from "@/lib/api";
import {
  buatProspekSchema,
  daftarProspekSchema,
  ProspekService,
  toProspekDetail,
  toProspekListItem,
} from "@/modules/presurvei";

const service = new ProspekService();

/** GET /api/presurvei/prospek — daftar prospek dengan filter dan paginasi. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei:read", "m_presurvei:read"] },
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const filters = daftarProspekSchema.parse({
      status: searchParams.get("status") ?? undefined,
      sumber: searchParams.get("sumber") ?? undefined,
      pemilikId: searchParams.get("pemilikId") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const hasil = await service.daftar(filters);

    return apiPaginated(hasil.items.map(toProspekListItem), {
      page: filters.page,
      limit: filters.limit,
      total: hasil.total,
    });
  },
);

/** POST /api/presurvei/prospek — catat prospek baru secara manual. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["presurvei:create", "m_presurvei:create"],
    schema: buatProspekSchema,
  },
  async (_request, ctx) => {
    const prospek = await service.buat({
      ...ctx.validated,
      pemilikId: ctx.validated.pemilikId ?? ctx.session!.user.id,
    });

    return apiSuccess(toProspekDetail(prospek), { status: 201 });
  },
);
```

- [ ] **Step 2: Tulis route detail dan ubah prospek**

Create `app/api/presurvei/prospek/[id]/route.ts`:

```ts
import { apiSuccess, createHandler } from "@/lib/api";
import {
  ProspekService,
  toProspekDetail,
  ubahProspekSchema,
} from "@/modules/presurvei";

const service = new ProspekService();

/** GET /api/presurvei/prospek/[id] — rincian satu prospek. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei:read", "m_presurvei:read"] },
  async (_request, ctx) => {
    const prospek = await service.detail(ctx.params.id as string);
    return apiSuccess(toProspekDetail(prospek));
  },
);

/** PATCH /api/presurvei/prospek/[id] — perbarui data atau status prospek. */
export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["presurvei:update", "m_presurvei:update"],
    schema: ubahProspekSchema,
  },
  async (_request, ctx) => {
    const prospek = await service.ubah(
      ctx.params.id as string,
      ctx.validated,
    );
    return apiSuccess(toProspekDetail(prospek));
  },
);
```

- [ ] **Step 3: Tulis route daftar dan catat kegiatan**

Create `app/api/presurvei/kegiatan/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { apiPaginated, apiSuccess, createHandler } from "@/lib/api";
import {
  catatKegiatanSchema,
  daftarKegiatanSchema,
  KegiatanService,
  toKegiatanDetail,
  toKegiatanListItem,
  toProspekDetail,
} from "@/modules/presurvei";

const service = new KegiatanService();

/** GET /api/presurvei/kegiatan — daftar kegiatan dengan filter dan paginasi. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei:read", "m_presurvei:read"] },
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const filters = daftarKegiatanSchema.parse({
      userId: searchParams.get("userId") ?? undefined,
      jenis: searchParams.get("jenis") ?? undefined,
      hasil: searchParams.get("hasil") ?? undefined,
      prospekId: searchParams.get("prospekId") ?? undefined,
      dariTanggal: searchParams.get("dariTanggal") ?? undefined,
      sampaiTanggal: searchParams.get("sampaiTanggal") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const hasil = await service.daftar(filters);

    return apiPaginated(hasil.items.map(toKegiatanListItem), {
      page: filters.page,
      limit: filters.limit,
      total: hasil.total,
    });
  },
);

/** POST /api/presurvei/kegiatan — catat kegiatan sales atau marketing. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["presurvei:create", "m_presurvei:create"],
    schema: catatKegiatanSchema,
  },
  async (_request, ctx) => {
    const hasil = await service.catat({
      ...ctx.validated,
      userId: ctx.session!.user.id,
    });

    return apiSuccess(
      {
        kegiatan: toKegiatanDetail(hasil.kegiatan),
        prospek: hasil.prospek ? toProspekDetail(hasil.prospek) : null,
      },
      { status: 201 },
    );
  },
);
```

- [ ] **Step 4: Tulis route detail kegiatan**

Create `app/api/presurvei/kegiatan/[id]/route.ts`:

```ts
import { apiSuccess, createHandler } from "@/lib/api";
import { KegiatanService, toKegiatanDetail } from "@/modules/presurvei";

const service = new KegiatanService();

/** GET /api/presurvei/kegiatan/[id] — rincian satu kegiatan. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei:read", "m_presurvei:read"] },
  async (_request, ctx) => {
    const kegiatan = await service.detail(ctx.params.id as string);
    return apiSuccess(toKegiatanDetail(kegiatan));
  },
);
```

- [ ] **Step 5: Periksa tipe**

Run: `npm run typecheck`
Expected: selesai tanpa error.

Bila `ctx.validated` bertipe `unknown`, pastikan `schema` sudah diisi pada opsi `createHandler` — tipe `validated` diturunkan dari skema tersebut.

- [ ] **Step 6: Commit**

```bash
git add app/api/presurvei
git commit -m "feat(presurvei): tambah route API kegiatan dan prospek"
```

---

### Task 10: Pendaftaran permission dan seed

**Files:**
- Modify: `lib/permissions.ts` (blok `MARKETING`, sekitar baris 108-127)
- Modify: `lib/permission-config.ts:85` (`PERMISSION_GROUPS.MARKETING`) dan `:120` (`PERMISSION_GROUPS_MOBILE.MARKETING`)
- Modify: `lib/resource-capabilities.ts` (dekat entri `canvasing`, sekitar baris 458-481)
- Modify: `lib/role-templates.ts` (role `sales`, sekitar baris 265-290)
- Create: `scripts/seed-presurvei-permissions.ts`

**Interfaces:**
- Consumes: —
- Produces: permission `presurvei:read|create|update|delete|site_only` dan `m_presurvei:read|create` yang dikenali RBAC

- [ ] **Step 1: Tambahkan konstanta permission**

Di `lib/permissions.ts`, dalam blok `MARKETING`, sisipkan setelah blok `CANVASING`:

```ts
    PRESURVEI: {
      READ: "presurvei:read",
      CREATE: "presurvei:create",
      UPDATE: "presurvei:update",
      DELETE: "presurvei:delete",
      SITE_ONLY: "presurvei:site_only",
    },
```

- [ ] **Step 2: Daftarkan resource ke grup permission**

Di `lib/permission-config.ts` baris 85, ubah:

```ts
  MARKETING: ["marketing", "coupon", "sales_dashboard", "sales", "canvasing"],
```

menjadi:

```ts
  MARKETING: [
    "marketing",
    "coupon",
    "sales_dashboard",
    "sales",
    "canvasing",
    "presurvei",
  ],
```

Di baris 120, ubah:

```ts
  MARKETING: ["m_canvasing"],
```

menjadi:

```ts
  MARKETING: ["m_canvasing", "m_presurvei"],
```

- [ ] **Step 3: Tambahkan resource capability**

Di `lib/resource-capabilities.ts`, sisipkan tepat setelah entri `sales` (sekitar baris 481, masih di blok `====== MARKETING MODULE ======`):

```ts
  presurvei: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Kegiatan sales & marketing dan prospek presurvei",
  },
```

Lalu sisipkan tepat setelah entri `m_canvasing` (sekitar baris 538, di blok `====== MOBILE APP RESOURCES (m_*) ======`):

```ts
  m_presurvei: {
    actions: ["read", "create", "update"],
    displayName: "Presurvei",
    description: "Catat kegiatan dan prospek presurvei dari mobile",
  },
```

`update` ikut disertakan karena sales mengubah status prospek dari lapangan —
tanpa itu, prospek hanya bisa dipindahkan statusnya lewat web admin.

Perhatikan bedanya: entri mobile punya `displayName`, entri web tidak — ikuti pola tetangganya masing-masing.

- [ ] **Step 4: Tambahkan ke role template sales**

Di `lib/role-templates.ts`, pada role dengan `id: "sales"`, tambahkan ke array `permissions`:

```ts
        "m_presurvei:read",
        "m_presurvei:create",
        "m_presurvei:update",
```

Role ini punya `accessAdminPanel: false`, jadi cukup permission mobile — route
presurvei menerima permission web **atau** mobile (lihat catatan di Task 9).

- [ ] **Step 5: Tulis script seed**

Create `scripts/seed-presurvei-permissions.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import { logger } from "../lib/logger";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL not found");

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PERMISSIONS = [
  { resource: "presurvei", action: "read", description: "Lihat kegiatan & prospek presurvei" },
  { resource: "presurvei", action: "create", description: "Catat kegiatan & prospek presurvei" },
  { resource: "presurvei", action: "update", description: "Ubah kegiatan & prospek presurvei" },
  { resource: "presurvei", action: "delete", description: "Hapus data presurvei" },
  { resource: "presurvei", action: "site_only", description: "Batasi presurvei ke site sendiri" },
  { resource: "m_presurvei", action: "read", description: "Akses menu Presurvei di mobile" },
  { resource: "m_presurvei", action: "create", description: "Catat presurvei lewat mobile" },
  { resource: "m_presurvei", action: "update", description: "Ubah prospek lewat mobile" },
];

// Role admin menerima seluruh permission presurvei; sales hanya permission
// mobile karena mereka tidak mengakses panel admin, dan tidak diberi hak hapus
// supaya tidak bisa menghilangkan data rekan setimnya.
const ROLE_ADMIN = ["Super Admin", "SUPER_ADMIN", "ADMIN", "Admin"];
const ROLE_SALES = ["SALES", "Sales", "Branch Manager", " Branch Manager"];
const PERMISSION_SALES = [
  "m_presurvei:read",
  "m_presurvei:create",
  "m_presurvei:update",
];

async function main() {
  logger.info("Seeding Presurvei permissions...");

  for (const perm of PERMISSIONS) {
    const exists = await prisma.permission.findFirst({
      where: { resource: perm.resource, action: perm.action },
    });

    if (!exists) {
      await prisma.permission.create({
        data: {
          id: crypto.randomUUID(),
          name: `${perm.resource}:${perm.action}`,
          ...perm,
          updatedAt: new Date(),
        },
      });
      logger.info(`Created permission: ${perm.resource}:${perm.action}`);
    }
  }

  const semuaPermission = await prisma.permission.findMany({
    where: { resource: { in: ["presurvei", "m_presurvei"] } },
  });

  const permissionSales = semuaPermission.filter((p) =>
    PERMISSION_SALES.includes(p.name),
  );

  await assignKeRole(ROLE_ADMIN, semuaPermission);
  await assignKeRole(ROLE_SALES, permissionSales);

  logger.info("Done!");
}

/** Lampirkan sekumpulan permission ke setiap role yang namanya cocok. */
async function assignKeRole(
  namaRole: string[],
  permissions: { id: string }[],
): Promise<void> {
  const roles = await prisma.role.findMany({
    where: { name: { in: namaRole } },
  });

  for (const role of roles) {
    await prisma.role.update({
      where: { id: role.id },
      data: { permission: { connect: permissions.map((p) => ({ id: p.id })) } },
    });
    logger.info(
      `Assigned ${permissions.length} permissions to role: ${role.name}`,
    );
  }
}

main()
  .catch((e) => {
    logger.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 6: Jalankan seed**

Run: `npx tsx scripts/seed-presurvei-permissions.ts`
Expected: log jumlah permission yang dibuat dan role yang diperbarui, tanpa error.

- [ ] **Step 7: Periksa lint dan tipe**

Run: `npm run lint && npm run typecheck`
Expected: keduanya lulus tanpa error.

- [ ] **Step 8: Commit**

```bash
git add lib/permissions.ts lib/permission-config.ts lib/resource-capabilities.ts lib/role-templates.ts scripts/seed-presurvei-permissions.ts
git commit -m "feat(presurvei): daftarkan permission presurvei untuk web dan mobile"
```

---

### Task 11: Verifikasi menyeluruh dan changelog

**Files:**
- Modify: `docs/CHANGELOG.md`

**Interfaces:**
- Consumes: seluruh task sebelumnya
- Produces: —

- [ ] **Step 1: Jalankan seluruh test modul**

Run: `npx vitest run tests/modules/presurvei/`
Expected: PASS — seluruh berkas lulus. Catat jumlah test yang lulus.

- [ ] **Step 2: Jalankan pemeriksaan penuh**

Run: `npm run lint && npm run typecheck && npm test`
Expected: ketiganya lulus. Bila ada test lain di repo yang gagal, periksa apakah kegagalannya berkaitan dengan perubahan ini — bila tidak, catat dan laporkan, jangan diperbaiki diam-diam.

- [ ] **Step 3: Pastikan tidak ada drift skema**

Run: `npx prisma migrate status`
Expected: `Database schema is up to date!`

- [ ] **Step 4: Tulis entri changelog**

Tambahkan di bagian `[Unreleased]` pada `docs/CHANGELOG.md`:

```markdown
### [2026-09-22] — Tambah modul presurvei (kegiatan sales & prospek)

- **Tipe**: [ADDED]
- **Scope**: `modules/presurvei`
- **Author**: agent
- **Deskripsi**: Modul baru untuk mencatat kegiatan tim sales dan marketing —
  kunjungan lapangan, survei lokasi, telepon, chat, dan pekerjaan iklan — beserta
  prospek yang lahir darinya. Kegiatan yang membuahkan minat langsung melahirkan
  prospek dalam satu transaksi, sehingga sales tidak mengetik ulang data yang sama.
  Prospek punya aturan transisi status terpusat dan atribusi sumber, menjawab
  kebutuhan manajemen untuk mengetahui kegiatan tim dan asal setiap prospek.
  Modul Canvasing dan Registration tidak diubah.
- **Files**: `modules/presurvei/**`, `app/api/presurvei/**`,
  `scripts/seed-presurvei-permissions.ts`, `lib/permissions.ts`,
  `lib/permission-config.ts`, `lib/resource-capabilities.ts`, `lib/role-templates.ts`
- **Migration**: `<timestamp>_add_presurvei_module`
- **Breaking**: ❌ Tidak
```

Ganti `<timestamp>` dengan nama folder migration yang sebenarnya dari Task 1.

- [ ] **Step 5: Commit**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): catat penambahan modul presurvei fase 1"
```

---

## Yang Belum Dikerjakan (Fase Berikutnya)

Fase 1 sengaja berhenti di sini. Yang menyusul, sesuai spec:

- **Fase 2**: service dan API untuk Iklan dan Target (tabelnya sudah ada sejak Task 1), event `registration:registration.created` beserta kolom UTM di `Registrations`, dan `ProspekKonversiService` untuk promosi prospek menjadi Canvasing
- **Fase 3**: UI admin web — daftar kegiatan, papan prospek, kelola iklan dan target, laporan kegiatan
- **Fase 4**: mobile — route group `(sales)`, beranda sales, layar presurvei, pengarahan setelah login
