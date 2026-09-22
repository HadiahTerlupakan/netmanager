# Modul Presurvei — Rencana Implementasi Fase 2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup perjalanan prospek dari ujung ke ujung — prospek masuk otomatis dari form pendaftaran publik lengkap dengan iklan asalnya, tidak menggandakan orang yang sama, dan yang matang dipromosikan menjadi Canvasing sehingga akhirnya menjadi Work Order instalasi.

**Architecture:** Melanjutkan `modules/presurvei` dengan pola Fase 1: domain murni, repository di balik port, service dengan constructor DI, route tipis lewat `createHandler`. Dua agregat yang tabelnya sudah dibuat Fase 1 tapi belum dipakai — Iklan dan Target — mendapat lapisan lengkapnya. Komunikasi dengan modul registration lewat domain event, dan dengan modul marketing lewat public API-nya.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma + PostgreSQL, Zod, BullMQ event bus, Vitest.

**Spec:** `docs/architecture/presurvei-module-design.md`

**Fase sebelumnya:** `docs/superpowers/plans/2026-09-22-presurvei-fase-1.md` — kegiatan, prospek, dan route-nya. Selesai dengan 119 test hijau.

## Global Constraints

Berlaku untuk setiap task, tanpa perlu diulang di masing-masing:

- **Bahasa**: komentar kode, pesan error, dan pesan validasi ditulis dalam Bahasa Indonesia.
- **Error handling**: service melempar `AppError` dari `@/lib/errors` — `new AppError(message, statusCode, code, details?)`. Jangan pakai pola `Result<T, E>`.
- **Klien Prisma**: `import { prisma } from "@/modules/database"` — **bukan** `@/lib/prisma`. Klien ini sudah punya ekstensi isolasi tenant yang terbukti menjangkau ke dalam `$transaction`, jadi **jangan menulis filter `tenantId` manual** di repository.
- **Module boundary**: modul lain hanya boleh mengimpor dari `modules/presurvei/index.ts`. Repository dan mapper **tidak** diekspor dari sana. Sebaliknya, presurvei mengimpor modul lain hanya lewat public API-nya (`@/modules/marketing`, bukan path internal).
- **Domain murni**: file di `domain/` tidak boleh mengimpor apa pun dari luar folder `domain/` — tanpa Prisma, tanpa framework, tanpa Zod.
- **Komentar**: setiap fungsi publik wajib punya brief comment satu baris tentang tujuannya. Komentar menjelaskan *kenapa*, bukan mengulang nama fungsi.
- **Penamaan**: fungsi adalah verb; boolean berprefix `is`/`has`/`can`. Tidak ada magic number — gunakan named constant.
- **Nullable**: field opsional di domain entity ditulis `| null`, bukan `?`. `Date` tetap `Date` di domain, dikonversi ke ISO string hanya di DTO.
- **`strictNullChecks: false`** — repo mematikannya (`tsconfig.json`) sementara `strict: true` tetap menyalakan `noImplicitAny`. Objek literal yang punya properti bernilai `null` dan tidak punya tipe kontekstual akan gagal typecheck dengan `TS7018`, dan `tsconfig.typecheck.json` mencakup `**/*.ts` sehingga file test ikut diperiksa. Setiap builder atau konstanta test yang memuat `null` **wajib** punya anotasi tipe eksplisit.
- **Jangan pakai truthiness untuk memeriksa "terisi"** — angka `0` adalah nilai sah. Pakai `isTerisi()` dari `modules/presurvei/validators/field-terisi.ts`. Jebakan ini sudah pernah jadi bug nyata di modul ini.
- **Test**: semua file test modul di `tests/modules/presurvei/`. Service diuji dengan me-mock port repository; repository diuji dengan me-mock `@/modules/database`. Waktu selalu di-inject supaya deterministik.
- **Migration**: `npx prisma migrate dev --name <deskriptif>`. `prisma db push` **dilarang**. Setelah `migrate dev`, **periksa isi `migration.sql`** — perintah itu mendiff seluruh schema terhadap seluruh DB, jadi ia bisa membundel perubahan lama yang belum punya migration. Buang statement yang tidak berkaitan sebelum commit, lalu validasi dengan menjalankan seluruh riwayat ke database kosong terpisah.
- **Commit**: Conventional Commits — `feat(presurvei): ...`, `test(presurvei): ...`.
- **Dua perintah verifikasi per task**, keduanya wajib lulus sebelum commit:
  1. `npx vitest run tests/modules/presurvei/` — seluruh test modul hijau
  2. `npx tsc --noEmit -p tsconfig.typecheck.json 2>&1 | grep presurvei` — tanpa output

  Vitest **tidak** melakukan typecheck, jadi test hijau saja tidak cukup.
- **Catatan alat**: diagnostics editor di repo ini sering melaporkan error palsu soal model presurvei tidak ada di `PrismaClient` — itu cache TypeScript server yang basi. Percayai `tsc`, bukan editor.

---

## Peta Gelombang

| Gelombang | Task | Hasil yang bisa diuji |
|---|---|---|
| **A — Menutup funnel** | 1–6 | Prospek masuk otomatis dari `/register`, tidak menggandakan orang yang sama, dan yang matang jadi Canvasing → WO instalasi |
| **B — Iklan** | 7–10 | Marketing mencatat kampanye; prospek dari website ter-atribusi ke iklan lewat UTM |
| **C — Target** | 11–13 | Target per sales per periode beserta laporan pencapaiannya |
| **D — Utang & penutup** | 14–16 | Permission terdaftar, route bertest, changelog |

---

## Struktur File

### Berkas baru

| File | Tanggung jawab |
|---|---|
| `modules/presurvei/domain/entities/Iklan.ts` | Const array channel, union type, entity iklan |
| `modules/presurvei/domain/entities/Target.ts` | Entity target |
| `modules/presurvei/domain/iklan-rules.ts` | Kapan iklan dianggap aktif pada suatu tanggal |
| `modules/presurvei/domain/target-rules.ts` | Perhitungan pencapaian terhadap target |
| `modules/presurvei/domain/ports/IIklanRepository.ts` | Kontrak akses data iklan |
| `modules/presurvei/domain/ports/ITargetRepository.ts` | Kontrak akses data target |
| `modules/presurvei/mappers/iklan.mapper.ts` | Row Prisma → entity iklan |
| `modules/presurvei/mappers/target.mapper.ts` | Row Prisma → entity target |
| `modules/presurvei/repositories/IklanRepository.ts` | Query Prisma iklan |
| `modules/presurvei/repositories/TargetRepository.ts` | Query Prisma target |
| `modules/presurvei/validators/iklan.validator.ts` | Skema Zod iklan |
| `modules/presurvei/validators/target.validator.ts` | Skema Zod target |
| `modules/presurvei/services/IklanService.ts` | Orkestrasi iklan |
| `modules/presurvei/services/TargetService.ts` | Orkestrasi target + laporan pencapaian |
| `modules/presurvei/services/ProspekKonversiService.ts` | Promosi prospek → Canvasing |
| `modules/presurvei/services/event-handlers/registration-created-presurvei.handler.ts` | Registrasi publik → prospek |
| `modules/presurvei/dto/iklan.dto.ts` · `target.dto.ts` | DTO kedua agregat |
| `app/api/presurvei/prospek/[id]/jadikan-canvasing/route.ts` | Endpoint promosi |
| `app/api/admin/presurvei/iklan/route.ts` · `[id]/route.ts` | CRUD iklan |
| `app/api/admin/presurvei/target/route.ts` · `[id]/route.ts` | CRUD target |
| `app/api/admin/presurvei/laporan/route.ts` | Laporan pencapaian |

### Berkas yang diubah

| File | Perubahan |
|---|---|
| `prisma/schema.prisma` | Tiga kolom UTM pada `Registrations` |
| `modules/registration/dto/RegistrationDTO.ts` | UTM pada DTO masuk dan keluar |
| `modules/registration/services/RegistrationService.ts` | Simpan UTM + publish event |
| `modules/registration/repositories/RegistrationRepository.ts` | UTM pada create input |
| `modules/registration/index.ts` | Ekspor handler? Tidak — handler ada di presurvei |
| `modules/marketing/index.ts` | Ekspor `CreateCanvasingInput` agar presurvei bisa memakainya |
| `modules/presurvei/domain/ports/IProspekRepository.ts` | `findByNoTelp`, `findByRegistrationId`, `canvasingId`/`konversiAt` pada update |
| `modules/presurvei/repositories/ProspekRepository.ts` | Implementasi ketiganya |
| `modules/presurvei/services/ProspekService.ts` | Peringatan duplikat nomor telepon |
| `modules/presurvei/index.ts` | Ekspor seluruh permukaan baru |
| `lib/event-bus/types.ts` | Dua event baru di empat tempat masing-masing |
| `lib/event-bus/event-handlers.ts` | Registrasi handler registrasi→prospek |
| `lib/permissions.ts` · `permission-config.ts` · `resource-capabilities.ts` | Permission iklan, target, laporan |
| `scripts/seed-presurvei-permissions.ts` | Seed permission baru |
| `app/register/page.tsx` | Tangkap UTM dari query string |
| `docs/CHANGELOG.md` | Entri Fase 2 |

---

# GELOMBANG A — Menutup funnel

### Task 1: Kolom UTM pada Registrations

**Files:**
- Modify: `prisma/schema.prisma` (model `Registrations`)
- Create: `prisma/migrations/<timestamp>_add_utm_to_registrations/migration.sql`
- Modify: `modules/registration/dto/RegistrationDTO.ts`
- Modify: `modules/registration/repositories/RegistrationRepository.ts`
- Modify: `modules/registration/services/RegistrationService.ts` (hanya `toCreateData`)
- Modify: `app/register/page.tsx`

**Interfaces:**
- Consumes: —
- Produces: kolom `utmSource`, `utmMedium`, `utmCampaign` (semua `String?`) pada tabel `registrations`; ketiganya ikut di `CreateRegistrationDTO` dan tersimpan lewat `RegistrationRepository.create`.

- [ ] **Step 1: Tambahkan tiga kolom ke model `Registrations`**

Di `prisma/schema.prisma`, sisipkan setelah baris `ipAddress String?`:

```prisma
  utmSource       String?
  utmMedium       String?
  utmCampaign     String?
```

Ketiganya nullable tanpa default: pendaftaran yang datang tanpa parameter kampanye memang tidak punya asal yang bisa dicatat, dan `null` mengatakan itu lebih jujur daripada string kosong.

- [ ] **Step 2: Buat migration**

Run: `npx prisma migrate dev --name add_utm_to_registrations`

- [ ] **Step 3: Periksa isi migration — langkah ini tidak boleh dilewati**

Run: `cat prisma/migrations/*_add_utm_to_registrations/migration.sql`

Yang boleh ada hanyalah tiga `ALTER TABLE "registrations" ADD COLUMN`. `migrate dev` mendiff seluruh schema terhadap seluruh database, jadi ia bisa membundel perubahan lama yang belum punya migration pasangannya. Kalau muncul statement lain — `DROP COLUMN`, `DROP INDEX`, `ALTER COLUMN ... DROP DEFAULT`, `RENAME` — **buang statement itu dari berkas**, sisakan hanya ketiga `ADD COLUMN`.

Bila kamu membuang sesuatu: checksum berkas berubah setelah ia sempat diterapkan, jadi selaraskan pembukuan Prisma dengan
```bash
docker exec netmanager-postgres-app psql -U netmgr -d netmanager -tAc "delete from _prisma_migrations where migration_name = '<nama folder migration>';"
npx prisma migrate resolve --applied <nama folder migration>
```
lalu laporkan statement apa saja yang kamu buang.

- [ ] **Step 4: Validasi migration dengan eksekusi nyata**

`migrate resolve` menandai migration terpasang **tanpa menjalankan SQL-nya**, jadi berkas yang rusak bisa lolos. Buktikan dengan menjalankan seluruh riwayat ke database kosong terpisah:

```bash
docker exec netmanager-postgres-app psql -U netmgr -d postgres -c "DROP DATABASE IF EXISTS validasi_migrasi;" -c "CREATE DATABASE validasi_migrasi;"
DATABASE_URL="postgresql://netmgr:<password dari .env>@localhost:5432/validasi_migrasi?schema=public" npx prisma migrate deploy
docker exec netmanager-postgres-app psql -U netmgr -d validasi_migrasi -tAc "select column_name from information_schema.columns where table_name='registrations' and column_name like 'utm%' order by 1;"
docker exec netmanager-postgres-app psql -U netmgr -d postgres -c "DROP DATABASE validasi_migrasi;"
```

Expected: `All migrations have been successfully applied.` lalu tiga baris `utmCampaign`, `utmMedium`, `utmSource`.

- [ ] **Step 5: Generate Prisma client**

Run: `npm run prisma:generate`

- [ ] **Step 6: Tambahkan UTM ke DTO registrasi**

Di `modules/registration/dto/RegistrationDTO.ts`, tambahkan ke `CreateRegistrationDTO`:

```ts
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
```

- [ ] **Step 7: Teruskan UTM ke data yang disimpan**

Di `modules/registration/services/RegistrationService.ts`, pada `toCreateData`, tambahkan ketiganya:

```ts
  private toCreateData(input: CreateRegistrationDTO) {
    return {
      name: input.name,
      email: input.email,
      phone: input.phone,
      address: input.address,
      location: input.location,
      packageName: input.packageName,
      notes: input.notes,
      ipAddress: input.ipAddress,
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      status: DEFAULT_STATUS,
    };
  }
```

Lalu di `modules/registration/repositories/RegistrationRepository.ts`, pastikan `toCreateInput` meneruskan ketiganya ke Prisma. Baca fungsi itu lebih dulu dan ikuti bentuk yang sudah ada — jangan menebak namanya.

- [ ] **Step 8: Tangkap UTM di form pendaftaran publik**

`app/register/page.tsx` adalah client component dan saat ini tidak membaca query string sama sekali. Tambahkan pembacaan parameter kampanye saat halaman dibuka, lalu sertakan pada submit.

Pakai `window.location.search` di dalam `useEffect`, **bukan** `useSearchParams` — hook itu menuntut halaman dibungkus `<Suspense>` di App Router dan akan mengubah struktur halaman lebih jauh dari yang diperlukan.

Simpan hasilnya di `useRef`, bukan `useState`: nilainya tidak pernah dirender, hanya dibaca saat submit, jadi tidak ada alasan memicu re-render. Repo ini juga menyalakan rule ESLint `react-hooks/set-state-in-effect` yang akan menolak `setState` di dalam `useEffect` seperti itu.

```tsx
  // Asal kampanye tidak pernah ditampilkan — ia hanya dibaca saat submit, jadi
  // tidak perlu memicu re-render (sekaligus menghindari rule
  // react-hooks/set-state-in-effect untuk setState yang tidak sinkron dengan
  // tampilan).
  const utmRef = useRef<{
    utmSource: string | undefined;
    utmMedium: string | undefined;
    utmCampaign: string | undefined;
  }>({ utmSource: undefined, utmMedium: undefined, utmCampaign: undefined });

  useEffect(() => {
    // Ditangkap sekali saat halaman dibuka: pengunjung sering menyunting form
    // cukup lama, dan sebagian browser membersihkan query string di tengah jalan.
    const params = new URLSearchParams(window.location.search);
    utmRef.current = {
      utmSource: params.get("utm_source") ?? undefined,
      utmMedium: params.get("utm_medium") ?? undefined,
      utmCampaign: params.get("utm_campaign") ?? undefined,
    };
  }, []);
```

Lalu pada `handleSubmit`, ubah body menjadi:

```tsx
          body: JSON.stringify({
            ...formData,
            ...utmRef.current,
            turnstileToken,
          }),
```

Satu berkas lagi ikut berubah meski tidak disebut di daftar di atas: `modules/registration/domain/entities/Registration.ts`. Tipe `CreateRegistrationData` di sana perlu ketiga field UTM karena `toCreateInput` mengaksesnya sebagai properti, bukan menyebarnya sebagai literal — tanpa itu typecheck gagal, dan menambal dengan type-cast justru menyembunyikan ketidakcocokannya.

`app/api/registrations/route.ts` meneruskan `...body` apa adanya ke service, jadi route itu tidak perlu diubah.

- [ ] **Step 9: Verifikasi**

Run: `npm run typecheck`
Expected: lulus.

Run: `npx vitest run tests/modules/presurvei/`
Expected: 119 test tetap hijau (task ini belum menyentuh presurvei).

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma prisma/migrations modules/registration app/register/page.tsx
git commit -m "feat(registration): catat asal kampanye pada pendaftaran publik"
```

---

### Task 2: Event registrasi baru

**Files:**
- Modify: `lib/event-bus/types.ts` (empat tempat)
- Modify: `modules/registration/services/RegistrationService.ts` (publish)

**Interfaces:**
- Consumes: kolom UTM dari Task 1
- Produces:
  - `EVENT_NAMES.REGISTRATION_CREATED` bernilai `"registration:registration.created"`
  - `RegistrationCreatedPayload` dengan field: `registrationId`, `nama`, `noTelp`, `email`, `alamat`, `paketDiminati`, `utmSource`, `utmMedium`, `utmCampaign`, `tenantId`
  - Event ter-publish setiap kali pendaftaran publik berhasil tersimpan

- [ ] **Step 1: Tambahkan nama event**

Di `lib/event-bus/types.ts`, pada objek `EVENT_NAMES`, sisipkan berdekatan dengan event marketing yang sudah ada:

```ts
  REGISTRATION_CREATED: "registration:registration.created",
```

- [ ] **Step 2: Tambahkan interface payload**

Letakkan berdekatan dengan `MarketingCanvasingApprovedPayload`:

```ts
/**
 * Pendaftaran publik baru masuk lewat form `/register`.
 *
 * Dikonsumsi modul presurvei untuk melahirkan prospek dengan sumber WEBSITE.
 * Seluruh nilainya primitif supaya aman melewati antrian.
 */
export interface RegistrationCreatedPayload extends BaseEventPayload {
  registrationId: string;
  nama: string;
  noTelp: string;
  email: string | null;
  alamat: string;
  paketDiminati: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}
```

- [ ] **Step 3: Daftarkan di peta payload**

```ts
  [EVENT_NAMES.REGISTRATION_CREATED]: RegistrationCreatedPayload;
```

- [ ] **Step 4: Daftarkan metadata routing**

`EVENT_METADATA` bertipe `Record<EventName, EventMetadata>` — Record lengkap, jadi menambah nama event tanpa metadata adalah type error.

```ts
  [EVENT_NAMES.REGISTRATION_CREATED]: {
    name: EVENT_NAMES.REGISTRATION_CREATED,
    category: "marketing",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
```

- [ ] **Step 5: Publish dari service registrasi**

Di `modules/registration/services/RegistrationService.ts`, pada `createRegistration`, setelah create berhasil dan sebelum `return`:

```ts
  private async createRegistration(
    input: CreateRegistrationDTO,
  ): Promise<RegistrationResult<RegistrationDetailDTO>> {
    try {
      const registration = await this.repository.create(
        this.toCreateData(input),
      );

      // Nilai UTM diambil dari `input`, bukan dari hasil create: Task 1 hanya
      // menyambungkan jalur tulis, sehingga `RegistrationMapper.toDomain` belum
      // memetakan ketiga kolom itu balik dari Prisma. Tidak ada normalisasi di
      // jalur simpan, jadi keduanya bernilai sama.
      this.publishRegistrationCreated({
        id: registration.id,
        name: registration.name,
        phone: registration.phone,
        email: registration.email,
        address: registration.address,
        packageName: registration.packageName,
        utmSource: input.utmSource ?? null,
        utmMedium: input.utmMedium ?? null,
        utmCampaign: input.utmCampaign ?? null,
        tenantId: registration.tenantId,
      });

      return { success: true, data: RegistrationMapper.toDTO(registration) };
    } catch (error) {
      logger.error("[RegistrationService] Error creating registration:", error);
      return this.failure(REGISTRATION_ERROR_MESSAGE, HTTP_INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Beri tahu modul lain bahwa pendaftaran publik masuk.
   *
   * Sengaja fire-and-forget: pendaftar sudah berhasil tersimpan, dan kegagalan
   * antrian tidak boleh membuat mereka melihat kesalahan atau mengirim ulang.
   * Import dinamis supaya BullMQ tidak tertarik ke bundel yang memuat route publik.
   */
  private publishRegistrationCreated(registration: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    address: string;
    packageName: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    tenantId: string | null;
  }): void {
    void (async () => {
      try {
        const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
        await eventBus.publish(EVENT_NAMES.REGISTRATION_CREATED, {
          registrationId: registration.id,
          nama: registration.name,
          noTelp: registration.phone,
          email: registration.email,
          alamat: registration.address,
          paketDiminati: registration.packageName,
          utmSource: registration.utmSource,
          utmMedium: registration.utmMedium,
          utmCampaign: registration.utmCampaign,
          tenantId: registration.tenantId ?? undefined,
        });
      } catch (error) {
        logger.error(
          "[RegistrationService] Gagal mempublikasikan event pendaftaran:",
          error,
        );
      }
    })();
  }
```

Perhatikan pola penanganan kegagalannya: event yang gagal terkirim dicatat, bukan dilempar. Pendaftar sudah tersimpan — membuat mereka melihat 500 dan mengirim ulang justru melahirkan pendaftaran ganda.

- [ ] **Step 6: Verifikasi**

Run: `npm run typecheck`
Expected: lulus. Bila `EVENT_METADATA` mengeluh ada kunci yang kurang, berarti Step 4 terlewat.

- [ ] **Step 7: Commit**

```bash
git add lib/event-bus/types.ts modules/registration
git commit -m "feat(registration): publikasikan event saat pendaftaran publik masuk"
```

---

### Task 3: Perluas port prospek

**Files:**
- Modify: `modules/presurvei/domain/ports/IProspekRepository.ts`
- Modify: `modules/presurvei/repositories/ProspekRepository.ts`
- Test: `tests/modules/presurvei/prospek-repository.test.ts`

**Interfaces:**
- Consumes: `ProspekEntity` (Fase 1)
- Produces:
  - `IProspekRepository.findByNoTelp(noTelp: string): Promise<ProspekEntity[]>`
  - `IProspekRepository.findByRegistrationId(registrationId: string): Promise<ProspekEntity | null>`
  - `UpdateProspekInput` bertambah `canvasingId?: string | null` dan `konversiAt?: Date | null`

Ketiganya dibutuhkan task berikutnya: `findByNoTelp` untuk peringatan duplikat, `findByRegistrationId` untuk idempotensi handler event, dan dua field update untuk menandai prospek yang sudah dipromosikan.

- [ ] **Step 1: Perluas port**

Di `modules/presurvei/domain/ports/IProspekRepository.ts`, tambahkan dua field ke `UpdateProspekInput`:

```ts
  canvasingId?: string | null;
  konversiAt?: Date | null;
```

dan dua metode ke `IProspekRepository`:

```ts
  /**
   * Prospek dengan nomor telepon yang sama — dipakai memperingatkan duplikat.
   *
   * Hasilnya dibatasi: yang dibutuhkan hanya beberapa contoh untuk ditampilkan,
   * dan nomor bersama seperti nomor kios bisa terpakai ratusan kali.
   */
  findByNoTelp(noTelp: string): Promise<ProspekEntity[]>;
  /** Prospek yang lahir dari satu pendaftaran publik, null bila belum ada. */
  findByRegistrationId(registrationId: string): Promise<ProspekEntity | null>;
```

- [ ] **Step 2: Tulis test lebih dulu**

Tambahkan ke `tests/modules/presurvei/prospek-repository.test.ts`. Mock `@/modules/database` di berkas itu perlu `findMany` dan `findUnique` — keduanya sudah ada, tidak perlu diubah.

```ts
describe("ProspekRepository.findByNoTelp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mencari persis pada nomor yang diberikan", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([] as never);

    await new ProspekRepository().findByNoTelp("081234567890");

    expect(prisma.presurveiProspek.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { noTelp: "081234567890" } }),
    );
  });

  it("mengembalikan entitas domain, bukan baris mentah", async () => {
    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([
      barisProspek(),
    ] as never);

    const hasil = await new ProspekRepository().findByNoTelp("081234567890");

    expect(hasil).toHaveLength(1);
    expect(hasil[0]).toMatchObject({ id: "prospek-1", status: "BARU" });
  });

  it("membatasi jumlah yang diambil pada angka yang masuk akal", async () => {
    // Nomor bersama bisa menempel pada ratusan prospek, dan kolomnya belum
    // ber-index. Tanpa batas, pemeriksaan duplikat memindai semuanya pada
    // jalur yang dilewati setiap pembuatan prospek.
    //
    // Batas atasnya ikut diperiksa, bukan hanya keberadaannya: `take` bernilai
    // besar secara teknis "ada batas" tapi menghidupkan kembali persis risiko
    // yang hendak dicegah. Batas bawahnya juga — `take: 1` akan menyembunyikan
    // duplikat nyata dari pemakai.
    const BATAS_WAJAR_MAKS = 50;
    const BATAS_WAJAR_MIN = 3;

    vi.mocked(prisma.presurveiProspek.findMany).mockResolvedValue([] as never);

    await new ProspekRepository().findByNoTelp("081234567890");

    const argumen = vi.mocked(prisma.presurveiProspek.findMany).mock.calls[0][0];
    expect(argumen?.take).toBeGreaterThanOrEqual(BATAS_WAJAR_MIN);
    expect(argumen?.take).toBeLessThanOrEqual(BATAS_WAJAR_MAKS);
  });
});

describe("ProspekRepository.update — penandaan konversi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("meneruskan canvasingId dan konversiAt ke Prisma", async () => {
    // Task berikutnya menandai prospek yang sudah jadi canvasing lewat kedua
    // field ini. Bila `update` suatu saat diubah menjadi daftar field eksplisit
    // dan keduanya terlupa, penandaannya hilang tanpa suara — test ini yang
    // akan gagal.
    const konversiAt = new Date("2026-09-23T00:00:00.000Z");
    vi.mocked(prisma.presurveiProspek.update).mockResolvedValue(
      barisProspek({ canvasingId: "canvasing-1", konversiAt }) as never,
    );

    const hasil = await new ProspekRepository().update("prospek-1", {
      canvasingId: "canvasing-1",
      konversiAt,
    });

    expect(prisma.presurveiProspek.update).toHaveBeenCalledWith({
      where: { id: "prospek-1" },
      data: { canvasingId: "canvasing-1", konversiAt },
    });
    expect(hasil.canvasingId).toBe("canvasing-1");
  });
});

describe("ProspekRepository.findByRegistrationId", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mengembalikan null saat pendaftaran belum punya prospek", async () => {
    vi.mocked(prisma.presurveiProspek.findUnique).mockResolvedValue(
      null as never,
    );

    expect(
      await new ProspekRepository().findByRegistrationId("reg-1"),
    ).toBeNull();
  });

  it("mencari lewat kolom unik registrationId", async () => {
    vi.mocked(prisma.presurveiProspek.findUnique).mockResolvedValue(
      barisProspek({ registrationId: "reg-1" }) as never,
    );

    const hasil = await new ProspekRepository().findByRegistrationId("reg-1");

    expect(prisma.presurveiProspek.findUnique).toHaveBeenCalledWith({
      where: { registrationId: "reg-1" },
    });
    expect(hasil?.registrationId).toBe("reg-1");
  });
});
```

- [ ] **Step 3: Jalankan test untuk memastikan gagal**

Run: `npx vitest run tests/modules/presurvei/prospek-repository.test.ts`
Expected: FAIL — `findByNoTelp is not a function`.

- [ ] **Step 4: Implementasikan kedua metode**

Di `modules/presurvei/repositories/ProspekRepository.ts`, tambahkan setelah `findById`:

Tambahkan named constant di atas kelas:

```ts
/**
 * Batas jumlah prospek sebobot nomor yang diambil saat memeriksa duplikat.
 *
 * Yang dibutuhkan hanya beberapa contoh untuk ditampilkan sebagai peringatan,
 * sementara nomor bersama — nomor kios, nomor kantor, atau placeholder yang
 * dipakai berulang — bisa menempel pada ratusan prospek. Kolom `noTelp` juga
 * belum ber-index, jadi membiarkannya tanpa batas berarti pemindaian penuh
 * pada jalur yang dilewati setiap pembuatan prospek.
 */
const BATAS_PERIKSA_DUPLIKAT = 10;
```

dan metodenya:

```ts
  /** Prospek dengan nomor telepon yang sama — dipakai memperingatkan duplikat. */
  async findByNoTelp(noTelp: string): Promise<ProspekEntity[]> {
    const rows = await prisma.presurveiProspek.findMany({
      where: { noTelp },
      orderBy: { createdAt: "desc" },
      take: BATAS_PERIKSA_DUPLIKAT,
    });
    return rows.map((row) => toProspekEntity(row as ProspekRow));
  }

  /** Prospek yang lahir dari satu pendaftaran publik, null bila belum ada. */
  async findByRegistrationId(
    registrationId: string,
  ): Promise<ProspekEntity | null> {
    const row = await prisma.presurveiProspek.findUnique({
      where: { registrationId },
    });
    return row ? toProspekEntity(row as ProspekRow) : null;
  }
```

- [ ] **Step 5: Perbarui mock port di test yang sudah ada**

Menambah metode ke `IProspekRepository` membuat setiap objek mock yang mengaku memenuhi antarmuka itu gagal typecheck (`TS2739`). Tambahkan keduanya ke `bangunRepository()` di `tests/modules/presurvei/prospek-service.test.ts`, mengikuti pola `findById` yang sudah ada:

```ts
  findByNoTelp: vi.fn().mockResolvedValue([]),
  findByRegistrationId: vi.fn().mockResolvedValue(null),
```

Jalankan `npx tsc --noEmit -p tsconfig.typecheck.json 2>&1 | grep presurvei` untuk menemukan berkas mana saja yang mengeluh — jangan menebak daftarnya.

- [ ] **Step 6: Jalankan kedua verifikasi**

Run: `npx vitest run tests/modules/presurvei/`
Expected: seluruh modul hijau, 125 test (119 + 4 baru).

Run: `npx tsc --noEmit -p tsconfig.typecheck.json 2>&1 | grep presurvei`
Expected: tanpa output.

- [ ] **Step 6: Commit**

```bash
git add modules/presurvei tests/modules/presurvei/prospek-repository.test.ts
git commit -m "feat(presurvei): perluas port prospek untuk dedup dan penandaan konversi"
```

---

### Task 4: Peringatan duplikat nomor telepon

**Files:**
- Modify: `modules/presurvei/services/ProspekService.ts`
- Modify: `modules/presurvei/validators/prospek.validator.ts`
- Modify: `app/api/presurvei/prospek/route.ts`
- Test: `tests/modules/presurvei/prospek-service.test.ts`

**Interfaces:**
- Consumes: `findByNoTelp` (Task 3)
- Produces: `ProspekService.buat(input, opsi?: { abaikanDuplikat?: boolean })` yang melempar `AppError` 409 `DUPLIKAT` bila ada prospek aktif bernomor sama, kecuali diminta mengabaikannya.

Spec §13 menjanjikan "peringatan duplikat berbasis nomor telepon saat input manual". Peringatan, bukan larangan: orang memang bisa punya dua kebutuhan, dan sales di lapangan tidak boleh terhalang. Jadi penolakan pertama membawa data duplikatnya agar klien bisa menampilkannya, lalu klien mengirim ulang dengan penanda bila memang disengaja.

- [ ] **Step 1: Tulis test lebih dulu**

Tambahkan ke `tests/modules/presurvei/prospek-service.test.ts`:

```ts
describe("ProspekService.buat — peringatan duplikat", () => {
  let repository: IProspekRepository;

  beforeEach(() => {
    repository = bangunRepository();
  });

  const masukan = {
    nama: "Budi",
    noTelp: "081234567890",
    alamat: "Jl. Merdeka 10",
    sumber: "WALK_IN" as const,
    pemilikId: "user-1",
  };

  it("menolak saat ada prospek aktif dengan nomor yang sama", async () => {
    vi.mocked(repository.findByNoTelp).mockResolvedValue([
      prospek({ id: "prospek-lama", status: "NEGOSIASI" }),
    ]);
    const service = new ProspekService(repository);

    await expect(service.buat(masukan)).rejects.toMatchObject({
      statusCode: 409,
      code: "DUPLIKAT",
    });

    expect(repository.create).not.toHaveBeenCalled();
  });

  it("menyertakan prospek duplikatnya supaya klien bisa menampilkannya", async () => {
    vi.mocked(repository.findByNoTelp).mockResolvedValue([
      prospek({ id: "prospek-lama", nama: "Budi Lama" }),
    ]);
    const service = new ProspekService(repository);

    await expect(service.buat(masukan)).rejects.toMatchObject({
      details: { duplikat: [{ id: "prospek-lama", nama: "Budi Lama" }] },
    });
  });

  it("tetap membuat saat pemanggil menyatakan duplikatnya disengaja", async () => {
    vi.mocked(repository.findByNoTelp).mockResolvedValue([
      prospek({ id: "prospek-lama" }),
    ]);
    vi.mocked(repository.create).mockResolvedValue(prospek());
    const service = new ProspekService(repository);

    await service.buat(masukan, { abaikanDuplikat: true });

    expect(repository.create).toHaveBeenCalledOnce();
    // Pencariannya harus benar-benar dilewati, bukan dijalankan lalu hasilnya
    // dibuang — kalau tidak, setiap pembuatan yang disengaja tetap membayar
    // satu query pada kolom yang belum ber-index.
    expect(repository.findByNoTelp).not.toHaveBeenCalled();
  });

  it("tidak menghitung prospek yang sudah final sebagai duplikat", async () => {
    // Orang yang dulu menolak boleh dicatat lagi sebagai prospek baru —
    // yang mengganggu hanyalah dua prospek aktif untuk orang yang sama.
    vi.mocked(repository.findByNoTelp).mockResolvedValue([
      prospek({ id: "prospek-lama", status: "TIDAK_LAYAK" }),
      prospek({ id: "prospek-lawas", status: "DEAL" }),
    ]);
    vi.mocked(repository.create).mockResolvedValue(prospek());
    const service = new ProspekService(repository);

    await service.buat(masukan);

    expect(repository.create).toHaveBeenCalledOnce();
  });

  it("membuat langsung saat tidak ada nomor yang sama", async () => {
    vi.mocked(repository.findByNoTelp).mockResolvedValue([]);
    vi.mocked(repository.create).mockResolvedValue(prospek());
    const service = new ProspekService(repository);

    await service.buat(masukan);

    expect(repository.create).toHaveBeenCalledOnce();
  });
});
```

Perbarui juga `bangunRepository()` di berkas itu agar memuat kedua metode baru:

```ts
const bangunRepository = (): IProspekRepository => ({
  findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  findById: vi.fn().mockResolvedValue(null),
  findByNoTelp: vi.fn().mockResolvedValue([]),
  findByRegistrationId: vi.fn().mockResolvedValue(null),
  create: vi.fn(),
  update: vi.fn(),
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run tests/modules/presurvei/prospek-service.test.ts`
Expected: FAIL — duplikat tidak terdeteksi, `repository.create` tetap terpanggil.

- [ ] **Step 3: Implementasikan di service**

Di `modules/presurvei/services/ProspekService.ts`, tambahkan import `isStatusFinal` dari `../domain/prospek-rules`, lalu ubah `buat`:

```ts
/** Pilihan tambahan saat membuat prospek. */
export interface OpsiBuatProspek {
  /** Lanjutkan meski ada prospek aktif dengan nomor telepon yang sama. */
  abaikanDuplikat?: boolean;
}

/** Ringkasan prospek duplikat yang dikembalikan bersama penolakan. */
interface RingkasanDuplikat {
  id: string;
  nama: string;
  status: ProspekStatus;
  pemilikId: string | null;
}
```

`status` memakai `ProspekStatus`, bukan `string` polos — tipe itu sudah ada di domain, dan memakainya berarti status yang keliru tertangkap saat kompilasi. Impor `ProspekStatus` bersama `ProspekEntity` dari `../domain/entities/Prospek`.

dan di dalam kelas:

```ts
  /**
   * Simpan prospek baru, menolak duplikat nomor telepon kecuali diminta lain.
   *
   * Penolakannya membawa prospek yang bentrok supaya klien bisa menampilkannya
   * dan pemakai memutuskan sendiri — dua orang memang bisa berbagi nomor, dan
   * sales di lapangan tidak boleh terhalang oleh tebakan sistem.
   */
  async buat(
    input: CreateProspekInput,
    opsi: OpsiBuatProspek = {},
  ): Promise<ProspekEntity> {
    if (!opsi.abaikanDuplikat) {
      const duplikat = await this.cariDuplikatAktif(input.noTelp);
      if (duplikat.length > 0) {
        throw new AppError(
          "Sudah ada prospek aktif dengan nomor telepon ini",
          409,
          "DUPLIKAT",
          { duplikat },
        );
      }
    }

    return this.repository.create(input);
  }

  private async cariDuplikatAktif(
    noTelp: string,
  ): Promise<RingkasanDuplikat[]> {
    const sama = await this.repository.findByNoTelp(noTelp);
    return sama
      .filter((prospek) => !isStatusFinal(prospek.status))
      .map((prospek) => ({
        id: prospek.id,
        nama: prospek.nama,
        status: prospek.status,
        pemilikId: prospek.pemilikId,
      }));
  }
```

Perhatikan pemakaian `isStatusFinal`: prospek yang sudah `DEAL` atau `TIDAK_LAYAK` tidak menghalangi pencatatan baru. Yang mengganggu hanyalah dua prospek aktif untuk orang yang sama.

- [ ] **Step 4: Terima penanda dari klien**

Di `modules/presurvei/validators/prospek.validator.ts`, tambahkan ke `buatProspekSchema`:

```ts
  abaikanDuplikat: z.boolean().optional(),
```

Di `app/api/presurvei/prospek/route.ts`, pisahkan penanda itu dari data prospek:

```ts
  async (_request, ctx) => {
    const { abaikanDuplikat, ...dataProspek } = ctx.validated;

    const prospek = await service.buat(
      {
        ...dataProspek,
        pemilikId: tentukanPemilikProspek(
          ctx.permissions,
          ctx.validated.pemilikId,
          ctx.session!.user.id,
        ),
      },
      { abaikanDuplikat },
    );

    return apiSuccess(toProspekDetail(prospek), { status: 201 });
  },
```

- [ ] **Step 5: Jalankan kedua verifikasi**

Run: `npx vitest run tests/modules/presurvei/`
Expected: seluruh modul hijau, 128 test.

Run: `npx tsc --noEmit -p tsconfig.typecheck.json 2>&1 | grep presurvei`
Expected: tanpa output.

- [ ] **Step 6: Commit**

```bash
git add modules/presurvei app/api/presurvei tests/modules/presurvei
git commit -m "feat(presurvei): peringatkan duplikat prospek berdasarkan nomor telepon"
```

---

### Task 5: Handler registrasi menjadi prospek

**Files:**
- Create: `modules/presurvei/services/event-handlers/registration-created-presurvei.handler.ts`
- Modify: `modules/presurvei/index.ts`
- Modify: `lib/event-bus/event-handlers.ts`
- Test: `tests/modules/presurvei/registration-created-handler.test.ts`

**Interfaces:**
- Consumes: `EVENT_NAMES.REGISTRATION_CREATED` (Task 2), `findByRegistrationId` (Task 3)
- Produces: `handleRegistrationCreatedPresurvei(job: Job<EventJobData>): Promise<void>`, diekspor dari `modules/presurvei/index.ts`

Handler ini **wajib idempotent**: event bus memberi jaminan at-least-once, jadi satu pendaftaran bisa sampai dua kali. `PresurveiProspek.registrationId` unik, jadi percobaan kedua akan ditolak database — tapi mengandalkan pelanggaran constraint sebagai alur normal berarti log penuh error palsu dan BullMQ me-retry sia-sia. Periksa lebih dulu.

Penugasan pemilik memakai aturan beban paling ringan di antara sales aktif. Bila tidak ada sales sama sekali, prospek dibuat tanpa pemilik dan muncul di daftar "Belum ditugaskan" — lebih jujur daripada menempelkannya ke orang yang kebetulan pertama ditemukan.

- [ ] **Step 1: Tulis test lebih dulu**

Create `tests/modules/presurvei/registration-created-handler.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";

/**
 * Event bus memberi jaminan at-least-once, jadi satu pendaftaran bisa sampai
 * dua kali. Tanpa pemeriksaan di depan, percobaan kedua menabrak unique
 * constraint `registrationId` — log penuh error palsu dan BullMQ me-retry
 * sesuatu yang sebenarnya sudah berhasil.
 */

const buatProspek = vi.fn();
const cariByRegistrationId = vi.fn();
const cariSalesTeringan = vi.fn();

vi.mock("@/modules/presurvei/repositories/ProspekRepository", () => ({
  ProspekRepository: class {
    create = buatProspek;
    findByRegistrationId = cariByRegistrationId;
  },
}));

vi.mock(
  "@/modules/presurvei/services/event-handlers/cari-sales-teringan",
  () => ({ cariSalesTeringan }),
);

import { handleRegistrationCreatedPresurvei } from "@/modules/presurvei/services/event-handlers/registration-created-presurvei.handler";

const job = (payload: Record<string, unknown>): Job<never> =>
  ({ data: { payload } }) as never;

const payloadLengkap = {
  registrationId: "reg-1",
  nama: "Budi",
  noTelp: "081234567890",
  email: "budi@contoh.id",
  alamat: "Jl. Merdeka 10",
  paketDiminati: "20 Mbps",
  utmSource: "instagram",
  utmMedium: "cpc",
  utmCampaign: "promo-ramadan",
  tenantId: "tenant-1",
};

describe("handleRegistrationCreatedPresurvei", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cariByRegistrationId.mockResolvedValue(null);
    cariSalesTeringan.mockResolvedValue("sales-1");
    buatProspek.mockResolvedValue({ id: "prospek-1" });
  });

  it("melahirkan prospek bersumber WEBSITE dari pendaftaran", async () => {
    await handleRegistrationCreatedPresurvei(job(payloadLengkap));

    expect(buatProspek).toHaveBeenCalledWith(
      expect.objectContaining({
        nama: "Budi",
        noTelp: "081234567890",
        email: "budi@contoh.id",
        alamat: "Jl. Merdeka 10",
        paketDiminati: "20 Mbps",
        sumber: "WEBSITE",
        registrationId: "reg-1",
        pemilikId: "sales-1",
      }),
    );
  });

  it("tidak membuat prospek kedua saat event sampai dua kali", async () => {
    cariByRegistrationId.mockResolvedValue({ id: "prospek-lama" });

    await handleRegistrationCreatedPresurvei(job(payloadLengkap));

    expect(buatProspek).not.toHaveBeenCalled();
  });

  it("membuat prospek tanpa pemilik saat tidak ada sales aktif", async () => {
    cariSalesTeringan.mockResolvedValue(null);

    await handleRegistrationCreatedPresurvei(job(payloadLengkap));

    expect(buatProspek).toHaveBeenCalledWith(
      expect.objectContaining({ pemilikId: null }),
    );
  });

  it("menolak payload tanpa registrationId", async () => {
    const { registrationId: _dibuang, ...tanpaId } = payloadLengkap;

    await expect(
      handleRegistrationCreatedPresurvei(job(tanpaId)),
    ).rejects.toThrow();

    expect(buatProspek).not.toHaveBeenCalled();
  });

  it("menolak payload tanpa nomor telepon", async () => {
    // Prospek tanpa nomor telepon tidak bisa di-follow-up sama sekali.
    const { noTelp: _dibuang, ...tanpaTelp } = payloadLengkap;

    await expect(
      handleRegistrationCreatedPresurvei(job(tanpaTelp)),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run tests/modules/presurvei/registration-created-handler.test.ts`
Expected: FAIL — modul handler belum ada.

- [ ] **Step 3: Tulis pencari sales beban teringan**

Create `modules/presurvei/services/event-handlers/cari-sales-teringan.ts`:

```ts
import { prisma } from "@/modules/database";
import { PROSPEK_STATUSES } from "../../domain/entities/Prospek";
import { isStatusFinal } from "../../domain/prospek-rules";

/**
 * Sales dengan prospek aktif paling sedikit, atau null bila tidak ada sales.
 *
 * Prospek dari form publik tidak membawa petunjuk siapa yang harus menanganinya,
 * jadi dibagi merata. Mengembalikan null — bukan menempelkannya ke orang pertama
 * yang ditemukan — supaya prospek tak bertuan terlihat jelas di daftar admin.
 */
export async function cariSalesTeringan(): Promise<string | null> {
  const statusAktif = PROSPEK_STATUSES.filter((status) => !isStatusFinal(status));

  const sales = await prisma.user.findMany({
    where: { isSales: true, isActive: true },
    select: {
      id: true,
      _count: {
        select: { presurveiProspek: { where: { status: { in: statusAktif } } } },
      },
    },
  });

  if (sales.length === 0) return null;

  return sales.reduce((teringan, kandidat) =>
    kandidat._count.presurveiProspek < teringan._count.presurveiProspek
      ? kandidat
      : teringan,
  ).id;
}
```

Sebelum menulis ini, **periksa `model User` di `prisma/schema.prisma`** untuk memastikan nama field `isActive` benar — bila repo memakai nama lain (`isDeleted`, `status`, atau tidak ada sama sekali), sesuaikan dan sebutkan di laporanmu. Jangan menebak.

- [ ] **Step 4: Tulis handler**

Create `modules/presurvei/services/event-handlers/registration-created-presurvei.handler.ts`:

```ts
import type { Job } from "bullmq";
import { logger } from "@/lib/logger";
import { requirePayloadString } from "@/lib/event-bus";
import type { EventJobData } from "@/lib/event-bus/queues";
import { ProspekRepository } from "../../repositories/ProspekRepository";
import { cariSalesTeringan } from "./cari-sales-teringan";

const SOURCE = "RegistrationCreatedPresurveiHandler";

/**
 * Lahirkan prospek dari pendaftaran yang masuk lewat form publik.
 *
 * Idempotent lewat pemeriksaan `registrationId`: event bus menjamin
 * at-least-once, dan mengandalkan unique constraint sebagai alur normal berarti
 * log penuh error palsu serta retry yang sia-sia.
 */
export async function handleRegistrationCreatedPresurvei(
  job: Job<EventJobData>,
): Promise<void> {
  const { payload } = job.data;
  const registrationId = requirePayloadString(
    payload.registrationId,
    "registrationId",
    SOURCE,
  );
  const nama = requirePayloadString(payload.nama, "nama", SOURCE);
  const noTelp = requirePayloadString(payload.noTelp, "noTelp", SOURCE);
  const alamat = requirePayloadString(payload.alamat, "alamat", SOURCE);

  const repository = new ProspekRepository();

  const sudahAda = await repository.findByRegistrationId(registrationId);
  if (sudahAda) {
    logger.info(
      `[${SOURCE}] Pendaftaran ${registrationId} sudah punya prospek, dilewati`,
    );
    return;
  }

  const prospek = await repository.create({
    nama,
    noTelp,
    alamat,
    email: (payload.email as string | null) ?? null,
    paketDiminati: (payload.paketDiminati as string | null) ?? null,
    sumber: "WEBSITE",
    registrationId,
    pemilikId: await cariSalesTeringan(),
  });

  logger.info(
    `[${SOURCE}] Prospek ${prospek.id} dibuat dari pendaftaran ${registrationId}`,
  );
}
```

Perhatikan: pencocokan `utmCampaign` ke iklan **belum** dilakukan di sini — entitas Iklan baru dibangun Gelombang B, dan Task 10 yang menambahkannya.

- [ ] **Step 5: Ekspor dan daftarkan**

Di `modules/presurvei/index.ts`, tambahkan:

```ts
export { handleRegistrationCreatedPresurvei } from "./services/event-handlers/registration-created-presurvei.handler";
```

Di `lib/event-bus/event-handlers.ts`, tambahkan import dari `@/modules/presurvei` dan registrasi di dalam `registerDefaultHandlers()`:

```ts
  registerEventHandler(
    EVENT_NAMES.REGISTRATION_CREATED,
    handleRegistrationCreatedPresurvei,
  );
```

- [ ] **Step 6: Jalankan kedua verifikasi**

Run: `npx vitest run tests/modules/presurvei/`
Expected: seluruh modul hijau, 133 test.

Run: `npx tsc --noEmit -p tsconfig.typecheck.json 2>&1 | grep presurvei`
Expected: tanpa output.

- [ ] **Step 7: Commit**

```bash
git add modules/presurvei lib/event-bus/event-handlers.ts tests/modules/presurvei
git commit -m "feat(presurvei): lahirkan prospek dari pendaftaran publik lewat event"
```

---

### Task 6: Promosi prospek menjadi Canvasing

**Files:**
- Modify: `modules/marketing/index.ts` (ekspor satu tipe)
- Create: `modules/presurvei/services/ProspekKonversiService.ts`
- Create: `modules/presurvei/validators/konversi.validator.ts`
- Modify: `modules/presurvei/index.ts`
- Modify: `lib/event-bus/types.ts` (event `presurvei:prospek.converted`)
- Create: `app/api/presurvei/prospek/[id]/jadikan-canvasing/route.ts`
- Test: `tests/modules/presurvei/prospek-konversi-service.test.ts`

**Interfaces:**
- Consumes: `canPromosikanKeCanvasing` (Fase 1), `UpdateProspekInput.canvasingId/konversiAt` (Task 3), `createCanvasingService` dari `@/modules/marketing`
- Produces: `ProspekKonversiService.jadikanCanvasing(prospekId, input, pemilikWajib?)`

**Yang membuat task ini tidak sepele:** `CreateCanvasingInput` mewajibkan `noKtp`, `kabel`, dan `paket`. Prospek tidak punya `noKtp` maupun `kabel` sama sekali, dan `paketDiminati`-nya string bebas sementara canvasing menuntut salah satu dari `CANVASING_PACKAGE_VALUES`. Jadi endpoint ini **menerima** ketiganya dari body — ia bukan sekadar menyalin prospek, melainkan melengkapinya. Data teknis (`odp`, `kabel`) diambil dari kegiatan survei terbaru bila ada, sebagai nilai awal yang bisa ditimpa body.

- [ ] **Step 1: Ekspor tipe input canvasing**

`CreateCanvasingInput` saat ini tidak bisa dijangkau dari luar modul marketing. Di `modules/marketing/index.ts`, tambahkan:

```ts
export type { CreateCanvasingInput } from "./domain/ports/ICanvasingRepository";
```

Ini menambah permukaan publik modul marketing seminimal mungkin — satu tipe, bukan seluruh barrel port-nya.

- [ ] **Step 2: Tambahkan event konversi**

Di `lib/event-bus/types.ts`, empat tempat seperti Task 2:

```ts
  PRESURVEI_PROSPEK_CONVERTED: "presurvei:prospek.converted",
```

```ts
/**
 * Prospek presurvei dipromosikan menjadi canvasing.
 *
 * Dipublikasikan agar perhitungan pencapaian target dan laporan atribusi punya
 * satu titik pasti kapan sebuah prospek dianggap berhasil.
 */
export interface PresurveiProspekConvertedPayload extends BaseEventPayload {
  prospekId: string;
  canvasingId: string;
  pemilikId: string | null;
  sumber: string;
  iklanId: string | null;
  konversiAt: string;
}
```

```ts
  [EVENT_NAMES.PRESURVEI_PROSPEK_CONVERTED]: PresurveiProspekConvertedPayload;
```

```ts
  [EVENT_NAMES.PRESURVEI_PROSPEK_CONVERTED]: {
    name: EVENT_NAMES.PRESURVEI_PROSPEK_CONVERTED,
    category: "marketing",
    priority: JOB_PRIORITIES.NORMAL,
    persistent: true,
    async: true,
  },
```

- [ ] **Step 3: Tulis validator**

Create `modules/presurvei/validators/konversi.validator.ts`:

```ts
import { z } from "zod";

/**
 * Masukan pelengkap saat prospek dipromosikan menjadi canvasing.
 *
 * Canvasing menuntut nomor KTP, panjang kabel, dan paket dari daftar tetap —
 * tiga hal yang tidak dimiliki prospek. Endpoint promosi karenanya melengkapi,
 * bukan sekadar menyalin.
 */

const PANJANG_KTP_MIN = 16;
const PANJANG_KTP_MAKS = 20;
const KABEL_METER_MAKS = 5000;
const PANJANG_TEKS_MAKS = 120;

export const jadikanCanvasingSchema = z.object({
  noKtp: z.string().min(PANJANG_KTP_MIN).max(PANJANG_KTP_MAKS),
  paket: z.string().min(1).max(PANJANG_TEKS_MAKS),
  kabel: z.number().int().min(0).max(KABEL_METER_MAKS).optional(),
  odp: z.string().max(PANJANG_TEKS_MAKS).optional().nullable(),
  sn: z.string().max(PANJANG_TEKS_MAKS).optional().nullable(),
  foto: z.string().url().optional().nullable(),
  fotoKtp: z.string().url().optional().nullable(),
});

export type JadikanCanvasingInput = z.infer<typeof jadikanCanvasingSchema>;
```

`kabel` opsional karena nilainya bisa datang dari kegiatan survei; service yang memutuskan nilai akhirnya.

- [ ] **Step 4: Tulis test service lebih dulu**

Create `tests/modules/presurvei/prospek-konversi-service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Promosi menyentuh dua modul sekaligus, jadi urutannya penting: canvasing
 * dibuat lebih dulu, baru prospek ditandai. Bila urutannya dibalik dan
 * pembuatan canvasing gagal, prospek terlanjur tercatat terkonversi ke
 * canvasing yang tidak pernah ada.
 */

import { ProspekKonversiService } from "@/modules/presurvei/services/ProspekKonversiService";
import type { IProspekRepository } from "@/modules/presurvei/domain/ports/IProspekRepository";
import type { IKegiatanRepository } from "@/modules/presurvei/domain/ports/IKegiatanRepository";
import type { ProspekEntity } from "@/modules/presurvei/domain/entities/Prospek";
import type { KegiatanEntity } from "@/modules/presurvei/domain/entities/Kegiatan";

const WAKTU = new Date("2026-09-23T00:00:00.000Z");

const prospek = (over: Partial<ProspekEntity> = {}): ProspekEntity =>
  ({
    id: "prospek-1",
    nama: "Budi",
    noTelp: "081234567890",
    email: null,
    alamat: "Jl. Merdeka 10",
    latitude: -6.2,
    longitude: 106.8,
    shareloc: null,
    sumber: "LAPANGAN",
    iklanId: null,
    registrationId: null,
    referralNama: null,
    status: "DEAL",
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

const kegiatanSurvei = (over: Partial<KegiatanEntity> = {}): KegiatanEntity =>
  ({
    id: "kegiatan-1",
    jenis: "SURVEI_LOKASI",
    userId: "user-1",
    prospekId: "prospek-1",
    iklanId: null,
    waktuMulai: WAKTU,
    waktuSelesai: null,
    latitude: -6.2,
    longitude: 106.8,
    alamatDikunjungi: "Jl. Merdeka 10",
    ditemuiNama: "Budi",
    hasil: "DEAL",
    catatan: null,
    fotoUrls: ["https://contoh.id/rumah.webp"],
    odpTerdekat: "ODP-12",
    estimasiKabelMeter: 120,
    catatanTeknis: null,
    siteId: null,
    tenantId: "tenant-1",
    createdAt: WAKTU,
    updatedAt: WAKTU,
    ...over,
  }) as KegiatanEntity;

const bangunProspekRepo = (): IProspekRepository => ({
  findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  findById: vi.fn().mockResolvedValue(prospek()),
  findByNoTelp: vi.fn().mockResolvedValue([]),
  findByRegistrationId: vi.fn().mockResolvedValue(null),
  create: vi.fn(),
  update: vi.fn().mockResolvedValue(prospek({ canvasingId: "canvasing-1" })),
});

const bangunKegiatanRepo = (): IKegiatanRepository => ({
  findMany: vi.fn().mockResolvedValue({ items: [kegiatanSurvei()], total: 1 }),
  findById: vi.fn().mockResolvedValue(null),
  create: vi.fn(),
  createDenganProspek: vi.fn(),
});

const masukan = { noKtp: "3201234567890001", paket: "HOME_20MBPS" };

describe("ProspekKonversiService.jadikanCanvasing", () => {
  let prospekRepo: IProspekRepository;
  let kegiatanRepo: IKegiatanRepository;
  let buatCanvasing: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    prospekRepo = bangunProspekRepo();
    kegiatanRepo = bangunKegiatanRepo();
    buatCanvasing = vi.fn().mockResolvedValue({ id: "canvasing-1" });
  });

  const service = () =>
    new ProspekKonversiService(prospekRepo, kegiatanRepo, buatCanvasing);

  it("menolak prospek yang belum DEAL", async () => {
    vi.mocked(prospekRepo.findById).mockResolvedValue(
      prospek({ status: "NEGOSIASI" }),
    );

    await expect(
      service().jadikanCanvasing("prospek-1", masukan),
    ).rejects.toMatchObject({ statusCode: 409, code: "INVALID_STATE" });

    expect(buatCanvasing).not.toHaveBeenCalled();
  });

  it("menolak prospek yang sudah pernah dipromosikan", async () => {
    vi.mocked(prospekRepo.findById).mockResolvedValue(
      prospek({ canvasingId: "canvasing-lama" }),
    );

    await expect(
      service().jadikanCanvasing("prospek-1", masukan),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(buatCanvasing).not.toHaveBeenCalled();
  });

  it("memakai data teknis dari kegiatan survei terbaru", async () => {
    await service().jadikanCanvasing("prospek-1", masukan);

    expect(buatCanvasing).toHaveBeenCalledWith(
      expect.objectContaining({ odp: "ODP-12", kabel: 120 }),
    );
  });

  it("mengutamakan nilai dari body di atas data kegiatan", async () => {
    await service().jadikanCanvasing("prospek-1", {
      ...masukan,
      kabel: 200,
      odp: "ODP-99",
    });

    expect(buatCanvasing).toHaveBeenCalledWith(
      expect.objectContaining({ odp: "ODP-99", kabel: 200 }),
    );
  });

  it("memindahkan identitas prospek ke canvasing", async () => {
    await service().jadikanCanvasing("prospek-1", masukan);

    expect(buatCanvasing).toHaveBeenCalledWith(
      expect.objectContaining({
        nama: "Budi",
        noTelpon: "081234567890",
        alamat: "Jl. Merdeka 10",
        latitude: -6.2,
        longitude: 106.8,
        noKtp: "3201234567890001",
        paket: "HOME_20MBPS",
        salesId: "user-1",
      }),
    );
  });

  it("menandai prospek setelah canvasing terbentuk, bukan sebelumnya", async () => {
    const urutan: string[] = [];
    buatCanvasing.mockImplementation(async () => {
      urutan.push("canvasing");
      return { id: "canvasing-1" };
    });
    vi.mocked(prospekRepo.update).mockImplementation(async () => {
      urutan.push("tandai");
      return prospek({ canvasingId: "canvasing-1" });
    });

    await service().jadikanCanvasing("prospek-1", masukan);

    expect(urutan).toEqual(["canvasing", "tandai"]);
  });

  it("tidak menandai prospek bila pembuatan canvasing gagal", async () => {
    buatCanvasing.mockRejectedValue(new Error("canvasing gagal"));

    await expect(
      service().jadikanCanvasing("prospek-1", masukan),
    ).rejects.toThrow();

    expect(prospekRepo.update).not.toHaveBeenCalled();
  });

  it("menghormati pembatasan kepemilikan", async () => {
    await expect(
      service().jadikanCanvasing("prospek-1", masukan, "sales-lain"),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(buatCanvasing).not.toHaveBeenCalled();
  });

  it("memakai kabel nol bila tidak ada kegiatan survei maupun nilai dari body", async () => {
    vi.mocked(kegiatanRepo.findMany).mockResolvedValue({ items: [], total: 0 });

    await service().jadikanCanvasing("prospek-1", masukan);

    expect(buatCanvasing).toHaveBeenCalledWith(
      expect.objectContaining({ kabel: 0, odp: null }),
    );
  });
});
```

- [ ] **Step 5: Jalankan test untuk memastikan gagal**

Run: `npx vitest run tests/modules/presurvei/prospek-konversi-service.test.ts`
Expected: FAIL — `ProspekKonversiService` belum ada.

- [ ] **Step 6: Tulis service**

Create `modules/presurvei/services/ProspekKonversiService.ts`:

```ts
import { AppError } from "@/lib/errors";
import type { CreateCanvasingInput } from "@/modules/marketing";
import type { KegiatanEntity } from "../domain/entities/Kegiatan";
import type { ProspekEntity } from "../domain/entities/Prospek";
import { canPromosikanKeCanvasing } from "../domain/prospek-rules";
import type { IKegiatanRepository } from "../domain/ports/IKegiatanRepository";
import type { IProspekRepository } from "../domain/ports/IProspekRepository";
import { KegiatanRepository } from "../repositories/KegiatanRepository";
import { ProspekRepository } from "../repositories/ProspekRepository";
import type { JadikanCanvasingInput } from "../validators/konversi.validator";

/** Membuat canvasing dari data yang sudah lengkap. */
type PembuatCanvasing = (input: CreateCanvasingInput) => Promise<{ id: string }>;

const KABEL_BAWAAN_METER = 0;
const JUMLAH_KEGIATAN_DIPERIKSA = 1;

/**
 * Promosi prospek yang sudah matang menjadi canvasing.
 *
 * Ini titik temu dua modul: presurvei memegang prospeknya, marketing memegang
 * canvasing beserta alur instalasinya. Canvasing dibuat lebih dulu, prospek
 * ditandai sesudahnya — bila urutannya dibalik dan pembuatan canvasing gagal,
 * prospek terlanjur tercatat terkonversi ke sesuatu yang tidak pernah ada.
 */
export class ProspekKonversiService {
  constructor(
    private readonly prospekRepository: IProspekRepository = new ProspekRepository(),
    private readonly kegiatanRepository: IKegiatanRepository = new KegiatanRepository(),
    private readonly buatCanvasing: PembuatCanvasing = async (input) => {
      const { createCanvasingService } = await import("@/modules/marketing");
      const hasil = await createCanvasingService().createRequest(input);
      return { id: hasil.id };
    },
  ) {}

  /**
   * Jadikan prospek sebagai canvasing, lalu tandai prospeknya.
   *
   * `pemilikWajib` diisi untuk pemanggil yang hanya boleh menyentuh datanya
   * sendiri; biarkan kosong untuk admin.
   */
  async jadikanCanvasing(
    prospekId: string,
    input: JadikanCanvasingInput,
    pemilikWajib?: string,
  ): Promise<{ prospek: ProspekEntity; canvasingId: string }> {
    const prospek = await this.ambilProspek(prospekId, pemilikWajib);

    if (!canPromosikanKeCanvasing(prospek)) {
      throw new AppError(
        prospek.canvasingId
          ? "Prospek ini sudah pernah dijadikan canvasing"
          : "Hanya prospek berstatus DEAL yang bisa dijadikan canvasing",
        409,
        "INVALID_STATE",
      );
    }

    const survei = await this.ambilSurveiTerbaru(prospekId);
    const canvasing = await this.buatCanvasing(
      this.bangunMasukanCanvasing(prospek, input, survei),
    );

    const diperbarui = await this.prospekRepository.update(prospekId, {
      canvasingId: canvasing.id,
      konversiAt: new Date(),
    });

    this.umumkanKonversi(diperbarui, canvasing.id);

    return { prospek: diperbarui, canvasingId: canvasing.id };
  }

  private async ambilProspek(
    prospekId: string,
    pemilikWajib?: string,
  ): Promise<ProspekEntity> {
    const prospek = await this.prospekRepository.findById(prospekId);
    if (!prospek) {
      throw new AppError("Prospek tidak ditemukan", 404, "NOT_FOUND");
    }
    if (pemilikWajib && prospek.pemilikId !== pemilikWajib) {
      throw new AppError("Prospek ini milik sales lain", 403, "FORBIDDEN");
    }
    return prospek;
  }

  private async ambilSurveiTerbaru(
    prospekId: string,
  ): Promise<KegiatanEntity | null> {
    const hasil = await this.kegiatanRepository.findMany({
      prospekId,
      jenis: "SURVEI_LOKASI",
      page: 1,
      limit: JUMLAH_KEGIATAN_DIPERIKSA,
    });
    return hasil.items[0] ?? null;
  }

  private bangunMasukanCanvasing(
    prospek: ProspekEntity,
    input: JadikanCanvasingInput,
    survei: KegiatanEntity | null,
  ): CreateCanvasingInput {
    return {
      nama: prospek.nama,
      noTelpon: prospek.noTelp,
      email: prospek.email,
      alamat: prospek.alamat,
      latitude: prospek.latitude,
      longitude: prospek.longitude,
      shareloc: prospek.shareloc,
      salesId: prospek.pemilikId,
      noKtp: input.noKtp,
      paket: input.paket,
      kabel: input.kabel ?? survei?.estimasiKabelMeter ?? KABEL_BAWAAN_METER,
      odp: input.odp ?? survei?.odpTerdekat ?? null,
      sn: input.sn ?? null,
      foto: input.foto ?? survei?.fotoUrls[0] ?? null,
      fotoKtp: input.fotoKtp ?? null,
    };
  }

  private umumkanKonversi(prospek: ProspekEntity, canvasingId: string): void {
    void (async () => {
      try {
        const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
        await eventBus.publish(EVENT_NAMES.PRESURVEI_PROSPEK_CONVERTED, {
          prospekId: prospek.id,
          canvasingId,
          pemilikId: prospek.pemilikId,
          sumber: prospek.sumber,
          iklanId: prospek.iklanId,
          konversiAt: (prospek.konversiAt ?? new Date()).toISOString(),
          tenantId: prospek.tenantId ?? undefined,
        });
      } catch {
        // Konversinya sudah tersimpan; kegagalan mengumumkan tidak boleh
        // membatalkannya. Laporan yang bersandar pada event ini akan tertinggal,
        // bukan salah.
      }
    })();
  }
}
```

- [ ] **Step 7: Jalankan test sampai hijau**

Run: `npx vitest run tests/modules/presurvei/prospek-konversi-service.test.ts`
Expected: PASS — 9 test lulus.

- [ ] **Step 8: Ekspor dan buat route**

Di `modules/presurvei/index.ts`, tambahkan:

```ts
export { ProspekKonversiService } from "./services/ProspekKonversiService";
export {
  jadikanCanvasingSchema,
  type JadikanCanvasingInput,
} from "./validators/konversi.validator";
```

Create `app/api/presurvei/prospek/[id]/jadikan-canvasing/route.ts`:

```ts
import { apiSuccess, createHandler } from "@/lib/api";
import {
  jadikanCanvasingSchema,
  ProspekKonversiService,
  toProspekDetail,
} from "@/modules/presurvei";
import { isBolehLihatSemuaPresurvei } from "../../../akses-presurvei";

const service = new ProspekKonversiService();

/** POST /api/presurvei/prospek/[id]/jadikan-canvasing — promosikan prospek. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["presurvei:update", "m_presurvei:update"],
    schema: jadikanCanvasingSchema,
  },
  async (_request, ctx) => {
    const hasil = await service.jadikanCanvasing(
      ctx.params.id as string,
      ctx.validated,
      isBolehLihatSemuaPresurvei(ctx.permissions)
        ? undefined
        : ctx.session!.user.id,
    );

    return apiSuccess({
      prospek: toProspekDetail(hasil.prospek),
      canvasingId: hasil.canvasingId,
    });
  },
);
```

- [ ] **Step 9: Jalankan kedua verifikasi**

Run: `npx vitest run tests/modules/presurvei/`
Expected: seluruh modul hijau, 142 test.

Run: `npm run typecheck`
Expected: lulus.

- [ ] **Step 10: Commit**

```bash
git add modules/presurvei modules/marketing/index.ts lib/event-bus/types.ts app/api/presurvei tests/modules/presurvei
git commit -m "feat(presurvei): promosikan prospek matang menjadi canvasing"
```

---

# GELOMBANG B — Iklan

### Task 7: Domain, port, dan mapper iklan

**Files:**
- Create: `modules/presurvei/domain/entities/Iklan.ts`
- Create: `modules/presurvei/domain/iklan-rules.ts`
- Create: `modules/presurvei/domain/ports/IIklanRepository.ts`
- Create: `modules/presurvei/mappers/iklan.mapper.ts`
- Test: `tests/modules/presurvei/iklan-rules.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `IKLAN_CHANNELS` (const array), `IklanChannel` (union type), `IklanEntity`
  - `isIklanBerjalan(iklan, pada?: Date): boolean`
  - `IIklanRepository` dengan `findMany`, `findById`, `findByKode`, `create`, `update`
  - `toIklanEntity(row: IklanRow): IklanEntity`

Tabel `presurvei_iklan` sudah dibuat Fase 1, jadi tidak ada migration di gelombang ini.

- [ ] **Step 1: Tulis entity**

Create `modules/presurvei/domain/entities/Iklan.ts`:

```ts
/**
 * Entitas domain iklan presurvei.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain.
 */

export const IKLAN_CHANNELS = [
  "META",
  "GOOGLE",
  "TIKTOK",
  "WHATSAPP",
  "OFFLINE",
  "LAINNYA",
] as const;

export type IklanChannel = (typeof IKLAN_CHANNELS)[number];

export interface IklanEntity {
  id: string;
  nama: string;
  kode: string;
  channel: IklanChannel;
  tanggalMulai: Date;
  tanggalSelesai: Date | null;
  biaya: number | null;
  penanggungJawabId: string | null;
  isAktif: boolean;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Perhatikan `biaya` bertipe `number | null` di domain meski kolomnya `Decimal` di Prisma — mapper yang mengonversinya, supaya domain tidak bergantung pada tipe Decimal milik Prisma.

- [ ] **Step 2: Tulis test aturan lebih dulu**

Create `tests/modules/presurvei/iklan-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";

/**
 * "Iklan sedang berjalan" tidak sama dengan "iklan aktif". Penanda `isAktif`
 * menyatakan niat pemiliknya; tanggal menyatakan kenyataannya. Keduanya harus
 * benar agar prospek yang masuk hari ini boleh diatribusikan ke iklan itu.
 */

import { isIklanBerjalan } from "@/modules/presurvei/domain/iklan-rules";
import type { IklanEntity } from "@/modules/presurvei/domain/entities/Iklan";

const HARI_INI = new Date("2026-09-22T00:00:00.000Z");

const iklan = (over: Partial<IklanEntity> = {}): IklanEntity =>
  ({
    id: "iklan-1",
    nama: "Promo Ramadan",
    kode: "promo-ramadan",
    channel: "META",
    tanggalMulai: new Date("2026-09-01T00:00:00.000Z"),
    tanggalSelesai: null,
    biaya: null,
    penanggungJawabId: null,
    isAktif: true,
    tenantId: "tenant-1",
    createdAt: HARI_INI,
    updatedAt: HARI_INI,
    ...over,
  }) as IklanEntity;

describe("isIklanBerjalan", () => {
  it("menganggap iklan aktif tanpa tanggal selesai sebagai berjalan", () => {
    expect(isIklanBerjalan(iklan(), HARI_INI)).toBe(true);
  });

  it("menolak iklan yang penandanya dimatikan meski tanggalnya masih berlaku", () => {
    expect(isIklanBerjalan(iklan({ isAktif: false }), HARI_INI)).toBe(false);
  });

  it("menolak iklan yang belum mulai", () => {
    expect(
      isIklanBerjalan(
        iklan({ tanggalMulai: new Date("2026-10-01T00:00:00.000Z") }),
        HARI_INI,
      ),
    ).toBe(false);
  });

  it("menolak iklan yang sudah lewat", () => {
    expect(
      isIklanBerjalan(
        iklan({ tanggalSelesai: new Date("2026-09-10T00:00:00.000Z") }),
        HARI_INI,
      ),
    ).toBe(false);
  });

  it("menerima iklan pada hari mulainya", () => {
    expect(
      isIklanBerjalan(iklan({ tanggalMulai: HARI_INI }), HARI_INI),
    ).toBe(true);
  });

  it("menerima iklan pada hari selesainya", () => {
    expect(
      isIklanBerjalan(iklan({ tanggalSelesai: HARI_INI }), HARI_INI),
    ).toBe(true);
  });
});
```

- [ ] **Step 3: Jalankan test untuk memastikan gagal**

Run: `npx vitest run tests/modules/presurvei/iklan-rules.test.ts`
Expected: FAIL — modul `iklan-rules` belum ada.

- [ ] **Step 4: Tulis aturan**

Create `modules/presurvei/domain/iklan-rules.ts`:

```ts
import type { IklanEntity } from "./entities/Iklan";

/**
 * Aturan bisnis iklan presurvei — fungsi murni, tanpa I/O.
 */

/**
 * Apakah iklan sedang berjalan pada suatu tanggal.
 *
 * Penanda `isAktif` menyatakan niat pemiliknya, tanggal menyatakan kenyataannya;
 * keduanya harus benar. Batas tanggalnya inklusif — iklan yang selesai hari ini
 * masih boleh menerima prospek yang masuk hari ini.
 */
export function isIklanBerjalan(
  iklan: Pick<IklanEntity, "isAktif" | "tanggalMulai" | "tanggalSelesai">,
  pada: Date = new Date(),
): boolean {
  if (!iklan.isAktif) return false;
  if (iklan.tanggalMulai.getTime() > pada.getTime()) return false;
  if (!iklan.tanggalSelesai) return true;
  return iklan.tanggalSelesai.getTime() >= pada.getTime();
}
```

- [ ] **Step 5: Tulis port**

Create `modules/presurvei/domain/ports/IIklanRepository.ts`:

```ts
import type { IklanChannel, IklanEntity } from "../entities/Iklan";

/**
 * Kontrak akses data iklan presurvei.
 */

export interface IklanListFilters {
  channel?: IklanChannel;
  isAktif?: boolean;
  search?: string;
  page: number;
  limit: number;
}

export interface CreateIklanInput {
  nama: string;
  kode: string;
  channel: IklanChannel;
  tanggalMulai: Date;
  tanggalSelesai?: Date | null;
  biaya?: number | null;
  penanggungJawabId?: string | null;
  isAktif?: boolean;
}

export interface UpdateIklanInput {
  nama?: string;
  channel?: IklanChannel;
  tanggalMulai?: Date;
  tanggalSelesai?: Date | null;
  biaya?: number | null;
  penanggungJawabId?: string | null;
  isAktif?: boolean;
}

export interface IIklanRepository {
  findMany(
    filters: IklanListFilters,
  ): Promise<{ items: IklanEntity[]; total: number }>;
  findById(id: string): Promise<IklanEntity | null>;
  /** Iklan dengan kode kampanye tertentu — dipakai mencocokkan `utm_campaign`. */
  findByKode(kode: string): Promise<IklanEntity | null>;
  create(input: CreateIklanInput): Promise<IklanEntity>;
  update(id: string, input: UpdateIklanInput): Promise<IklanEntity>;
}
```

`kode` sengaja tidak ada di `UpdateIklanInput`: ia dipakai mencocokkan `utm_campaign` pada tautan yang sudah tersebar di luar sana, jadi mengubahnya memutus atribusi prospek yang datang kemudian.

- [ ] **Step 6: Tulis mapper**

Create `modules/presurvei/mappers/iklan.mapper.ts`:

```ts
import type { IklanChannel, IklanEntity } from "../domain/entities/Iklan";

/**
 * Pemetaan baris Prisma ke entitas domain iklan.
 *
 * Bentuk barisnya dideklarasikan struktural supaya mapper tidak perlu
 * mengimpor tipe Prisma.
 */

export interface IklanRow {
  id: string;
  nama: string;
  kode: string;
  channel: string;
  tanggalMulai: Date;
  tanggalSelesai: Date | null;
  biaya: { toNumber(): number } | number | null;
  penanggungJawabId: string | null;
  isAktif: boolean;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Ubah satu baris iklan dari database menjadi entitas domain. */
export function toIklanEntity(row: IklanRow): IklanEntity {
  return {
    id: row.id,
    nama: row.nama,
    kode: row.kode,
    channel: row.channel as IklanChannel,
    tanggalMulai: row.tanggalMulai,
    tanggalSelesai: row.tanggalSelesai,
    // Decimal Prisma dan number polos (dari fixture test) ditangani lewat union
    // eksplisit, bukan duck-typing `toString()`. Setiap nilai JavaScript punya
    // `toString()`, jadi bentuk baris yang keliru akan lolos kompilasi lalu
    // diam-diam menghasilkan NaN pada kolom yang dipakai menghitung biaya per
    // lead. `toNumber()` hanya dipenuhi objek mirip-Decimal.
    biaya:
      row.biaya === null
        ? null
        : typeof row.biaya === "number"
          ? row.biaya
          : row.biaya.toNumber(),
    penanggungJawabId: row.penanggungJawabId,
    isAktif: row.isAktif,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
```

- [ ] **Step 7: Jalankan kedua verifikasi**

Run: `npx vitest run tests/modules/presurvei/`
Expected: seluruh modul hijau; task ini menambah 6 test baru. Jangan mencocokkan totalnya dengan angka apa pun — baseline bergeser tiap ronde perbaikan, dan yang harus benar adalah pertambahannya.

Run: `npx tsc --noEmit -p tsconfig.typecheck.json 2>&1 | grep presurvei`
Expected: tanpa output.

- [ ] **Step 8: Commit**

```bash
git add modules/presurvei tests/modules/presurvei/iklan-rules.test.ts
git commit -m "feat(presurvei): tambah domain, port, dan mapper iklan"
```

---

### Task 8: Repository, validator, dan service iklan

**Files:**
- Create: `modules/presurvei/repositories/IklanRepository.ts`
- Create: `modules/presurvei/validators/iklan.validator.ts`
- Create: `modules/presurvei/services/IklanService.ts`
- Test: `tests/modules/presurvei/iklan-repository.test.ts`
- Test: `tests/modules/presurvei/iklan-service.test.ts`

**Interfaces:**
- Consumes: seluruh keluaran Task 7
- Produces:
  - `class IklanRepository implements IIklanRepository`
  - `buatIklanSchema`, `ubahIklanSchema`, `daftarIklanSchema`
  - `class IklanService` dengan `daftar`, `detail`, `buat`, `ubah`

- [ ] **Step 1: Tulis test repository lebih dulu**

Create `tests/modules/presurvei/iklan-repository.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Repository diuji dengan me-mock klien Prisma: yang diperiksa adalah bentuk
 * query yang dikirim, bukan perilaku database. Filter tenantId sengaja tidak
 * diperiksa karena ditegakkan ekstensi Prisma di lapisan database.
 */

vi.mock("@/modules/database", () => ({
  prisma: {
    presurveiIklan: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/modules/database";
import { IklanRepository } from "@/modules/presurvei/repositories/IklanRepository";
import type { IklanRow } from "@/modules/presurvei/mappers/iklan.mapper";

const barisIklan = (over: Partial<IklanRow> = {}): IklanRow => ({
  id: "iklan-1",
  nama: "Promo Ramadan",
  kode: "promo-ramadan",
  channel: "META",
  tanggalMulai: new Date("2026-09-01T00:00:00.000Z"),
  tanggalSelesai: null,
  biaya: null,
  penanggungJawabId: null,
  isAktif: true,
  tenantId: "tenant-1",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  ...over,
});

describe("IklanRepository.findMany", () => {
  beforeEach(() => vi.clearAllMocks());

  it("menghitung lompatan halaman dari nomor halaman", async () => {
    vi.mocked(prisma.presurveiIklan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiIklan.count).mockResolvedValue(0 as never);

    await new IklanRepository().findMany({ page: 3, limit: 20 });

    expect(prisma.presurveiIklan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
  });

  it("menggabungkan filter channel, status aktif, dan pencarian", async () => {
    vi.mocked(prisma.presurveiIklan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiIklan.count).mockResolvedValue(0 as never);

    await new IklanRepository().findMany({
      page: 1,
      limit: 10,
      channel: "META",
      isAktif: true,
      search: "ramadan",
    });

    const argumen = vi.mocked(prisma.presurveiIklan.findMany).mock.calls[0][0];
    expect(argumen?.where).toMatchObject({ channel: "META", isAktif: true });
    expect(argumen?.where?.OR).toEqual([
      { nama: { contains: "ramadan", mode: "insensitive" } },
      { kode: { contains: "ramadan", mode: "insensitive" } },
    ]);
  });

  it("menyaring isAktif false, bukan mengabaikannya", async () => {
    // `isAktif: false` adalah filter yang sah — memeriksanya dengan truthiness
    // akan membuat pengguna tidak pernah bisa melihat iklan yang dimatikan.
    vi.mocked(prisma.presurveiIklan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiIklan.count).mockResolvedValue(0 as never);

    await new IklanRepository().findMany({ page: 1, limit: 10, isAktif: false });

    const argumen = vi.mocked(prisma.presurveiIklan.findMany).mock.calls[0][0];
    expect(argumen?.where).toMatchObject({ isAktif: false });
  });

  it("tidak menyaring apa pun saat tidak ada filter", async () => {
    vi.mocked(prisma.presurveiIklan.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.presurveiIklan.count).mockResolvedValue(0 as never);

    await new IklanRepository().findMany({ page: 1, limit: 10 });

    const argumen = vi.mocked(prisma.presurveiIklan.findMany).mock.calls[0][0];
    expect(argumen?.where).toEqual({});
  });
});

describe("IklanRepository.findByKode", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mencari lewat findFirst karena kode hanya unik per tenant", async () => {
    vi.mocked(prisma.presurveiIklan.findFirst).mockResolvedValue(null as never);

    await new IklanRepository().findByKode("promo-ramadan");

    expect(prisma.presurveiIklan.findFirst).toHaveBeenCalledWith({
      where: { kode: "promo-ramadan" },
    });
  });

  it("mengembalikan null saat kode tidak dikenal", async () => {
    vi.mocked(prisma.presurveiIklan.findFirst).mockResolvedValue(null as never);

    expect(await new IklanRepository().findByKode("entah")).toBeNull();
  });
});

describe("IklanRepository — pemetaan", () => {
  beforeEach(() => vi.clearAllMocks());

  it("memetakan seluruh kolom baris menjadi entitas domain", async () => {
    const baris = barisIklan({
      tanggalSelesai: new Date("2026-09-30T00:00:00.000Z"),
      biaya: { toString: () => "1500000.50" },
      penanggungJawabId: "user-1",
    });
    vi.mocked(prisma.presurveiIklan.findUnique).mockResolvedValue(
      baris as never,
    );

    const hasil = await new IklanRepository().findById("iklan-1");

    expect(hasil).toEqual({
      id: "iklan-1",
      nama: "Promo Ramadan",
      kode: "promo-ramadan",
      channel: "META",
      tanggalMulai: baris.tanggalMulai,
      tanggalSelesai: baris.tanggalSelesai,
      biaya: 1500000.5,
      penanggungJawabId: "user-1",
      isAktif: true,
      tenantId: "tenant-1",
      createdAt: baris.createdAt,
      updatedAt: baris.updatedAt,
    });
  });

  it("mempertahankan biaya null apa adanya", async () => {
    vi.mocked(prisma.presurveiIklan.findUnique).mockResolvedValue(
      barisIklan() as never,
    );

    const hasil = await new IklanRepository().findById("iklan-1");

    expect(hasil?.biaya).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run tests/modules/presurvei/iklan-repository.test.ts`
Expected: FAIL — `IklanRepository` belum ada.

- [ ] **Step 3: Tulis repository**

Create `modules/presurvei/repositories/IklanRepository.ts`:

```ts
import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import type { IklanEntity } from "../domain/entities/Iklan";
import type {
  CreateIklanInput,
  IIklanRepository,
  IklanListFilters,
  UpdateIklanInput,
} from "../domain/ports/IIklanRepository";
import { toIklanEntity, type IklanRow } from "../mappers/iklan.mapper";

/**
 * Akses data iklan presurvei.
 *
 * Memakai klien Prisma ber-ekstensi isolasi tenant, sehingga penyaringan
 * tenantId ditegakkan di lapisan database dan tidak ditulis ulang di sini.
 */
export class IklanRepository implements IIklanRepository {
  /** Ambil satu halaman iklan beserta jumlah totalnya. */
  async findMany(
    filters: IklanListFilters,
  ): Promise<{ items: IklanEntity[]; total: number }> {
    const where = this.bangunFilter(filters);

    const [rows, total] = await Promise.all([
      prisma.presurveiIklan.findMany({
        where,
        orderBy: { tanggalMulai: "desc" },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.presurveiIklan.count({ where }),
    ]);

    return { items: rows.map((row) => toIklanEntity(row as IklanRow)), total };
  }

  /** Ambil satu iklan berdasarkan id, null bila tidak ditemukan. */
  async findById(id: string): Promise<IklanEntity | null> {
    const row = await prisma.presurveiIklan.findUnique({ where: { id } });
    return row ? toIklanEntity(row as IklanRow) : null;
  }

  /**
   * Iklan dengan kode kampanye tertentu.
   *
   * Memakai `findFirst`, bukan `findUnique`: kodenya unik per tenant, dan
   * ekstensi isolasi menambahkan penyaring tenant pada query ini.
   */
  async findByKode(kode: string): Promise<IklanEntity | null> {
    const row = await prisma.presurveiIklan.findFirst({ where: { kode } });
    return row ? toIklanEntity(row as IklanRow) : null;
  }

  /** Simpan iklan baru. */
  async create(input: CreateIklanInput): Promise<IklanEntity> {
    const row = await prisma.presurveiIklan.create({ data: input });
    return toIklanEntity(row as IklanRow);
  }

  /** Perbarui iklan yang sudah ada. */
  async update(id: string, input: UpdateIklanInput): Promise<IklanEntity> {
    const row = await prisma.presurveiIklan.update({
      where: { id },
      data: input,
    });
    return toIklanEntity(row as IklanRow);
  }

  private bangunFilter(
    filters: IklanListFilters,
  ): Prisma.PresurveiIklanWhereInput {
    return {
      ...(filters.channel ? { channel: filters.channel } : {}),
      // Perbandingan eksplisit terhadap undefined: `isAktif: false` adalah
      // filter yang sah dan tidak boleh hilang karena dianggap falsy.
      ...(filters.isAktif === undefined ? {} : { isAktif: filters.isAktif }),
      ...(filters.search
        ? {
            OR: [
              { nama: { contains: filters.search, mode: "insensitive" } },
              { kode: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
  }
}
```

- [ ] **Step 4: Tulis validator**

Create `modules/presurvei/validators/iklan.validator.ts`:

```ts
import { z } from "zod";
import { IKLAN_CHANNELS } from "../domain/entities/Iklan";

/**
 * Validasi masukan iklan presurvei.
 *
 * Kode kampanye dibatasi huruf kecil, angka, dan tanda hubung karena ia
 * dipasangkan dengan `utm_campaign` pada tautan iklan — spasi dan huruf besar
 * di sana akan tersandi berbeda-beda antar platform dan atribusinya meleset.
 */

const PANJANG_NAMA_MIN = 3;
const PANJANG_NAMA_MAKS = 120;
const PANJANG_KODE_MIN = 3;
const PANJANG_KODE_MAKS = 60;
const BIAYA_MAKS = 1_000_000_000_000;
const BATAS_HALAMAN_MAKS = 100;
const ISI_HALAMAN_BAWAAN = 20;

const POLA_KODE = /^[a-z0-9-]+$/;

export const buatIklanSchema = z.object({
  nama: z.string().min(PANJANG_NAMA_MIN).max(PANJANG_NAMA_MAKS),
  kode: z
    .string()
    .min(PANJANG_KODE_MIN)
    .max(PANJANG_KODE_MAKS)
    .regex(POLA_KODE, "Kode hanya boleh huruf kecil, angka, dan tanda hubung"),
  channel: z.enum(IKLAN_CHANNELS),
  tanggalMulai: z.coerce.date(),
  tanggalSelesai: z.coerce.date().optional().nullable(),
  biaya: z.number().min(0).max(BIAYA_MAKS).optional().nullable(),
  penanggungJawabId: z.string().optional().nullable(),
  isAktif: z.boolean().optional(),
});

export const ubahIklanSchema = z.object({
  nama: z.string().min(PANJANG_NAMA_MIN).max(PANJANG_NAMA_MAKS).optional(),
  channel: z.enum(IKLAN_CHANNELS).optional(),
  tanggalMulai: z.coerce.date().optional(),
  tanggalSelesai: z.coerce.date().optional().nullable(),
  biaya: z.number().min(0).max(BIAYA_MAKS).optional().nullable(),
  penanggungJawabId: z.string().optional().nullable(),
  isAktif: z.boolean().optional(),
});

export const daftarIklanSchema = z.object({
  channel: z.enum(IKLAN_CHANNELS).optional(),
  isAktif: z
    .enum(["true", "false"])
    .transform((nilai) => nilai === "true")
    .optional(),
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

`isAktif` pada daftar sengaja diurai dari string `"true"`/`"false"`, bukan `z.coerce.boolean()` — coercion itu menganggap string `"false"` bernilai true, sehingga filter iklan nonaktif tidak akan pernah bekerja.

- [ ] **Step 5: Tulis test service**

Create `tests/modules/presurvei/iklan-service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Kode kampanye adalah kunci atribusi: ia dipasangkan dengan `utm_campaign`
 * pada tautan yang sudah tersebar. Dua iklan berkode sama membuat prospek
 * teratribusi ke kampanye yang salah tanpa jejak untuk memperbaikinya.
 */

import { IklanService } from "@/modules/presurvei/services/IklanService";
import type { IIklanRepository } from "@/modules/presurvei/domain/ports/IIklanRepository";
import type { IklanEntity } from "@/modules/presurvei/domain/entities/Iklan";

const WAKTU = new Date("2026-09-22T00:00:00.000Z");

const iklan = (over: Partial<IklanEntity> = {}): IklanEntity =>
  ({
    id: "iklan-1",
    nama: "Promo Ramadan",
    kode: "promo-ramadan",
    channel: "META",
    tanggalMulai: WAKTU,
    tanggalSelesai: null,
    biaya: null,
    penanggungJawabId: null,
    isAktif: true,
    tenantId: "tenant-1",
    createdAt: WAKTU,
    updatedAt: WAKTU,
    ...over,
  }) as IklanEntity;

const bangunRepository = (): IIklanRepository => ({
  findMany: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  findById: vi.fn().mockResolvedValue(null),
  findByKode: vi.fn().mockResolvedValue(null),
  create: vi.fn().mockResolvedValue(iklan()),
  update: vi.fn().mockResolvedValue(iklan()),
});

const masukan = {
  nama: "Promo Ramadan",
  kode: "promo-ramadan",
  channel: "META" as const,
  tanggalMulai: WAKTU,
};

describe("IklanService.buat", () => {
  let repository: IIklanRepository;

  beforeEach(() => {
    repository = bangunRepository();
  });

  it("menolak kode yang sudah dipakai iklan lain", async () => {
    vi.mocked(repository.findByKode).mockResolvedValue(
      iklan({ id: "iklan-lama" }),
    );

    await expect(new IklanService(repository).buat(masukan)).rejects.toMatchObject(
      { statusCode: 409, code: "DUPLIKAT" },
    );

    expect(repository.create).not.toHaveBeenCalled();
  });

  it("menyimpan saat kodenya belum dipakai", async () => {
    await new IklanService(repository).buat(masukan);

    expect(repository.create).toHaveBeenCalledOnce();
  });

  it("menolak tanggal selesai yang mendahului tanggal mulai", async () => {
    await expect(
      new IklanService(repository).buat({
        ...masukan,
        tanggalSelesai: new Date("2026-09-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(repository.create).not.toHaveBeenCalled();
  });

  it("menerima tanggal selesai yang sama dengan tanggal mulai", async () => {
    // Kampanye satu hari itu wajar dan tidak boleh ditolak.
    await new IklanService(repository).buat({
      ...masukan,
      tanggalSelesai: WAKTU,
    });

    expect(repository.create).toHaveBeenCalledOnce();
  });
});

describe("IklanService.detail", () => {
  it("melempar 404 saat iklan tidak ditemukan", async () => {
    await expect(
      new IklanService(bangunRepository()).detail("tidak-ada"),
    ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
  });
});

describe("IklanService.ubah", () => {
  let repository: IIklanRepository;

  beforeEach(() => {
    repository = bangunRepository();
    vi.mocked(repository.findById).mockResolvedValue(iklan());
  });

  it("menolak tanggal selesai yang mendahului tanggal mulai tersimpan", async () => {
    await expect(
      new IklanService(repository).ubah("iklan-1", {
        tanggalSelesai: new Date("2026-09-01T00:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(repository.update).not.toHaveBeenCalled();
  });

  it("memeriksa terhadap tanggal mulai baru bila keduanya diubah sekaligus", async () => {
    await new IklanService(repository).ubah("iklan-1", {
      tanggalMulai: new Date("2026-08-01T00:00:00.000Z"),
      tanggalSelesai: new Date("2026-08-15T00:00:00.000Z"),
    });

    expect(repository.update).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 6: Tulis service**

Create `modules/presurvei/services/IklanService.ts`:

```ts
import { AppError } from "@/lib/errors";
import type { IklanEntity } from "../domain/entities/Iklan";
import type {
  CreateIklanInput,
  IIklanRepository,
  IklanListFilters,
  UpdateIklanInput,
} from "../domain/ports/IIklanRepository";
import { IklanRepository } from "../repositories/IklanRepository";

/**
 * Orkestrasi iklan presurvei.
 *
 * Menjaga dua hal yang tidak bisa dijaga skema: kode kampanye tidak boleh
 * bertabrakan, dan rentang tanggalnya harus masuk akal.
 */
export class IklanService {
  constructor(
    private readonly repository: IIklanRepository = new IklanRepository(),
  ) {}

  /** Ambil satu halaman iklan sesuai filter. */
  async daftar(
    filters: IklanListFilters,
  ): Promise<{ items: IklanEntity[]; total: number }> {
    return this.repository.findMany(filters);
  }

  /** Ambil satu iklan, melempar 404 bila tidak ada. */
  async detail(id: string): Promise<IklanEntity> {
    const iklan = await this.repository.findById(id);
    if (!iklan) {
      throw new AppError("Iklan tidak ditemukan", 404, "NOT_FOUND");
    }
    return iklan;
  }

  /** Simpan iklan baru, menolak kode yang sudah dipakai. */
  async buat(input: CreateIklanInput): Promise<IklanEntity> {
    const bentrok = await this.repository.findByKode(input.kode);
    if (bentrok) {
      throw new AppError(
        `Kode kampanye "${input.kode}" sudah dipakai iklan lain`,
        409,
        "DUPLIKAT",
      );
    }

    this.pastikanRentangTanggalMasukAkal(
      input.tanggalMulai,
      input.tanggalSelesai,
    );

    return this.repository.create(input);
  }

  /** Perbarui iklan; kode kampanye tidak bisa diubah. */
  async ubah(id: string, input: UpdateIklanInput): Promise<IklanEntity> {
    const iklan = await this.detail(id);

    this.pastikanRentangTanggalMasukAkal(
      input.tanggalMulai ?? iklan.tanggalMulai,
      input.tanggalSelesai,
    );

    return this.repository.update(id, input);
  }

  private pastikanRentangTanggalMasukAkal(
    mulai: Date,
    selesai: Date | null | undefined,
  ): void {
    if (!selesai) return;
    if (selesai.getTime() >= mulai.getTime()) return;

    throw new AppError(
      "Tanggal selesai iklan tidak boleh mendahului tanggal mulai",
      400,
      "VALIDATION_ERROR",
    );
  }
}
```

- [ ] **Step 7: Jalankan kedua verifikasi**

Run: `npx vitest run tests/modules/presurvei/`
Expected: seluruh modul hijau; task ini menambah 16 test baru. Jangan mencocokkan totalnya dengan angka apa pun — baseline bergeser tiap ronde perbaikan, dan yang harus benar adalah pertambahannya.

Run: `npx tsc --noEmit -p tsconfig.typecheck.json 2>&1 | grep presurvei`
Expected: tanpa output.

- [ ] **Step 8: Commit**

```bash
git add modules/presurvei tests/modules/presurvei
git commit -m "feat(presurvei): tambah repository, validator, dan service iklan"
```

---
### Task 9: DTO, public API, dan route admin iklan

**Files:**
- Create: `modules/presurvei/dto/iklan.dto.ts`
- Modify: `modules/presurvei/index.ts`
- Create: `app/api/admin/presurvei/iklan/route.ts`
- Create: `app/api/admin/presurvei/iklan/[id]/route.ts`
- Test: `tests/modules/presurvei/iklan-dto.test.ts`

**Interfaces:**
- Consumes: Task 7 dan 8
- Produces: `toIklanListItem`, `toIklanDetail`, `IklanListItemDto`, `IklanDetailDto`; keempatnya diekspor dari `modules/presurvei/index.ts` bersama `IklanService` dan ketiga skema Zod-nya

- [ ] **Step 1: Tulis DTO**

Create `modules/presurvei/dto/iklan.dto.ts`:

```ts
import type { IklanEntity } from "../domain/entities/Iklan";
import { isIklanBerjalan } from "../domain/iklan-rules";

/**
 * Bentuk data iklan yang dikirim ke klien.
 *
 * `isBerjalan` dihitung di sini supaya UI tidak perlu menyalin aturan domain
 * dan berisiko berbeda pendapat dengan server soal kampanye mana yang hidup.
 */

export interface IklanListItemDto {
  id: string;
  nama: string;
  kode: string;
  channel: string;
  tanggalMulai: string;
  tanggalSelesai: string | null;
  isAktif: boolean;
  isBerjalan: boolean;
}

export interface IklanDetailDto extends IklanListItemDto {
  biaya: number | null;
  penanggungJawabId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Ringkasan iklan untuk tampilan daftar. */
export function toIklanListItem(iklan: IklanEntity): IklanListItemDto {
  return {
    id: iklan.id,
    nama: iklan.nama,
    kode: iklan.kode,
    channel: iklan.channel,
    tanggalMulai: iklan.tanggalMulai.toISOString(),
    tanggalSelesai: iklan.tanggalSelesai?.toISOString() ?? null,
    isAktif: iklan.isAktif,
    isBerjalan: isIklanBerjalan(iklan),
  };
}

/** Rincian lengkap iklan untuk halaman detail. */
export function toIklanDetail(iklan: IklanEntity): IklanDetailDto {
  return {
    ...toIklanListItem(iklan),
    biaya: iklan.biaya,
    penanggungJawabId: iklan.penanggungJawabId,
    createdAt: iklan.createdAt.toISOString(),
    updatedAt: iklan.updatedAt.toISOString(),
  };
}
```

- [ ] **Step 2: Tulis test DTO**

Create `tests/modules/presurvei/iklan-dto.test.ts`:

```ts
import { describe, expect, it } from "vitest";

/**
 * `isAktif` menyatakan niat pemilik iklan, `isBerjalan` menyatakan kenyataannya.
 * Keduanya sengaja dikirim terpisah supaya UI bisa membedakan "dimatikan" dari
 * "sudah lewat" — dua hal yang butuh tindakan berbeda.
 */

import {
  toIklanDetail,
  toIklanListItem,
} from "@/modules/presurvei/dto/iklan.dto";
import type { IklanEntity } from "@/modules/presurvei/domain/entities/Iklan";

const LAMPAU = new Date("2020-01-01T00:00:00.000Z");

const iklan = (over: Partial<IklanEntity> = {}): IklanEntity =>
  ({
    id: "iklan-1",
    nama: "Promo Ramadan",
    kode: "promo-ramadan",
    channel: "META",
    tanggalMulai: LAMPAU,
    tanggalSelesai: null,
    biaya: null,
    penanggungJawabId: null,
    isAktif: true,
    tenantId: "tenant-1",
    createdAt: LAMPAU,
    updatedAt: LAMPAU,
    ...over,
  }) as IklanEntity;

describe("toIklanListItem", () => {
  it("mengubah tanggal menjadi ISO string", () => {
    expect(toIklanListItem(iklan()).tanggalMulai).toBe(
      "2020-01-01T00:00:00.000Z",
    );
  });

  it("mengembalikan null untuk tanggal selesai yang kosong", () => {
    expect(toIklanListItem(iklan()).tanggalSelesai).toBeNull();
  });

  it("menandai iklan yang sudah lewat sebagai tidak berjalan meski penandanya aktif", () => {
    const hasil = toIklanListItem(
      iklan({ tanggalSelesai: new Date("2020-02-01T00:00:00.000Z") }),
    );

    expect(hasil.isAktif).toBe(true);
    expect(hasil.isBerjalan).toBe(false);
  });

  it("menandai iklan berjalan saat aktif dan tanggalnya masih berlaku", () => {
    expect(toIklanListItem(iklan()).isBerjalan).toBe(true);
  });
});

describe("toIklanDetail", () => {
  it("menyertakan biaya dan penanggung jawab", () => {
    const hasil = toIklanDetail(
      iklan({ biaya: 1500000.5, penanggungJawabId: "user-1" }),
    );

    expect(hasil.biaya).toBe(1500000.5);
    expect(hasil.penanggungJawabId).toBe("user-1");
  });

  it("mempertahankan biaya nol, bukan mengubahnya jadi null", () => {
    // Kampanye berbiaya nol itu wajar — organik, atau anggarannya belum diisi.
    expect(toIklanDetail(iklan({ biaya: 0 })).biaya).toBe(0);
  });
});
```

- [ ] **Step 3: Jalankan test**

Run: `npx vitest run tests/modules/presurvei/iklan-dto.test.ts`
Expected: PASS — 6 test lulus.

- [ ] **Step 4: Ekspor dari public API**

Di `modules/presurvei/index.ts`, tambahkan di tempat yang sesuai dengan pengelompokan yang sudah ada:

```ts
export {
  IKLAN_CHANNELS,
  type IklanChannel,
  type IklanEntity,
} from "./domain/entities/Iklan";

export { isIklanBerjalan } from "./domain/iklan-rules";

export {
  buatIklanSchema,
  daftarIklanSchema,
  ubahIklanSchema,
} from "./validators/iklan.validator";

export { IklanService } from "./services/IklanService";

export {
  toIklanDetail,
  toIklanListItem,
  type IklanDetailDto,
  type IklanListItemDto,
} from "./dto/iklan.dto";
```

`IklanRepository` dan `iklan.mapper` **tidak** diekspor — keduanya detail internal, sama seperti repository Fase 1.

- [ ] **Step 5: Tulis route daftar dan buat**

Create `app/api/admin/presurvei/iklan/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { apiPaginated, apiSuccess, createHandler } from "@/lib/api";
import {
  buatIklanSchema,
  daftarIklanSchema,
  IklanService,
  toIklanDetail,
  toIklanListItem,
} from "@/modules/presurvei";

const service = new IklanService();

/** GET /api/admin/presurvei/iklan — daftar iklan dengan filter dan paginasi. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei_iklan:read"] },
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const filters = daftarIklanSchema.parse({
      channel: searchParams.get("channel") ?? undefined,
      isAktif: searchParams.get("isAktif") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const hasil = await service.daftar(filters);

    return apiPaginated(hasil.items.map(toIklanListItem), {
      page: filters.page,
      limit: filters.limit,
      total: hasil.total,
    });
  },
);

/** POST /api/admin/presurvei/iklan — catat kampanye iklan baru. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["presurvei_iklan:create"],
    schema: buatIklanSchema,
  },
  async (_request, ctx) => {
    const iklan = await service.buat(ctx.validated);
    return apiSuccess(toIklanDetail(iklan), { status: 201 });
  },
);
```

Perhatikan permission-nya tunggal, bukan berpasangan seperti route presurvei Fase 1: pengelolaan kampanye adalah pekerjaan admin web, dan tidak ada layar mobile yang membutuhkannya.

- [ ] **Step 6: Tulis route detail dan ubah**

Create `app/api/admin/presurvei/iklan/[id]/route.ts`:

```ts
import { apiSuccess, createHandler } from "@/lib/api";
import { IklanService, toIklanDetail, ubahIklanSchema } from "@/modules/presurvei";

const service = new IklanService();

/** GET /api/admin/presurvei/iklan/[id] — rincian satu iklan. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei_iklan:read"] },
  async (_request, ctx) => {
    const iklan = await service.detail(ctx.params.id as string);
    return apiSuccess(toIklanDetail(iklan));
  },
);

/** PATCH /api/admin/presurvei/iklan/[id] — perbarui kampanye iklan. */
export const PATCH = createHandler(
  {
    auth: true,
    permissions: ["presurvei_iklan:update"],
    schema: ubahIklanSchema,
  },
  async (_request, ctx) => {
    const iklan = await service.ubah(ctx.params.id as string, ctx.validated);
    return apiSuccess(toIklanDetail(iklan));
  },
);
```

Tidak ada DELETE: kampanye yang sudah berjalan menjadi asal-usul prospek yang sudah tercatat, dan menghapusnya memutus atribusi itu. Mematikannya lewat `isAktif: false` menyimpan sejarahnya.

- [ ] **Step 7: Jalankan verifikasi**

Run: `npx vitest run tests/modules/presurvei/`
Expected: seluruh modul hijau; task ini menambah 6 test baru. Jangan mencocokkan totalnya dengan angka apa pun — baseline bergeser tiap ronde perbaikan, dan yang harus benar adalah pertambahannya.

Run: `npm run typecheck`
Expected: lulus. Permission `presurvei_iklan:*` belum ada di database sampai Task 14, jadi route ini akan menolak semua pemanggil untuk sementara — itu normal dan tidak mempengaruhi typecheck.

- [ ] **Step 8: Commit**

```bash
git add modules/presurvei app/api/admin/presurvei tests/modules/presurvei
git commit -m "feat(presurvei): tambah DTO dan route admin iklan"
```

---

### Task 10: Atribusi prospek website ke iklan

**Files:**
- Modify: `modules/presurvei/services/event-handlers/registration-created-presurvei.handler.ts`
- Test: `tests/modules/presurvei/registration-created-handler.test.ts`

**Interfaces:**
- Consumes: `IIklanRepository.findByKode` (Task 7), handler (Task 5)
- Produces: prospek dari website membawa `iklanId` bila `utm_campaign`-nya cocok dengan kode kampanye yang terdaftar

Inilah yang menjawab pertanyaan spec §1 nomor 2 — "marketing menjalankan iklan apa, dan berapa prospek yang masuk dari iklan itu". Tanpa langkah ini, UTM tersimpan di tabel registrations tapi tidak pernah terhubung ke kampanye mana pun.

- [ ] **Step 1: Tambahkan test untuk pencocokan**

Tambahkan ke `tests/modules/presurvei/registration-created-handler.test.ts`. Mock repositori iklan di bagian atas berkas, sejajar dengan mock yang sudah ada:

```ts
const cariIklanByKode = vi.fn();

vi.mock("@/modules/presurvei/repositories/IklanRepository", () => ({
  IklanRepository: class {
    findByKode = cariIklanByKode;
  },
}));
```

Lalu tambahkan ke `beforeEach` yang sudah ada: `cariIklanByKode.mockResolvedValue(null);`

Dan blok test baru:

```ts
describe("handleRegistrationCreatedPresurvei — atribusi iklan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cariByRegistrationId.mockResolvedValue(null);
    cariSalesTeringan.mockResolvedValue("sales-1");
    buatProspek.mockResolvedValue({ id: "prospek-1" });
    cariIklanByKode.mockResolvedValue(null);
  });

  it("menautkan prospek ke iklan yang kodenya cocok dengan utm_campaign", async () => {
    cariIklanByKode.mockResolvedValue({ id: "iklan-1", isAktif: true });

    await handleRegistrationCreatedPresurvei(job(payloadLengkap));

    expect(cariIklanByKode).toHaveBeenCalledWith("promo-ramadan");
    expect(buatProspek).toHaveBeenCalledWith(
      expect.objectContaining({ iklanId: "iklan-1", sumber: "IKLAN" }),
    );
  });

  it("tetap bersumber WEBSITE saat kampanyenya tidak dikenal", async () => {
    // UTM dari tautan lama atau salah ketik tidak boleh membuat prospek hilang —
    // ia tetap tercatat, hanya tanpa atribusi kampanye.
    cariIklanByKode.mockResolvedValue(null);

    await handleRegistrationCreatedPresurvei(job(payloadLengkap));

    expect(buatProspek).toHaveBeenCalledWith(
      expect.objectContaining({ iklanId: null, sumber: "WEBSITE" }),
    );
  });

  it("tidak mencari iklan saat pendaftaran datang tanpa utm_campaign", async () => {
    const { utmCampaign: _dibuang, ...tanpaKampanye } = payloadLengkap;

    await handleRegistrationCreatedPresurvei(job(tanpaKampanye));

    expect(cariIklanByKode).not.toHaveBeenCalled();
    expect(buatProspek).toHaveBeenCalledWith(
      expect.objectContaining({ iklanId: null, sumber: "WEBSITE" }),
    );
  });

  it("tidak jatuh saat pencarian iklan gagal", async () => {
    // Atribusi adalah pelengkap; kegagalannya tidak boleh menelan pendaftaran.
    cariIklanByKode.mockRejectedValue(new Error("database sibuk"));

    await handleRegistrationCreatedPresurvei(job(payloadLengkap));

    expect(buatProspek).toHaveBeenCalledWith(
      expect.objectContaining({ iklanId: null, sumber: "WEBSITE" }),
    );
  });
});
```

- [ ] **Step 2: Jalankan test untuk memastikan gagal**

Run: `npx vitest run tests/modules/presurvei/registration-created-handler.test.ts`
Expected: FAIL — handler belum mencari iklan sama sekali.

- [ ] **Step 3: Tambahkan pencocokan ke handler**

Di `registration-created-presurvei.handler.ts`, tambahkan import `IklanRepository` lalu sisipkan fungsi bantu dan pemakaiannya:

```ts
/**
 * Cari iklan yang kodenya cocok dengan `utm_campaign` pendaftaran.
 *
 * Mengembalikan null untuk kampanye yang tidak dikenal maupun saat pencariannya
 * gagal: atribusi adalah pelengkap, dan kehilangannya jauh lebih ringan daripada
 * kehilangan pendaftarnya.
 */
async function cariIklanDariKampanye(
  utmCampaign: unknown,
): Promise<string | null> {
  if (typeof utmCampaign !== "string" || utmCampaign.trim().length === 0) {
    return null;
  }

  try {
    const iklan = await new IklanRepository().findByKode(utmCampaign);
    return iklan?.id ?? null;
  } catch (error) {
    logger.warn(
      `[${SOURCE}] Gagal mencocokkan kampanye "${utmCampaign}": ${String(error)}`,
    );
    return null;
  }
}
```

lalu di dalam handler, sebelum `repository.create`:

```ts
  const iklanId = await cariIklanDariKampanye(payload.utmCampaign);

  const prospek = await repository.create({
    nama,
    noTelp,
    alamat,
    email: (payload.email as string | null) ?? null,
    paketDiminati: (payload.paketDiminati as string | null) ?? null,
    sumber: iklanId ? "IKLAN" : "WEBSITE",
    iklanId,
    registrationId,
    pemilikId: await cariSalesTeringan(),
  });
```

Perhatikan `sumber` ikut berubah menjadi `IKLAN` saat kampanyenya dikenal — itu yang membuat laporan "prospek dari iklan" bisa menyaring lewat satu kolom, bukan menebak dari ada-tidaknya `iklanId`.

- [ ] **Step 4: Jalankan kedua verifikasi**

Run: `npx vitest run tests/modules/presurvei/`
Expected: seluruh modul hijau; task ini menambah 4 test baru. Jangan mencocokkan totalnya dengan angka apa pun — baseline bergeser tiap ronde perbaikan, dan yang harus benar adalah pertambahannya.

Run: `npx tsc --noEmit -p tsconfig.typecheck.json 2>&1 | grep presurvei`
Expected: tanpa output.

- [ ] **Step 5: Commit**

```bash
git add modules/presurvei tests/modules/presurvei
git commit -m "feat(presurvei): atribusikan prospek website ke kampanye iklannya"
```

---
# GELOMBANG C — Target dan laporan

### Task 11: Domain, port, mapper, dan repository target

**Files:**
- Create: `modules/presurvei/domain/entities/Target.ts`
- Create: `modules/presurvei/domain/target-rules.ts`
- Create: `modules/presurvei/domain/ports/ITargetRepository.ts`
- Create: `modules/presurvei/mappers/target.mapper.ts`
- Create: `modules/presurvei/repositories/TargetRepository.ts`
- Test: `tests/modules/presurvei/target-rules.test.ts`

**Interfaces:**
- Consumes: —
- Produces:
  - `TargetEntity`, `PeriodeTarget { tahun, bulan }`
  - `hitungPencapaian(target, realisasi): Pencapaian`
  - `ITargetRepository` dengan `findByPeriode`, `findByUserPeriode`, `simpan`
  - `toTargetEntity(row: TargetRow): TargetEntity`

- [ ] **Step 1: Tulis entity**

Create `modules/presurvei/domain/entities/Target.ts`:

```ts
/**
 * Entitas domain target presurvei.
 *
 * Murni: tidak mengimpor apa pun dari luar folder domain.
 */

export const BULAN_MIN = 1;
export const BULAN_MAKS = 12;

export interface PeriodeTarget {
  tahun: number;
  bulan: number;
}

export interface TargetEntity {
  id: string;
  userId: string;
  periodeTahun: number;
  periodeBulan: number;
  targetKunjungan: number;
  targetProspek: number;
  targetKonversi: number;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Angka nyata yang dicapai seorang sales pada satu periode. */
export interface RealisasiTarget {
  kunjungan: number;
  prospek: number;
  konversi: number;
}
```

- [ ] **Step 2: Tulis test aturan lebih dulu**

Create `tests/modules/presurvei/target-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";

/**
 * Pencapaian dipakai untuk bilah progres dan peringkat sales, jadi pembagian
 * dengan target nol harus punya jawaban yang disepakati — bukan Infinity atau
 * NaN yang merusak tampilan dan pengurutan.
 */

import { hitungPencapaian } from "@/modules/presurvei/domain/target-rules";

const target = {
  targetKunjungan: 20,
  targetProspek: 10,
  targetKonversi: 5,
};

describe("hitungPencapaian", () => {
  it("menghitung persentase tiap jenis target", () => {
    const hasil = hitungPencapaian(target, {
      kunjungan: 10,
      prospek: 5,
      konversi: 1,
    });

    expect(hasil.kunjungan.persen).toBe(50);
    expect(hasil.prospek.persen).toBe(50);
    expect(hasil.konversi.persen).toBe(20);
  });

  it("membatasi persentase pada 100 untuk keperluan tampilan", () => {
    const hasil = hitungPencapaian(target, {
      kunjungan: 40,
      prospek: 0,
      konversi: 0,
    });

    expect(hasil.kunjungan.persen).toBe(100);
  });

  it("tetap melaporkan jumlah sebenarnya meski persentasenya dibatasi", () => {
    // Bilah progres berhenti di 100%, tapi manajer perlu melihat 40 kunjungan.
    const hasil = hitungPencapaian(target, {
      kunjungan: 40,
      prospek: 0,
      konversi: 0,
    });

    expect(hasil.kunjungan.tercapai).toBe(40);
    expect(hasil.kunjungan.target).toBe(20);
  });

  it("menganggap target nol sebagai sudah tercapai penuh", () => {
    // Tidak ada target berarti tidak ada yang gagal dicapai. Mengembalikan
    // Infinity atau NaN akan merusak pengurutan peringkat sales.
    const hasil = hitungPencapaian(
      { targetKunjungan: 0, targetProspek: 0, targetKonversi: 0 },
      { kunjungan: 0, prospek: 0, konversi: 0 },
    );

    expect(hasil.kunjungan.persen).toBe(100);
    expect(hasil.prospek.persen).toBe(100);
    expect(hasil.konversi.persen).toBe(100);
  });

  it("melaporkan nol persen saat target ada tapi belum ada realisasi", () => {
    const hasil = hitungPencapaian(target, {
      kunjungan: 0,
      prospek: 0,
      konversi: 0,
    });

    expect(hasil.kunjungan.persen).toBe(0);
  });

  it("membulatkan persentase ke bilangan bulat", () => {
    const hasil = hitungPencapaian(target, {
      kunjungan: 7,
      prospek: 0,
      konversi: 0,
    });

    expect(hasil.kunjungan.persen).toBe(35);
  });
});
```

- [ ] **Step 3: Jalankan test untuk memastikan gagal**

Run: `npx vitest run tests/modules/presurvei/target-rules.test.ts`
Expected: FAIL — modul `target-rules` belum ada.

- [ ] **Step 4: Tulis aturan**

Create `modules/presurvei/domain/target-rules.ts`:

```ts
import type { RealisasiTarget, TargetEntity } from "./entities/Target";

/**
 * Aturan pencapaian target presurvei — fungsi murni, tanpa I/O.
 */

const PERSEN_PENUH = 100;

/** Satu baris pencapaian: target, realisasi, dan persentasenya. */
export interface BarisPencapaian {
  target: number;
  tercapai: number;
  persen: number;
}

export interface Pencapaian {
  kunjungan: BarisPencapaian;
  prospek: BarisPencapaian;
  konversi: BarisPencapaian;
}

/**
 * Hitung pencapaian seorang sales terhadap targetnya.
 *
 * Persentase dibatasi pada 100 supaya bilah progres tidak melampaui bingkainya,
 * tapi `tercapai` tetap melaporkan angka sebenarnya — manajer perlu melihat
 * siapa yang jauh melampaui target, bukan sekadar bahwa ia lewat.
 */
export function hitungPencapaian(
  target: Pick<
    TargetEntity,
    "targetKunjungan" | "targetProspek" | "targetKonversi"
  >,
  realisasi: RealisasiTarget,
): Pencapaian {
  return {
    kunjungan: bangunBaris(target.targetKunjungan, realisasi.kunjungan),
    prospek: bangunBaris(target.targetProspek, realisasi.prospek),
    konversi: bangunBaris(target.targetKonversi, realisasi.konversi),
  };
}

function bangunBaris(target: number, tercapai: number): BarisPencapaian {
  return { target, tercapai, persen: hitungPersen(target, tercapai) };
}

/**
 * Persentase pencapaian, dibatasi 0–100.
 *
 * Target nol dianggap tercapai penuh: tidak ada yang bisa gagal dicapai, dan
 * mengembalikan Infinity atau NaN akan merusak pengurutan peringkat sales.
 */
function hitungPersen(target: number, tercapai: number): number {
  if (target <= 0) return PERSEN_PENUH;
  return Math.min(PERSEN_PENUH, Math.round((tercapai / target) * PERSEN_PENUH));
}
```

- [ ] **Step 5: Tulis port**

Create `modules/presurvei/domain/ports/ITargetRepository.ts`:

```ts
import type { PeriodeTarget, TargetEntity } from "../entities/Target";

/**
 * Kontrak akses data target presurvei.
 */

export interface SimpanTargetInput {
  userId: string;
  periodeTahun: number;
  periodeBulan: number;
  targetKunjungan: number;
  targetProspek: number;
  targetKonversi: number;
}

export interface ITargetRepository {
  /** Seluruh target pada satu periode — dipakai laporan tim. */
  findByPeriode(periode: PeriodeTarget): Promise<TargetEntity[]>;
  findByUserPeriode(
    userId: string,
    periode: PeriodeTarget,
  ): Promise<TargetEntity | null>;
  /** Simpan target, menimpa yang sudah ada untuk user dan periode yang sama. */
  simpan(input: SimpanTargetInput): Promise<TargetEntity>;
}
```

Sengaja `simpan` alih-alih `create` dan `update` terpisah: tabelnya punya batasan unik pada `(userId, periodeTahun, periodeBulan, tenantId)`, dan menetapkan target untuk periode yang sudah punya target selalu berarti menggantinya.

- [ ] **Step 6: Tulis mapper dan repository**

Create `modules/presurvei/mappers/target.mapper.ts`:

```ts
import type { TargetEntity } from "../domain/entities/Target";

/**
 * Pemetaan baris Prisma ke entitas domain target.
 */

export interface TargetRow {
  id: string;
  userId: string;
  periodeTahun: number;
  periodeBulan: number;
  targetKunjungan: number;
  targetProspek: number;
  targetKonversi: number;
  tenantId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Ubah satu baris target dari database menjadi entitas domain. */
export function toTargetEntity(row: TargetRow): TargetEntity {
  return {
    id: row.id,
    userId: row.userId,
    periodeTahun: row.periodeTahun,
    periodeBulan: row.periodeBulan,
    targetKunjungan: row.targetKunjungan,
    targetProspek: row.targetProspek,
    targetKonversi: row.targetKonversi,
    tenantId: row.tenantId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
```

Create `modules/presurvei/repositories/TargetRepository.ts`:

```ts
import { prisma } from "@/modules/database";
import type { PeriodeTarget, TargetEntity } from "../domain/entities/Target";
import type {
  ITargetRepository,
  SimpanTargetInput,
} from "../domain/ports/ITargetRepository";
import { toTargetEntity, type TargetRow } from "../mappers/target.mapper";

/**
 * Akses data target presurvei.
 *
 * Memakai klien Prisma ber-ekstensi isolasi tenant.
 */
export class TargetRepository implements ITargetRepository {
  /** Seluruh target pada satu periode — dipakai laporan tim. */
  async findByPeriode(periode: PeriodeTarget): Promise<TargetEntity[]> {
    const rows = await prisma.presurveiTarget.findMany({
      where: { periodeTahun: periode.tahun, periodeBulan: periode.bulan },
    });
    return rows.map((row) => toTargetEntity(row as TargetRow));
  }

  /** Target seorang sales pada satu periode, null bila belum ditetapkan. */
  async findByUserPeriode(
    userId: string,
    periode: PeriodeTarget,
  ): Promise<TargetEntity | null> {
    const row = await prisma.presurveiTarget.findFirst({
      where: {
        userId,
        periodeTahun: periode.tahun,
        periodeBulan: periode.bulan,
      },
    });
    return row ? toTargetEntity(row as TargetRow) : null;
  }

  /**
   * Simpan target, menimpa yang sudah ada untuk user dan periode yang sama.
   *
   * Memakai cari-lalu-tulis alih-alih `upsert`: batasan uniknya menyertakan
   * `tenantId`, dan nilai itu diisi ekstensi isolasi — bukan oleh pemanggil —
   * sehingga tidak bisa disusun menjadi kunci `where` yang utuh di sini.
   */
  async simpan(input: SimpanTargetInput): Promise<TargetEntity> {
    const adaSebelumnya = await this.findByUserPeriode(input.userId, {
      tahun: input.periodeTahun,
      bulan: input.periodeBulan,
    });

    const row = adaSebelumnya
      ? await prisma.presurveiTarget.update({
          where: { id: adaSebelumnya.id },
          data: {
            targetKunjungan: input.targetKunjungan,
            targetProspek: input.targetProspek,
            targetKonversi: input.targetKonversi,
          },
        })
      : await prisma.presurveiTarget.create({ data: input });

    return toTargetEntity(row as TargetRow);
  }
}
```

- [ ] **Step 7: Jalankan kedua verifikasi**

Run: `npx vitest run tests/modules/presurvei/`
Expected: seluruh modul hijau; task ini menambah 6 test baru. Jangan mencocokkan totalnya dengan angka apa pun — baseline bergeser tiap ronde perbaikan, dan yang harus benar adalah pertambahannya.

Run: `npx tsc --noEmit -p tsconfig.typecheck.json 2>&1 | grep presurvei`
Expected: tanpa output.

- [ ] **Step 8: Commit**

```bash
git add modules/presurvei tests/modules/presurvei/target-rules.test.ts
git commit -m "feat(presurvei): tambah domain dan repository target sales"
```

---

### Task 12: Service target dan laporan pencapaian

**Files:**
- Create: `modules/presurvei/validators/target.validator.ts`
- Create: `modules/presurvei/services/TargetService.ts`
- Create: `modules/presurvei/dto/target.dto.ts`
- Modify: `modules/presurvei/domain/ports/IKegiatanRepository.ts` (satu metode hitung)
- Modify: `modules/presurvei/domain/ports/IProspekRepository.ts` (dua metode hitung)
- Modify: `modules/presurvei/repositories/KegiatanRepository.ts` · `ProspekRepository.ts`
- Modify: `modules/presurvei/index.ts`
- Test: `tests/modules/presurvei/target-service.test.ts`

**Interfaces:**
- Consumes: Task 11
- Produces:
  - `tetapkanTargetSchema`, `laporanPeriodeSchema`
  - `TargetService` dengan `tetapkan`, `ambilPeriode`, `laporanPencapaian`
  - `IKegiatanRepository.hitungPerUser(periode)`, `IProspekRepository.hitungBaruPerUser(periode)`, `IProspekRepository.hitungKonversiPerUser(periode)` — semuanya mengembalikan `Record<string, number>` berkunci userId

Ketiga metode hitung itu yang mengubah target dari angka mati menjadi laporan. Menghitungnya di repository dengan `groupBy` jauh lebih murah daripada mengambil seluruh baris lalu menjumlahkannya di service.

- [ ] **Step 1: Perluas kedua port dengan metode hitung**

Di `modules/presurvei/domain/ports/IKegiatanRepository.ts`, tambahkan:

```ts
/** Rentang waktu tertutup untuk perhitungan laporan. */
export interface RentangPeriode {
  mulai: Date;
  selesai: Date;
}
```

dan ke antarmuka:

```ts
  /** Jumlah kegiatan per pelaku pada satu rentang, berkunci userId. */
  hitungPerUser(rentang: RentangPeriode): Promise<Record<string, number>>;
```

Di `modules/presurvei/domain/ports/IProspekRepository.ts`, impor tipe rentangnya dan tambahkan dua metode. **Pakai `RentangPeriode` yang sama**, jangan mengetik ulang bentuknya inline — dua definisi yang kebetulan sama hari ini akan berbeda saat salah satunya berubah:

```ts
import type { RentangPeriode } from "./IKegiatanRepository";
```

```ts
  /** Jumlah prospek baru per pemilik pada satu rentang, berkunci pemilikId. */
  hitungBaruPerUser(rentang: RentangPeriode): Promise<Record<string, number>>;
  /** Jumlah prospek terkonversi per pemilik pada satu rentang. */
  hitungKonversiPerUser(
    rentang: RentangPeriode,
  ): Promise<Record<string, number>>;
```

- [ ] **Step 2: Implementasikan di kedua repository**

Di `KegiatanRepository`:

```ts
  /** Jumlah kegiatan per pelaku pada satu rentang, berkunci userId. */
  async hitungPerUser(
    rentang: RentangPeriode,
  ): Promise<Record<string, number>> {
    const hasil = await prisma.presurveiKegiatan.groupBy({
      by: ["userId"],
      where: { waktuMulai: { gte: rentang.mulai, lte: rentang.selesai } },
      _count: { _all: true },
    });

    return Object.fromEntries(
      hasil.map((baris) => [baris.userId, baris._count._all]),
    );
  }
```

Di `ProspekRepository`, dua metode dengan bentuk serupa — yang pertama menghitung berdasarkan `createdAt`, yang kedua berdasarkan `konversiAt`:

```ts
  /** Jumlah prospek baru per pemilik pada satu rentang, berkunci pemilikId. */
  async hitungBaruPerUser(
    rentang: RentangPeriode,
  ): Promise<Record<string, number>> {
    return this.hitungPerPemilik({
      createdAt: { gte: rentang.mulai, lte: rentang.selesai },
    });
  }

  /** Jumlah prospek terkonversi per pemilik pada satu rentang. */
  async hitungKonversiPerUser(
    rentang: RentangPeriode,
  ): Promise<Record<string, number>> {
    return this.hitungPerPemilik({
      konversiAt: { gte: rentang.mulai, lte: rentang.selesai },
    });
  }

  private async hitungPerPemilik(
    where: Prisma.PresurveiProspekWhereInput,
  ): Promise<Record<string, number>> {
    const hasil = await prisma.presurveiProspek.groupBy({
      by: ["pemilikId"],
      // Prospek tak bertuan tidak dihitung ke siapa pun; ia muncul di daftar
      // "Belum ditugaskan", bukan di laporan pencapaian seseorang.
      where: { ...where, pemilikId: { not: null } },
      _count: { _all: true },
    });

    return Object.fromEntries(
      hasil
        .filter((baris) => baris.pemilikId !== null)
        .map((baris) => [baris.pemilikId as string, baris._count._all]),
    );
  }
```

- [ ] **Step 3: Tulis validator**

Create `modules/presurvei/validators/target.validator.ts`:

```ts
import { z } from "zod";
import { BULAN_MAKS, BULAN_MIN } from "../domain/entities/Target";

/**
 * Validasi masukan target presurvei.
 */

const TAHUN_MIN = 2020;
const TAHUN_MAKS = 2100;
const TARGET_MAKS = 10_000;

export const tetapkanTargetSchema = z.object({
  userId: z.string().min(1),
  periodeTahun: z.number().int().min(TAHUN_MIN).max(TAHUN_MAKS),
  periodeBulan: z.number().int().min(BULAN_MIN).max(BULAN_MAKS),
  targetKunjungan: z.number().int().min(0).max(TARGET_MAKS),
  targetProspek: z.number().int().min(0).max(TARGET_MAKS),
  targetKonversi: z.number().int().min(0).max(TARGET_MAKS),
});

export const laporanPeriodeSchema = z.object({
  tahun: z.coerce.number().int().min(TAHUN_MIN).max(TAHUN_MAKS),
  bulan: z.coerce.number().int().min(BULAN_MIN).max(BULAN_MAKS),
});
```

- [ ] **Step 4: Tulis test service lebih dulu**

Create `tests/modules/presurvei/target-service.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Laporan pencapaian menggabungkan tiga sumber angka yang dihitung terpisah.
 * Yang paling mudah salah adalah batas periodenya: satu hari meleset berarti
 * kegiatan tanggal 1 atau tanggal terakhir hilang dari laporan bulan itu.
 */

import { TargetService } from "@/modules/presurvei/services/TargetService";
import type { ITargetRepository } from "@/modules/presurvei/domain/ports/ITargetRepository";
import type { IKegiatanRepository } from "@/modules/presurvei/domain/ports/IKegiatanRepository";
import type { IProspekRepository } from "@/modules/presurvei/domain/ports/IProspekRepository";
import type { TargetEntity } from "@/modules/presurvei/domain/entities/Target";

const WAKTU = new Date("2026-09-01T00:00:00.000Z");

const target = (over: Partial<TargetEntity> = {}): TargetEntity =>
  ({
    id: "target-1",
    userId: "sales-1",
    periodeTahun: 2026,
    periodeBulan: 9,
    targetKunjungan: 20,
    targetProspek: 10,
    targetKonversi: 5,
    tenantId: "tenant-1",
    createdAt: WAKTU,
    updatedAt: WAKTU,
    ...over,
  }) as TargetEntity;

const bangunTargetRepo = (): ITargetRepository => ({
  findByPeriode: vi.fn().mockResolvedValue([target()]),
  findByUserPeriode: vi.fn().mockResolvedValue(null),
  simpan: vi.fn().mockResolvedValue(target()),
});

const bangunKegiatanRepo = () =>
  ({
    hitungPerUser: vi.fn().mockResolvedValue({ "sales-1": 10 }),
  }) as unknown as IKegiatanRepository;

const bangunProspekRepo = () =>
  ({
    hitungBaruPerUser: vi.fn().mockResolvedValue({ "sales-1": 5 }),
    hitungKonversiPerUser: vi.fn().mockResolvedValue({ "sales-1": 1 }),
  }) as unknown as IProspekRepository;

describe("TargetService.laporanPencapaian", () => {
  let targetRepo: ITargetRepository;
  let kegiatanRepo: IKegiatanRepository;
  let prospekRepo: IProspekRepository;

  beforeEach(() => {
    targetRepo = bangunTargetRepo();
    kegiatanRepo = bangunKegiatanRepo();
    prospekRepo = bangunProspekRepo();
  });

  const service = () =>
    new TargetService(targetRepo, kegiatanRepo, prospekRepo);

  it("menggabungkan target dengan realisasi tiap sales", async () => {
    const hasil = await service().laporanPencapaian({ tahun: 2026, bulan: 9 });

    expect(hasil).toHaveLength(1);
    expect(hasil[0]).toMatchObject({
      userId: "sales-1",
      pencapaian: {
        kunjungan: { target: 20, tercapai: 10, persen: 50 },
        prospek: { target: 10, tercapai: 5, persen: 50 },
        konversi: { target: 5, tercapai: 1, persen: 20 },
      },
    });
  });

  it("memakai rentang yang mencakup seluruh hari pada bulan itu", async () => {
    await service().laporanPencapaian({ tahun: 2026, bulan: 9 });

    const rentang = vi.mocked(kegiatanRepo.hitungPerUser).mock.calls[0][0];
    expect(rentang.mulai.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    // September berakhir tanggal 30; batas atasnya harus mencakup detik
    // terakhir hari itu, bukan tengah malam yang memotong satu hari penuh.
    expect(rentang.selesai.toISOString()).toBe("2026-09-30T23:59:59.999Z");
  });

  it("menangani Desember dengan menyeberang ke tahun berikutnya", async () => {
    await service().laporanPencapaian({ tahun: 2026, bulan: 12 });

    const rentang = vi.mocked(kegiatanRepo.hitungPerUser).mock.calls[0][0];
    expect(rentang.selesai.toISOString()).toBe("2026-12-31T23:59:59.999Z");
  });

  it("menangani Februari tahun kabisat", async () => {
    await service().laporanPencapaian({ tahun: 2028, bulan: 2 });

    const rentang = vi.mocked(kegiatanRepo.hitungPerUser).mock.calls[0][0];
    expect(rentang.selesai.toISOString()).toBe("2028-02-29T23:59:59.999Z");
  });

  it("melaporkan nol realisasi untuk sales yang belum bergerak", async () => {
    vi.mocked(kegiatanRepo.hitungPerUser).mockResolvedValue({});
    vi.mocked(prospekRepo.hitungBaruPerUser).mockResolvedValue({});
    vi.mocked(prospekRepo.hitungKonversiPerUser).mockResolvedValue({});

    const hasil = await service().laporanPencapaian({ tahun: 2026, bulan: 9 });

    expect(hasil[0].pencapaian.kunjungan.tercapai).toBe(0);
    expect(hasil[0].pencapaian.kunjungan.persen).toBe(0);
  });

  it("mengembalikan daftar kosong saat belum ada target ditetapkan", async () => {
    vi.mocked(targetRepo.findByPeriode).mockResolvedValue([]);

    expect(
      await service().laporanPencapaian({ tahun: 2026, bulan: 9 }),
    ).toEqual([]);
  });
});

describe("TargetService.tetapkan", () => {
  it("meneruskan masukan apa adanya ke repository", async () => {
    const targetRepo = bangunTargetRepo();
    const service = new TargetService(
      targetRepo,
      bangunKegiatanRepo(),
      bangunProspekRepo(),
    );

    await service.tetapkan({
      userId: "sales-1",
      periodeTahun: 2026,
      periodeBulan: 9,
      targetKunjungan: 20,
      targetProspek: 10,
      targetKonversi: 5,
    });

    expect(targetRepo.simpan).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 5: Tulis service dan DTO**

Create `modules/presurvei/services/TargetService.ts`:

```ts
import type { PeriodeTarget, TargetEntity } from "../domain/entities/Target";
import type {
  IKegiatanRepository,
  RentangPeriode,
} from "../domain/ports/IKegiatanRepository";
import type { IProspekRepository } from "../domain/ports/IProspekRepository";
import type {
  ITargetRepository,
  SimpanTargetInput,
} from "../domain/ports/ITargetRepository";
import { hitungPencapaian, type Pencapaian } from "../domain/target-rules";
import { KegiatanRepository } from "../repositories/KegiatanRepository";
import { ProspekRepository } from "../repositories/ProspekRepository";
import { TargetRepository } from "../repositories/TargetRepository";

/** Satu baris laporan: target seorang sales beserta pencapaiannya. */
export interface BarisLaporan {
  userId: string;
  periodeTahun: number;
  periodeBulan: number;
  pencapaian: Pencapaian;
}

const BULAN_BERIKUTNYA = 1;
const SATU_MILIDETIK = 1;

/**
 * Orkestrasi target sales beserta laporan pencapaiannya.
 *
 * Realisasi dihitung di repository lewat agregasi, bukan dengan mengambil
 * seluruh baris lalu menjumlahkannya di sini — laporan satu bulan bisa
 * menyentuh ribuan kegiatan.
 */
export class TargetService {
  constructor(
    private readonly targetRepository: ITargetRepository = new TargetRepository(),
    private readonly kegiatanRepository: IKegiatanRepository = new KegiatanRepository(),
    private readonly prospekRepository: IProspekRepository = new ProspekRepository(),
  ) {}

  /** Tetapkan target seorang sales, menimpa target periode yang sama. */
  async tetapkan(input: SimpanTargetInput): Promise<TargetEntity> {
    return this.targetRepository.simpan(input);
  }

  /** Seluruh target pada satu periode. */
  async ambilPeriode(periode: PeriodeTarget): Promise<TargetEntity[]> {
    return this.targetRepository.findByPeriode(periode);
  }

  /** Target beserta realisasinya untuk seluruh sales pada satu periode. */
  async laporanPencapaian(periode: PeriodeTarget): Promise<BarisLaporan[]> {
    const target = await this.targetRepository.findByPeriode(periode);
    if (target.length === 0) return [];

    const rentang = bangunRentangBulan(periode);

    const [kunjungan, prospekBaru, konversi] = await Promise.all([
      this.kegiatanRepository.hitungPerUser(rentang),
      this.prospekRepository.hitungBaruPerUser(rentang),
      this.prospekRepository.hitungKonversiPerUser(rentang),
    ]);

    return target.map((baris) => ({
      userId: baris.userId,
      periodeTahun: baris.periodeTahun,
      periodeBulan: baris.periodeBulan,
      pencapaian: hitungPencapaian(baris, {
        kunjungan: kunjungan[baris.userId] ?? 0,
        prospek: prospekBaru[baris.userId] ?? 0,
        konversi: konversi[baris.userId] ?? 0,
      }),
    }));
  }
}

/**
 * Rentang tertutup yang mencakup seluruh hari pada satu bulan.
 *
 * Batas atasnya satu milidetik sebelum bulan berikutnya, bukan tengah malam
 * tanggal terakhir — memakai tengah malam akan memotong kegiatan sepanjang
 * hari terakhir dari laporan. Penanggalan bulan diserahkan ke `Date` supaya
 * jumlah hari dan tahun kabisat tidak perlu dihitung sendiri.
 */
function bangunRentangBulan(periode: PeriodeTarget): RentangPeriode {
  const mulai = new Date(Date.UTC(periode.tahun, periode.bulan - 1, 1));
  const awalBulanBerikutnya = Date.UTC(
    periode.tahun,
    periode.bulan - 1 + BULAN_BERIKUTNYA,
    1,
  );

  return {
    mulai,
    selesai: new Date(awalBulanBerikutnya - SATU_MILIDETIK),
  };
}
```

Create `modules/presurvei/dto/target.dto.ts`:

```ts
import type { TargetEntity } from "../domain/entities/Target";
import type { BarisLaporan } from "../services/TargetService";

/**
 * Bentuk data target yang dikirim ke klien.
 */

export interface TargetDto {
  id: string;
  userId: string;
  periodeTahun: number;
  periodeBulan: number;
  targetKunjungan: number;
  targetProspek: number;
  targetKonversi: number;
  updatedAt: string;
}

export interface BarisLaporanDto {
  userId: string;
  periodeTahun: number;
  periodeBulan: number;
  kunjungan: { target: number; tercapai: number; persen: number };
  prospek: { target: number; tercapai: number; persen: number };
  konversi: { target: number; tercapai: number; persen: number };
}

/** Bentuk target untuk klien. */
export function toTargetDto(target: TargetEntity): TargetDto {
  return {
    id: target.id,
    userId: target.userId,
    periodeTahun: target.periodeTahun,
    periodeBulan: target.periodeBulan,
    targetKunjungan: target.targetKunjungan,
    targetProspek: target.targetProspek,
    targetKonversi: target.targetKonversi,
    updatedAt: target.updatedAt.toISOString(),
  };
}

/** Bentuk satu baris laporan pencapaian untuk klien. */
export function toBarisLaporanDto(baris: BarisLaporan): BarisLaporanDto {
  return {
    userId: baris.userId,
    periodeTahun: baris.periodeTahun,
    periodeBulan: baris.periodeBulan,
    kunjungan: baris.pencapaian.kunjungan,
    prospek: baris.pencapaian.prospek,
    konversi: baris.pencapaian.konversi,
  };
}
```

- [ ] **Step 6: Perbarui mock port di test yang sudah ada**

Menambah metode ke `IKegiatanRepository` dan `IProspekRepository` membuat setiap objek mock yang mengaku memenuhi antarmuka itu gagal typecheck. Tambahkan ketiganya ke `bangunRepository()` di `prospek-service.test.ts`, `kegiatan-service.test.ts`, dan `prospek-konversi-service.test.ts`:

```ts
  hitungPerUser: vi.fn().mockResolvedValue({}),
```
untuk kegiatan, dan
```ts
  hitungBaruPerUser: vi.fn().mockResolvedValue({}),
  hitungKonversiPerUser: vi.fn().mockResolvedValue({}),
```
untuk prospek.

Jalankan `npx tsc --noEmit -p tsconfig.typecheck.json 2>&1 | grep presurvei` untuk menemukan berkas mana saja yang mengeluh — jangan menebak daftarnya.

- [ ] **Step 7: Ekspor dari public API**

Di `modules/presurvei/index.ts`:

```ts
export {
  BULAN_MAKS,
  BULAN_MIN,
  type PeriodeTarget,
  type RealisasiTarget,
  type TargetEntity,
} from "./domain/entities/Target";

export {
  hitungPencapaian,
  type BarisPencapaian,
  type Pencapaian,
} from "./domain/target-rules";

export {
  laporanPeriodeSchema,
  tetapkanTargetSchema,
} from "./validators/target.validator";

export { TargetService, type BarisLaporan } from "./services/TargetService";

export {
  toBarisLaporanDto,
  toTargetDto,
  type BarisLaporanDto,
  type TargetDto,
} from "./dto/target.dto";
```

- [ ] **Step 8: Jalankan kedua verifikasi**

Run: `npx vitest run tests/modules/presurvei/`
Expected: seluruh modul hijau; task ini menambah 7 test baru. Jangan mencocokkan totalnya dengan angka apa pun — baseline bergeser tiap ronde perbaikan, dan yang harus benar adalah pertambahannya.

Run: `npx tsc --noEmit -p tsconfig.typecheck.json 2>&1 | grep presurvei`
Expected: tanpa output.

- [ ] **Step 9: Commit**

```bash
git add modules/presurvei tests/modules/presurvei
git commit -m "feat(presurvei): tambah service target dan laporan pencapaian"
```

---

### Task 13: Route admin target dan laporan

**Files:**
- Create: `app/api/admin/presurvei/target/route.ts`
- Create: `app/api/admin/presurvei/laporan/route.ts`

**Interfaces:**
- Consumes: Task 12
- Produces: tiga endpoint admin — daftar target periode, tetapkan target, dan laporan pencapaian

- [ ] **Step 1: Tulis route target**

Create `app/api/admin/presurvei/target/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { apiSuccess, createHandler } from "@/lib/api";
import {
  laporanPeriodeSchema,
  TargetService,
  tetapkanTargetSchema,
  toTargetDto,
} from "@/modules/presurvei";

const service = new TargetService();

/** GET /api/admin/presurvei/target — target seluruh sales pada satu periode. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei_target:read"] },
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const periode = laporanPeriodeSchema.parse({
      tahun: searchParams.get("tahun") ?? undefined,
      bulan: searchParams.get("bulan") ?? undefined,
    });

    const target = await service.ambilPeriode(periode);

    return apiSuccess(target.map(toTargetDto));
  },
);

/** POST /api/admin/presurvei/target — tetapkan target seorang sales. */
export const POST = createHandler(
  {
    auth: true,
    permissions: ["presurvei_target:create"],
    schema: tetapkanTargetSchema,
  },
  async (_request, ctx) => {
    const target = await service.tetapkan(ctx.validated);
    return apiSuccess(toTargetDto(target), { status: 201 });
  },
);
```

Tidak ada route `[id]`: target dialamati dengan pasangan sales dan periode, bukan id-nya, dan `POST` sudah menimpa target yang sudah ada. Menambahkan `PATCH /target/[id]` berarti dua jalan menuju hasil yang sama.

- [ ] **Step 2: Tulis route laporan**

Create `app/api/admin/presurvei/laporan/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { apiSuccess, createHandler } from "@/lib/api";
import {
  laporanPeriodeSchema,
  TargetService,
  toBarisLaporanDto,
} from "@/modules/presurvei";

const service = new TargetService();

/** GET /api/admin/presurvei/laporan — pencapaian sales pada satu periode. */
export const GET = createHandler(
  { auth: true, permissions: ["presurvei_laporan:read"] },
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const periode = laporanPeriodeSchema.parse({
      tahun: searchParams.get("tahun") ?? undefined,
      bulan: searchParams.get("bulan") ?? undefined,
    });

    const laporan = await service.laporanPencapaian(periode);

    return apiSuccess(laporan.map(toBarisLaporanDto));
  },
);
```

- [ ] **Step 3: Jalankan verifikasi**

Run: `npm run typecheck`
Expected: lulus.

Run: `npx vitest run tests/modules/presurvei/`
Expected: 187 test tetap hijau.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/presurvei
git commit -m "feat(presurvei): tambah route admin target dan laporan pencapaian"
```

---
# GELOMBANG D — Utang dan penutup

### Task 14: Permission iklan, target, dan laporan

**Files:**
- Modify: `lib/permissions.ts`
- Modify: `lib/permission-config.ts`
- Modify: `lib/resource-capabilities.ts`
- Modify: `scripts/seed-presurvei-permissions.ts`

**Interfaces:**
- Consumes: route Gelombang B dan C
- Produces: `presurvei_iklan:read|create|update`, `presurvei_target:read|create`, `presurvei_laporan:read` dikenali RBAC dan tersemai ke role admin

Tanpa task ini, keenam route admin yang dibangun Gelombang B dan C menolak semua pemanggil.

Perhatikan daftar action-nya sengaja sempit — hanya yang benar-benar dipakai route. `delete` tidak didaftarkan karena tidak ada route DELETE; `site_only` tidak didaftarkan karena pembatasan per-site belum ditegakkan kode mana pun dan toggle yang tidak berefek lebih buruk daripada tidak ada. Ini pelajaran dari Fase 1, di mana `presurvei:site_only` sempat didaftarkan lalu harus dicabut.

- [ ] **Step 1: Tambahkan konstanta permission**

Di `lib/permissions.ts`, dalam blok `MARKETING`, sisipkan setelah blok `PRESURVEI` yang sudah ada:

```ts
    PRESURVEI_IKLAN: {
      READ: "presurvei_iklan:read",
      CREATE: "presurvei_iklan:create",
      UPDATE: "presurvei_iklan:update",
    },
    PRESURVEI_TARGET: {
      READ: "presurvei_target:read",
      CREATE: "presurvei_target:create",
    },
    PRESURVEI_LAPORAN: {
      READ: "presurvei_laporan:read",
    },
```

- [ ] **Step 2: Daftarkan ke grup permission**

Di `lib/permission-config.ts`, tambahkan ketiganya ke `PERMISSION_GROUPS.MARKETING`:

```ts
    "presurvei_iklan",
    "presurvei_target",
    "presurvei_laporan",
```

Jangan tambahkan ke `PERMISSION_GROUPS_MOBILE` — ketiganya pekerjaan admin web.

- [ ] **Step 3: Tambahkan resource capability**

Di `lib/resource-capabilities.ts`, sisipkan setelah entri `presurvei`, mengikuti bentuk tetangganya (tanpa `displayName`, karena ini entri web):

```ts
  presurvei_iklan: {
    actions: ["read", "create", "update"],
    description: "Kampanye iklan sebagai asal prospek presurvei",
  },
  presurvei_target: {
    actions: ["read", "create"],
    description: "Target sales presurvei per periode",
  },
  presurvei_laporan: {
    actions: ["read"],
    description: "Laporan pencapaian target presurvei",
  },
```

- [ ] **Step 4: Tambahkan ke script seed**

Di `scripts/seed-presurvei-permissions.ts`, tambahkan keenam permission ke array `PERMISSIONS`:

```ts
  { resource: "presurvei_iklan", action: "read", description: "Lihat kampanye iklan presurvei" },
  { resource: "presurvei_iklan", action: "create", description: "Catat kampanye iklan presurvei" },
  { resource: "presurvei_iklan", action: "update", description: "Ubah kampanye iklan presurvei" },
  { resource: "presurvei_target", action: "read", description: "Lihat target sales presurvei" },
  { resource: "presurvei_target", action: "create", description: "Tetapkan target sales presurvei" },
  { resource: "presurvei_laporan", action: "read", description: "Lihat laporan pencapaian presurvei" },
```

Lalu perluas daftar resource yang diambil saat menautkan ke role:

```ts
  const semuaPermission = await prisma.permission.findMany({
    where: {
      resource: {
        in: [
          "presurvei",
          "m_presurvei",
          "presurvei_iklan",
          "presurvei_target",
          "presurvei_laporan",
        ],
      },
    },
  });
```

`PERMISSION_SALES` tidak berubah — sales tetap hanya memegang permission mobile.

- [ ] **Step 5: Jalankan seed dan verifikasi**

Run: `npx tsx scripts/seed-presurvei-permissions.ts`
Expected: melaporkan permission yang dibuat dan role yang diperbarui.

Verifikasi hasilnya di database:
```bash
docker exec netmanager-postgres-app psql -U netmgr -d netmanager -tAc "select resource||':'||action from \"Permission\" where resource like 'presurvei%' order by 1;"
```
Expected: memuat keenam permission baru. Pastikan `presurvei:site_only` **tidak** muncul — ia sengaja dicabut di Fase 1.

Verifikasi role admin menerimanya:
```bash
docker exec netmanager-postgres-app psql -U netmgr -d netmanager -tAc "select count(*) from \"Permission\" p join \"_PermissionToRole\" pr on pr.\"A\"=p.id join roles r on r.id=pr.\"B\" where r.name='ADMIN' and p.resource like 'presurvei_%';"
```
Expected: 6.

- [ ] **Step 6: Jalankan lint dan typecheck**

Run: `npm run lint && npm run typecheck`
Expected: keduanya lulus.

- [ ] **Step 7: Commit**

```bash
git add lib scripts/seed-presurvei-permissions.ts
git commit -m "feat(presurvei): daftarkan permission iklan, target, dan laporan"
```

---

### Task 15: Test route presurvei

**Files:**
- Create: `tests/api/presurvei-prospek-route.test.ts`
- Create: `tests/api/presurvei-konversi-route.test.ts`

**Interfaces:**
- Consumes: seluruh route presurvei
- Produces: jaring pengaman untuk pemasangan permission dan pembatasan kepemilikan di lapisan route

Ini utang Fase 1 yang paling penting. Review akhir Fase 1 menemukan bahwa baris paling kritikal keamanan — penimpaan filter kepemilikan di route daftar — tidak punya test sama sekali. Refactor yang membalik urutan spread (`{ pemilikId, ...filters }` alih-alih `{ ...filters, pemilikId }`) akan mengembalikan celahnya tanpa satu test pun merah.

**Peringatan soal acuan:** `tests/api/` memuat dua macam test. Sebagian benar-benar mengimpor route dan memanggil handler-nya — `marketing-canvasing-approve-route.test.ts` adalah contohnya. Sebagian lain **tidak**: `admin-holidays-id-route.test.ts` membangun objek `response` palsu lalu mengasersikannya, dengan komentar yang mengakui lingkungan Vitest tidak stabil untuk pemanggilan sungguhan. Yang kedua itu tautologis dan **jangan ditiru**. Pola di bawah mengikuti yang pertama.

Bedanya dengan route canvasing: route presurvei memakai `createHandler`, yang mengambil sesi lewat `getServerSession(authOptions)` dan membaca `session.user.permissions` langsung bila ada. Jadi yang di-mock adalah `next-auth` dan `@/lib/auth`, bukan `verifyAuth`.

- [ ] **Step 1: Tulis test route daftar dan buat prospek**

Create `tests/api/presurvei-prospek-route.test.ts`:

```ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Pembatasan kepemilikan di lapisan route.
 *
 * Permission presurvei bersifat ATAU — pemanggil bermodal permission mobile
 * saja lolos gerbang yang sama dengan admin web. Yang membedakan keduanya
 * adalah penimpaan filter di route ini. Tanpa test, refactor yang membalik
 * urutan spread mengembalikan celahnya tanpa suara.
 */

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  daftar: vi.fn(),
  buat: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockFns.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  authConfig: {},
  getUserPermissions: mockFns.getUserPermissions,
}));

vi.mock("@/modules/presurvei", async () => {
  const actual =
    await vi.importActual<typeof import("@/modules/presurvei")>(
      "@/modules/presurvei",
    );

  return {
    ...actual,
    ProspekService: class {
      daftar = mockFns.daftar;
      buat = mockFns.buat;
    },
  };
});

import { GET, POST } from "@/app/api/presurvei/prospek/route";

const ID_SESI = "sales-a";
const ID_ORANG_LAIN = "sales-b";

const prospekTersimpan = {
  id: "prospek-1",
  nama: "Budi",
  noTelp: "081234567890",
  email: null,
  alamat: "Jl. Merdeka 10",
  latitude: null,
  longitude: null,
  shareloc: null,
  sumber: "WALK_IN",
  iklanId: null,
  registrationId: null,
  referralNama: null,
  status: "BARU",
  pemilikId: ID_SESI,
  paketDiminati: null,
  catatan: null,
  canvasingId: null,
  konversiAt: null,
  siteId: null,
  tenantId: "tenant-1",
  createdAt: new Date("2026-09-22T00:00:00.000Z"),
  updatedAt: new Date("2026-09-22T00:00:00.000Z"),
};

const beriPermission = (permissions: string[]): void => {
  mockFns.getServerSession.mockResolvedValue({
    user: { id: ID_SESI, email: "sales-a@contoh.id", permissions },
  });
  mockFns.getUserPermissions.mockResolvedValue(permissions);
};

const mintaDaftar = (query: string) =>
  GET(new NextRequest(`http://localhost/api/presurvei/prospek?${query}`), {
    params: Promise.resolve({}),
  } as never);

const mintaBuat = (body: Record<string, unknown>) =>
  POST(
    new NextRequest("http://localhost/api/presurvei/prospek", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) } as never,
  );

describe("GET /api/presurvei/prospek — pembatasan kepemilikan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.daftar.mockResolvedValue({ items: [], total: 0 });
  });

  it("memaksa pemanggil bermodal permission mobile melihat miliknya sendiri", async () => {
    // Inilah test yang merah bila urutan spread di route dibalik.
    beriPermission(["m_presurvei:read"]);

    await mintaDaftar(`pemilikId=${ID_ORANG_LAIN}`);

    expect(mockFns.daftar).toHaveBeenCalledWith(
      expect.objectContaining({ pemilikId: ID_SESI }),
    );
  });

  it("menghormati filter pemilik dari pemegang permission web", async () => {
    beriPermission(["presurvei:read"]);

    await mintaDaftar(`pemilikId=${ID_ORANG_LAIN}`);

    expect(mockFns.daftar).toHaveBeenCalledWith(
      expect.objectContaining({ pemilikId: ID_ORANG_LAIN }),
    );
  });

  it("memperlakukan wildcard super admin seperti permission web", async () => {
    beriPermission(["*"]);

    await mintaDaftar(`pemilikId=${ID_ORANG_LAIN}`);

    expect(mockFns.daftar).toHaveBeenCalledWith(
      expect.objectContaining({ pemilikId: ID_ORANG_LAIN }),
    );
  });

  it("tetap mengikat pemanggil mobile meski tidak mengirim filter pemilik", async () => {
    beriPermission(["m_presurvei:read"]);

    await mintaDaftar("page=1");

    expect(mockFns.daftar).toHaveBeenCalledWith(
      expect.objectContaining({ pemilikId: ID_SESI }),
    );
  });
});

describe("POST /api/presurvei/prospek — penugasan pemilik", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.buat.mockResolvedValue(prospekTersimpan);
  });

  const bodiDasar = {
    nama: "Budi",
    noTelp: "081234567890",
    alamat: "Jl. Merdeka 10",
    sumber: "WALK_IN",
  };

  it("mengabaikan pemilik kiriman klien dari pemanggil mobile", async () => {
    beriPermission(["m_presurvei:create"]);

    await mintaBuat({ ...bodiDasar, pemilikId: ID_ORANG_LAIN });

    expect(mockFns.buat).toHaveBeenCalledWith(
      expect.objectContaining({ pemilikId: ID_SESI }),
      expect.anything(),
    );
  });

  it("menghormati pemilik kiriman admin web", async () => {
    beriPermission(["presurvei:read", "presurvei:create"]);

    await mintaBuat({ ...bodiDasar, pemilikId: ID_ORANG_LAIN });

    expect(mockFns.buat).toHaveBeenCalledWith(
      expect.objectContaining({ pemilikId: ID_ORANG_LAIN }),
      expect.anything(),
    );
  });

  it("meneruskan penanda abaikan duplikat ke service, bukan ke data prospek", async () => {
    beriPermission(["presurvei:create"]);

    await mintaBuat({ ...bodiDasar, abaikanDuplikat: true });

    const [dataProspek, opsi] = mockFns.buat.mock.calls[0];
    expect(dataProspek).not.toHaveProperty("abaikanDuplikat");
    expect(opsi).toMatchObject({ abaikanDuplikat: true });
  });

  it("menolak pemanggil tanpa permission apa pun", async () => {
    beriPermission([]);

    const response = await mintaBuat(bodiDasar);

    expect(response.status).toBe(403);
    expect(mockFns.buat).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Jalankan dan sesuaikan bila perlu**

Run: `npx vitest run tests/api/presurvei-prospek-route.test.ts`

Bila gagal karena bentuk pemanggilan handler atau mock sesi, **sesuaikan test-nya** dengan yang sebenarnya dibutuhkan `createHandler` — baca `lib/api/handler.ts` untuk memastikan. Jangan mengubah route agar cocok dengan test. Kalau setelah dua kali percobaan masih tidak jalan, berhenti dan laporkan apa yang kamu temukan.

- [ ] **Step 3: Tulis test route promosi**

Create `tests/api/presurvei-konversi-route.test.ts`, mengikuti bentuk yang sama:

```ts
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Promosi mengubah prospek menjadi canvasing dan memicu work order instalasi —
 * tindakan yang tidak bisa dibatalkan dari sisi presurvei. Pembatasan
 * kepemilikannya karena itu perlu dijaga sama ketatnya dengan route lain.
 */

const mockFns = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getUserPermissions: vi.fn(),
  jadikanCanvasing: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockFns.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  authConfig: {},
  getUserPermissions: mockFns.getUserPermissions,
}));

vi.mock("@/modules/presurvei", async () => {
  const actual =
    await vi.importActual<typeof import("@/modules/presurvei")>(
      "@/modules/presurvei",
    );

  return {
    ...actual,
    ProspekKonversiService: class {
      jadikanCanvasing = mockFns.jadikanCanvasing;
    },
  };
});

import { POST } from "@/app/api/presurvei/prospek/[id]/jadikan-canvasing/route";

const ID_SESI = "sales-a";

const beriPermission = (permissions: string[]): void => {
  mockFns.getServerSession.mockResolvedValue({
    user: { id: ID_SESI, email: "sales-a@contoh.id", permissions },
  });
  mockFns.getUserPermissions.mockResolvedValue(permissions);
};

const mintaPromosi = (body: Record<string, unknown>) =>
  POST(
    new NextRequest(
      "http://localhost/api/presurvei/prospek/prospek-1/jadikan-canvasing",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    ),
    { params: Promise.resolve({ id: "prospek-1" }) } as never,
  );

const bodiLengkap = { noKtp: "3201234567890001", paket: "HOME_20MBPS" };

describe("POST /api/presurvei/prospek/[id]/jadikan-canvasing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.jadikanCanvasing.mockResolvedValue({
      prospek: {
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
        status: "DEAL",
        pemilikId: ID_SESI,
        paketDiminati: null,
        catatan: null,
        canvasingId: "canvasing-1",
        konversiAt: new Date("2026-09-23T00:00:00.000Z"),
        siteId: null,
        tenantId: "tenant-1",
        createdAt: new Date("2026-09-22T00:00:00.000Z"),
        updatedAt: new Date("2026-09-23T00:00:00.000Z"),
      },
      canvasingId: "canvasing-1",
    });
  });

  it("mengikat pemanggil mobile ke prospek miliknya sendiri", async () => {
    beriPermission(["m_presurvei:update"]);

    await mintaPromosi(bodiLengkap);

    expect(mockFns.jadikanCanvasing).toHaveBeenCalledWith(
      "prospek-1",
      expect.objectContaining(bodiLengkap),
      ID_SESI,
    );
  });

  it("membiarkan admin web mempromosikan prospek siapa pun", async () => {
    beriPermission(["presurvei:read", "presurvei:update"]);

    await mintaPromosi(bodiLengkap);

    expect(mockFns.jadikanCanvasing).toHaveBeenCalledWith(
      "prospek-1",
      expect.objectContaining(bodiLengkap),
      undefined,
    );
  });

  it("menolak permintaan tanpa nomor KTP sebelum menyentuh service", async () => {
    beriPermission(["presurvei:update"]);

    const response = await mintaPromosi({ paket: "HOME_20MBPS" });

    expect(response.status).toBe(400);
    expect(mockFns.jadikanCanvasing).not.toHaveBeenCalled();
  });

  it("menolak permintaan tanpa paket", async () => {
    beriPermission(["presurvei:update"]);

    const response = await mintaPromosi({ noKtp: "3201234567890001" });

    expect(response.status).toBe(400);
    expect(mockFns.jadikanCanvasing).not.toHaveBeenCalled();
  });

  it("menolak pemanggil tanpa permission update", async () => {
    beriPermission(["m_presurvei:read"]);

    const response = await mintaPromosi(bodiLengkap);

    expect(response.status).toBe(403);
    expect(mockFns.jadikanCanvasing).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Buktikan test menangkap regresinya**

Test yang tidak pernah terbukti merah tidak membuktikan apa pun. Untuk test "memaksa pemanggil bermodal permission mobile melihat miliknya sendiri":

1. Ubah sementara `app/api/presurvei/prospek/route.ts` agar penimpaannya terbalik — `{ pemilikId: ctx.session!.user.id, ...filters }` alih-alih `{ ...filters, pemilikId: ... }`
2. Run: `npx vitest run tests/api/presurvei-prospek-route.test.ts`
3. **Konfirmasi test itu MERAH**
4. Pulihkan route, jalankan lagi, konfirmasi hijau

Lakukan hal yang sama untuk "mengikat pemanggil mobile ke prospek miliknya sendiri" pada berkas konversi — ubah `pemilikWajib` menjadi selalu `undefined`, konfirmasi merah, pulihkan.

Laporkan kedua bukti merah-dulu itu.

- [ ] **Step 5: Jalankan verifikasi**

Run: `npx vitest run tests/api/presurvei-prospek-route.test.ts tests/api/presurvei-konversi-route.test.ts`
Expected: seluruhnya hijau.

Run: `npm run typecheck`
Expected: lulus.

- [ ] **Step 6: Commit**

```bash
git add tests/api
git commit -m "test(presurvei): kunci pembatasan kepemilikan di lapisan route"
```

---

### Task 16: Verifikasi menyeluruh dan changelog

**Files:**
- Modify: `docs/architecture/presurvei-module-design.md`
- Modify: `docs/CHANGELOG.md`

**Interfaces:**
- Consumes: seluruh task sebelumnya
- Produces: —

- [ ] **Step 1: Jalankan seluruh verifikasi**

Jalankan berurutan dan catat hasil masing-masing:

1. `npx vitest run tests/modules/presurvei/` — catat jumlah berkas dan test
2. `npx vitest run tests/api/` — test route
3. `npm run lint`
4. `npm run typecheck`
5. `npx prisma migrate status` — harus "Database schema is up to date!"
6. `npm test` — seluruh suite repo

Untuk nomor 6: bila ada yang gagal, periksa apakah kegagalannya berkaitan dengan presurvei. Bila tidak berkaitan, catat nama test-nya dan laporkan apa adanya — jangan memperbaikinya dan jangan menyembunyikannya. Bila berkaitan, berhenti dan laporkan sebagai BLOCKED.

- [ ] **Step 2: Perbarui spec**

Di `docs/architecture/presurvei-module-design.md`, sesuaikan agar mencerminkan apa yang benar-benar dibangun:

- Bagian fase: tandai Fase 2 selesai, dan sebutkan bahwa UI admin (Fase 3) serta aplikasi sales (Fase 4) belum dikerjakan.
- Bagian permission: tambahkan `presurvei_iklan:read|create|update`, `presurvei_target:read|create`, `presurvei_laporan:read`, dan catat bahwa ketiganya admin-web saja.
- Bagian alur §6.2: sebutkan bahwa prospek dari form publik kini lahir otomatis lewat event, bahwa `utm_campaign` dicocokkan ke kode kampanye, dan bahwa prospek tanpa kampanye yang dikenal tetap tercatat dengan sumber `WEBSITE`.
- Bagian alur §6.3: sebutkan bahwa endpoint promosi **menerima** `noKtp`, `paket`, dan `kabel` dari body karena prospek tidak memilikinya, dan bahwa data teknis diambil dari kegiatan survei terbaru sebagai nilai awal.
- Bagian §13 risiko: tandai bahwa peringatan duplikat berbasis nomor telepon sudah dibangun, dan jelaskan bahwa ia peringatan yang bisa dilewati, bukan larangan.

- [ ] **Step 3: Tulis entri changelog**

Tambahkan satu entri di bagian `[Unreleased]` pada `docs/CHANGELOG.md`, mengikuti format yang dipatok CLAUDE.md. Satu entri untuk seluruh Fase 2, bukan enam belas.

Yang wajib ada di dalamnya:
- **Tipe**: `[ADDED]`
- **Scope**: `modules/presurvei`
- **Migration**: nama folder migration UTM yang sebenarnya dari Task 1
- **Breaking**: ❌ Tidak
- **Deskripsi** yang menyebut: prospek otomatis dari form publik beserta atribusi kampanyenya, peringatan duplikat nomor telepon, promosi prospek menjadi canvasing yang menutup perjalanan sampai work order instalasi, entitas iklan dan target beserta laporan pencapaian, dan bahwa modul Canvasing tidak diubah selain satu tipe yang diekspor.

Sebutkan juga jumlah test akhir.

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs(changelog): catat penambahan modul presurvei fase 2"
```

---

## Yang Belum Dikerjakan Sesudah Fase 2

- **Fase 3**: UI admin web — daftar kegiatan, papan prospek, kelola iklan dan target, halaman laporan. Termasuk penegakan `site_only` beserta deklarasi permission-nya, yang sengaja ditunda sampai ada kode yang menegakkannya.
- **Fase 4**: mobile — route group `(sales)`, beranda sales, layar presurvei, pengarahan setelah login.
- **Di luar modul ini**: kolom `support_tickets.rating` yang hilang dari schema tanpa migration sementara kode masih menulisnya. Ia akan terus muncul setiap kali ada yang menjalankan `migrate dev`, dan butuh keputusan tersendiri.
