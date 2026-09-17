/**
 * Catalog modul domain yang dapat di-toggle per tenant.
 *
 * Kode di sini dipakai sebagai source of truth untuk:
 * - tabel `TenantFeatureFlag.feature`
 * - tag `featureModule` di `lib/menu-config.ts` (filter sidebar)
 * - opsi `feature` di `secure()` / `createHandler()` (gate API)
 * - daftar yang di-render di UI super admin (`/admin/tenants/[id]/features`)
 *
 * Dikelola sebagai const tuple agar TypeScript catch typo via type union
 * `FeatureModuleCode`. Tambah module baru → tambah entry di sini saja.
 *
 * Yang TIDAK termasuk catalog: modul infra/system yang tidak punya menu
 * sidebar atau wajib aktif untuk tenant agar aplikasi berfungsi (database,
 * events, notification core, admin shell, registration flow, tenant
 * management, mitra integration). Modul-modul ini tidak boleh disable.
 */

export interface FeatureModule {
  /** Kode unik (snake-case-or-kebab) yang disimpan di DB. */
  readonly code: string;
  /** Label tampil di UI super admin. */
  readonly label: string;
  /** Penjelasan singkat agar super admin paham scope modul. */
  readonly description: string;
  /** Group untuk pengelompokan di UI super admin. */
  readonly group: "core" | "operasional" | "keuangan" | "sdm" | "lainnya";
}

export const FEATURE_MODULES = [
  // === CORE: jaringan & pelanggan ===
  {
    code: "network",
    label: "Network / MikroTik",
    description: "Manajemen router MikroTik, monitoring, RADIUS.",
    group: "core",
  },
  {
    code: "olt",
    label: "OLT / FTTH",
    description: "Monitoring OLT, ONU, profile, jalur fiber.",
    group: "core",
  },
  {
    code: "map",
    label: "Peta Jaringan",
    description: "Visualisasi jalur dan node fiber/jaringan.",
    group: "core",
  },
  {
    code: "pelanggan",
    label: "Pelanggan",
    description: "Manajemen data pelanggan, paket, status layanan.",
    group: "core",
  },
  {
    code: "reseller",
    label: "Reseller",
    description: "Manajemen reseller, outlet, dan harga paket reseller.",
    group: "core",
  },

  // === OPERASIONAL ===
  {
    code: "work-order",
    label: "Work Order",
    description: "Penugasan teknisi, RAB, completion, history.",
    group: "operasional",
  },
  {
    code: "inventory",
    label: "Inventory",
    description: "Stok barang, masuk/keluar, transfer, asset depreciation.",
    group: "operasional",
  },
  {
    code: "procurement",
    label: "Procurement",
    description: "Purchase request, purchase order, supplier.",
    group: "operasional",
  },
  {
    code: "chat",
    label: "Chat Internal",
    description: "Komunikasi internal admin/karyawan.",
    group: "operasional",
  },
  {
    code: "settings",
    label: "Pengaturan Tenant",
    description: "Konfigurasi tenant, tema, branding, integrasi.",
    group: "operasional",
  },
  {
    code: "website",
    label: "Website / Landing",
    description: "Konten landing tenant (hero, fitur, pricing, footer).",
    group: "operasional",
  },

  // === KEUANGAN ===
  {
    code: "finance",
    label: "Finance / Tagihan",
    description: "Tagihan, pembayaran, isolir otomatis, reminder.",
    group: "keuangan",
  },
  {
    code: "accounting",
    label: "Akuntansi",
    description: "GL, COA, journal entry, period, laporan keuangan.",
    group: "keuangan",
  },
  {
    code: "tax",
    label: "Pajak",
    description: "Manajemen pajak, PPN, PPh.",
    group: "keuangan",
  },
  {
    code: "payment-gateway",
    label: "Payment Gateway",
    description: "Konfigurasi & monitoring payment gateway pihak ketiga.",
    group: "keuangan",
  },
  {
    code: "coupons",
    label: "Kupon Diskon",
    description: "Kupon diskon untuk tagihan pelanggan.",
    group: "keuangan",
  },
  {
    code: "marketing",
    label: "Marketing",
    description: "Kampanye marketing, lead, broadcast.",
    group: "keuangan",
  },

  // === SDM ===
  {
    code: "users",
    label: "Manajemen User",
    description: "User internal tenant (admin, karyawan).",
    group: "sdm",
  },
  {
    code: "roles",
    label: "Role & Permission",
    description: "Pengelolaan role dan permission RBAC.",
    group: "sdm",
  },
  {
    code: "attendance",
    label: "Kehadiran",
    description: "Check-in/out, koreksi, izin, lokasi tracking.",
    group: "sdm",
  },
  {
    code: "shift",
    label: "Shift Kerja",
    description: "Pengaturan shift dan jadwal kerja.",
    group: "sdm",
  },
  {
    code: "overtime",
    label: "Lembur",
    description: "Pengajuan lembur, approval, perhitungan.",
    group: "sdm",
  },
  {
    code: "salary",
    label: "Gaji / Payroll",
    description: "Komponen gaji, slip, payroll cycle.",
    group: "sdm",
  },

  // === LAINNYA ===
  {
    code: "investor",
    label: "Investor",
    description: "Portal investor, deposit, laporan return.",
    group: "lainnya",
  },
  {
    code: "app-update",
    label: "App Update Mobile",
    description: "Manajemen rilis & update aplikasi mobile karyawan.",
    group: "lainnya",
  },
  {
    code: "app-version",
    label: "App Version Control",
    description: "Version pinning untuk mobile build.",
    group: "lainnya",
  },
  {
    code: "planning",
    label: "Planning OSP",
    description:
      "Perencanaan ekspansi jaringan ISP (Outside Plant) dengan approval workflow.",
    group: "lainnya",
  },
] as const satisfies readonly FeatureModule[];

export type FeatureModuleCode = (typeof FEATURE_MODULES)[number]["code"];

const FEATURE_MODULE_CODES = new Set<string>(
  FEATURE_MODULES.map((m) => m.code),
);

/** Validasi runtime apakah string adalah kode modul yang dikenali. */
export function isFeatureModuleCode(
  value: unknown,
): value is FeatureModuleCode {
  return typeof value === "string" && FEATURE_MODULE_CODES.has(value);
}

/** Cari metadata modul berdasarkan kode. Return null bila tidak ditemukan. */
export function getFeatureModule(code: string): FeatureModule | null {
  return FEATURE_MODULES.find((m) => m.code === code) ?? null;
}
