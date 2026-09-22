# Presurvei Fase 3 — UI Admin Web: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun enam layar admin web untuk modul presurvei, yang sejak Fase 2 berfungsi penuh lewat API tapi belum punya satu halaman pun.

**Architecture:** Mengikuti konvensi admin yang sudah terbukti di repo — Server Component tipis sebagai gerbang permission, Client Component sebagai shell, hook untuk pengambilan data, dan komponen presentasional murni. Logika yang tidak bisa diuji lewat DOM (aturan seret kanban, pemetaan status, pembentukan query) ditarik keluar menjadi fungsi murni yang diuji langsung.

**Tech Stack:** Next.js 14 App Router · TanStack Query · Zod · `ResponsiveTable` · OpenLayers (`ol`) · react-hot-toast · Vitest (tanpa DOM palsu)

**Spec:** `docs/architecture/presurvei-ui-admin-design.md`

## Global Constraints

- **Tidak ada DOM palsu.** Repo ini tidak memakai testing-library, jsdom, maupun happy-dom. Ke-31 test komponennya memakai `renderToStaticMarkup` dari `react-dom/server`, atau memalsukan komponen anak dengan `vi.mock` lalu memeriksa props yang diteruskan. Acuan: `tests/ui/restock-table.test.tsx`. **Interaksi seret dan klik tidak dapat diuji** — karena itu logikanya wajib berada di fungsi murni di luar komponen.
- **`strictNullChecks: false` digabung `strict: true`.** `tsc` bukan jaring pengaman untuk nullability: `x?.id` tanpa `?? null` lolos kompilasi lalu mengembalikan `undefined` di tempat yang kontraknya `null`. Object literal ber-`null` tanpa tipe kontekstual memicu TS7018 — beri anotasi eksplisit pada fixture.
- **Vitest TIDAK melakukan typecheck.** Jalankan `npx tsc -p tsconfig.typecheck.json --noEmit` terpisah; `tsconfig.typecheck.json` mencakup berkas test.
- **Jalankan test dengan `npm test` atau `--maxWorkers=50%`**, bukan `npx vitest run` polos. Kontensi CPU di mesin ini menimbulkan timeout palsu; terdokumentasi di `tasks/lessons.md`.
- **Komponen klien mengimpor dari `@/modules/presurvei/client`**, bukan `@/modules/presurvei`. Barrel penuh menyeret Prisma, `pg`, dan `tls` ke bundle browser.
- **Form memakai `useState` + Zod `.safeParse()`**, bukan react-hook-form. RHF hanya ada di modul `mitra` dan tidak pernah menyebar; modul terbaru yang dibangun utuh (Planning, Agustus 2026) memakai pola ini.
- **State filter adalah state React lokal**, bukan query parameter URL. Nol berkas admin memakai `useSearchParams`. Fase 3 tidak mengubah konvensi ini.
- **Toast memakai `react-hot-toast`** (`toast.success`/`toast.error`) — sudah terpasang global di `components/providers/session-provider.tsx`, tidak perlu provider tambahan.
- **Amplop API:** daftar mengembalikan `{ success: true, data: T[], meta: { page, limit, total, totalPages } }`; tunggal mengembalikan `{ success: true, data: T }`.
- **Penamaan Bahasa Indonesia.** Boolean berprefiks `is`/`has`/`can`. Tanpa magic number.
- **Jangan sentuh `docs/CHANGELOG.md`** sampai task penutup; entri dikonsolidasikan satu kali.

## Kelas cacat yang berulang di Fase 2 — jaga di setiap task

Semuanya pernah lolos ke kode dan baru ketahuan lewat mutation testing:

1. **Assertion yang hanya memastikan sesuatu terpanggil** tanpa memeriksa argumennya. Ganti `toHaveBeenCalledOnce()` dengan `toHaveBeenCalledWith(...)`.
2. **Assertion atas referensi bersama** hanya menguji identitas, bukan nilai — mutasi in-place lolos. Bekukan objek dengan `Object.freeze` atau bandingkan dengan literal terpisah.
3. **Nilai kembar pada field bersebelahan bertipe sama** membuat tertukarnya tak terlihat, dan compiler tidak menolaknya. Beri nilai berbeda-beda.
4. **`||` di tempat nilai `0` atau `""` sah.** Pakai `??` atau perbandingan eksplisit dengan `null`.
5. **Daftar turunan tulis-tangan yang tidak exhaustive.** Pakai `Record<Union, T>` agar anggota baru wajib dijawab saat kompilasi.
6. **Fungsi yang mengembalikan array level-modul tanpa menyalinnya** — pemanggil yang meng-`sort()` merusak tabel modul selamanya.

---

## Peta berkas

**Fondasi (Task 1–4)**

| Berkas | Tanggung jawab |
|---|---|
| `modules/presurvei/client.ts` | Barrel aman-klien: schema Zod, tipe, konstanta. Tanpa service/repository. |
| `modules/presurvei/utils/statusConfig.ts` | Label dan warna untuk kelima enum presurvei. |
| `modules/presurvei/domain/prospek-kanban.ts` | Fungsi murni penentu aksi seret. |
| `modules/presurvei/dto/kegiatan.dto.ts` | (ubah) Tambah koordinat ke item daftar. |
| `lib/menu-config.ts` | (ubah) Blok menu `PRESURVEI`. |
| `lib/feature-modules.ts` | (ubah) Entri modul agar bisa dimatikan per-tenant. |
| `components/layout/admin-sidebar/adminSidebarMenu.ts` | (ubah) Pemetaan permission per sub-menu. |

**Layar iklan (Task 5–6)** — dikerjakan lebih dulu karena paling sederhana dan menetapkan pola yang disalin layar lain.

| Berkas | Tanggung jawab |
|---|---|
| `app/admin/presurvei/iklan/page.tsx` | Server Component, gerbang `presurvei_iklan:read`. |
| `app/admin/presurvei/iklan/IklanClient.tsx` | Shell klien. |
| `app/admin/presurvei/iklan/useIklanListQuery.ts` | Pengambilan daftar berfilter. |
| `app/admin/presurvei/iklan/IklanTable.tsx` | Tabel presentasional. |
| `app/admin/presurvei/iklan/IklanFilters.tsx` | Kontrol filter. |
| `app/admin/presurvei/iklan/IklanForm.tsx` | Form dipakai ulang create & edit. |
| `app/admin/presurvei/iklan/new/page.tsx` + `IklanCreateClient.tsx` | Halaman buat. |
| `app/admin/presurvei/iklan/[id]/edit/page.tsx` + `IklanEditClient.tsx` | Halaman ubah. |

**Layar kegiatan (Task 7–10)**

| Berkas | Tanggung jawab |
|---|---|
| `app/admin/presurvei/kegiatan/page.tsx` | Server Component, gerbang `presurvei:read`. |
| `app/admin/presurvei/kegiatan/KegiatanClient.tsx` | Shell + sakelar tab daftar/peta. |
| `app/admin/presurvei/kegiatan/useKegiatanListQuery.ts` | Pengambilan daftar berfilter. |
| `app/admin/presurvei/kegiatan/KegiatanFilters.tsx` | Filter jenis, hasil, sales, rentang tanggal. |
| `app/admin/presurvei/kegiatan/KegiatanTable.tsx` | Tabel presentasional. |
| `app/admin/presurvei/kegiatan/KegiatanPeta.tsx` | Tab peta Leaflet. |
| `app/admin/presurvei/kegiatan/KegiatanFormModal.tsx` | Modal catat/ubah kegiatan. |
| `app/admin/presurvei/kegiatan/[id]/page.tsx` + `KegiatanDetailClient.tsx` | Detail: foto, data teknis, titik. |

**Layar prospek (Task 11–14)**

| Berkas | Tanggung jawab |
|---|---|
| `app/admin/presurvei/prospek/page.tsx` | Server Component, gerbang `presurvei:read`. |
| `app/admin/presurvei/prospek/ProspekKanbanClient.tsx` | Papan: kolom, seret, sakelar status mati. |
| `app/admin/presurvei/prospek/useProspekKanban.ts` | Pengambilan + mutasi status. |
| `app/admin/presurvei/prospek/ProspekCard.tsx` | Kartu presentasional. |
| `app/admin/presurvei/prospek/ProspekFormModal.tsx` | Modal buat/ubah prospek. |
| `app/admin/presurvei/prospek/KonversiModal.tsx` | Modal promosi ke canvasing. |

**Layar target, laporan, dashboard (Task 15–17)**

| Berkas | Tanggung jawab |
|---|---|
| `app/admin/presurvei/target/page.tsx` + `TargetClient.tsx` + `TargetFormModal.tsx` | Target per periode. |
| `app/admin/presurvei/laporan/page.tsx` + `LaporanClient.tsx` | Laporan pencapaian. |
| `app/admin/presurvei/page.tsx` + `DashboardClient.tsx` | Dashboard KPI. |

---

## Task 1: Konfigurasi status dan barrel klien

**Files:**
- Create: `modules/presurvei/utils/statusConfig.ts`
- Create: `modules/presurvei/client.ts`
- Test: `tests/modules/presurvei/status-config.test.ts`

**Interfaces:**
- Consumes: `ProspekStatus`, `ProspekSumber`, `KegiatanJenis`, `KegiatanHasil`, `IklanChannel` dari `modules/presurvei/domain/entities/*`
- Produces: `TampilanStatus`, `PROSPEK_STATUS_CONFIG`, `PROSPEK_SUMBER_CONFIG`, `KEGIATAN_JENIS_CONFIG`, `KEGIATAN_HASIL_CONFIG`, `IKLAN_CHANNEL_CONFIG`, `daftarKolomHidup(): ProspekStatus[]`, `daftarKolomMati(): ProspekStatus[]` — semuanya juga tersedia lewat `@/modules/presurvei/client`

Komponen `components/common/StatusBadge.tsx` memakai union status yang di-hardcode (`AKTIF`/`NONAKTIF`/`PENDING`/…) dan tidak memuat satu pun enum presurvei. Memaksakannya ke sana akan mengubah union yang dipakai sepuluh berkas lain. Modul ini butuh konfigurasinya sendiri, sama seperti `modules/planning/utils/statusConfig.ts`.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// tests/modules/presurvei/status-config.test.ts
import { describe, expect, it } from "vitest";

/**
 * Konfigurasi ini memetakan seluruh enum presurvei ke label dan warna. Bentuk
 * `Record<Union, T>` membuat anggota enum baru wajib dijawab saat kompilasi —
 * tanpa itu, status yang ditambahkan nanti akan tampil kosong di UI tanpa
 * satu pun keluhan.
 */

import {
  IKLAN_CHANNEL_CONFIG,
  KEGIATAN_HASIL_CONFIG,
  KEGIATAN_JENIS_CONFIG,
  PROSPEK_STATUS_CONFIG,
  PROSPEK_SUMBER_CONFIG,
  daftarKolomHidup,
  daftarKolomMati,
} from "@/modules/presurvei/utils/statusConfig";
import {
  IKLAN_CHANNELS,
  KEGIATAN_HASIL,
  KEGIATAN_JENIS,
  PROSPEK_STATUSES,
  PROSPEK_SUMBER,
} from "@/modules/presurvei/client";

describe("konfigurasi tampilan status", () => {
  it.each([
    ["status prospek", PROSPEK_STATUSES, PROSPEK_STATUS_CONFIG],
    ["sumber prospek", PROSPEK_SUMBER, PROSPEK_SUMBER_CONFIG],
    ["jenis kegiatan", KEGIATAN_JENIS, KEGIATAN_JENIS_CONFIG],
    ["hasil kegiatan", KEGIATAN_HASIL, KEGIATAN_HASIL_CONFIG],
    ["channel iklan", IKLAN_CHANNELS, IKLAN_CHANNEL_CONFIG],
  ])("memberi label dan warna untuk setiap %s", (_nama, nilai, config) => {
    for (const anggota of nilai) {
      const tampilan = (config as Record<string, { label: string; warna: string }>)[anggota];
      expect(tampilan?.label.trim().length).toBeGreaterThan(0);
      expect(tampilan?.warna.trim().length).toBeGreaterThan(0);
    }
  });

  it("tidak memakai label yang sama untuk dua status berbeda", () => {
    // Dua status berlabel sama membuat papan kanban mustahil dibaca, dan
    // compiler tidak akan menolaknya karena keduanya string yang sah.
    const label = PROSPEK_STATUSES.map((s) => PROSPEK_STATUS_CONFIG[s].label);
    expect(new Set(label).size).toBe(PROSPEK_STATUSES.length);
  });
});

describe("kolom papan kanban", () => {
  it("membagi seluruh status menjadi kolom hidup dan kolom mati", () => {
    // Status yang tidak masuk salah satunya akan hilang dari papan tanpa
    // gejala — kartunya tidak muncul di mana pun.
    const gabungan = [...daftarKolomHidup(), ...daftarKolomMati()].sort();
    expect(gabungan).toEqual([...PROSPEK_STATUSES].sort());
  });

  it("menempatkan DEAL di kolom hidup dan status gagal di kolom mati", () => {
    expect(daftarKolomHidup()).toContain("DEAL");
    expect(daftarKolomMati()).toEqual(["TIDAK_MINAT", "TIDAK_LAYAK"]);
  });

  it("mengembalikan salinan, bukan array modulnya", () => {
    // Pemanggil yang meng-sort hasilnya akan mengacak urutan kolom papan
    // selamanya bagi seluruh pemakai proses ini.
    daftarKolomHidup().sort();
    expect(daftarKolomHidup()).toEqual([
      "BARU",
      "DIHUBUNGI",
      "TERTARIK",
      "NEGOSIASI",
      "DEAL",
    ]);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan merah**

Run: `npx vitest run tests/modules/presurvei/status-config.test.ts --maxWorkers=50%`
Expected: FAIL — `Cannot find module '@/modules/presurvei/utils/statusConfig'`

- [ ] **Step 3: Tulis konfigurasi status**

Create `modules/presurvei/utils/statusConfig.ts`:

```ts
/**
 * Label dan warna untuk enum presurvei di lapisan tampilan.
 *
 * Terpisah dari `components/common/StatusBadge.tsx` karena komponen itu
 * memakai union status yang di-hardcode dan tidak memuat enum modul ini;
 * memaksakannya ke sana akan mengubah union yang dipakai sepuluh berkas lain.
 */

import type { IklanChannel } from "../domain/entities/Iklan";
import type { KegiatanHasil, KegiatanJenis } from "../domain/entities/Kegiatan";
import {
  PROSPEK_STATUSES,
  type ProspekStatus,
  type ProspekSumber,
} from "../domain/entities/Prospek";

/** Bagaimana satu nilai enum ditampilkan. */
export interface TampilanStatus {
  label: string;
  /** Kelas Tailwind untuk badge — latar dan teks sekaligus. */
  warna: string;
}

export const PROSPEK_STATUS_CONFIG: Record<ProspekStatus, TampilanStatus> = {
  BARU: { label: "Baru", warna: "bg-slate-100 text-slate-700" },
  DIHUBUNGI: { label: "Dihubungi", warna: "bg-blue-100 text-blue-700" },
  TERTARIK: { label: "Tertarik", warna: "bg-amber-100 text-amber-700" },
  NEGOSIASI: { label: "Negosiasi", warna: "bg-orange-100 text-orange-700" },
  DEAL: { label: "Deal", warna: "bg-emerald-100 text-emerald-700" },
  TIDAK_MINAT: { label: "Tidak minat", warna: "bg-gray-100 text-gray-600" },
  TIDAK_LAYAK: { label: "Tidak layak", warna: "bg-red-100 text-red-700" },
};

export const PROSPEK_SUMBER_CONFIG: Record<ProspekSumber, TampilanStatus> = {
  LAPANGAN: { label: "Lapangan", warna: "bg-teal-100 text-teal-700" },
  IKLAN: { label: "Iklan", warna: "bg-violet-100 text-violet-700" },
  WEBSITE: { label: "Website", warna: "bg-sky-100 text-sky-700" },
  REFERRAL: { label: "Referral", warna: "bg-pink-100 text-pink-700" },
  WALK_IN: { label: "Walk-in", warna: "bg-lime-100 text-lime-700" },
};

export const KEGIATAN_JENIS_CONFIG: Record<KegiatanJenis, TampilanStatus> = {
  KUNJUNGAN: { label: "Kunjungan", warna: "bg-teal-100 text-teal-700" },
  SURVEI_LOKASI: { label: "Survei lokasi", warna: "bg-indigo-100 text-indigo-700" },
  TELEPON: { label: "Telepon", warna: "bg-sky-100 text-sky-700" },
  CHAT: { label: "Chat", warna: "bg-cyan-100 text-cyan-700" },
  IKLAN: { label: "Iklan", warna: "bg-violet-100 text-violet-700" },
};

export const KEGIATAN_HASIL_CONFIG: Record<KegiatanHasil, TampilanStatus> = {
  TERTARIK: { label: "Tertarik", warna: "bg-amber-100 text-amber-700" },
  PERLU_FOLLOWUP: { label: "Perlu follow-up", warna: "bg-blue-100 text-blue-700" },
  TIDAK_MINAT: { label: "Tidak minat", warna: "bg-gray-100 text-gray-600" },
  TIDAK_ADA_ORANG: { label: "Tidak ada orang", warna: "bg-slate-100 text-slate-600" },
  DEAL: { label: "Deal", warna: "bg-emerald-100 text-emerald-700" },
};

export const IKLAN_CHANNEL_CONFIG: Record<IklanChannel, TampilanStatus> = {
  META: { label: "Meta", warna: "bg-blue-100 text-blue-700" },
  GOOGLE: { label: "Google", warna: "bg-red-100 text-red-700" },
  TIKTOK: { label: "TikTok", warna: "bg-neutral-100 text-neutral-800" },
  WHATSAPP: { label: "WhatsApp", warna: "bg-green-100 text-green-700" },
  OFFLINE: { label: "Offline", warna: "bg-stone-100 text-stone-700" },
  LAINNYA: { label: "Lainnya", warna: "bg-gray-100 text-gray-600" },
};

/**
 * Kolom corong yang selalu tampil di papan, berurutan dari kiri.
 *
 * Disimpan sebagai konstanta modul dan diberikan lewat fungsi yang menyalin:
 * pemanggil yang meng-`sort()` hasilnya akan mengacak urutan kolom bagi
 * seluruh pemakai proses ini, dan server ini berumur panjang.
 */
const KOLOM_STATUS: Record<ProspekStatus, "hidup" | "mati"> = {
  BARU: "hidup",
  DIHUBUNGI: "hidup",
  TERTARIK: "hidup",
  NEGOSIASI: "hidup",
  DEAL: "hidup",
  TIDAK_MINAT: "mati",
  TIDAK_LAYAK: "mati",
};

/**
 * Salinan kolom corong hidup, berurutan dari kiri.
 *
 * Diturunkan dari `PROSPEK_STATUSES` lewat `.filter()`, bukan ditulis sebagai
 * array tersendiri: bentuk `Record` memaksa status baru dijawab saat kompilasi,
 * dan `.filter()` menghasilkan array baru tiap panggilan sehingga sifat
 * salinannya tetap.
 */
export function daftarKolomHidup(): ProspekStatus[] {
  return PROSPEK_STATUSES.filter((status) => KOLOM_STATUS[status] === "hidup");
}

/** Salinan kolom status mati; prospek mati mengotori papan kerja. */
export function daftarKolomMati(): ProspekStatus[] {
  return PROSPEK_STATUSES.filter((status) => KOLOM_STATUS[status] === "mati");
}
```

- [ ] **Step 4: Tulis barrel aman-klien**

Create `modules/presurvei/client.ts`. Isinya hanya tipe, schema Zod, konstanta, dan fungsi murni — **tanpa** service, repository, atau apa pun yang menyentuh Prisma:

```ts
/**
 * Public API modul presurvei untuk komponen klien.
 *
 * Hanya berisi tipe, konstanta, schema Zod, dan fungsi murni — TIDAK
 * meng-export service atau repository, sehingga aman diimpor dari client
 * component tanpa menarik Prisma/pg/tls ke bundle browser.
 *
 * Client component: `import { ... } from "@/modules/presurvei/client"`
 * Server/API route: `import { ... } from "@/modules/presurvei"` (barrel penuh)
 */

export {
  KEGIATAN_HASIL,
  KEGIATAN_JENIS,
  type KegiatanHasil,
  type KegiatanJenis,
} from "./domain/entities/Kegiatan";

export {
  PROSPEK_STATUSES,
  PROSPEK_SUMBER,
  type ProspekStatus,
  type ProspekSumber,
} from "./domain/entities/Prospek";

export { IKLAN_CHANNELS, type IklanChannel } from "./domain/entities/Iklan";

export {
  BULAN_MAKS,
  BULAN_MIN,
  type PeriodeTarget,
} from "./domain/entities/Target";

export {
  getStatusLanjutan,
  isStatusFinal,
  isSumberButuhIklan,
  isSumberButuhReferral,
} from "./domain/prospek-rules";

export {
  isButuhDataTeknis,
  isButuhIklan,
  isButuhLokasi,
} from "./domain/kegiatan-rules";

export { isIklanBerjalan } from "./domain/iklan-rules";

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
  jadikanCanvasingSchema,
  type JadikanCanvasingInput,
} from "./validators/konversi.validator";

export {
  buatIklanSchema,
  daftarIklanSchema,
  ubahIklanSchema,
} from "./validators/iklan.validator";

export {
  laporanPeriodeSchema,
  tetapkanTargetSchema,
} from "./validators/target.validator";

export type {
  KegiatanDetailDto,
  KegiatanListItemDto,
} from "./dto/kegiatan.dto";
export type { ProspekDetailDto, ProspekListItemDto } from "./dto/prospek.dto";
export type { IklanDetailDto, IklanListItemDto } from "./dto/iklan.dto";
export type { BarisLaporanDto, TargetDto } from "./dto/target.dto";

export {
  IKLAN_CHANNEL_CONFIG,
  KEGIATAN_HASIL_CONFIG,
  KEGIATAN_JENIS_CONFIG,
  PROSPEK_STATUS_CONFIG,
  PROSPEK_SUMBER_CONFIG,
  daftarKolomHidup,
  daftarKolomMati,
  type TampilanStatus,
} from "./utils/statusConfig";
```

Perhatikan: `isIklanBerjalan` dan `getStatusLanjutan` ikut karena keduanya fungsi murni di lapisan domain yang dibutuhkan UI. `ProspekEntity`, `KegiatanEntity`, dan seluruh service **tidak** ikut.

- [ ] **Step 5: Jalankan test, pastikan hijau**

Run: `npx vitest run tests/modules/presurvei/status-config.test.ts --maxWorkers=50%`
Expected: PASS — 5 test lulus.

- [ ] **Step 6: Pastikan barrel klien benar-benar bersih dari Prisma**

Run:
```bash
npx tsc -p tsconfig.typecheck.json --noEmit
grep -rE "Service|Repository|@/lib/prisma|@prisma/client" modules/presurvei/client.ts
```
Expected: `tsc` exit 0, dan grep **tidak menemukan apa pun**. Kalau ada yang cocok, barrel-nya bocor dan akan menyeret Prisma ke bundle browser — hapus ekspornya.

- [ ] **Step 7: Commit**

```bash
git add modules/presurvei/utils/statusConfig.ts modules/presurvei/client.ts tests/modules/presurvei/status-config.test.ts
git commit -m "feat(presurvei): tambah konfigurasi status dan barrel klien"
```

---

## Task 2: Aturan seret papan kanban

**Files:**
- Create: `modules/presurvei/domain/prospek-kanban.ts`
- Modify: `modules/presurvei/client.ts` (tambah ekspor)
- Test: `tests/modules/presurvei/prospek-kanban.test.ts`

**Interfaces:**
- Consumes: `isTransisiStatusSah(dari: ProspekStatus, ke: ProspekStatus): boolean` dari `./prospek-rules`
- Produces: `type AksiKanban`, `resolveAksiKanban(dari: ProspekStatus, ke: ProspekStatus): AksiKanban | null` — dipakai Task 12

Inilah bagian yang membuat papan bisa dipakai. Tanpa pembatasan, mayoritas seretan ditolak server dan pemakai belajar mengabaikan pesan error. Aturannya **tidak ditulis ulang di UI** — `isTransisiStatusSah` sudah memegangnya di domain.

Fungsi ini murni dan berada di lapisan domain karena interaksi seretnya sendiri tidak dapat diuji: repo ini tidak punya DOM palsu. Preseden yang sama persis ada di `modules/planning/domain/planning-kanban-transitions.ts` beserta testnya.

`DEAL` dibedakan karena mencapainya bukan sekadar mengubah status — ia mempromosikan prospek menjadi canvasing, dan itu menuntut nomor KTP serta paket yang tidak ada pada prospek.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// tests/modules/presurvei/prospek-kanban.test.ts
import { describe, expect, it } from "vitest";

/**
 * Penentu aksi saat kartu dijatuhkan ke sebuah kolom. Murni dan di domain,
 * karena interaksi seretnya sendiri tidak dapat diuji — repo ini tidak punya
 * DOM palsu.
 */

import { PROSPEK_STATUSES } from "@/modules/presurvei/domain/entities/Prospek";
import { resolveAksiKanban } from "@/modules/presurvei/domain/prospek-kanban";
import { isTransisiStatusSah } from "@/modules/presurvei/domain/prospek-rules";

describe("resolveAksiKanban", () => {
  it("mengizinkan perpindahan yang sah menurut aturan domain", () => {
    expect(resolveAksiKanban("BARU", "DIHUBUNGI")).toEqual({
      jenis: "ubah-status",
      tujuan: "DIHUBUNGI",
    });
  });

  it("menolak perpindahan yang tidak sah", () => {
    // BARU tidak boleh langsung DEAL: aturannya hanya mengizinkan DIHUBUNGI
    // atau TIDAK_MINAT. Tanpa penolakan ini, kolom DEAL akan menyala saat
    // kartu BARU diangkat lalu servernya yang menolak.
    expect(resolveAksiKanban("BARU", "DEAL")).toBeNull();
    expect(resolveAksiKanban("DEAL", "BARU")).toBeNull();
  });

  it("menolak menjatuhkan kartu ke kolomnya sendiri", () => {
    expect(resolveAksiKanban("NEGOSIASI", "NEGOSIASI")).toBeNull();
  });

  it("meminta form konversi saat tujuannya DEAL", () => {
    // DEAL bukan sekadar ganti status — ia mempromosikan prospek menjadi
    // canvasing, dan itu butuh nomor KTP serta paket yang tidak ada di prospek.
    expect(resolveAksiKanban("NEGOSIASI", "DEAL")).toEqual({
      jenis: "buka-konversi",
    });
  });

  it("tidak membuka form untuk tujuan lain dari NEGOSIASI", () => {
    // NEGOSIASI satu-satunya status yang punya jalur ke DEAL. Tanpa kasus ini
    // cabang `ke === "DEAL"` bisa ditukar jadi `dari === "NEGOSIASI"` tanpa
    // satu pun test merah — lalu sales yang menyeret kartu ke "Tidak Minat"
    // disambut form konversi yang meminta KTP dan paket.
    expect(resolveAksiKanban("NEGOSIASI", "TIDAK_MINAT")).toEqual({
      jenis: "ubah-status",
      tujuan: "TIDAK_MINAT",
    });
  });

  it("sepakat dengan isTransisiStatusSah untuk ke-49 pasangan status", () => {
    // Inilah yang benar-benar mengunci "tidak menyalin tabel transisi".
    // Menyalin `TRANSISI_SAH` ke dalam berkas ini tidak berbahaya selama
    // nilainya sama — bahayanya muncul saat kedua salinan menyimpang, dan di
    // situlah test ini merah. Test bernilai tunggal tidak bisa melihatnya.
    for (const dari of PROSPEK_STATUSES) {
      for (const ke of PROSPEK_STATUSES) {
        // Pasangan ikut di-assert supaya kegagalannya menyebut pasangan mana
        // yang menyimpang; `expect(false).toBe(true)` tidak memberi tahu apa pun.
        expect({
          dari,
          ke,
          adaAksi: resolveAksiKanban(dari, ke) !== null,
        }).toEqual({
          dari,
          ke,
          adaAksi: dari !== ke && isTransisiStatusSah(dari, ke),
        });
      }
    }
  });

  it("mengizinkan jalan kembali dari TIDAK_MINAT ke DIHUBUNGI", () => {
    // Prospek mati bukan jalan buntu: pelanggan bisa berubah pikiran, dan
    // papan harus mengizinkan kartunya ditarik kembali ke corong hidup.
    // Contoh konkret yang menemani test ke-49-pasangan di atas.
    expect(resolveAksiKanban("TIDAK_MINAT", "DIHUBUNGI")).toEqual({
      jenis: "ubah-status",
      tujuan: "DIHUBUNGI",
    });
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan merah**

Run: `npx vitest run tests/modules/presurvei/prospek-kanban.test.ts --maxWorkers=50%`
Expected: FAIL — `Cannot find module '@/modules/presurvei/domain/prospek-kanban'`

- [ ] **Step 3: Tulis implementasinya**

Create `modules/presurvei/domain/prospek-kanban.ts`:

```ts
/**
 * Aturan seret papan prospek.
 *
 * Murni: tidak mengimpor apa pun dari luar folder `domain/`.
 *
 * Aturan transisinya TIDAK ditulis ulang di sini — `isTransisiStatusSah` sudah
 * memegangnya, dan menyalinnya akan melahirkan dua sumber kebenaran yang
 * bisa berbeda pendapat.
 */

import type { ProspekStatus } from "./entities/Prospek";
import { isTransisiStatusSah } from "./prospek-rules";

/** Apa yang terjadi saat kartu dijatuhkan ke sebuah kolom. */
export type AksiKanban =
  | { jenis: "ubah-status"; tujuan: ProspekStatus }
  | { jenis: "buka-konversi" };

/**
 * Aksi untuk kartu berstatus `dari` yang dijatuhkan ke kolom `ke`, atau null
 * bila perpindahan itu tidak sah.
 *
 * Pemanggil memakai null untuk meredupkan kolom saat kartu diangkat, sehingga
 * tujuan yang tidak sah tidak pernah tampak bisa dijatuhi.
 */
export function resolveAksiKanban(
  dari: ProspekStatus,
  ke: ProspekStatus,
): AksiKanban | null {
  // Menjatuhkan kartu ke kolomnya sendiri bukan perpindahan, apa pun kata
  // tabel transisi. Penjaga ini TIDAK redundan secara semantik meski hari ini
  // tak terjangkau mutasi: `TRANSISI_SAH` kebetulan tidak punya satu pun
  // status yang mendaftarkan dirinya sendiri, jadi penjaga di bawah sudah
  // menolak kasus ini. Begitu ada satu saja transisi-diri ditambahkan nanti,
  // tanpa baris ini sebuah non-perpindahan akan diam-diam menulis status.
  if (dari === ke) {
    return null;
  }

  if (!isTransisiStatusSah(dari, ke)) {
    return null;
  }

  // DEAL menuntut data yang tidak ada pada prospek, jadi ia membuka form
  // alih-alih langsung menulis status.
  return ke === "DEAL"
    ? { jenis: "buka-konversi" }
    : { jenis: "ubah-status", tujuan: ke };
}
```

- [ ] **Step 4: Ekspor lewat barrel klien**

Di `modules/presurvei/client.ts`, tambahkan setelah blok ekspor `prospek-rules`:

```ts
export {
  resolveAksiKanban,
  type AksiKanban,
} from "./domain/prospek-kanban";
```

- [ ] **Step 5: Jalankan test dan typecheck**

Run:
```bash
npx vitest run tests/modules/presurvei/prospek-kanban.test.ts --maxWorkers=50%
npx tsc -p tsconfig.typecheck.json --noEmit
```
Expected: 7 test lulus, `tsc` exit 0.

- [ ] **Step 6: Buktikan test punya gigi**

Terapkan mutasi ini ke `prospek-kanban.ts`, pastikan merah, lalu **kembalikan**:

| Mutasi | Harus merah |
|---|---|
| Hapus penjaga `isTransisiStatusSah` | "menolak perpindahan yang tidak sah" **dan** "sepakat dengan isTransisiStatusSah…" |
| Ganti `ke === "DEAL"` jadi `false` | "meminta form konversi saat tujuannya DEAL" |
| Ganti `ke === "DEAL"` jadi `dari === "NEGOSIASI"` | "tidak membuka form untuk tujuan lain dari NEGOSIASI" |

**Penjaga `dari === ke` sengaja TIDAK ada di tabel ini.** Menghapusnya tidak
akan membuat test apa pun merah, karena `TRANSISI_SAH` tidak punya satu pun
status yang mendaftarkan dirinya sendiri — penjaga kedua sudah menolak
kasusnya. Jangan mencoba "membuktikan" baris itu dengan mutasi, dan jangan
pula menghapusnya karena tampak mati: alasannya sudah ditulis sebagai komentar
di Step 3. Test "menolak menjatuhkan kartu ke kolomnya sendiri" mengunci
**perilakunya**, bukan barisnya, dan justru akan merah bila suatu hari ada
transisi-diri ditambahkan ke `TRANSISI_SAH` tanpa penjaga itu.

Setelah selesai: `git status --short` wajib bersih.

- [ ] **Step 7: Commit**

```bash
git add modules/presurvei/domain/prospek-kanban.ts modules/presurvei/client.ts tests/modules/presurvei/prospek-kanban.test.ts
git commit -m "feat(presurvei): tambah aturan seret papan kanban prospek"
```

---

## Task 3: Koordinat pada item daftar kegiatan

**Files:**
- Modify: `modules/presurvei/dto/kegiatan.dto.ts`
- Test: `tests/modules/presurvei/presurvei-dto.test.ts` (tambah, berkas sudah ada)

**Interfaces:**
- Produces: `KegiatanListItemDto` kini memuat `latitude: number | null` dan `longitude: number | null` — dipakai Task 8

Satu-satunya perubahan backend di fase ini. Peta kunjungan butuh koordinat pada setiap baris daftar; mengambilnya lewat endpoint detail per-baris akan melahirkan N+1 pada halaman yang menampilkan puluhan kegiatan.

Keduanya sudah ada di `KegiatanDetailDto`, jadi ini memindahkan field ke induknya — bukan menambah data baru ke entitas.

- [ ] **Step 1: Tulis test yang gagal**

Di `tests/modules/presurvei/presurvei-dto.test.ts`. Berkas itu **belum punya** blok `describe` untuk `toKegiatanListItem` dan **belum mengimpor** fungsinya — yang ada hanya `toKegiatanDetail`. Jadi dua hal dulu:

1. Perluas impor yang ada di baris 13 menjadi:

```ts
import {
  toKegiatanDetail,
  toKegiatanListItem,
} from "@/modules/presurvei/dto/kegiatan.dto";
```

2. Buat blok `describe("toKegiatanListItem", () => { ... })` baru, taruh **sebelum** blok `describe("toKegiatanDetail")` yang sudah ada, dan isi dengan kedua test di bawah.

Helper fixture-nya sudah ada dan bernama `kegiatan(over)` — pakai itu, jangan bikin sendiri:

```ts
  it("menyertakan koordinat supaya peta tidak perlu mengambil detail per baris", () => {
    // Nilai lintang dan bujur sengaja dibuat berjauhan: keduanya `number`
    // bersebelahan, dan tertukarnya tidak akan ditolak compiler — penanda
    // peta akan mendarat di belahan bumi yang salah tanpa satu pun keluhan.
    const hasil = toKegiatanListItem(
      kegiatan({ latitude: -6.2, longitude: 106.8 }),
    );

    expect(hasil.latitude).toBe(-6.2);
    expect(hasil.longitude).toBe(106.8);
  });

  it("meneruskan koordinat kosong apa adanya", () => {
    // Kegiatan telepon, chat, dan walk-in kantor tidak punya titik. Mengubah
    // null menjadi 0 akan menempatkannya di lepas pantai Afrika.
    const hasil = toKegiatanListItem(
      kegiatan({ latitude: null, longitude: null }),
    );

    expect(hasil.latitude).toBeNull();
    expect(hasil.longitude).toBeNull();
  });
```

- [ ] **Step 2: Jalankan test, pastikan merah**

Run: `npx vitest run tests/modules/presurvei/presurvei-dto.test.ts --maxWorkers=50%`
Expected: FAIL — `expected undefined to be -6.2`, dan test kedua gagal dengan
`expected undefined to be null`. Keduanya harus gagal karena **nilainya** belum ada,
bukan karena impor atau `describe` yang salah tulis — kalau pesannya berbeda dari
itu, perbaiki dulu berkas test-nya sebelum lanjut ke Step 3.

- [ ] **Step 3: Pindahkan field ke DTO induk**

Di `modules/presurvei/dto/kegiatan.dto.ts`, tambahkan dua field ke `KegiatanListItemDto` (setelah `ditemuiNama`):

```ts
  latitude: number | null;
  longitude: number | null;
```

Lalu **hapus** keduanya dari `KegiatanDetailDto` — ia meng-`extends KegiatanListItemDto`, jadi mendeklarasikannya dua kali membuat perubahan berikutnya harus menyentuh dua tempat.

Dan isi keduanya di `toKegiatanListItem`, setelah `ditemuiNama`:

```ts
    latitude: kegiatan.latitude,
    longitude: kegiatan.longitude,
```

`toKegiatanDetail` tidak perlu diubah bila ia sudah menyebarkan hasil `toKegiatanListItem`; periksa berkasnya — kalau ia menyusun objeknya sendiri, hapus baris `latitude`/`longitude` yang kini duplikat.

- [ ] **Step 4: Jalankan test dan typecheck**

Run:
```bash
npx vitest run tests/modules/presurvei --maxWorkers=50%
npx tsc -p tsconfig.typecheck.json --noEmit
```
Expected: seluruh test presurvei hijau, `tsc` exit 0. Kalau ada test detail yang merah, kemungkinan besar `toKegiatanDetail` kini kehilangan field — perbaiki di sana, jangan longgarkan assertion-nya.

- [ ] **Step 5: Commit**

```bash
git add modules/presurvei/dto/kegiatan.dto.ts tests/modules/presurvei/presurvei-dto.test.ts
git commit -m "feat(presurvei): sertakan koordinat pada item daftar kegiatan"
```

---

## Task 4: Registrasi menu presurvei

**Files:**
- Modify: `lib/menu-config.ts`
- Modify: `lib/feature-modules.ts`
- Modify: `components/layout/admin-sidebar/adminSidebarMenu.ts`
- Test: `tests/modules/presurvei/menu-presurvei.test.ts`

**Interfaces:**
- Produces: enam item menu di bawah kode `PRESURVEI`, masing-masing dipetakan ke resource permission-nya sendiri

**Setiap sub-menu memetakan ke resource-nya sendiri, bukan satu resource bersama.** Ini sengaja berbeda dari pola `PLANNING.*` yang memetakan seluruh anak ke `planning`. Presurvei memakai empat resource berbeda dengan pemegang berbeda, dan memetakan semuanya ke `presurvei` akan menampilkan menu Iklan kepada orang yang tidak punya `presurvei_iklan:read`, lalu menyambutnya dengan 403 setelah diklik. Menu yang mengecoh lebih buruk daripada menu yang tidak ada.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// tests/modules/presurvei/menu-presurvei.test.ts
import { describe, expect, it } from "vitest";

/**
 * Menu presurvei memakai empat resource permission berbeda. Test ini menjaga
 * agar pemetaannya tidak disederhanakan jadi satu resource bersama — orang
 * tanpa `presurvei_iklan:read` akan melihat menunya lalu ditolak 403.
 */

import { filterAdminMenuItems } from "@/components/layout/admin-sidebar/adminSidebarMenu";
import { ADMIN_MENU_CONFIG } from "@/lib/menu-config";

const blokPresurvei = () =>
  ADMIN_MENU_CONFIG.find((item) => item.code === "PRESURVEI");

describe("blok menu presurvei", () => {
  it("terdaftar dengan enam anak", () => {
    const blok = blokPresurvei();

    expect(blok).toBeDefined();
    expect(blok?.children?.map((anak) => anak.code)).toEqual([
      "PRESURVEI.DASHBOARD",
      "PRESURVEI.KEGIATAN",
      "PRESURVEI.PROSPEK",
      "PRESURVEI.IKLAN",
      "PRESURVEI.TARGET",
      "PRESURVEI.LAPORAN",
    ]);
  });

  it("menunjuk path yang benar-benar akan dibangun", () => {
    // Path yang salah ketik menghasilkan menu yang mengarah ke 404, dan
    // compiler tidak akan menolaknya karena keduanya string yang sah.
    const path = Object.fromEntries(
      (blokPresurvei()?.children ?? []).map((anak) => [anak.code, anak.path]),
    );

    expect(path).toEqual({
      "PRESURVEI.DASHBOARD": "/admin/presurvei",
      "PRESURVEI.KEGIATAN": "/admin/presurvei/kegiatan",
      "PRESURVEI.PROSPEK": "/admin/presurvei/prospek",
      "PRESURVEI.IKLAN": "/admin/presurvei/iklan",
      "PRESURVEI.TARGET": "/admin/presurvei/target",
      "PRESURVEI.LAPORAN": "/admin/presurvei/laporan",
    });
  });

  it("memberi tiap sub-menu resource permission-nya sendiri", () => {
    // Inilah alasan task ini ada, dan kedua test di atas TIDAK menjaganya:
    // keduanya tetap hijau meski Step 5 dilewatkan sepenuhnya. Kalau
    // dilewatkan, fallback `getPermissionResource` mengambil segmen
    // TERAKHIR kode — "PRESURVEI.IKLAN" jadi menuntut `iklan:read` yang
    // tidak pernah ada — dan seluruh menu presurvei lenyap untuk semua
    // orang tanpa satu pun error di log.
    const tampil = (izin: string) =>
      filterAdminMenuItems({
        items: ADMIN_MENU_CONFIG,
        hasPermission: (permission) => permission === izin,
        isSuperAdmin: false,
        isFeatureEnabled: (feature) => feature === "presurvei",
      })
        .find((item) => item.code === "PRESURVEI")
        ?.children?.map((anak) => anak.code);

    // Pemegang `presurvei:read` melihat tiga menu inti dan TIDAK melihat
    // iklan, target, atau laporan.
    expect(tampil("presurvei:read")).toEqual([
      "PRESURVEI.DASHBOARD",
      "PRESURVEI.KEGIATAN",
      "PRESURVEI.PROSPEK",
    ]);

    // Pemegang `presurvei_iklan:read` melihat persis satu menu. Bila keenam
    // anak dipetakan ke `presurvei` bersama — kesalahan yang paling mungkin
    // — tak satu pun anak lolos dan hasilnya `undefined`.
    expect(tampil("presurvei_iklan:read")).toEqual(["PRESURVEI.IKLAN"]);
  });
});
```

Test ketiga memakai `filterAdminMenuItems`, bukan memeriksa tabel pemetaan langsung: `getPermissionResource` adalah fungsi privat modul, dan yang ingin dikunci memang perilakunya — siapa melihat apa — bukan bentuk tabelnya.

- [ ] **Step 2: Jalankan test, pastikan merah**

Run: `npx vitest run tests/modules/presurvei/menu-presurvei.test.ts --maxWorkers=50%`
Expected: FAIL — `expected undefined to be defined`

- [ ] **Step 3: Tambahkan blok menu**

Di `lib/menu-config.ts`, sisipkan blok berikut ke `ADMIN_MENU_CONFIG`, tepat **sebelum** blok `MARKETING` (presurvei berada di hulu canvasing, dan urutan menu sebaiknya mencerminkan alur kerjanya):

```ts
  {
    code: "PRESURVEI",
    name: "Presurvei",
    path: "/admin/presurvei",
    icon: "HiOutlineMapPin",
    section: "Pemasaran",
    featureModule: "presurvei",
    children: [
      {
        code: "PRESURVEI.DASHBOARD",
        name: "Dashboard",
        path: "/admin/presurvei",
        icon: "HiOutlineChartBar",
        exact: true,
      },
      {
        code: "PRESURVEI.KEGIATAN",
        name: "Kegiatan Sales",
        path: "/admin/presurvei/kegiatan",
        icon: "HiOutlineClipboardDocumentList",
      },
      {
        code: "PRESURVEI.PROSPEK",
        name: "Papan Prospek",
        path: "/admin/presurvei/prospek",
        icon: "HiOutlineViewColumns",
      },
      {
        code: "PRESURVEI.IKLAN",
        name: "Kampanye Iklan",
        path: "/admin/presurvei/iklan",
        icon: "HiOutlineMegaphone",
      },
      {
        code: "PRESURVEI.TARGET",
        name: "Target Sales",
        path: "/admin/presurvei/target",
        icon: "HiOutlineFlag",
      },
      {
        code: "PRESURVEI.LAPORAN",
        name: "Laporan Pencapaian",
        path: "/admin/presurvei/laporan",
        icon: "HiOutlineDocumentChartBar",
      },
    ],
  },
```

`exact: true` pada dashboard wajib: tanpanya, seluruh sub-halaman akan ikut menyorot item dashboard karena path-nya adalah awalan dari semuanya.

Pastikan setiap nama ikon benar-benar ada di `components/layout/admin-sidebar/adminSidebarIcons`. Kalau salah satu tidak ada, ikonnya hilang tanpa error — periksa berkas itu dan ganti dengan yang tersedia.

- [ ] **Step 4: Daftarkan modul fitur**

Di `lib/feature-modules.ts`, tambahkan entri mengikuti bentuk `marketing`:

```ts
  {
    code: "presurvei",
    label: "Presurvei",
    description: "Kegiatan sales, prospek, kampanye iklan, dan target.",
    group: "keuangan",
  },
```

`FeatureModuleCode` diturunkan dari daftarnya sendiri (`(typeof FEATURE_MODULES)[number]["code"]`), jadi menambahkan entri di atas sudah otomatis memperluas union-nya — tidak ada suntingan kedua yang perlu. `group: "keuangan"` dan `section: "Pemasaran"` keduanya sudah dipakai berkas-berkas itu; jangan menciptakan nilai baru.

- [ ] **Step 5: Petakan permission per sub-menu**

Di `components/layout/admin-sidebar/adminSidebarMenu.ts`, tambahkan ke `specialMappings`:

```ts
    // Presurvei: tiap sub-menu memakai resource-nya sendiri, berbeda dari pola
    // PLANNING di atas. Memetakan semuanya ke `presurvei` akan menampilkan
    // menu Iklan kepada orang tanpa `presurvei_iklan:read`, lalu menolaknya
    // dengan 403 setelah diklik.
    PRESURVEI: "presurvei",
    "PRESURVEI.DASHBOARD": "presurvei",
    "PRESURVEI.KEGIATAN": "presurvei",
    "PRESURVEI.PROSPEK": "presurvei",
    "PRESURVEI.IKLAN": "presurvei_iklan",
    "PRESURVEI.TARGET": "presurvei_target",
    "PRESURVEI.LAPORAN": "presurvei_laporan",
```

- [ ] **Step 6: Jalankan test dan typecheck**

Run:
```bash
npx vitest run tests/modules/presurvei/menu-presurvei.test.ts --maxWorkers=50%
npm test
npx tsc -p tsconfig.typecheck.json --noEmit
```
Expected: test menu lulus, **seluruh suite repo tetap hijau**, `tsc` exit 0.

Seluruh suite dijalankan karena task ini menyentuh tiga berkas bersama di luar modul. `tests/lib/rbac.test.ts` dan `tests/architecture/site-restriction-capability-catalog.test.ts` membaca katalog permission dan menu — keduanya harus tetap lulus.

- [ ] **Step 7: Buktikan test punya gigi**

Terapkan tiap mutasi, pastikan merah, lalu **kembalikan**:

| Mutasi | Harus merah |
|---|---|
| Hapus seluruh blok `PRESURVEI*` dari `specialMappings` | test "memberi tiap sub-menu resource permission-nya sendiri" |
| Ganti `"PRESURVEI.IKLAN": "presurvei_iklan"` jadi `"presurvei"` | test yang sama |
| Hapus `exact: true` dari anak `PRESURVEI.DASHBOARD` | *(tidak ada — lihat catatan)* |

Baris ketiga sengaja dicantumkan sebagai **peringatan, bukan tugas**: `exact: true` memengaruhi penyorotan item aktif, dan tidak ada test di task ini yang mengunciNya. Jangan menambah test untuknya di sini — `isSidebarItemActive` sudah punya test sendiri di repo. Cukup pastikan nilainya benar saat menulis Step 3.

Setelah selesai: `git status --short` wajib bersih.

- [ ] **Step 8: Commit**

```bash
git add lib/menu-config.ts lib/feature-modules.ts components/layout/admin-sidebar/adminSidebarMenu.ts tests/modules/presurvei/menu-presurvei.test.ts
git commit -m "feat(presurvei): daftarkan menu admin presurvei"
```

---

## Task 5: Layar daftar kampanye iklan

**Files:**
- Create: `app/admin/presurvei/iklan/page.tsx`
- Create: `app/admin/presurvei/iklan/IklanClient.tsx`
- Create: `app/admin/presurvei/iklan/iklanListQuery.ts`
- Create: `app/admin/presurvei/iklan/useIklanListQuery.ts`
- Create: `app/admin/presurvei/iklan/IklanTable.tsx`
- Create: `app/admin/presurvei/iklan/IklanFilters.tsx`
- Test: `tests/app/presurvei-iklan-list-query.test.ts`

**Interfaces:**
- Consumes: `IklanListItemDto`, `IKLAN_CHANNELS`, `IKLAN_CHANNEL_CONFIG`, `isIklanBerjalan` dari `@/modules/presurvei/client`
- Produces: `type FilterIklan`, `buildIklanListUrl(filter: FilterIklan): string` — pola yang disalin Task 7 dan 15

Dikerjakan lebih dulu karena paling sederhana: satu daftar, tiga filter, tanpa peta maupun seret. Ia menetapkan pola yang disalin layar lain.

**Yang diuji adalah pembentukan URL-nya, bukan komponennya.** Repo ini tidak punya DOM palsu, jadi menguji komponen berarti memeriksa props yang diteruskan — berguna, tapi rapuh. Pembentukan query dari filter adalah logika nyata dengan banyak cara gagal (filter kosong ikut terkirim, `isAktif: false` hilang karena dianggap falsy, halaman tidak ikut berubah), dan itu bisa diuji langsung sebagai fungsi murni.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// tests/app/presurvei-iklan-list-query.test.ts
import { describe, expect, it } from "vitest";

/**
 * Pembentukan URL daftar iklan dari state filter. Diuji langsung sebagai
 * fungsi murni karena repo ini tidak punya DOM palsu — logika yang tertinggal
 * di dalam komponen tidak akan pernah teruji.
 */

import { buildIklanListUrl } from "@/app/admin/presurvei/iklan/iklanListQuery";

describe("buildIklanListUrl", () => {
  it("selalu mengirim halaman dan batas", () => {
    expect(buildIklanListUrl({ page: 2, search: "", channel: "", isAktif: null })).toBe(
      "/api/admin/presurvei/iklan?page=2&limit=20",
    );
  });

  it("tidak mengirim filter yang kosong", () => {
    // Mengirim `search=` kosong membuat server menyaring dengan string kosong
    // alih-alih tidak menyaring sama sekali.
    const url = buildIklanListUrl({ page: 1, search: "", channel: "", isAktif: null });

    expect(url).not.toContain("search=");
    expect(url).not.toContain("channel=");
    expect(url).not.toContain("isAktif=");
  });

  it("mengirim isAktif false, bukan menghilangkannya", () => {
    // `false` itu falsy. Penyaringan berbasis truthiness akan membuat filter
    // "hanya yang nonaktif" diam-diam berubah jadi "semua".
    expect(
      buildIklanListUrl({ page: 1, search: "", channel: "", isAktif: false }),
    ).toContain("isAktif=false");
  });

  it("menyandikan pencarian yang mengandung karakter khusus", () => {
    // Tanpa penyandian, kode kampanye ber-'&' memotong query string dan
    // filter sesudahnya hilang tanpa gejala.
    const url = buildIklanListUrl({
      page: 1,
      search: "promo & diskon",
      channel: "",
      isAktif: null,
    });

    expect(url).toContain("search=promo+%26+diskon");
  });

  it("menggabungkan seluruh filter yang terisi", () => {
    const url = buildIklanListUrl({
      page: 3,
      search: "ramadan",
      channel: "META",
      isAktif: true,
    });

    expect(url).toBe(
      "/api/admin/presurvei/iklan?page=3&limit=20&search=ramadan&channel=META&isAktif=true",
    );
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan merah**

Run: `npx vitest run tests/app/presurvei-iklan-list-query.test.ts --maxWorkers=50%`
Expected: FAIL — `Cannot find module '@/app/admin/presurvei/iklan/iklanListQuery'`

- [ ] **Step 3: Tulis pembentuk query**

Create `app/admin/presurvei/iklan/iklanListQuery.ts`:

```ts
import type { IklanChannel } from "@/modules/presurvei/client";

/** Jumlah baris per halaman daftar iklan. */
const BATAS_PER_HALAMAN = 20;

/** State filter daftar iklan; string kosong dan null berarti "tidak menyaring". */
export interface FilterIklan {
  page: number;
  search: string;
  channel: IklanChannel | "";
  isAktif: boolean | null;
}

/**
 * URL daftar iklan dari state filter.
 *
 * Dipisahkan dari komponen supaya bisa diuji langsung: repo ini tidak punya
 * DOM palsu, jadi logika yang tertinggal di dalam komponen tidak akan teruji.
 */
export function buildIklanListUrl(filter: FilterIklan): string {
  const params = new URLSearchParams({
    page: String(filter.page),
    limit: String(BATAS_PER_HALAMAN),
  });

  if (filter.search.trim().length > 0) {
    params.set("search", filter.search.trim());
  }
  if (filter.channel !== "") {
    params.set("channel", filter.channel);
  }
  // Perbandingan eksplisit terhadap null, bukan truthiness: `false` adalah
  // pilihan filter yang sah ("hanya yang nonaktif").
  if (filter.isAktif !== null) {
    params.set("isAktif", String(filter.isAktif));
  }

  return `/api/admin/presurvei/iklan?${params.toString()}`;
}
```

- [ ] **Step 4: Jalankan test, pastikan hijau**

Run: `npx vitest run tests/app/presurvei-iklan-list-query.test.ts --maxWorkers=50%`
Expected: PASS — 5 test lulus.

- [ ] **Step 5: Tulis hook pengambilan data**

Create `app/admin/presurvei/iklan/useIklanListQuery.ts`. Ikuti pola `app/admin/marketing/canvasing/useCanvasingListQuery.ts` — baca berkas itu lebih dulu, termasuk komentar yang menjelaskan `keepPreviousData`:

```ts
"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useEffect } from "react";

import type { IklanListItemDto } from "@/modules/presurvei/client";
import { buildIklanListUrl, type FilterIklan } from "./iklanListQuery";

interface AmplopDaftar {
  data: IklanListItemDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const FILTER_AWAL: FilterIklan = {
  page: 1,
  search: "",
  channel: "",
  isAktif: null,
};

export function useIklanListQuery() {
  const [filter, setFilter] = useState<FilterIklan>(FILTER_AWAL);

  const url = useMemo(() => buildIklanListUrl(filter), [filter]);

  const query = useQuery<AmplopDaftar>({
    queryKey: ["presurvei-iklan-list", url],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Gagal memuat daftar iklan");
      return res.json();
    },
    // Menjaga baris lama tetap tampil saat filter berubah, supaya tabel tidak
    // berkedip kosong di antara dua pengambilan.
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (query.error) toast.error("Gagal memuat daftar iklan");
  }, [query.error]);

  /** Mengubah filter selalu mengembalikan ke halaman satu. */
  const ubahFilter = (perubahan: Partial<Omit<FilterIklan, "page">>) =>
    setFilter((lama) => ({ ...lama, ...perubahan, page: 1 }));

  const ubahHalaman = (page: number) =>
    setFilter((lama) => ({ ...lama, page }));

  return {
    filter,
    ubahFilter,
    ubahHalaman,
    baris: query.data?.data ?? [],
    meta: query.data?.meta,
    isLoading: query.isPending,
  };
}
```

Perhatikan `ubahFilter` mengembalikan halaman ke satu. Tanpa itu, menyaring saat berada di halaman lima menghasilkan tabel kosong dan pemakai mengira datanya tidak ada.

- [ ] **Step 6: Tulis komponen presentasional**

Create `app/admin/presurvei/iklan/IklanFilters.tsx` — kotak pencarian, pemilih channel dari `IKLAN_CHANNELS`, dan pemilih status aktif bernilai tiga (semua / aktif / nonaktif). Pemilih status **tidak boleh** memakai checkbox dua nilai: "semua" dan "nonaktif" adalah dua hal berbeda.

Create `app/admin/presurvei/iklan/IklanTable.tsx` memakai `ResponsiveTable` dari `@/components/ui/ResponsiveTable`:

```tsx
"use client";

import Link from "next/link";
import { ResponsiveTable, type Column } from "@/components/ui/ResponsiveTable";
import {
  IKLAN_CHANNEL_CONFIG,
  type IklanListItemDto,
} from "@/modules/presurvei/client";

interface Props {
  baris: IklanListItemDto[];
  isLoading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const kolom: Column<IklanListItemDto>[] = [
  { key: "nama", header: "Nama kampanye", priority: "primary" },
  { key: "kode", header: "Kode UTM", priority: "primary" },
  {
    key: "channel",
    header: "Channel",
    priority: "secondary",
    render: (item) => {
      const tampilan = IKLAN_CHANNEL_CONFIG[item.channel as keyof typeof IKLAN_CHANNEL_CONFIG];
      return (
        <span className={`rounded px-2 py-0.5 text-xs ${tampilan.warna}`}>
          {tampilan.label}
        </span>
      );
    },
  },
  {
    key: "isBerjalan",
    header: "Status",
    priority: "primary",
    render: (item) =>
      item.isBerjalan ? (
        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
          Berjalan
        </span>
      ) : (
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
          {item.isAktif ? "Belum mulai / sudah lewat" : "Dimatikan"}
        </span>
      ),
  },
  { key: "tanggalMulai", header: "Mulai", priority: "tertiary" },
  { key: "tanggalSelesai", header: "Selesai", priority: "tertiary" },
];

export function IklanTable({ baris, isLoading, page, totalPages, onPageChange }: Props) {
  return (
    <ResponsiveTable
      data={baris}
      columns={kolom}
      keyField="id"
      loading={isLoading}
      emptyMessage="Belum ada kampanye iklan."
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      renderActions={(item) => (
        <Link
          href={`/admin/presurvei/iklan/${item.id}/edit`}
          className="text-sm text-indigo-600 hover:underline"
        >
          Ubah
        </Link>
      )}
    />
  );
}
```

Kolom status membedakan tiga keadaan, bukan dua: kampanye bisa aktif tapi belum mulai, aktif tapi sudah lewat, atau memang dimatikan. Menggabungkan ketiganya jadi "tidak berjalan" menyembunyikan alasannya dari pemakai.

- [ ] **Step 7: Tulis shell dan halaman**

Create `app/admin/presurvei/iklan/IklanClient.tsx` — merangkai `IklanFilters`, `IklanTable`, dan tombol "Kampanye baru" yang menautkan ke `/admin/presurvei/iklan/new`.

Create `app/admin/presurvei/iklan/page.tsx`:

```tsx
import { ensureAnyPermission } from "@/lib/rbac";
import { IklanClient } from "./IklanClient";

export const metadata = {
  title: "Kampanye Iklan - Admin Portal",
};

export default async function Page() {
  await ensureAnyPermission(["presurvei_iklan:read"]);

  return <IklanClient />;
}
```

`ensureAnyPermission` berasal dari `@/lib/rbac` — sudah diverifikasi, bukan dari `@/lib/auth-guard`. Bentuk ini menyalin `app/admin/marketing/canvasing/page.tsx` persis, termasuk `metadata` yang mengisi judul tab.

- [ ] **Step 8: Verifikasi**

Run:
```bash
npx vitest run tests/app/presurvei-iklan-list-query.test.ts --maxWorkers=50%
npx tsc -p tsconfig.typecheck.json --noEmit
npm run lint
```
Expected: semuanya hijau.

Buktikan test punya gigi — terapkan mutasi berikut ke `iklanListQuery.ts`, pastikan merah, lalu **kembalikan**:

| Mutasi | Harus merah |
|---|---|
| Ganti `filter.isAktif !== null` jadi `filter.isAktif` | test "mengirim isAktif false" |
| Hapus `.trim()` dan penjaga panjang pada search | test "tidak mengirim filter yang kosong" |
| Ganti `params.toString()` jadi perangkaian string manual | test "menyandikan pencarian" |

- [ ] **Step 9: Commit**

```bash
git add app/admin/presurvei/iklan tests/app/presurvei-iklan-list-query.test.ts
git commit -m "feat(presurvei): tambah layar daftar kampanye iklan"
```

---

## Task 6: Form kampanye iklan (buat dan ubah)

**Files:**
- Create: `app/admin/presurvei/iklan/iklanFormState.ts`
- Create: `app/admin/presurvei/iklan/IklanForm.tsx`
- Create: `app/admin/presurvei/iklan/new/page.tsx`
- Create: `app/admin/presurvei/iklan/new/IklanCreateClient.tsx`
- Create: `app/admin/presurvei/iklan/[id]/edit/page.tsx`
- Create: `app/admin/presurvei/iklan/[id]/edit/IklanEditClient.tsx`
- Test: `tests/app/presurvei-iklan-form-state.test.ts`

**Interfaces:**
- Consumes: `buatIklanSchema`, `ubahIklanSchema`, `IKLAN_CHANNELS`, `IklanDetailDto` dari `@/modules/presurvei/client`
- Produces: `type NilaiFormIklan`, `keNilaiForm(iklan: IklanDetailDto): NilaiFormIklan`, `keMuatanBuat(nilai: NilaiFormIklan)`, `keMuatanUbah(nilai: NilaiFormIklan)`

**Kode UTM tidak bisa diubah setelah dibuat.** `ubahIklanSchema` sengaja tidak memuat `kode`, dan form harus mencerminkannya: pada mode ubah, medan kode ditampilkan sebagai teks mati, bukan input. Mengubahnya akan memutus atribusi seluruh prospek yang sudah tertaut ke kampanye itu — `iklanId` mereka menunjuk baris yang sama, tapi `utm_campaign` di tautan lama tidak lagi cocok.

Form memakai `useState` + `.safeParse()`, bukan react-hook-form. Konversi antara nilai form (semuanya string, karena berasal dari `<input>`) dan muatan API ditarik keluar menjadi fungsi murni supaya bisa diuji.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// tests/app/presurvei-iklan-form-state.test.ts
import { describe, expect, it } from "vitest";

/**
 * Konversi antara nilai form dan muatan API. Medan form selalu string karena
 * berasal dari <input>; API menuntut angka, tanggal, dan null. Di konversi
 * inilah kesalahan paling mudah bersembunyi.
 */

import {
  keMuatanBuat,
  keMuatanUbah,
  keNilaiForm,
  type NilaiFormIklan,
} from "@/app/admin/presurvei/iklan/iklanFormState";

const nilaiLengkap: NilaiFormIklan = {
  nama: "Promo Ramadan",
  kode: "promo-ramadan",
  channel: "META",
  tanggalMulai: "2026-03-01",
  tanggalSelesai: "2026-04-01",
  biaya: "1500000",
  isAktif: true,
};

describe("keMuatanBuat", () => {
  it("mengubah biaya menjadi angka", () => {
    expect(keMuatanBuat(nilaiLengkap).biaya).toBe(1500000);
  });

  it("mempertahankan biaya nol, bukan mengubahnya jadi null", () => {
    // Kampanye organik berbiaya nol itu sah. Penyaringan berbasis truthiness
    // akan mengubahnya jadi "belum diisi" — dua hal yang berbeda artinya.
    expect(keMuatanBuat({ ...nilaiLengkap, biaya: "0" }).biaya).toBe(0);
  });

  it("mengirim null untuk biaya yang dikosongkan", () => {
    expect(keMuatanBuat({ ...nilaiLengkap, biaya: "" }).biaya).toBeNull();
  });

  it("mengirim null untuk tanggal selesai yang dikosongkan", () => {
    // Kampanye tanpa tanggal selesai berjalan sampai dimatikan manual.
    expect(
      keMuatanBuat({ ...nilaiLengkap, tanggalSelesai: "" }).tanggalSelesai,
    ).toBeNull();
  });

  it("lolos validasi schema buat", async () => {
    const { buatIklanSchema } = await import("@/modules/presurvei/client");

    expect(buatIklanSchema.safeParse(keMuatanBuat(nilaiLengkap)).success).toBe(
      true,
    );
  });
});

describe("keMuatanUbah", () => {
  it("tidak pernah mengirim kode", () => {
    // Kode UTM tidak bisa diubah: mengubahnya memutus atribusi seluruh
    // prospek yang sudah tertaut lewat tautan kampanye lama.
    expect(keMuatanUbah(nilaiLengkap)).not.toHaveProperty("kode");
  });

  it("lolos validasi schema ubah", async () => {
    const { ubahIklanSchema } = await import("@/modules/presurvei/client");

    expect(ubahIklanSchema.safeParse(keMuatanUbah(nilaiLengkap)).success).toBe(
      true,
    );
  });
});

describe("keNilaiForm", () => {
  it("mengisi medan dari iklan yang sudah ada", () => {
    // Nilai sengaja berbeda-beda: nama, kode, dan channel semuanya string
    // bersebelahan, dan tertukarnya tidak akan ditolak compiler.
    const nilai = keNilaiForm({
      id: "iklan-1",
      nama: "Promo Ramadan",
      kode: "promo-ramadan",
      channel: "GOOGLE",
      tanggalMulai: "2026-03-01T00:00:00.000Z",
      tanggalSelesai: null,
      biaya: 0,
      isAktif: false,
      isBerjalan: false,
    } as never);

    expect(nilai.nama).toBe("Promo Ramadan");
    expect(nilai.kode).toBe("promo-ramadan");
    expect(nilai.channel).toBe("GOOGLE");
    expect(nilai.tanggalMulai).toBe("2026-03-01");
    expect(nilai.tanggalSelesai).toBe("");
    // Biaya nol harus tampil sebagai "0" di medan, bukan kosong — kalau
    // kosong, menyimpan ulang akan mengubahnya jadi null tanpa disadari.
    expect(nilai.biaya).toBe("0");
    expect(nilai.isAktif).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan merah**

Run: `npx vitest run tests/app/presurvei-iklan-form-state.test.ts --maxWorkers=50%`
Expected: FAIL — `Cannot find module '@/app/admin/presurvei/iklan/iklanFormState'`

- [ ] **Step 3: Tulis konversi nilai form**

Create `app/admin/presurvei/iklan/iklanFormState.ts`:

```ts
import type { IklanChannel, IklanDetailDto } from "@/modules/presurvei/client";

/** Nilai medan form; semuanya string karena berasal dari `<input>`. */
export interface NilaiFormIklan {
  nama: string;
  kode: string;
  channel: IklanChannel;
  /** Format `YYYY-MM-DD` dari `<input type="date">`. */
  tanggalMulai: string;
  tanggalSelesai: string;
  biaya: string;
  isAktif: boolean;
}

/** Nilai awal form untuk kampanye baru. */
export const NILAI_FORM_KOSONG: NilaiFormIklan = {
  nama: "",
  kode: "",
  channel: "META",
  tanggalMulai: "",
  tanggalSelesai: "",
  biaya: "",
  isAktif: true,
};

/**
 * Angka dari medan teks, atau null bila medannya dikosongkan.
 *
 * Perbandingan terhadap string kosong, bukan truthiness: "0" adalah masukan
 * yang sah dan `Boolean("0")` memang true, tapi `Number("")` menghasilkan 0
 * sehingga medan kosong akan diam-diam terkirim sebagai nol.
 */
function angkaAtauNull(teks: string): number | null {
  const bersih = teks.trim();
  return bersih === "" ? null : Number(bersih);
}

/** Tanggal ISO dari medan, atau null bila dikosongkan. */
function tanggalAtauNull(teks: string): string | null {
  return teks.trim() === "" ? null : teks;
}

export function keMuatanBuat(nilai: NilaiFormIklan) {
  return {
    nama: nilai.nama.trim(),
    kode: nilai.kode.trim(),
    channel: nilai.channel,
    tanggalMulai: nilai.tanggalMulai,
    tanggalSelesai: tanggalAtauNull(nilai.tanggalSelesai),
    biaya: angkaAtauNull(nilai.biaya),
    isAktif: nilai.isAktif,
  };
}

/**
 * Muatan ubah, tanpa `kode`.
 *
 * Kode UTM tidak bisa diubah setelah dibuat: prospek yang sudah tertaut
 * menyimpan `iklanId`, tapi tautan kampanye yang beredar membawa kode lama.
 * Mengubahnya membuat pendaftar berikutnya gagal dicocokkan.
 */
export function keMuatanUbah(nilai: NilaiFormIklan) {
  return {
    nama: nilai.nama.trim(),
    channel: nilai.channel,
    tanggalMulai: nilai.tanggalMulai,
    tanggalSelesai: tanggalAtauNull(nilai.tanggalSelesai),
    biaya: angkaAtauNull(nilai.biaya),
    isAktif: nilai.isAktif,
  };
}

/** Nilai form dari kampanye yang sudah ada, untuk mode ubah. */
export function keNilaiForm(iklan: IklanDetailDto): NilaiFormIklan {
  return {
    nama: iklan.nama,
    kode: iklan.kode,
    channel: iklan.channel as IklanChannel,
    tanggalMulai: iklan.tanggalMulai.slice(0, 10),
    tanggalSelesai: iklan.tanggalSelesai?.slice(0, 10) ?? "",
    // Perbandingan eksplisit terhadap null: biaya 0 harus tampil sebagai "0",
    // bukan medan kosong. Kalau kosong, menyimpan ulang mengubahnya jadi null.
    biaya: iklan.biaya === null ? "" : String(iklan.biaya),
    isAktif: iklan.isAktif,
  };
}
```

- [ ] **Step 4: Jalankan test, pastikan hijau**

Run: `npx vitest run tests/app/presurvei-iklan-form-state.test.ts --maxWorkers=50%`
Expected: PASS — 8 test lulus.

- [ ] **Step 5: Tulis komponen form**

Create `app/admin/presurvei/iklan/IklanForm.tsx` — dipakai ulang oleh mode buat dan ubah. Props: `nilai`, `onUbah(perubahan: Partial<NilaiFormIklan>)`, `onSubmit`, `isMenyimpan`, dan `isModeUbah`.

Pada `isModeUbah`, medan kode dirender sebagai teks mati dengan keterangan *"Kode UTM tidak bisa diubah setelah kampanye dibuat"* — bukan input yang di-`disabled`, supaya jelas ini aturan dan bukan kerusakan.

Validasi saat submit memakai schema yang sesuai mode:

```tsx
const hasil = isModeUbah
  ? ubahIklanSchema.safeParse(keMuatanUbah(nilai))
  : buatIklanSchema.safeParse(keMuatanBuat(nilai));

if (!hasil.success) {
  setKesalahan(
    Object.fromEntries(
      hasil.error.issues.map((i) => [String(i.path[0]), i.message]),
    ),
  );
  return;
}
```

- [ ] **Step 6: Tulis halaman buat dan ubah**

Create `app/admin/presurvei/iklan/new/page.tsx`:

```tsx
import { ensureAnyPermission } from "@/lib/rbac";
import { IklanCreateClient } from "./IklanCreateClient";

export const metadata = {
  title: "Kampanye Baru - Admin Portal",
};

export default async function Page() {
  await ensureAnyPermission(["presurvei_iklan:create"]);

  return <IklanCreateClient />;
}
```

Create `app/admin/presurvei/iklan/[id]/edit/page.tsx` dengan pola sama, memakai permission `presurvei_iklan:update` dan meneruskan `params.id` ke `IklanEditClient`.

`IklanCreateClient` memakai `useState(NILAI_FORM_KOSONG)` dan mengirim `POST` ke `/api/admin/presurvei/iklan`. `IklanEditClient` memuat detail lewat `useApi`, mengisi form lewat `keNilaiForm`, dan mengirim `PATCH` ke `/api/admin/presurvei/iklan/{id}`.

Keduanya menampilkan `toast.success` lalu `router.push("/admin/presurvei/iklan")` setelah berhasil, dan `toast.error` dengan pesan dari server bila gagal.

- [ ] **Step 7: Verifikasi dan buktikan test punya gigi**

Run:
```bash
npx vitest run tests/app/presurvei-iklan-form-state.test.ts --maxWorkers=50%
npx tsc -p tsconfig.typecheck.json --noEmit
npm run lint
```

Terapkan mutasi berikut, pastikan merah, lalu **kembalikan**:

| Mutasi | Harus merah |
|---|---|
| Ganti `bersih === ""` jadi `!bersih` di `angkaAtauNull` | test "mempertahankan biaya nol" |
| Ganti `iklan.biaya === null` jadi `!iklan.biaya` di `keNilaiForm` | test "mengisi medan dari iklan yang sudah ada" |
| Tambahkan `kode` ke keluaran `keMuatanUbah` | test "tidak pernah mengirim kode" |

- [ ] **Step 8: Commit**

```bash
git add app/admin/presurvei/iklan tests/app/presurvei-iklan-form-state.test.ts
git commit -m "feat(presurvei): tambah form kampanye iklan"
```

---

## Task 7: Layar daftar kegiatan sales

**Files:**
- Create: `app/admin/presurvei/kegiatan/page.tsx`
- Create: `app/admin/presurvei/kegiatan/kegiatanListQuery.ts`
- Create: `app/admin/presurvei/kegiatan/useKegiatanListQuery.ts`
- Create: `app/admin/presurvei/kegiatan/KegiatanClient.tsx`
- Create: `app/admin/presurvei/kegiatan/KegiatanFilters.tsx`
- Create: `app/admin/presurvei/kegiatan/KegiatanTable.tsx`
- Test: `tests/app/presurvei-kegiatan-list-query.test.ts`

**Interfaces:**
- Consumes: `KegiatanListItemDto`, `KEGIATAN_JENIS`, `KEGIATAN_HASIL`, `KEGIATAN_JENIS_CONFIG`, `KEGIATAN_HASIL_CONFIG` dari `@/modules/presurvei/client`
- Produces: `type FilterKegiatan`, `buildKegiatanListUrl(filter: FilterKegiatan): string` — dipakai juga oleh tab peta di Task 8

Endpoint-nya mendukung `userId`, `jenis`, `hasil`, `dariTanggal`, `sampaiTanggal`, `page`, dan `limit`. Rentang tanggal penting bukan hanya untuk daftar: tab peta di Task 8 memakai filter yang **sama persis**, sehingga peta dan daftar tidak pernah menampilkan himpunan yang berbeda.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// tests/app/presurvei-kegiatan-list-query.test.ts
import { describe, expect, it } from "vitest";

import {
  buildKegiatanListUrl,
  type FilterKegiatan,
} from "@/app/admin/presurvei/kegiatan/kegiatanListQuery";

const kosong: FilterKegiatan = {
  page: 1,
  userId: "",
  jenis: "",
  hasil: "",
  dariTanggal: "",
  sampaiTanggal: "",
};

describe("buildKegiatanListUrl", () => {
  it("selalu mengirim halaman dan batas", () => {
    expect(buildKegiatanListUrl(kosong)).toBe(
      "/api/presurvei/kegiatan?page=1&limit=20",
    );
  });

  it("tidak mengirim filter yang kosong", () => {
    const url = buildKegiatanListUrl(kosong);

    expect(url).not.toContain("userId=");
    expect(url).not.toContain("jenis=");
    expect(url).not.toContain("dariTanggal=");
  });

  it("mengirim rentang tanggal apa adanya", () => {
    // Dua tanggal sengaja berbeda jauh: keduanya string bersebelahan, dan
    // tertukarnya menghasilkan rentang terbalik yang selalu kosong tanpa
    // satu pun pesan kesalahan.
    const url = buildKegiatanListUrl({
      ...kosong,
      dariTanggal: "2026-09-01",
      sampaiTanggal: "2026-09-30",
    });

    expect(url).toContain("dariTanggal=2026-09-01");
    expect(url).toContain("sampaiTanggal=2026-09-30");
  });

  it("menggabungkan seluruh filter yang terisi", () => {
    expect(
      buildKegiatanListUrl({
        page: 2,
        userId: "sales-7",
        jenis: "SURVEI_LOKASI",
        hasil: "TERTARIK",
        dariTanggal: "2026-09-01",
        sampaiTanggal: "2026-09-30",
      }),
    ).toBe(
      "/api/presurvei/kegiatan?page=2&limit=20&userId=sales-7&jenis=SURVEI_LOKASI&hasil=TERTARIK&dariTanggal=2026-09-01&sampaiTanggal=2026-09-30",
    );
  });

  it("memakai batas lebih besar untuk peta", () => {
    // Peta menggambar seluruh titik pada rentang itu sekaligus; membatasinya
    // ke 20 akan menampilkan sebagian kunjungan dan menyesatkan pembacanya.
    expect(buildKegiatanListUrl(kosong, { untukPeta: true })).toContain(
      "limit=100",
    );
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan merah**

Run: `npx vitest run tests/app/presurvei-kegiatan-list-query.test.ts --maxWorkers=50%`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Tulis pembentuk query**

Create `app/admin/presurvei/kegiatan/kegiatanListQuery.ts`:

```ts
import type { KegiatanHasil, KegiatanJenis } from "@/modules/presurvei/client";

const BATAS_TABEL = 20;
/** Batas maksimum yang diizinkan `daftarKegiatanSchema`. */
const BATAS_PETA = 100;

export interface FilterKegiatan {
  page: number;
  userId: string;
  jenis: KegiatanJenis | "";
  hasil: KegiatanHasil | "";
  /** Format `YYYY-MM-DD`; kosong berarti tidak membatasi. */
  dariTanggal: string;
  sampaiTanggal: string;
}

/**
 * URL daftar kegiatan.
 *
 * Tab peta memakai fungsi yang sama dengan `untukPeta: true`, supaya peta dan
 * daftar tidak pernah menampilkan himpunan yang berbeda — satu-satunya
 * perbedaannya adalah berapa banyak baris yang diambil sekaligus.
 */
export function buildKegiatanListUrl(
  filter: FilterKegiatan,
  opsi: { untukPeta?: boolean } = {},
): string {
  const params = new URLSearchParams({
    page: String(opsi.untukPeta ? 1 : filter.page),
    limit: String(opsi.untukPeta ? BATAS_PETA : BATAS_TABEL),
  });

  for (const [kunci, nilai] of [
    ["userId", filter.userId],
    ["jenis", filter.jenis],
    ["hasil", filter.hasil],
    ["dariTanggal", filter.dariTanggal],
    ["sampaiTanggal", filter.sampaiTanggal],
  ] as const) {
    if (nilai.trim().length > 0) {
      params.set(kunci, nilai.trim());
    }
  }

  return `/api/presurvei/kegiatan?${params.toString()}`;
}
```

- [ ] **Step 4: Jalankan test, pastikan hijau**

Run: `npx vitest run tests/app/presurvei-kegiatan-list-query.test.ts --maxWorkers=50%`
Expected: PASS — 5 test lulus.

- [ ] **Step 5: Tulis hook, filter, tabel, dan shell**

`useKegiatanListQuery.ts` menyalin bentuk `useIklanListQuery` dari Task 5: `useQuery` dengan `placeholderData: keepPreviousData`, query key `["presurvei-kegiatan-list", url]`, `ubahFilter` yang mengembalikan halaman ke satu, dan `toast.error` pada kegagalan.

**Satu jebakan yang sudah pernah menggigit repo ini.** Kalau kamu menambahkan debounce pada medan filter, jangan mengembalikan skeleton lebih awal untuk seluruh halaman saat `isLoading`. Komentar di `app/admin/planning/PlanningKanbanClient.tsx:45-52` mencatat akibatnya: input ikut ter-unmount tiap huruf, fokus hilang, huruf berikutnya tidak masuk, dan halaman menembak satu request per ketikan. Render skeleton hanya di area tabel, bukan menggantikan seluruh halaman.

`KegiatanFilters.tsx` memuat pemilih sales, jenis, hasil, dan dua medan `<input type="date">`. `KegiatanTable.tsx` memakai `ResponsiveTable` dengan kolom waktu, sales, jenis, hasil, alamat, dan jumlah foto — badge memakai `KEGIATAN_JENIS_CONFIG` dan `KEGIATAN_HASIL_CONFIG`.

`KegiatanClient.tsx` merangkai keduanya dan menyediakan sakelar tab **Daftar / Peta**; tab peta diisi Task 8. Tombol "Catat kegiatan" membuka modal dari Task 10.

Create `app/admin/presurvei/kegiatan/page.tsx` dengan gerbang `ensureAnyPermission(["presurvei:read", "m_presurvei:read"])` dan `metadata` berjudul "Kegiatan Sales - Admin Portal".

- [ ] **Step 6: Verifikasi dan buktikan test punya gigi**

Run:
```bash
npx vitest run tests/app/presurvei-kegiatan-list-query.test.ts --maxWorkers=50%
npx tsc -p tsconfig.typecheck.json --noEmit
npm run lint
```

Terapkan mutasi, pastikan merah, lalu **kembalikan**:

| Mutasi | Harus merah |
|---|---|
| Hapus cabang `untukPeta` pada `limit` | test "memakai batas lebih besar untuk peta" |
| Tukar `dariTanggal` dengan `sampaiTanggal` di daftar pasangan | test "mengirim rentang tanggal apa adanya" |
| Hapus penjaga `nilai.trim().length > 0` | test "tidak mengirim filter yang kosong" |

- [ ] **Step 7: Commit**

```bash
git add app/admin/presurvei/kegiatan tests/app/presurvei-kegiatan-list-query.test.ts
git commit -m "feat(presurvei): tambah layar daftar kegiatan sales"
```

---

## Task 8: Tab peta kunjungan

**Files:**
- Create: `app/admin/presurvei/kegiatan/titikPeta.ts`
- Create: `app/admin/presurvei/kegiatan/KegiatanPeta.tsx`
- Modify: `app/admin/presurvei/kegiatan/KegiatanClient.tsx` (isi tab peta)
- Test: `tests/app/presurvei-titik-peta.test.ts`

**Interfaces:**
- Consumes: `KegiatanListItemDto` (kini bermuatan koordinat dari Task 3), `KEGIATAN_HASIL_CONFIG`, dan `buildKegiatanListUrl(filter, { untukPeta: true })` dari Task 7
- Produces: `type TitikKegiatan`, `keTitikPeta(baris: KegiatanListItemDto[]): { titik: TitikKegiatan[]; tanpaKoordinat: number }`

Ini yang menjawab permintaan asli pemilik produk: *"kunjungan kemana saja"*. Kolom alamat saja tidak menjawabnya — sepuluh alamat di daftar tidak menunjukkan bahwa sembilan di antaranya berkerumun di satu kelurahan.

**Memakai OpenLayers, bukan react-leaflet.** Repo ini memakai keduanya untuk tujuan berbeda: react-leaflet untuk topologi jaringan (`components/map/*`), OpenLayers untuk peta titik. `components/attendance/EmployeeLocationMap.tsx` menggambar banyak lokasi orang dengan popup — bentuk yang sama persis dengan ini. Baca berkas itu lebih dulu dan tiru strukturnya.

**Komponennya wajib dimuat lewat `dynamic(..., { ssr: false })`.** Pustaka peta menyentuh `window` saat modul dimuat; tanpa itu render di server gagal dengan `window is not defined`. Contohnya ada di `app/admin/kehadiran/live-map/LiveMapClient.tsx:24`.

**Kegiatan tanpa koordinat tidak disembunyikan diam-diam.** Telepon, chat, walk-in kantor, dan kegiatan yang dicatat dari web memang tidak punya titik. Jumlahnya ditampilkan sebagai keterangan di bawah peta — tanpa itu, manajer melihat lima titik dari dua puluh kegiatan dan menyimpulkan timnya tidak bergerak.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// tests/app/presurvei-titik-peta.test.ts
import { describe, expect, it } from "vitest";

import { keTitikPeta } from "@/app/admin/presurvei/kegiatan/titikPeta";
import type { KegiatanListItemDto } from "@/modules/presurvei/client";

const kegiatan = (over: Partial<KegiatanListItemDto>): KegiatanListItemDto =>
  ({
    id: "kegiatan-1",
    jenis: "KUNJUNGAN",
    userId: "sales-1",
    prospekId: null,
    waktuMulai: "2026-09-10T02:00:00.000Z",
    alamatDikunjungi: "Jl. Merdeka 10",
    ditemuiNama: "Budi",
    hasil: "TERTARIK",
    jumlahFoto: 2,
    latitude: -6.2,
    longitude: 106.8,
    ...over,
  }) as KegiatanListItemDto;

describe("keTitikPeta", () => {
  it("memetakan kegiatan berkoordinat menjadi titik", () => {
    // Lintang dan bujur sengaja berjauhan: keduanya `number` bersebelahan dan
    // tertukarnya tidak ditolak compiler — penanda akan mendarat di laut.
    const hasil = keTitikPeta([kegiatan({})]);

    expect(hasil.titik).toHaveLength(1);
    expect(hasil.titik[0]).toMatchObject({
      id: "kegiatan-1",
      latitude: -6.2,
      longitude: 106.8,
      hasil: "TERTARIK",
    });
  });

  it("menghitung kegiatan tanpa koordinat alih-alih membuangnya diam-diam", () => {
    // Telepon dan walk-in kantor tidak punya titik. Tanpa hitungan ini,
    // manajer melihat satu titik dari tiga kegiatan dan mengira timnya diam.
    const hasil = keTitikPeta([
      kegiatan({}),
      kegiatan({ id: "kegiatan-2", latitude: null, longitude: null }),
      kegiatan({ id: "kegiatan-3", latitude: -6.9, longitude: null }),
    ]);

    expect(hasil.titik).toHaveLength(1);
    expect(hasil.tanpaKoordinat).toBe(2);
  });

  it("memperlakukan koordinat nol sebagai titik yang sah", () => {
    // Lintang 0 adalah khatulistiwa, dan Indonesia dilaluinya. Penyaringan
    // berbasis truthiness akan membuang kunjungan di Pontianak.
    const hasil = keTitikPeta([kegiatan({ latitude: 0, longitude: 109.3 })]);

    expect(hasil.titik).toHaveLength(1);
    expect(hasil.tanpaKoordinat).toBe(0);
  });

  it("memberi warna menurut hasil kegiatan", () => {
    const hasil = keTitikPeta([
      kegiatan({ hasil: "TERTARIK" }),
      kegiatan({ id: "kegiatan-2", hasil: "TIDAK_MINAT" }),
    ]);

    expect(hasil.titik[0].warna).not.toBe(hasil.titik[1].warna);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan merah**

Run: `npx vitest run tests/app/presurvei-titik-peta.test.ts --maxWorkers=50%`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Tulis pemetaan titik**

Create `app/admin/presurvei/kegiatan/titikPeta.ts`:

```ts
import {
  KEGIATAN_HASIL_CONFIG,
  type KegiatanHasil,
  type KegiatanListItemDto,
} from "@/modules/presurvei/client";

/** Warna penanda per hasil kegiatan, sejajar dengan badge di daftar. */
const WARNA_PENANDA: Record<KegiatanHasil, string> = {
  TERTARIK: "#f59e0b",
  PERLU_FOLLOWUP: "#3b82f6",
  TIDAK_MINAT: "#9ca3af",
  TIDAK_ADA_ORANG: "#94a3b8",
  DEAL: "#10b981",
};

export interface TitikKegiatan {
  id: string;
  latitude: number;
  longitude: number;
  hasil: string;
  label: string;
  alamat: string | null;
  warna: string;
}

/**
 * Titik peta dari daftar kegiatan, beserta jumlah yang tidak punya koordinat.
 *
 * Yang tanpa koordinat tidak dibuang diam-diam: telepon, chat, walk-in kantor,
 * dan kegiatan yang dicatat dari web memang tidak terjadi di suatu titik, dan
 * pemakainya perlu tahu berapa banyak yang tidak tergambar.
 */
export function keTitikPeta(baris: KegiatanListItemDto[]): {
  titik: TitikKegiatan[];
  tanpaKoordinat: number;
} {
  const titik: TitikKegiatan[] = [];
  let tanpaKoordinat = 0;

  for (const item of baris) {
    // Perbandingan eksplisit terhadap null, bukan truthiness: lintang 0
    // adalah khatulistiwa, dan Indonesia dilaluinya.
    if (item.latitude === null || item.longitude === null) {
      tanpaKoordinat += 1;
      continue;
    }

    const tampilan =
      KEGIATAN_HASIL_CONFIG[item.hasil as KegiatanHasil] ?? null;

    titik.push({
      id: item.id,
      latitude: item.latitude,
      longitude: item.longitude,
      hasil: item.hasil,
      label: tampilan?.label ?? item.hasil,
      alamat: item.alamatDikunjungi,
      warna: WARNA_PENANDA[item.hasil as KegiatanHasil] ?? "#6b7280",
    });
  }

  return { titik, tanpaKoordinat };
}
```

- [ ] **Step 4: Jalankan test, pastikan hijau**

Run: `npx vitest run tests/app/presurvei-titik-peta.test.ts --maxWorkers=50%`
Expected: PASS — 4 test lulus.

- [ ] **Step 5: Tulis komponen peta**

Create `app/admin/presurvei/kegiatan/KegiatanPeta.tsx` — `"use client"`, menerima `titik: TitikKegiatan[]` dan `tanpaKoordinat: number`.

Baca `components/attendance/EmployeeLocationMap.tsx` lebih dulu dan tiru strukturnya: `useRef` untuk wadah peta, `useEffect` yang membangun `Map`, `VectorLayer`, dan `VectorSource`, plus `Overlay` untuk popup. Ganti bentuk datanya dengan `TitikKegiatan`.

Mengklik penanda membuka popup berisi label hasil, alamat, dan tautan ke `/admin/presurvei/kegiatan/{id}`.

Di bawah peta, tampilkan keterangan bila ada yang tersembunyi:

```tsx
{tanpaKoordinat > 0 && (
  <p className="mt-2 text-sm text-gray-500">
    {tanpaKoordinat} kegiatan tidak tergambar karena tidak punya titik lokasi —
    telepon, chat, dan kegiatan yang dicatat dari web.
  </p>
)}
```

- [ ] **Step 6: Sambungkan ke tab**

Di `KegiatanClient.tsx`, muat komponen peta dengan `dynamic` dan matikan SSR:

```tsx
const KegiatanPeta = dynamic(() => import("./KegiatanPeta"), {
  ssr: false,
  loading: () => <Skeleton className="h-[480px] w-full" />,
});
```

Tab peta memakai hook yang sama dengan tab daftar, dipanggil dengan `{ untukPeta: true }` sehingga filternya identik dan batasnya 100.

- [ ] **Step 7: Verifikasi dan buktikan test punya gigi**

Terapkan mutasi, pastikan merah, lalu **kembalikan**:

| Mutasi | Harus merah |
|---|---|
| Ganti penjaga null jadi `!item.latitude \|\| !item.longitude` | test "memperlakukan koordinat nol sebagai titik yang sah" |
| Hapus penambahan `tanpaKoordinat` | test "menghitung kegiatan tanpa koordinat" |
| Buat seluruh entri `WARNA_PENANDA` bernilai sama | test "memberi warna menurut hasil kegiatan" |

Lalu: `npx tsc -p tsconfig.typecheck.json --noEmit` dan `npm run lint`.

- [ ] **Step 8: Commit**

```bash
git add app/admin/presurvei/kegiatan tests/app/presurvei-titik-peta.test.ts
git commit -m "feat(presurvei): tambah tab peta kunjungan sales"
```

---

## Task 9: Halaman detail kegiatan

**Files:**
- Create: `app/admin/presurvei/kegiatan/[id]/page.tsx`
- Create: `app/admin/presurvei/kegiatan/[id]/KegiatanDetailClient.tsx`
- Create: `app/admin/presurvei/kegiatan/[id]/blokDetail.ts`
- Test: `tests/app/presurvei-kegiatan-detail-blok.test.ts`

**Interfaces:**
- Consumes: `KegiatanDetailDto` dari `@/modules/presurvei/client`
- Produces: `blokYangTampil(kegiatan: KegiatanDetailDto): BlokDetail`

Detail punya halaman sendiri, bukan modal, karena memuat galeri foto dan blok data teknis yang tidak muat nyaman di dalam dialog.

Yang diuji adalah **keputusan blok mana yang tampil**, bukan tata letaknya. Ada tiga blok opsional — foto, data teknis, dan titik peta — dan masing-masing punya cara gagal yang senyap.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// tests/app/presurvei-kegiatan-detail-blok.test.ts
import { describe, expect, it } from "vitest";

import { blokYangTampil } from "@/app/admin/presurvei/kegiatan/[id]/blokDetail";
import type { KegiatanDetailDto } from "@/modules/presurvei/client";

const detail = (over: Partial<KegiatanDetailDto>): KegiatanDetailDto =>
  ({
    id: "kegiatan-1",
    jenis: "SURVEI_LOKASI",
    userId: "sales-1",
    prospekId: "prospek-1",
    waktuMulai: "2026-09-10T02:00:00.000Z",
    waktuSelesai: null,
    alamatDikunjungi: "Jl. Merdeka 10",
    ditemuiNama: "Budi",
    hasil: "TERTARIK",
    jumlahFoto: 0,
    latitude: null,
    longitude: null,
    iklanId: null,
    catatan: null,
    fotoUrls: [],
    dataTeknis: null,
    createdAt: "2026-09-10T02:00:00.000Z",
    ...over,
  }) as KegiatanDetailDto;

describe("blokYangTampil", () => {
  it("menyembunyikan ketiga blok saat tidak ada isinya", () => {
    const blok = blokYangTampil(detail({}));

    expect(blok).toEqual({ foto: false, dataTeknis: false, peta: false });
  });

  it("menampilkan peta hanya bila kedua koordinat ada", () => {
    // Satu koordinat tanpa pasangannya tidak bisa digambar, dan menampilkan
    // peta kosong lebih membingungkan daripada tidak menampilkannya.
    expect(blokYangTampil(detail({ latitude: -6.2 })).peta).toBe(false);
    expect(
      blokYangTampil(detail({ latitude: -6.2, longitude: 106.8 })).peta,
    ).toBe(true);
  });

  it("menampilkan peta untuk koordinat nol", () => {
    // Lintang 0 melintasi Indonesia. Pemeriksaan truthiness akan menyembunyikan
    // peta untuk survei di Pontianak.
    expect(blokYangTampil(detail({ latitude: 0, longitude: 109.3 })).peta).toBe(
      true,
    );
  });

  it("menampilkan blok data teknis saat ada isinya", () => {
    expect(
      blokYangTampil(
        detail({
          dataTeknis: {
            odpTerdekat: "ODP-12",
            estimasiKabelMeter: 0,
            catatanTeknis: null,
          },
        }),
      ).dataTeknis,
    ).toBe(true);
  });

  it("menampilkan galeri hanya bila ada foto", () => {
    expect(blokYangTampil(detail({ fotoUrls: [] })).foto).toBe(false);
    expect(blokYangTampil(detail({ fotoUrls: ["a.jpg"] })).foto).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan merah**

Run: `npx vitest run tests/app/presurvei-kegiatan-detail-blok.test.ts --maxWorkers=50%`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Tulis penentu blok**

Create `app/admin/presurvei/kegiatan/[id]/blokDetail.ts`:

```ts
import type { KegiatanDetailDto } from "@/modules/presurvei/client";

export interface BlokDetail {
  foto: boolean;
  dataTeknis: boolean;
  peta: boolean;
}

/**
 * Blok opsional mana yang punya isi.
 *
 * Dipisahkan dari komponen supaya bisa diuji: repo ini tidak punya DOM palsu,
 * dan ketiga penentuan di bawah punya cara gagal yang senyap.
 */
export function blokYangTampil(kegiatan: KegiatanDetailDto): BlokDetail {
  return {
    foto: kegiatan.fotoUrls.length > 0,
    // `dataTeknis` sudah dinormalkan DTO menjadi objek atau null.
    dataTeknis: kegiatan.dataTeknis !== null,
    // Perbandingan eksplisit terhadap null: lintang 0 melintasi Indonesia,
    // dan pemeriksaan truthiness akan menyembunyikan petanya.
    peta: kegiatan.latitude !== null && kegiatan.longitude !== null,
  };
}
```

- [ ] **Step 4: Tulis halaman dan komponennya**

Create `app/admin/presurvei/kegiatan/[id]/page.tsx` dengan gerbang `ensureAnyPermission(["presurvei:read", "m_presurvei:read"])`, meneruskan `params.id`.

`KegiatanDetailClient.tsx` memuat detail lewat `useApi<{ data: KegiatanDetailDto }>` ke `/api/presurvei/kegiatan/{id}`, lalu merender: ringkasan (waktu, sales, jenis, hasil, alamat, orang yang ditemui), catatan, dan ketiga blok opsional menurut `blokYangTampil`.

Blok peta memuat komponen yang sama dengan Task 8 lewat `dynamic(..., { ssr: false })`, dengan satu titik.

- [ ] **Step 5: Verifikasi dan buktikan test punya gigi**

Terapkan mutasi, pastikan merah, lalu **kembalikan**:

| Mutasi | Harus merah |
|---|---|
| Ganti penjaga peta jadi `Boolean(latitude && longitude)` | test "menampilkan peta untuk koordinat nol" |
| Ganti `&&` jadi `\|\|` pada penjaga peta | test "menampilkan peta hanya bila kedua koordinat ada" |
| Ganti `fotoUrls.length > 0` jadi `fotoUrls.length >= 0` | test "menampilkan galeri hanya bila ada foto" |

Lalu jalankan `tsc` dan `lint`.

- [ ] **Step 6: Commit**

```bash
git add "app/admin/presurvei/kegiatan/[id]" tests/app/presurvei-kegiatan-detail-blok.test.ts
git commit -m "feat(presurvei): tambah halaman detail kegiatan"
```

---

## Task 10: Modal catat dan ubah kegiatan

**Files:**
- Create: `app/admin/presurvei/kegiatan/kegiatanFormState.ts`
- Create: `app/admin/presurvei/kegiatan/KegiatanFormModal.tsx`
- Modify: `app/admin/presurvei/kegiatan/KegiatanClient.tsx` (tombol dan pemasangan modal)
- Test: `tests/app/presurvei-kegiatan-form-state.test.ts`

**Interfaces:**
- Consumes: `catatKegiatanSchema`, `KEGIATAN_JENIS`, `KEGIATAN_HASIL`, `isButuhDataTeknis`, `isButuhLokasi`, `isButuhIklan` dari `@/modules/presurvei/client`
- Produces: `type NilaiFormKegiatan`, `keMuatanKegiatan(nilai: NilaiFormKegiatan)`

**Form web sengaja tidak memuat foto maupun penangkapan GPS.** Keduanya lahir dari perangkat di lapangan; memalsukannya dari kursi kantor merusak arti peta kunjungan. Konsekuensinya kegiatan yang dicatat dari web tidak muncul sebagai penanda — dan itu benar, ia memang tidak terjadi di suatu titik.

Domain punya tiga predikat yang menentukan medan mana yang wajib: `isButuhDataTeknis`, `isButuhLokasi`, dan `isButuhIklan`. Form memakainya untuk menampilkan medan yang relevan saja — tapi karena lokasi tidak ditangkap di web, `isButuhLokasi` dipakai untuk **memperingatkan**, bukan untuk memaksa.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// tests/app/presurvei-kegiatan-form-state.test.ts
import { describe, expect, it } from "vitest";

import {
  keMuatanKegiatan,
  type NilaiFormKegiatan,
} from "@/app/admin/presurvei/kegiatan/kegiatanFormState";

const nilai: NilaiFormKegiatan = {
  jenis: "SURVEI_LOKASI",
  hasil: "TERTARIK",
  waktuMulai: "2026-09-10T09:00",
  alamatDikunjungi: "Jl. Merdeka 10",
  ditemuiNama: "Budi",
  catatan: "",
  prospekId: "",
  iklanId: "",
  odpTerdekat: "ODP-12",
  estimasiKabelMeter: "0",
  catatanTeknis: "",
};

describe("keMuatanKegiatan", () => {
  it("mengubah estimasi kabel menjadi angka", () => {
    expect(keMuatanKegiatan(nilai).estimasiKabelMeter).toBe(0);
  });

  it("mempertahankan estimasi kabel nol, bukan mengubahnya jadi null", () => {
    // Survei yang mencatat 0 meter berarti ODP tepat di lokasi. Mengubahnya
    // jadi null menghilangkan hasil survei yang sah.
    expect(keMuatanKegiatan({ ...nilai, estimasiKabelMeter: "0" }).estimasiKabelMeter).toBe(0);
  });

  it("mengirim null untuk medan opsional yang dikosongkan", () => {
    const muatan = keMuatanKegiatan({
      ...nilai,
      catatan: "",
      prospekId: "",
      iklanId: "",
      estimasiKabelMeter: "",
    });

    expect(muatan.catatan).toBeNull();
    expect(muatan.prospekId).toBeNull();
    expect(muatan.iklanId).toBeNull();
    expect(muatan.estimasiKabelMeter).toBeNull();
  });

  it("tidak pernah mengirim koordinat maupun foto", () => {
    // Keduanya lahir dari perangkat di lapangan. Mengirimnya dari web akan
    // menempatkan penanda palsu di peta kunjungan.
    const muatan = keMuatanKegiatan(nilai) as Record<string, unknown>;

    expect(muatan).not.toHaveProperty("latitude");
    expect(muatan).not.toHaveProperty("longitude");
    expect(muatan).not.toHaveProperty("fotoUrls");
  });

  it("lolos validasi schema catat kegiatan", async () => {
    const { catatKegiatanSchema } = await import("@/modules/presurvei/client");

    const hasil = catatKegiatanSchema.safeParse(keMuatanKegiatan(nilai));
    expect(hasil.success).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan merah**

Run: `npx vitest run tests/app/presurvei-kegiatan-form-state.test.ts --maxWorkers=50%`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Tulis konversi nilai form**

Create `app/admin/presurvei/kegiatan/kegiatanFormState.ts`. Bentuknya menyalin pola `iklanFormState.ts` dari Task 6: medan semuanya string, dikonversi lewat helper `angkaAtauNull` dan `teksAtauNull` yang memeriksa string kosong, **bukan** truthiness.

Baca `catatKegiatanSchema` di `modules/presurvei/validators/kegiatan.validator.ts` lebih dulu untuk memastikan nama dan bentuk setiap medan cocok — schema itu merangkai tiga `.refine()` terpisah untuk medan bersyarat (lokasi, data teknis, iklan), dan muatan yang tidak cocok akan ditolak dengan pesan yang tidak jelas. Buka berkasnya — jangan mencari `superRefine`, tidak ada.

- [ ] **Step 4: Tulis modal**

Create `app/admin/presurvei/kegiatan/KegiatanFormModal.tsx` memakai `Modal` dari `@/components/ui/Modal`.

Medan data teknis hanya tampil bila `isButuhDataTeknis(jenis)` bernilai true. Bila `isButuhLokasi(jenis)` true — misalnya untuk `SURVEI_LOKASI` — tampilkan keterangan, bukan penghalang:

```tsx
{isButuhLokasi(nilai.jenis) && (
  <p className="text-sm text-amber-600">
    Kegiatan jenis ini biasanya dicatat dari lapangan lewat aplikasi mobile
    supaya titik lokasinya ikut tersimpan. Yang dicatat dari sini tidak akan
    muncul di peta kunjungan.
  </p>
)}
```

- [ ] **Step 5: Verifikasi dan buktikan test punya gigi**

Terapkan mutasi, pastikan merah, lalu **kembalikan**:

| Mutasi | Harus merah |
|---|---|
| Ganti pemeriksaan string kosong jadi truthiness di `angkaAtauNull` | test "mempertahankan estimasi kabel nol" |
| Tambahkan `latitude: 0, longitude: 0` ke muatan | test "tidak pernah mengirim koordinat maupun foto" |

- [ ] **Step 6: Commit**

```bash
git add app/admin/presurvei/kegiatan tests/app/presurvei-kegiatan-form-state.test.ts
git commit -m "feat(presurvei): tambah modal catat dan ubah kegiatan"
```

---

## Task 11: Papan prospek — kolom dan kartu

**Files:**
- Create: `app/admin/presurvei/prospek/page.tsx`
- Create: `app/admin/presurvei/prospek/prospekKolomQuery.ts`
- Create: `app/admin/presurvei/prospek/useProspekKolom.ts`
- Create: `app/admin/presurvei/prospek/ProspekCard.tsx`
- Create: `app/admin/presurvei/prospek/ProspekKanbanClient.tsx`
- Test: `tests/app/presurvei-prospek-kolom-query.test.ts`

**Interfaces:**
- Consumes: `daftarKolomHidup`, `daftarKolomMati`, `PROSPEK_STATUS_CONFIG`, `ProspekListItemDto` dari `@/modules/presurvei/client`
- Produces: `buildProspekKolomUrl(status: ProspekStatus, page: number): string`, `useProspekKolom(status)` — dipakai Task 12

**Tiap kolom mengambil datanya sendiri.** Endpoint `/api/presurvei/prospek` berpaginasi dengan batas maksimum 100. Mengambil semuanya sekaligus lalu mengelompokkan di klien akan bekerja di development dan **gagal diam-diam di produksi** begitu prospek melewati seratus — kolom terakhir kehilangan kartunya tanpa satu pun pesan.

Pengambilan per-kolom membuat tiap kolom jujur soal jumlahnya (`menampilkan 20 dari 47`), tidak menuntut endpoint papan baru di backend, dan memungkinkan tiap kolom memuat lebih sendiri. Biayanya lima sampai tujuh permintaan paralel, yang wajar untuk papan.

**Kolom mati disembunyikan di balik sakelar.** `TIDAK_MINAT` dan `TIDAK_LAYAK` tumbuh tanpa batas dan akan menenggelamkan corong kerjanya. Sakelarnya juga menghemat dua permintaan saat tidak dipakai.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// tests/app/presurvei-prospek-kolom-query.test.ts
import { describe, expect, it } from "vitest";

import { buildProspekKolomUrl } from "@/app/admin/presurvei/prospek/prospekKolomQuery";

describe("buildProspekKolomUrl", () => {
  it("menyaring tepat satu status per kolom", () => {
    expect(buildProspekKolomUrl("NEGOSIASI", 1)).toBe(
      "/api/presurvei/prospek?status=NEGOSIASI&page=1&limit=20",
    );
  });

  it("meneruskan halaman untuk memuat lebih banyak", () => {
    // Tiap kolom berpaginasi sendiri; tanpa ini tombol "muat lebih" akan
    // mengambil ulang halaman satu dan kartunya tidak pernah bertambah.
    expect(buildProspekKolomUrl("BARU", 3)).toContain("page=3");
  });

  it("memakai status yang diminta, bukan yang pertama", () => {
    // Keduanya string bersebelahan di pemanggilan; tertukarnya membuat
    // seluruh kolom menampilkan isi kolom yang sama tanpa ditolak compiler.
    expect(buildProspekKolomUrl("TIDAK_LAYAK", 1)).toContain(
      "status=TIDAK_LAYAK",
    );
    expect(buildProspekKolomUrl("DEAL", 1)).toContain("status=DEAL");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan merah**

Run: `npx vitest run tests/app/presurvei-prospek-kolom-query.test.ts --maxWorkers=50%`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Tulis pembentuk query kolom**

Create `app/admin/presurvei/prospek/prospekKolomQuery.ts`:

```ts
import type { ProspekStatus } from "@/modules/presurvei/client";

/** Kartu per kolom pada satu kali pengambilan. */
const ISI_KOLOM = 20;

/**
 * URL satu kolom papan.
 *
 * Tiap kolom mengambil datanya sendiri: endpoint ini berpaginasi dengan batas
 * 100, jadi mengambil semua prospek sekaligus lalu mengelompokkan di klien
 * akan bekerja di development dan gagal diam-diam begitu datanya bertambah.
 */
export function buildProspekKolomUrl(
  status: ProspekStatus,
  page: number,
): string {
  const params = new URLSearchParams({
    status,
    page: String(page),
    limit: String(ISI_KOLOM),
  });

  return `/api/presurvei/prospek?${params.toString()}`;
}
```

- [ ] **Step 4: Jalankan test, pastikan hijau**

Run: `npx vitest run tests/app/presurvei-prospek-kolom-query.test.ts --maxWorkers=50%`
Expected: PASS — 3 test lulus.

- [ ] **Step 5: Tulis hook per kolom**

Create `app/admin/presurvei/prospek/useProspekKolom.ts` — satu `useQuery` per status, query key `["presurvei-prospek-kolom", status, page]`, mengembalikan `{ kartu, total, isLoading, muatLebih, adaLagi }`.

Kartu dari halaman sebelumnya **diakumulasi**, bukan diganti: tombol "muat lebih" harus menambah, bukan menukar. Simpan akumulasinya di `useState` yang di-reset saat status atau filter berubah.

- [ ] **Step 6: Tulis kartu dan papan**

`ProspekCard.tsx` menampilkan nama, nomor telepon, badge sumber, dan pemilik. Kartu **tanpa pemilik** diberi penanda jelas — prospek tak bertuan lahir saat form publik masuk dan tenant belum punya sales aktif, dan tanpa penanda ia tidak akan pernah ditemukan.

`ProspekKanbanClient.tsx` merender kolom dari `daftarKolomHidup()`, plus `daftarKolomMati()` bila sakelarnya menyala. Tiap kolom menampilkan judul dari `PROSPEK_STATUS_CONFIG`, jumlah (`menampilkan N dari M`), daftar kartu, dan tombol "muat lebih" bila `adaLagi`.

**Jangan mengembalikan skeleton lebih awal untuk seluruh papan saat memuat.** Komentar di `app/admin/planning/PlanningKanbanClient.tsx:45-52` mencatat akibatnya di halaman serupa: kontrol di atas papan ikut ter-unmount, fokus hilang, dan tiap ketikan menembak satu permintaan. Render skeleton di dalam kolom masing-masing.

Create `app/admin/presurvei/prospek/page.tsx` dengan gerbang `ensureAnyPermission(["presurvei:read", "m_presurvei:read"])` dan `metadata` berjudul "Papan Prospek - Admin Portal".

- [ ] **Step 7: Verifikasi**

Run:
```bash
npx vitest run tests/app/presurvei-prospek-kolom-query.test.ts --maxWorkers=50%
npx tsc -p tsconfig.typecheck.json --noEmit
npm run lint
```

- [ ] **Step 8: Commit**

```bash
git add app/admin/presurvei/prospek tests/app/presurvei-prospek-kolom-query.test.ts
git commit -m "feat(presurvei): tambah papan prospek dengan kolom per status"
```

---

## Task 12: Papan prospek — interaksi seret

**Files:**
- Modify: `app/admin/presurvei/prospek/ProspekKanbanClient.tsx`
- Create: `app/admin/presurvei/prospek/useSeretProspek.ts`
- Test: `tests/app/presurvei-seret-prospek.test.ts`

**Interfaces:**
- Consumes: `resolveAksiKanban` dari `@/modules/presurvei/client` (Task 2)
- Produces: `useSeretProspek({ onUbahStatus, onBukaKonversi })`

Inilah yang membuat papan bisa dipakai. Tanpa pembatasan, mayoritas seretan ditolak server dan pemakai belajar mengabaikan pesan error.

Memakai HTML5 drag-drop native, mengikuti `app/admin/planning/PlanningKanbanClient.tsx` yang sudah berjalan — tidak ada pustaka drag-drop baru yang ditambahkan. Baca berkas itu lebih dulu, khususnya `handleDragStart`, `handleDrop`, dan perhitungan `isDropTarget`.

**Interaksi seretnya sendiri tidak dapat diuji** — repo ini tidak punya DOM palsu. Yang diuji adalah hook yang memegang keputusannya: status apa yang sedang diangkat, kolom mana yang boleh menerima, dan aksi apa yang dipanggil saat dijatuhkan.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// tests/app/presurvei-seret-prospek.test.ts
import { describe, expect, it, vi } from "vitest";

/**
 * Keputusan seret dipegang hook, bukan komponen: repo ini tidak punya DOM
 * palsu, jadi logika yang tertinggal di dalam handler DOM tidak akan teruji.
 */

import { putuskanSeret } from "@/app/admin/presurvei/prospek/useSeretProspek";

describe("putuskanSeret", () => {
  it("tidak melakukan apa pun tanpa kartu yang diangkat", () => {
    const aksi = putuskanSeret(null, "DIHUBUNGI");

    expect(aksi).toBeNull();
  });

  it("menolak kolom yang tidak sah menurut aturan domain", () => {
    expect(putuskanSeret({ id: "p1", dari: "BARU" }, "DEAL")).toBeNull();
  });

  it("meminta ubah status untuk perpindahan biasa", () => {
    expect(putuskanSeret({ id: "p1", dari: "BARU" }, "DIHUBUNGI")).toEqual({
      prospekId: "p1",
      aksi: { jenis: "ubah-status", tujuan: "DIHUBUNGI" },
    });
  });

  it("meminta form konversi saat tujuannya DEAL", () => {
    expect(putuskanSeret({ id: "p9", dari: "NEGOSIASI" }, "DEAL")).toEqual({
      prospekId: "p9",
      aksi: { jenis: "buka-konversi" },
    });
  });

  it("membawa id kartu yang benar, bukan id kolomnya", () => {
    // `prospekId` dan status sama-sama string yang diteruskan bersebelahan;
    // tertukarnya akan memindahkan kartu yang salah tanpa ditolak compiler.
    const hasil = putuskanSeret({ id: "prospek-42", dari: "TERTARIK" }, "NEGOSIASI");

    expect(hasil?.prospekId).toBe("prospek-42");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan merah**

Run: `npx vitest run tests/app/presurvei-seret-prospek.test.ts --maxWorkers=50%`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Tulis keputusan seret dan hook-nya**

Create `app/admin/presurvei/prospek/useSeretProspek.ts`:

```ts
"use client";

import { useState } from "react";

import {
  resolveAksiKanban,
  type AksiKanban,
  type ProspekStatus,
} from "@/modules/presurvei/client";

/** Kartu yang sedang diangkat. */
export interface KartuDiangkat {
  id: string;
  dari: ProspekStatus;
}

export interface KeputusanSeret {
  prospekId: string;
  aksi: AksiKanban;
}

/**
 * Apa yang terjadi bila kartu yang sedang diangkat dijatuhkan ke `ke`.
 *
 * Murni dan terpisah dari komponen supaya bisa diuji — interaksi seretnya
 * sendiri tidak dapat diuji tanpa DOM.
 */
export function putuskanSeret(
  diangkat: KartuDiangkat | null,
  ke: ProspekStatus,
): KeputusanSeret | null {
  if (diangkat === null) {
    return null;
  }

  const aksi = resolveAksiKanban(diangkat.dari, ke);
  return aksi === null ? null : { prospekId: diangkat.id, aksi };
}

export function useSeretProspek(handler: {
  onUbahStatus: (prospekId: string, tujuan: ProspekStatus) => void;
  onBukaKonversi: (prospekId: string) => void;
}) {
  const [diangkat, setDiangkat] = useState<KartuDiangkat | null>(null);

  const mulaiSeret = (kartu: KartuDiangkat) => setDiangkat(kartu);
  const selesaiSeret = () => setDiangkat(null);

  /** Apakah kolom ini boleh menerima kartu yang sedang diangkat. */
  const isKolomTujuan = (status: ProspekStatus) =>
    putuskanSeret(diangkat, status) !== null;

  const jatuhkan = (status: ProspekStatus) => {
    const keputusan = putuskanSeret(diangkat, status);
    selesaiSeret();
    if (keputusan === null) return;

    if (keputusan.aksi.jenis === "buka-konversi") {
      handler.onBukaKonversi(keputusan.prospekId);
      return;
    }
    handler.onUbahStatus(keputusan.prospekId, keputusan.aksi.tujuan);
  };

  return { diangkat, mulaiSeret, selesaiSeret, isKolomTujuan, jatuhkan };
}
```

- [ ] **Step 4: Sambungkan ke papan**

Di `ProspekKanbanClient.tsx`, jadikan kartu `draggable` dan pasang `onDragStart`/`onDragEnd`; pasang `onDragOver`/`onDrop` pada kolom. Kolom yang `isKolomTujuan` bernilai false **diredupkan dan menolak jatuhan** — `onDragOver` tidak memanggil `preventDefault()` sehingga kursor menunjukkan tanda dilarang.

Ubah status memanggil `PATCH /api/presurvei/prospek/{id}` dengan `{ status }`, lalu meng-invalidate query kolom asal dan kolom tujuan. Kegagalan menampilkan `toast.error` dengan pesan dari server — bukan pesan generik, karena server menjelaskan transisi mana yang ditolak.

- [ ] **Step 5: Verifikasi dan buktikan test punya gigi**

Terapkan mutasi, pastikan merah, lalu **kembalikan**:

| Mutasi | Harus merah |
|---|---|
| Hapus penjaga `diangkat === null` | test "tidak melakukan apa pun tanpa kartu yang diangkat" |
| Kembalikan `{ jenis: "ubah-status", tujuan: ke }` tanpa memanggil `resolveAksiKanban` | test "menolak kolom yang tidak sah" dan "meminta form konversi" |
| Ganti `diangkat.id` jadi `ke` pada `prospekId` | test "membawa id kartu yang benar" |

- [ ] **Step 6: Commit**

```bash
git add app/admin/presurvei/prospek tests/app/presurvei-seret-prospek.test.ts
git commit -m "feat(presurvei): tambah interaksi seret pada papan prospek"
```

---

## Task 13: Modal buat dan ubah prospek

**Files:**
- Create: `app/admin/presurvei/prospek/prospekFormState.ts`
- Create: `app/admin/presurvei/prospek/ProspekFormModal.tsx`
- Modify: `app/admin/presurvei/prospek/ProspekKanbanClient.tsx`
- Test: `tests/app/presurvei-prospek-form-state.test.ts`

**Interfaces:**
- Consumes: `buatProspekSchema`, `ubahProspekSchema`, `PROSPEK_SUMBER`, `isSumberButuhIklan`, `isSumberButuhReferral` dari `@/modules/presurvei/client`
- Produces: `type NilaiFormProspek`, `keMuatanBuatProspek`, `keMuatanUbahProspek`

Modal, bukan halaman: menavigasi keluar dari papan lalu kembali memutus konteks dan menghilangkan posisi guliran tiap kolom.

Domain punya dua predikat yang menentukan medan bersyarat: `isSumberButuhIklan` (sumber `IKLAN` wajib menunjuk kampanye) dan `isSumberButuhReferral` (sumber `REFERRAL` wajib menyebut perujuk). Form memakainya untuk menampilkan medan yang relevan, dan schema-nya menegakkan di sisi server.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// tests/app/presurvei-prospek-form-state.test.ts
import { describe, expect, it } from "vitest";

import {
  keMuatanBuatProspek,
  keMuatanUbahProspek,
  type NilaiFormProspek,
} from "@/app/admin/presurvei/prospek/prospekFormState";

const nilai: NilaiFormProspek = {
  nama: "Budi Santoso",
  noTelp: "081234567890",
  email: "",
  alamat: "Jl. Merdeka 10",
  sumber: "WALK_IN",
  iklanId: "",
  referralNama: "",
  paketDiminati: "",
  catatan: "",
};

describe("keMuatanBuatProspek", () => {
  it("mengirim null untuk medan opsional yang dikosongkan", () => {
    const muatan = keMuatanBuatProspek(nilai);

    expect(muatan.email).toBeNull();
    expect(muatan.iklanId).toBeNull();
    expect(muatan.referralNama).toBeNull();
    expect(muatan.paketDiminati).toBeNull();
  });

  it("memangkas spasi pada medan wajib", () => {
    // Nama berspasi di ujung lolos `min(1)` tapi menghasilkan kartu yang
    // tampak rata kiri berbeda dari tetangganya.
    const muatan = keMuatanBuatProspek({ ...nilai, nama: "  Budi  " });

    expect(muatan.nama).toBe("Budi");
  });

  it("mengirim iklanId saat sumbernya IKLAN", () => {
    const muatan = keMuatanBuatProspek({
      ...nilai,
      sumber: "IKLAN",
      iklanId: "iklan-7",
    });

    expect(muatan.sumber).toBe("IKLAN");
    expect(muatan.iklanId).toBe("iklan-7");
  });

  it("lolos validasi schema buat", async () => {
    const { buatProspekSchema } = await import("@/modules/presurvei/client");

    expect(buatProspekSchema.safeParse(keMuatanBuatProspek(nilai)).success).toBe(
      true,
    );
  });
});

describe("keMuatanUbahProspek", () => {
  it("tidak pernah mengirim pemilikId", () => {
    // Kepemilikan menentukan siapa boleh membaca dan mengubah prospek. Route
    // membuangnya untuk pemanggil tanpa permission web, dan form tidak punya
    // alasan mengirimkannya sama sekali.
    expect(keMuatanUbahProspek(nilai)).not.toHaveProperty("pemilikId");
  });

  it("tidak pernah mengirim status", () => {
    // Status berpindah lewat papan. PATCH sebenarnya AMAN — `ProspekService.ubah()`
    // memanggil `isTransisiStatusSah` dan melempar 409 untuk transisi tak sah —
    // jadi ini bukan soal keamanan melainkan satu jalur: dua tempat yang bisa
    // memindahkan status berarti dua tempat yang harus sepakat soal DEAL, yang
    // menuntut konversi, bukan sekadar ganti status.
    expect(keMuatanUbahProspek(nilai)).not.toHaveProperty("status");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan merah**

Run: `npx vitest run tests/app/presurvei-prospek-form-state.test.ts --maxWorkers=50%`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Tulis konversi nilai form**

Create `app/admin/presurvei/prospek/prospekFormState.ts` mengikuti bentuk `iklanFormState.ts` dari Task 6 — helper `teksAtauNull` yang memeriksa string kosong setelah `.trim()`, bukan truthiness.

`keMuatanUbahProspek` **tidak** memuat `pemilikId` maupun `status`. Keduanya punya jalurnya sendiri: kepemilikan ditentukan server, status berpindah lewat papan yang menegakkan aturan transisi.

- [ ] **Step 4: Tulis modal**

Create `app/admin/presurvei/prospek/ProspekFormModal.tsx` memakai `Modal`. Medan `iklanId` hanya tampil bila `isSumberButuhIklan(sumber)`; `referralNama` hanya bila `isSumberButuhReferral(sumber)`. Pemilih kampanye mengambil daftar iklan yang sedang berjalan lewat `useApi`.

Setelah berhasil, invalidate query kolom yang terpengaruh lalu tutup modal dan `toast.success`.

- [ ] **Step 5: Verifikasi dan buktikan test punya gigi**

| Mutasi | Harus merah |
|---|---|
| Ganti pemeriksaan string kosong jadi truthiness | test "mengirim null untuk medan opsional" |
| Tambahkan `pemilikId` ke `keMuatanUbahProspek` | test "tidak pernah mengirim pemilikId" |
| Tambahkan `status` ke `keMuatanUbahProspek` | test "tidak pernah mengirim status" |

- [ ] **Step 6: Commit**

```bash
git add app/admin/presurvei/prospek tests/app/presurvei-prospek-form-state.test.ts
git commit -m "feat(presurvei): tambah modal buat dan ubah prospek"
```

---

## Task 14: Modal promosi prospek ke canvasing

**Files:**
- Create: `app/admin/presurvei/prospek/konversiFormState.ts`
- Create: `app/admin/presurvei/prospek/KonversiModal.tsx`
- Modify: `app/admin/presurvei/prospek/ProspekKanbanClient.tsx`
- Modify: `lib/hooks/useInvalidate.ts`
- Test: `tests/app/presurvei-konversi-form-state.test.ts`

**Interfaces:**
- Consumes: `jadikanCanvasingSchema` dari `@/modules/presurvei/client`
- Produces: `type NilaiFormKonversi`, `keMuatanKonversi`, dan helper `useInvalidatePresurveiKonversi` di `lib/hooks/useInvalidate.ts`

Inilah ujung corongnya. Menjatuhkan kartu ke kolom DEAL membuka modal ini, bukan langsung mengubah status — promosi ke canvasing menuntut nomor KTP dan paket yang tidak ada pada prospek.

**Konversi berhasil wajib meng-invalidate daftar canvasing, bukan hanya papan prospek.** Prospek yang dipromosikan melahirkan baris baru di modul marketing; tanpa invalidasi, admin yang membuka halaman canvasing setelahnya melihat daftar basi dan mengira promosinya gagal. Pola helper-nya ada di `lib/hooks/useInvalidate.ts` — lihat `useInvalidatePlanningRelated`.

Nilai `kabel` dan `odp` diisi awal dari survei terakhir prospek bila ada, tapi tetap bisa diubah — service di Fase 2 sudah melakukan fallback yang sama di sisi server, dan mengisinya di form membuat pemakai melihat angka yang akan dipakai sebelum menyimpan.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// tests/app/presurvei-konversi-form-state.test.ts
import { describe, expect, it } from "vitest";

import {
  keMuatanKonversi,
  type NilaiFormKonversi,
} from "@/app/admin/presurvei/prospek/konversiFormState";

const nilai: NilaiFormKonversi = {
  noKtp: "3201234567890001",
  paket: "20 Mbps",
  kabel: "120",
  odp: "ODP-12",
  sn: "",
  fotoKtp: "",
};

describe("keMuatanKonversi", () => {
  it("mengubah kabel menjadi angka", () => {
    expect(keMuatanKonversi(nilai).kabel).toBe(120);
  });

  it("mengirim null untuk kabel yang dikosongkan, bukan nol", () => {
    // Dikosongkan berarti "pakai estimasi survei", dan server memang punya
    // fallback-nya. Mengirim 0 berarti "kabelnya nol meter" — pernyataan
    // yang berbeda, dan validator marketing menolaknya.
    expect(keMuatanKonversi({ ...nilai, kabel: "" }).kabel).toBeNull();
  });

  it("mengirim null untuk medan opsional yang dikosongkan", () => {
    const muatan = keMuatanKonversi({ ...nilai, sn: "", fotoKtp: "" });

    expect(muatan.sn).toBeNull();
    expect(muatan.fotoKtp).toBeNull();
  });

  it("memakai nilai yang berbeda untuk noKtp dan paket", () => {
    // Keduanya string wajib yang bersebelahan; tertukarnya menghasilkan
    // canvasing dengan paket bernama nomor KTP, dan compiler diam.
    const muatan = keMuatanKonversi(nilai);

    expect(muatan.noKtp).toBe("3201234567890001");
    expect(muatan.paket).toBe("20 Mbps");
  });

  it("lolos validasi schema konversi", async () => {
    const { jadikanCanvasingSchema } = await import(
      "@/modules/presurvei/client"
    );

    expect(
      jadikanCanvasingSchema.safeParse(keMuatanKonversi(nilai)).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan merah**

Run: `npx vitest run tests/app/presurvei-konversi-form-state.test.ts --maxWorkers=50%`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Tulis konversi nilai form**

Create `app/admin/presurvei/prospek/konversiFormState.ts`. Baca `modules/presurvei/validators/konversi.validator.ts` lebih dulu untuk memastikan nama setiap medan cocok.

`kabel` yang dikosongkan menjadi `null`, **bukan** `0`: kosong berarti "pakai estimasi survei" dan server sudah punya fallback-nya, sementara `0` adalah pernyataan bahwa kabelnya nol meter — yang ditolak validator marketing karena menuntut minimal 1.

- [ ] **Step 4: Tambahkan helper invalidasi**

Di `lib/hooks/useInvalidate.ts`, tambahkan mengikuti bentuk helper yang sudah ada:

```ts
/**
 * Konversi prospek melahirkan baris baru di modul marketing. Tanpa
 * invalidasi ini, halaman canvasing menampilkan daftar basi dan pemakainya
 * mengira promosinya gagal.
 */
export function useInvalidatePresurveiKonversi() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: ["presurvei-prospek-kolom"] });
    void queryClient.invalidateQueries({ queryKey: ["canvasing-list"] });
  };
}
```

Periksa query key daftar canvasing di `app/admin/marketing/canvasing/useCanvasingListQuery.ts` dan pakai yang persis — key yang meleset membuat invalidasinya tidak melakukan apa pun, dan tidak ada yang akan memberi tahu.

- [ ] **Step 5: Tulis modal**

Create `app/admin/presurvei/prospek/KonversiModal.tsx`. Ia menerima `prospekId`, memuat detail prospek dan survei terakhirnya untuk mengisi nilai awal `kabel` dan `odp`, lalu mengirim `POST /api/presurvei/prospek/{id}/jadikan-canvasing`.

Berhasil: panggil `useInvalidatePresurveiKonversi()`, `toast.success`, tutup modal. Gagal: `toast.error` dengan pesan dari server — ia menjelaskan hal spesifik seperti "Prospek ini sudah pernah dijadikan canvasing" yang tidak boleh diganti pesan generik.

- [ ] **Step 6: Verifikasi dan buktikan test punya gigi**

| Mutasi | Harus merah |
|---|---|
| Ganti `bersih === ""` jadi truthiness pada kabel | test "mengirim null untuk kabel yang dikosongkan" |
| Tukar `noKtp` dengan `paket` di keluaran | test "memakai nilai yang berbeda untuk noKtp dan paket" |

- [ ] **Step 7: Commit**

```bash
git add app/admin/presurvei/prospek lib/hooks/useInvalidate.ts tests/app/presurvei-konversi-form-state.test.ts
git commit -m "feat(presurvei): tambah modal promosi prospek ke canvasing"
```

---

## Task 15: Layar target sales

**Files:**
- Create: `app/admin/presurvei/target/page.tsx`
- Create: `app/admin/presurvei/target/periodeQuery.ts`
- Create: `app/admin/presurvei/target/TargetClient.tsx`
- Create: `app/admin/presurvei/target/TargetFormModal.tsx`
- Test: `tests/app/presurvei-periode-query.test.ts`

**Interfaces:**
- Consumes: `tetapkanTargetSchema`, `BULAN_MIN`, `BULAN_MAKS`, `TargetDto` dari `@/modules/presurvei/client`
- Produces: `type Periode`, `periodeSekarang(): Periode`, `buildTargetUrl(periode: Periode): string` — dipakai juga Task 16 dan 17

Menetapkan target memakai `POST`, dan **menyimpan ulang periode yang sama akan menimpanya** — itulah sebabnya tidak ada route `PATCH` untuk target. Modalnya harus menyatakan itu, supaya pemakai tidak mengira ia membuat baris kedua.

`periodeSekarang()` dipakai tiga layar, jadi ia tinggal di sini dan diimpor yang lain.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// tests/app/presurvei-periode-query.test.ts
import { describe, expect, it } from "vitest";

import {
  buildTargetUrl,
  periodeSekarang,
} from "@/app/admin/presurvei/target/periodeQuery";

describe("buildTargetUrl", () => {
  it("mengirim tahun dan bulan sebagai angka", () => {
    // Keduanya `number` bersebelahan; tertukarnya menghasilkan periode
    // "bulan 2026" yang ditolak server dengan pesan yang membingungkan.
    expect(buildTargetUrl({ tahun: 2026, bulan: 9 })).toBe(
      "/api/admin/presurvei/target?tahun=2026&bulan=9",
    );
  });

  it("tidak mengisi bulan dengan nol di depan", () => {
    // `z.coerce.number()` menerima "09", tapi URL jadi tidak konsisten dengan
    // yang dibentuk layar lain dan memecah cache query.
    expect(buildTargetUrl({ tahun: 2026, bulan: 1 })).toContain("bulan=1");
  });
});

describe("periodeSekarang", () => {
  it("mengembalikan bulan kalender berjalan, bukan indeks nol", () => {
    // `Date.getMonth()` mengembalikan 0 untuk Januari. Meneruskannya apa
    // adanya membuat Januari ditolak validator yang menuntut minimal 1.
    const periode = periodeSekarang(new Date("2026-01-15T00:00:00.000Z"));

    expect(periode).toEqual({ tahun: 2026, bulan: 1 });
  });

  it("mengembalikan Desember sebagai bulan dua belas", () => {
    expect(periodeSekarang(new Date("2026-12-31T23:00:00.000Z"))).toEqual({
      tahun: 2026,
      bulan: 12,
    });
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan merah**

Run: `npx vitest run tests/app/presurvei-periode-query.test.ts --maxWorkers=50%`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Tulis pembentuk periode**

Create `app/admin/presurvei/target/periodeQuery.ts`:

```ts
export interface Periode {
  tahun: number;
  /** 1–12, bukan indeks nol seperti `Date.getMonth()`. */
  bulan: number;
}

/**
 * Periode bulan berjalan.
 *
 * `Date.getMonth()` mengembalikan 0 untuk Januari; validator menuntut minimal
 * 1, jadi meneruskannya apa adanya membuat Januari ditolak.
 */
export function periodeSekarang(sekarang: Date = new Date()): Periode {
  return {
    tahun: sekarang.getUTCFullYear(),
    bulan: sekarang.getUTCMonth() + 1,
  };
}

export function buildTargetUrl(periode: Periode): string {
  const params = new URLSearchParams({
    tahun: String(periode.tahun),
    bulan: String(periode.bulan),
  });

  return `/api/admin/presurvei/target?${params.toString()}`;
}
```

**Nama param wajib dicocokkan ke route, bukan ke test.** `tahun` dan `bulan` di atas
bukan pilihan bebas: `app/api/admin/presurvei/target/route.ts` membaca persis kedua
nama itu lewat `laporanPeriodeSchema`, dan keduanya **wajib** — tidak ada `.optional()`.
Nama yang meleset membuat `searchParams.get("tahun")` mengembalikan null, schema
melempar, dan layar ini menerima 400 di setiap pembukaan.

Test `buildTargetUrl` **tidak bisa menangkap ini**: ia mengunci string yang rencana ini
sendiri tentukan, tidak pernah menyentuh route. `tsc`, `lint`, dan seluruh suite akan
tetap hijau. Jadi sebelum lanjut, buka `app/api/admin/presurvei/target/route.ts` dan
`modules/presurvei/validators/target.validator.ts`, dan pastikan dengan mata sendiri
bahwa kedua nama itu cocok. Hal yang sama berlaku untuk route laporan di Task 16 —
ia memakai schema yang sama.

- [ ] **Step 4: Tulis layar dan modal**

`TargetClient.tsx` menampilkan pemilih periode (dua `<select>`: bulan dan tahun), tabel target periode itu memakai `ResponsiveTable` dengan kolom sales dan tiga angka target, serta tombol "Tetapkan target".

`TargetFormModal.tsx` memuat pemilih sales dan tiga medan angka. Di atasnya, keterangan yang menjelaskan perilaku timpa:

```tsx
<p className="text-sm text-gray-500">
  Menyimpan target untuk sales dan periode yang sama akan menimpa target
  sebelumnya, bukan menambah baris baru.
</p>
```

Create `app/admin/presurvei/target/page.tsx` dengan gerbang `ensureAnyPermission(["presurvei_target:read"])`.

- [ ] **Step 5: Verifikasi dan buktikan test punya gigi**

| Mutasi | Harus merah |
|---|---|
| Hapus `+ 1` pada `getUTCMonth()` | test "mengembalikan bulan kalender berjalan" |
| Tukar `tahun` dengan `bulan` di URL | test "mengirim tahun dan bulan sebagai angka" |

- [ ] **Step 6: Commit**

```bash
git add app/admin/presurvei/target tests/app/presurvei-periode-query.test.ts
git commit -m "feat(presurvei): tambah layar target sales"
```

---

## Task 16: Layar laporan pencapaian

**Files:**
- Create: `app/admin/presurvei/laporan/page.tsx`
- Create: `app/admin/presurvei/laporan/LaporanClient.tsx`
- Create: `app/admin/presurvei/laporan/barisLaporan.ts`
- Test: `tests/app/presurvei-baris-laporan.test.ts`

**Interfaces:**
- Consumes: `BarisLaporanDto` dari `@/modules/presurvei/client`, `periodeSekarang` dan `Periode` dari Task 15
- Produces: `keBarisTampilan(baris: BarisLaporanDto[]): BarisTampilan[]`

Perhitungan pencapaiannya sudah ada di domain sejak Fase 2 — `hitungPencapaian` sudah membatasi persentase pada 100 dan memperlakukan target nol sebagai tercapai penuh. Layar ini **tidak menghitung ulang apa pun**; ia hanya menyiapkan bentuk tampilan.

**Dua keterbatasan dari Fase 2 wajib terlihat di layar, bukan disembunyikan.** Laporan digerakkan daftar target, sehingga sales yang bekerja tanpa target ditetapkan tidak muncul sama sekali — manajer yang tidak tahu itu akan mengira timnya lebih kecil. Dan batas periodenya memakai UTC, bukan timezone tenant, sehingga aktivitas pada tujuh jam pertama tiap bulan terhitung di bulan sebelumnya.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// tests/app/presurvei-baris-laporan.test.ts
import { describe, expect, it } from "vitest";

import { keBarisTampilan } from "@/app/admin/presurvei/laporan/barisLaporan";
import type { BarisLaporanDto } from "@/modules/presurvei/client";

const baris = (over: Partial<BarisLaporanDto>): BarisLaporanDto =>
  ({
    userId: "sales-1",
    periodeTahun: 2026,
    periodeBulan: 9,
    kunjungan: { target: 20, tercapai: 10, persen: 50 },
    prospek: { target: 10, tercapai: 5, persen: 50 },
    konversi: { target: 5, tercapai: 1, persen: 20 },
    ...over,
  }) as BarisLaporanDto;

describe("keBarisTampilan", () => {
  it("membatasi lebar bilah pada 100 tapi menampilkan angka sebenarnya", () => {
    // Manajer perlu melihat 40 kunjungan dari target 20, bukan sekadar "100%".
    const hasil = keBarisTampilan([
      baris({
        kunjungan: { target: 20, tercapai: 40, persen: 100 },
      }),
    ]);

    expect(hasil[0].kunjungan.lebarBilah).toBe(100);
    expect(hasil[0].kunjungan.tercapai).toBe(40);
  });

  it("menandai baris yang seluruh targetnya nol", () => {
    // Target nol dihitung domain sebagai tercapai penuh. Tanpa penanda, baris
    // itu tampak sebagai sales berkinerja sempurna padahal targetnya memang
    // belum ditetapkan.
    const hasil = keBarisTampilan([
      baris({
        kunjungan: { target: 0, tercapai: 0, persen: 100 },
        prospek: { target: 0, tercapai: 0, persen: 100 },
        konversi: { target: 0, tercapai: 0, persen: 100 },
      }),
    ]);

    expect(hasil[0].isTanpaTarget).toBe(true);
  });

  it("tidak menandai baris yang punya target", () => {
    expect(keBarisTampilan([baris({})])[0].isTanpaTarget).toBe(false);
  });

  it("memakai tiga metrik yang berbeda, tidak menyalin satu ke lainnya", () => {
    // Ketiganya berbentuk sama dan bersebelahan; tertukarnya tidak ditolak
    // compiler dan menghasilkan laporan yang tampak masuk akal.
    const hasil = keBarisTampilan([baris({})])[0];

    expect(hasil.kunjungan.tercapai).toBe(10);
    expect(hasil.prospek.tercapai).toBe(5);
    expect(hasil.konversi.tercapai).toBe(1);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan merah**

Run: `npx vitest run tests/app/presurvei-baris-laporan.test.ts --maxWorkers=50%`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Tulis penyiap tampilan**

Create `app/admin/presurvei/laporan/barisLaporan.ts`:

```ts
import type { BarisLaporanDto } from "@/modules/presurvei/client";

interface MetrikTampilan {
  target: number;
  tercapai: number;
  persen: number;
  /** Lebar bilah kemajuan, dibatasi 100 walau pencapaiannya melampaui. */
  lebarBilah: number;
}

export interface BarisTampilan {
  userId: string;
  kunjungan: MetrikTampilan;
  prospek: MetrikTampilan;
  konversi: MetrikTampilan;
  /** Seluruh targetnya nol — belum ditetapkan, bukan berkinerja sempurna. */
  isTanpaTarget: boolean;
}

const LEBAR_BILAH_MAKS = 100;

function keMetrik(m: { target: number; tercapai: number; persen: number }): MetrikTampilan {
  return {
    ...m,
    lebarBilah: Math.min(m.persen, LEBAR_BILAH_MAKS),
  };
}

/**
 * Bentuk tampilan dari baris laporan.
 *
 * Tidak menghitung ulang apa pun — `hitungPencapaian` di domain sudah
 * membatasi persentase dan memperlakukan target nol sebagai tercapai penuh.
 * Yang ditambahkan hanya lebar bilah dan penanda target-belum-ditetapkan.
 */
export function keBarisTampilan(baris: BarisLaporanDto[]): BarisTampilan[] {
  return baris.map((b) => ({
    userId: b.userId,
    kunjungan: keMetrik(b.kunjungan),
    prospek: keMetrik(b.prospek),
    konversi: keMetrik(b.konversi),
    isTanpaTarget:
      b.kunjungan.target === 0 &&
      b.prospek.target === 0 &&
      b.konversi.target === 0,
  }));
}
```

- [ ] **Step 4: Tulis layar**

`LaporanClient.tsx` memakai pemilih periode yang sama dengan Task 15, memuat `/api/admin/presurvei/laporan?tahun=…&bulan=…`, dan merender tabel sales × tiga metrik dengan bilah kemajuan.

Baris ber-`isTanpaTarget` diberi keterangan "target belum ditetapkan" alih-alih bilah penuh.

Di bawah tabel, dua keterangan yang **tidak boleh dihilangkan**:

```tsx
<p className="mt-4 text-sm text-gray-500">
  Sales yang belum ditetapkan targetnya pada periode ini tidak muncul di
  daftar, karena laporan disusun dari daftar target.
</p>
<p className="mt-1 text-sm text-gray-500">
  Batas periode memakai waktu UTC. Kegiatan pada dini hari tanggal 1 dapat
  terhitung pada bulan sebelumnya.
</p>
```

Create `app/admin/presurvei/laporan/page.tsx` dengan gerbang `ensureAnyPermission(["presurvei_laporan:read"])`.

- [ ] **Step 5: Verifikasi dan buktikan test punya gigi**

| Mutasi | Harus merah |
|---|---|
| Hapus `Math.min` pada `lebarBilah` | test "membatasi lebar bilah pada 100" |
| Ganti `&&` jadi `\|\|` pada `isTanpaTarget` | test "tidak menandai baris yang punya target" |
| Salin `b.kunjungan` ke ketiga metrik | test "memakai tiga metrik yang berbeda" |

- [ ] **Step 6: Commit**

```bash
git add app/admin/presurvei/laporan tests/app/presurvei-baris-laporan.test.ts
git commit -m "feat(presurvei): tambah layar laporan pencapaian"
```

---

## Task 17: Dashboard presurvei

**Files:**
- Create: `app/admin/presurvei/page.tsx`
- Create: `app/admin/presurvei/DashboardClient.tsx`
- Create: `app/admin/presurvei/ringkasanDashboard.ts`
- Test: `tests/app/presurvei-ringkasan-dashboard.test.ts`

**Interfaces:**
- Consumes: `ProspekListItemDto`, `daftarKolomHidup`, `PROSPEK_STATUS_CONFIG` dari `@/modules/presurvei/client`; `periodeSekarang` dari Task 15; `buildProspekKolomUrl(status, page)` dari Task 11
- Produces: `hitungCorong(jumlahPerStatus: Record<string, number>): KartuCorong[]`

Pintu masuk menu. Ia **tidak memperkenalkan endpoint baru** — kartu corong memakai `meta.total` dari permintaan kolom yang sama dengan papan, dan ringkasan pencapaian memakai endpoint laporan periode berjalan.

**Prospek tak bertuan ditonjolkan.** Ia lahir saat form publik masuk dan tenant belum punya sales aktif. Tanpa tempat yang menampilkannya, ia tidak akan pernah ditemukan — dan itu lead yang sudah dibayar iklannya.

- [ ] **Step 1: Tulis test yang gagal**

```ts
// tests/app/presurvei-ringkasan-dashboard.test.ts
import { describe, expect, it } from "vitest";

import { hitungCorong } from "@/app/admin/presurvei/ringkasanDashboard";

describe("hitungCorong", () => {
  it("menyusun kartu untuk tiap kolom hidup, berurutan", () => {
    const kartu = hitungCorong({
      BARU: 12,
      DIHUBUNGI: 7,
      TERTARIK: 4,
      NEGOSIASI: 2,
      DEAL: 1,
    });

    expect(kartu.map((k) => k.status)).toEqual([
      "BARU",
      "DIHUBUNGI",
      "TERTARIK",
      "NEGOSIASI",
      "DEAL",
    ]);
  });

  it("menampilkan nol untuk status yang tidak punya prospek", () => {
    // Status yang hilang dari respons berarti nol, bukan tidak ada. Kartu
    // yang menghilang membuat corongnya tampak lebih pendek dari kenyataan.
    const kartu = hitungCorong({ BARU: 3 });

    expect(kartu).toHaveLength(5);
    expect(kartu.find((k) => k.status === "DEAL")?.jumlah).toBe(0);
  });

  it("tidak memasukkan status mati ke corong", () => {
    // TIDAK_MINAT dan TIDAK_LAYAK tumbuh tanpa batas; memasukkannya membuat
    // kartu corong didominasi prospek yang sudah tidak digarap.
    const kartu = hitungCorong({ BARU: 3, TIDAK_MINAT: 99, TIDAK_LAYAK: 50 });

    expect(kartu.map((k) => k.status)).not.toContain("TIDAK_MINAT");
    expect(kartu.map((k) => k.status)).not.toContain("TIDAK_LAYAK");
  });

  it("memakai label dari konfigurasi status", () => {
    expect(hitungCorong({ BARU: 1 })[0].label).toBe("Baru");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan merah**

Run: `npx vitest run tests/app/presurvei-ringkasan-dashboard.test.ts --maxWorkers=50%`
Expected: FAIL — modul belum ada.

- [ ] **Step 3: Tulis penyusun corong**

Create `app/admin/presurvei/ringkasanDashboard.ts`:

```ts
import {
  PROSPEK_STATUS_CONFIG,
  daftarKolomHidup,
  type ProspekStatus,
} from "@/modules/presurvei/client";

export interface KartuCorong {
  status: ProspekStatus;
  label: string;
  warna: string;
  jumlah: number;
}

/**
 * Kartu corong dari jumlah per status.
 *
 * Hanya kolom hidup: TIDAK_MINAT dan TIDAK_LAYAK tumbuh tanpa batas dan akan
 * mendominasi ringkasan dengan prospek yang sudah tidak digarap.
 */
export function hitungCorong(
  jumlahPerStatus: Record<string, number>,
): KartuCorong[] {
  return daftarKolomHidup().map((status) => ({
    status,
    label: PROSPEK_STATUS_CONFIG[status].label,
    warna: PROSPEK_STATUS_CONFIG[status].warna,
    // Status yang tidak ada di respons berarti nol, bukan tidak ada — kartu
    // yang menghilang membuat corongnya tampak lebih pendek dari kenyataan.
    jumlah: jumlahPerStatus[status] ?? 0,
  }));
}
```

- [ ] **Step 4: Tulis dashboard**

`DashboardClient.tsx` menampilkan: kartu corong memakai `StatCard` dari `@/components/common/StatCard`, ringkasan pencapaian bulan berjalan lewat `periodeSekarang()`, daftar pendek kegiatan tujuh hari terakhir, dan **daftar prospek tanpa pemilik** dengan tautan ke papan.

Jumlah per status diambil dari `meta.total` pada permintaan `buildProspekKolomUrl(status, 1)` — kolom yang sama dengan papan, sehingga angkanya tidak pernah berbeda antara dashboard dan papan.

Create `app/admin/presurvei/page.tsx` dengan gerbang `ensureAnyPermission(["presurvei:read", "m_presurvei:read"])` dan `metadata` berjudul "Presurvei - Admin Portal".

- [ ] **Step 5: Verifikasi dan buktikan test punya gigi**

| Mutasi | Harus merah |
|---|---|
| Ganti `?? 0` jadi `\|\| 0` lalu hapus status dari masukan | (mutan ekuivalen — lewati, catat alasannya) |
| Ganti `daftarKolomHidup()` jadi seluruh `PROSPEK_STATUSES` | test "tidak memasukkan status mati ke corong" |
| Kembalikan `jumlahPerStatus[status]` tanpa `?? 0` | test "menampilkan nol untuk status yang tidak punya prospek" |

- [ ] **Step 6: Commit**

```bash
git add app/admin/presurvei/page.tsx app/admin/presurvei/DashboardClient.tsx app/admin/presurvei/ringkasanDashboard.ts tests/app/presurvei-ringkasan-dashboard.test.ts
git commit -m "feat(presurvei): tambah dashboard presurvei"
```

---

## Task 18: Verifikasi menyeluruh dan changelog

**Files:**
- Modify: `docs/architecture/presurvei-ui-admin-design.md`
- Modify: `docs/architecture/presurvei-module-design.md`
- Modify: `docs/CHANGELOG.md`

Penutup fase. Tidak ada kode produksi yang disentuh.

- [ ] **Step 1: Jalankan verifikasi lengkap dan laporkan apa adanya**

```bash
npm run lint
npx tsc -p tsconfig.typecheck.json --noEmit
npm test
```

Pakai `npm test`, bukan `npx vitest run` polos — kontensi CPU di mesin ini menimbulkan timeout palsu, terdokumentasi di `tasks/lessons.md`.

**Kalau ada yang gagal, laporkan apa adanya dan jangan tutupi.** Fase yang ditutup dengan laporan terlalu cerah lebih buruk daripada fase yang ditutup dengan daftar masalah yang jujur.

- [ ] **Step 2: Periksa setiap layar benar-benar terpasang**

```bash
find app/admin/presurvei -name "page.tsx" | sort
grep -c "PRESURVEI" lib/menu-config.ts
```
Expected: enam `page.tsx` (dashboard, kegiatan, kegiatan/[id], prospek, iklan, iklan/new, iklan/[id]/edit, target, laporan — hitung ulang terhadap peta berkas di atas), dan blok menu terdaftar.

Periksa juga tidak ada komponen klien yang mengimpor barrel penuh:

```bash
grep -rn 'from "@/modules/presurvei"' app/admin/presurvei/
```
Expected: **nihil**. Setiap kecocokan adalah komponen yang menyeret Prisma ke bundle browser — ganti ke `@/modules/presurvei/client`.

- [ ] **Step 3: Perbarui spec**

Di `docs/architecture/presurvei-ui-admin-design.md`, ubah status di kepala dokumen dari "Disetujui untuk direncanakan" menjadi "Selesai" beserta tanggalnya.

Di `docs/architecture/presurvei-module-design.md` §14, ubah baris Fase 3 dari `⬜ Belum dikerjakan` menjadi `✅ Selesai` dengan tanggal, dan sesuaikan kalimat di bawah tabel yang menyatakan modul ini "belum punya satu layar pun".

- [ ] **Step 4: Tulis entri changelog**

Satu entri konsolidasi untuk seluruh Fase 3 di bagian `[Unreleased]` pada `docs/CHANGELOG.md`, mengikuti format di bagian "SOT & Changelog Policy" pada `CLAUDE.md`.

Tidak ada migration Prisma di fase ini — perubahan koordinat pada Task 3 hanya menyentuh DTO, bukan skema. **Verifikasi klaim itu sebelum menulisnya**: jalankan `git diff --stat <commit-awal>..HEAD -- prisma/` dan pastikan kosong. Kalau ternyata ada, cantumkan nama migration-nya.

Keterbatasan yang **wajib** tercatat di entri:

1. Kegiatan yang dicatat dari web tidak punya koordinat maupun foto, sehingga tidak muncul di peta kunjungan. Itu disengaja — keduanya lahir dari perangkat di lapangan.
2. Laporan tidak menampilkan sales yang punya realisasi tapi belum ditetapkan target, karena laporan disusun dari daftar target.
3. Batas periode laporan memakai UTC, bukan timezone tenant. Aktivitas pada tujuh jam pertama tiap bulan terhitung di bulan sebelumnya. Repo ini **tidak punya** timezone per-tenant: satu-satunya field `timezone` di `prisma/schema.prisma` adalah milik model `MikroTikRouter` (baris 644), dan `Tenant` maupun `TenantSettings` tidak punya padanannya. Jadi perbaikannya menuntut keputusan produk lebih dulu — zona mana yang dipakai — bukan sekadar membaca pengaturan yang sudah ada.
4. Laporan per-iklan belum ada. Atribusi `iklanId` dikumpulkan sejak Fase 2 tapi belum ada yang mengonsumsinya; saat dibangun nanti ia wajib sadar-periode agar kampanye yang sudah mati tidak menggelembungkan hasilnya.
5. Filter tidak tersimpan di URL, mengikuti konvensi seluruh halaman admin. Reload menghilangkan filter dan tautannya tidak bisa dibagikan.

- [ ] **Step 5: Commit**

```bash
git add docs/
git commit -m "docs(presurvei): catat penyelesaian fase 3 UI admin"
```

---

## Catatan untuk pelaksana

**Urutan task disengaja.** Iklan (Task 5–6) dikerjakan lebih dulu meski bukan yang paling penting, karena ia layar paling sederhana yang lengkap — satu daftar, satu form, tanpa peta maupun seret. Ia menetapkan pola yang disalin lima layar lain. Memulai dari papan kanban akan membuat keputusan pola diambil sambil bergulat dengan bagian tersulit.

**Empat task pertama tidak menghasilkan layar apa pun.** Itu disengaja: barrel klien, konfigurasi status, aturan seret, dan registrasi menu adalah prasyarat yang dipakai berulang, dan membangunnya sambil jalan akan melahirkan empat versi berbeda.

**Setiap task menuntut pembuktian bahwa test-nya bergigi.** Tabel mutasi di tiap task bukan formalitas — di Fase 2 modul ini, tiga puluh dua mutasi dijalankan dan sembilan lolos hidup, termasuk assertion yang sudah diperketat sekali. Terapkan mutasinya, pastikan merah, lalu kembalikan, dan pastikan `git status --short` bersih sebelum commit.
