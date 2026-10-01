/**
 * Relevansi izin mobile (`m_*`) per persona karyawan.
 *
 * Persona menentukan kerangka tampilan HP (Beranda, tab bawah, menu cepat);
 * izin menentukan isinya. Berkas ini mencatat izin mana yang benar-benar
 * dapat dijangkau di tiap tampilan, izin inti yang tanpanya tampilan kosong,
 * dan preset izin standar — dipakai form role admin untuk menata matriks
 * Mobile App.
 *
 * Sumber (repo `mobile-netmanager`, dibaca 2026-10-02):
 * - Pemilih tampilan: `app/(app)/dashboard.tsx` & `app/(app)/_layout.tsx`
 *   (`LAYAR_BERANDA`, `TAB_BAR_PER_PERSONA`) — Finance & Direktur SEMENTARA
 *   memakai Beranda dan tab bar Staff.
 * - Staff: `src/utils/tabKaryawanStaff.ts` (Beranda · Absensi · Chat · Profil),
 *   `src/components/screens/KaryawanStaffDashboardScreen.tsx`
 *   (`MENU_CEPAT_STAFF` = izin, lembur, holidays, chat; kartu absen;
 *   `BagianKinerjaBeranda` bagi pemantau tim sales → layar penilaian
 *   berpenjaga `m_presurvei`).
 * - Sales: `src/utils/tabKaryawanSales.ts` (Beranda · Presurvei · Canvasing ·
 *   Absensi · Profil), `src/components/screens/KaryawanSalesDashboardScreen.tsx`
 *   (`MENU_CEPAT_SALES` = chat, izin, holidays; lembur sengaja tidak ada).
 * - Teknisi: tab bar bawaan `app/(app)/_layout.tsx` (Beranda · Work Order ·
 *   Canvasing · Barang · Absensi · Profil),
 *   `src/components/screens/KaryawanTeknisiDashboardScreen.tsx` (karusel WO &
 *   canvasing; `QuickMenu` tanpa `menuIds` = seluruh menu cepat di
 *   `src/components/organisms/dashboard/QuickMenu.tsx`, termasuk Topology,
 *   Barang Keluar, Presurvei, dan Isolir/`m_pelanggan`), dan
 *   `app/(app)/barang/index.tsx` (Barang Masuk/Keluar/Riwayat).
 * - Tab Beranda terkunci tanpa `m_dashboard` (`ATURAN_TAB.dashboard` di kedua
 *   berkas tab, `handleTabPress` di `_layout.tsx`).
 *
 * Murni (tanpa Prisma) agar aman dipakai client component lewat
 * `@/modules/roles/client`. Kesesuaian dengan `PERMISSION_GROUPS_MOBILE` dan
 * template role dijaga tes `tests/modules/roles/izin-mobile-persona.test.ts`.
 */

import {
  LABEL_PERSONA_KARYAWAN,
  type PersonaKaryawan,
} from "./persona-karyawan";

/**
 * Resource mobile yang tampil di matriks Mobile App (sama dengan isi
 * `PERMISSION_GROUPS_MOBILE`). Resource internal (`m_dashboard`, `m_salary`,
 * `m_partners`) sengaja tidak termasuk.
 */
export const RESOURCE_MOBILE_MATRIKS = [
  "m_work_order",
  "m_barang",
  "m_barang_masuk",
  "m_barang_keluar",
  "m_absensi",
  "m_lembur",
  "m_izin",
  "m_holidays",
  "m_canvasing",
  "m_presurvei",
  "m_chat",
  "m_topology",
  "m_pelanggan",
] as const;

export type ResourceMobileMatriks = (typeof RESOURCE_MOBILE_MATRIKS)[number];

/** Izin Beranda: resource internal, tidak tampil di matriks. */
const IZIN_BERANDA = "m_dashboard:read";

/** Resource yang dijangkau tampilan Staff (juga Finance & Direktur sementara). */
const RESOURCE_TAMPILAN_STAFF: readonly ResourceMobileMatriks[] = [
  "m_absensi",
  "m_izin",
  "m_lembur",
  "m_holidays",
  "m_chat",
  "m_presurvei",
];

/**
 * Resource mobile yang benar-benar dapat dijangkau di HP per persona. Resource
 * matriks di luar daftar ini tidak pernah tampil di tampilan persona tersebut.
 */
export const RESOURCE_MOBILE_PER_PERSONA: Record<
  PersonaKaryawan,
  readonly ResourceMobileMatriks[]
> = {
  STAFF: RESOURCE_TAMPILAN_STAFF,
  TEKNISI: RESOURCE_MOBILE_MATRIKS,
  SALES: [
    "m_presurvei",
    "m_canvasing",
    "m_absensi",
    "m_izin",
    "m_holidays",
    "m_chat",
  ],
  FINANCE: RESOURCE_TAMPILAN_STAFF,
  DIREKTUR: RESOURCE_TAMPILAN_STAFF,
};

/** Catatan untuk resource yang hanya terjangkau dalam keadaan tertentu. */
const CATATAN_PRESURVEI_PEMANTAU =
  "Presurvei hanya terpakai bila pengguna memantau kinerja tim sales (kartu kinerja di Beranda membuka rincian penilaian).";

/** Catatan relevansi bersyarat per persona (resource → keterangan). */
export const CATATAN_RESOURCE_MOBILE_PER_PERSONA: Record<
  PersonaKaryawan,
  Partial<Record<ResourceMobileMatriks, string>>
> = {
  STAFF: { m_presurvei: CATATAN_PRESURVEI_PEMANTAU },
  TEKNISI: {},
  SALES: {},
  FINANCE: { m_presurvei: CATATAN_PRESURVEI_PEMANTAU },
  DIREKTUR: { m_presurvei: CATATAN_PRESURVEI_PEMANTAU },
};

/** Izin yang tanpanya tampilan persona kosong atau terkunci. */
export interface IzinIntiMobile {
  izin: string;
  namaFitur: string;
  akibat: string;
}

const INTI_BERANDA: IzinIntiMobile = {
  izin: IZIN_BERANDA,
  namaFitur: "Beranda",
  akibat: "tab Beranda terkunci di HP",
};

const INTI_TAMPILAN_STAFF: readonly IzinIntiMobile[] = [
  INTI_BERANDA,
  {
    izin: "m_absensi:read",
    namaFitur: "Absensi",
    akibat: "kartu absen dan tab Absensi hilang, Beranda nyaris kosong",
  },
];

/** Izin inti per persona. */
export const IZIN_INTI_PER_PERSONA: Record<
  PersonaKaryawan,
  readonly IzinIntiMobile[]
> = {
  STAFF: INTI_TAMPILAN_STAFF,
  TEKNISI: [
    INTI_BERANDA,
    {
      izin: "m_work_order:read",
      namaFitur: "Work Order",
      akibat: "Beranda teknisi akan kosong",
    },
  ],
  SALES: [
    INTI_BERANDA,
    {
      izin: "m_presurvei:read",
      namaFitur: "Presurvei",
      akibat: "tab Presurvei terkunci dan ringkasan presurvei di Beranda kosong",
    },
  ],
  FINANCE: INTI_TAMPILAN_STAFF,
  DIREKTUR: INTI_TAMPILAN_STAFF,
};

/** Preset tampilan Staff: kepegawaian (absen, izin, lembur, libur, chat). */
const IZIN_STANDAR_STAFF: readonly string[] = [
  IZIN_BERANDA,
  "m_absensi:read",
  "m_absensi:create",
  "m_lembur:read",
  "m_lembur:create",
  "m_izin:read",
  "m_izin:create",
  "m_holidays:read",
  "m_chat:read",
  "m_chat:create",
];

/**
 * Preset izin mobile lazim per persona. Teknisi & Sales sama dengan bagian
 * mobile template `teknisi` dan `sales` di `lib/role-templates.ts`; Staff
 * diturunkan dari menu tampilan Staff (belum ada template yang pas).
 */
export const IZIN_STANDAR_MOBILE_PER_PERSONA: Record<
  PersonaKaryawan,
  readonly string[]
> = {
  STAFF: IZIN_STANDAR_STAFF,
  TEKNISI: [
    IZIN_BERANDA,
    "m_work_order:read",
    "m_work_order:create",
    "m_work_order:update",
    "m_barang:read",
    "m_barang_masuk:read",
    "m_barang_masuk:create",
    "m_barang_keluar:read",
    "m_barang_keluar:create",
    "m_absensi:read",
    "m_absensi:create",
    "m_lembur:read",
    "m_lembur:create",
    "m_izin:read",
    "m_izin:create",
    "m_holidays:read",
    "m_canvasing:read",
    "m_canvasing:create",
    "m_chat:read",
    "m_chat:create",
  ],
  SALES: [
    IZIN_BERANDA,
    "m_canvasing:read",
    "m_canvasing:create",
    "m_presurvei:read",
    "m_presurvei:create",
    "m_presurvei:update",
    "m_absensi:read",
    "m_absensi:create",
    "m_izin:read",
    "m_izin:create",
    "m_holidays:read",
    "m_chat:read",
    "m_chat:create",
  ],
  FINANCE: IZIN_STANDAR_STAFF,
  DIREKTUR: IZIN_STANDAR_STAFF,
};

/** Resource dari string izin `resource:aksi[:subaksi]`. */
function getResourceIzin(izin: string): string {
  return izin.split(":")[0];
}

/** Apakah resource adalah resource matriks Mobile App. */
export function isResourceMobileMatriks(
  resource: string,
): resource is ResourceMobileMatriks {
  return (RESOURCE_MOBILE_MATRIKS as readonly string[]).includes(resource);
}

/** Apakah resource mobile tampil di HP untuk persona ini. */
export function isResourceMobileRelevan(
  persona: PersonaKaryawan,
  resource: string,
): boolean {
  return (RESOURCE_MOBILE_PER_PERSONA[persona] as readonly string[]).includes(
    resource,
  );
}

/** Izin matriks mobile yang dicentang tetapi tidak pernah tampil di HP persona. */
export function getIzinTakTerlihatDiHp(
  persona: PersonaKaryawan,
  permissions: readonly string[],
): string[] {
  return permissions.filter((izin) => {
    const resource = getResourceIzin(izin);
    return (
      isResourceMobileMatriks(resource) &&
      !isResourceMobileRelevan(persona, resource)
    );
  });
}

/** Izin inti persona yang belum dicentang. */
export function getIzinIntiHilang(
  persona: PersonaKaryawan,
  permissions: readonly string[],
): IzinIntiMobile[] {
  return IZIN_INTI_PER_PERSONA[persona].filter(
    ({ izin }) => !permissions.includes(izin),
  );
}

/** Kalimat peringatan untuk satu izin inti yang hilang. */
export function formatPeringatanIzinInti(
  persona: PersonaKaryawan,
  inti: IzinIntiMobile,
): string {
  return `Tampilan ${LABEL_PERSONA_KARYAWAN[persona]} tanpa izin ${inti.namaFitur}: ${inti.akibat}.`;
}

/**
 * Ganti izin mobile dengan preset persona. Hanya izin `m_*` matriks yang
 * diganti; izin web admin dan izin mobile internal (`m_salary`,
 * `m_partners`, dst.) dipertahankan. `m_dashboard:read` ikut dipastikan ada.
 */
export function terapkanIzinStandarMobile(
  persona: PersonaKaryawan,
  permissions: readonly string[],
): string[] {
  const izinDipertahankan = permissions.filter(
    (izin) => !isResourceMobileMatriks(getResourceIzin(izin)),
  );
  return [
    ...new Set([
      ...izinDipertahankan,
      ...IZIN_STANDAR_MOBILE_PER_PERSONA[persona],
    ]),
  ];
}
