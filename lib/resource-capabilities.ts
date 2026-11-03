/**
 * Resource Capabilities Configuration
 *
 * Menentukan actions apa yang tersedia untuk setiap resource.
 * Digunakan oleh Role Matrix UI untuk filter checkbox yang ditampilkan.
 *
 * Actions:
 * - read: Melihat/membaca data
 * - create: Membuat data baru
 * - update: Mengubah data yang ada
 * - delete: Menghapus data
 * - site_only: Batasi ke data site sendiri
 * - department_only: Batasi ke data departemen sendiri
 * - cancel: Membatalkan (khusus Work Order)
 * - verify: Memverifikasi (khusus Work Order)
 *
 * Aksi pembatasan (`site_only`, `department_only`) HANYA tampil bila
 * dideklarasikan eksplisit di entri resource-nya — default tidak pernah
 * menawarkannya. Toggle pembatasan yang tidak dibaca backend menipu pemilik
 * role: ia menyalakan "Batasi ke Site Sendiri", yakin datanya terbatas, padahal
 * tidak terjadi apa-apa. Deklarasikan pembatasan hanya bersamaan dengan kode
 * yang menegakkannya; `tests/architecture/katalog-toggle-pembatasan.test.ts`
 * menggagalkan build bila katalog menawarkan toggle yang tidak dibaca siapa pun.
 */

export type ResourceAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "site_only"
  | "department_only"
  | "cancel"
  | "verify"
  | "reminder"
  | "approve_request"
  | "audit"
  | "approve"
  | "mark_paid"
  | "calculate"
  | "manage"
  | "view_all"
  | "correct-missed-checkin"
  | "cashout"
  | "downgrade_paket";

export interface ResourceCapability {
  actions: ResourceAction[];
  description?: string;
  displayName?: string;
}

/**
 * Resource capabilities mapping
 * Key: resource name (lowercase)
 * Value: available actions for that resource
 */
export const RESOURCE_CAPABILITIES: Record<string, ResourceCapability> = {
  salary: {
    actions: [
      "read",
      "create",
      "update",
      "delete",
      "manage",
      "calculate",
      "audit",
      "approve",
      "mark_paid",
      "view_all",
    ],
    description: "Manajemen Daftar Gaji",
  },
  salary_users: {
    actions: ["read", "create", "update", "delete"],
    description: "Manajemen Karyawan Digaji & Pengaturan Gaji Individu",
  },

  // Resource di bawah yang hanya memuat aksi kemampuan (tanpa `site_only`/
  // `department_only`) — salary, salary_users, login, activity, daily_income,
  // period_income, profit_loss, procurement, map, network, acs_* — dulu
  // menawarkan toggle pembatasan yang tidak dibaca kode mana pun (snapshot
  // 2026-11-03). Tambahkan kembali hanya bersama penegakannya.

  // ====== READ-ONLY RESOURCES ======
  // Hanya bisa lihat data, tidak ada CRUD
  dashboard: {
    // Tanpa `site_only`: tidak ada route API yang dijaga `dashboard:*` — satu-
    // satunya pemakai `dashboard:read` adalah Server Component `app/admin/page.tsx`,
    // dan tidak ada satu titik pun tempat filter site bisa dipasang.
    actions: ["read"],
    description: "Dashboard utama admin portal",
  },
  work_order_dashboard: {
    actions: ["read", "site_only", "department_only"],
    description: "Dashboard Work Order",
  },
  live_tracking: {
    actions: ["read", "site_only", "department_only"],
    description: "Live tracking lokasi karyawan",
  },
  system_log: {
    actions: ["read", "site_only"],
    description: "Log aktivitas sistem",
  },
  login: {
    actions: ["read"],
    description: "Log riwayat login",
  },
  activity: {
    actions: ["read"],
    description: "Log riwayat aktivitas pengguna",
  },
  report: {
    actions: ["read", "site_only", "department_only"],
    description: "Laporan kehadiran",
  },
  daily_income: {
    actions: ["read"],
    description: "Pendapatan harian",
  },
  period_income: {
    actions: ["read"],
    description: "Pendapatan periodik",
  },
  profit_loss: {
    actions: ["read"],
    description: "Laporan rugi laba",
  },

  // ====== KEHADIRAN MODULE ======
  attendance: {
    actions: [
      "read",
      "create",
      "update",
      "delete",
      "site_only",
      "department_only",
      "correct-missed-checkin",
    ],
    description: "Data kehadiran karyawan",
  },
  izin: {
    actions: [
      "read",
      "create",
      "update",
      "delete",
      "verify",
      "site_only",
      "department_only",
    ],
    description: "Pengajuan izin/cuti",
  },
  lembur: {
    actions: [
      "read",
      "create",
      "update",
      "delete",
      "verify",
      "site_only",
      "department_only",
    ],
    description: "Data lembur karyawan",
  },
  holiday: {
    // Tanpa `site_only`: model `Holiday` hanya punya date/description/isNational
    // dan `tenantId`. Hari libur berlaku se-tenant; tidak ada sumbu site untuk
    // difilter.
    actions: ["read", "create", "update", "delete"],
    description: "Hari libur nasional/perusahaan",
  },
  shift: {
    actions: ["read", "create", "update", "delete"],
    description: "Manajemen jadwal shift kerja",
  },

  // ====== INVENTORY MODULE ======
  // Kelompok inventory tanpa `department_only`: Barang, Gudang, BarangMasuk,
  // BarangKeluar, TransferAntarGudang, dan StockOpname tidak punya kolom
  // departemen, dan satu-satunya jalur keluar dari gudang adalah relasi ke
  // Sites. Pembatasan per departemen di sini mustahil ditegakkan, jadi
  // toggle-nya dibuang alih-alih dibiarkan menipu pemilik role.
  barang: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Master barang inventory",
  },
  gudang: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Master gudang/warehouse",
  },
  masuk: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Barang masuk",
  },
  keluar: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Barang keluar",
  },
  transfer: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Transfer antar gudang",
  },
  opname: {
    actions: [
      "read",
      "create",
      "update",
      "delete",
      "site_only",
      // Pengelola SO: menerima ringkasan gudang yang tidak tuntas SO per bulan.
      "manage",
    ],
    description: "Stock opname",
  },
  restock: {
    actions: [
      "read",
      "create",
      "update",
      "delete",
      "approve",
      "verify",
      "site_only",
    ],
    description: "Request restock",
  },
  inventory: {
    // Tanpa aksi pembatasan: ini permission menu induk — tidak ada route API
    // yang dijaga `inventory:*`. Datanya dilayani `barang`/`gudang`/`k_barang`,
    // yang sudah menegakkan pembatasan site lewat `gudang.sites`. Toggle di sini
    // hanya akan menjanjikan pembatasan kedua yang tidak pernah dibaca.
    actions: ["read", "create", "update", "delete"],
    description: "Menu inventory (parent)",
  },

  // ====== PROCUREMENT MODULE ======
  procurement: {
    actions: ["read", "create", "update", "delete", "verify"], // Approve = verify
    description: "Manajemen pengadaan barang (PO)",
  },
  supplier: {
    actions: ["read", "create", "update", "delete"],
    description: "Master data supplier",
  },

  // ====== WORK ORDER MODULE ======
  workorders: {
    actions: [
      "read",
      "create",
      "update",
      "delete",
      "cancel",
      "verify",
      "reminder",
      "approve_request",
      "site_only",
      "department_only",
    ],
    description: "Work Order",
  },
  list: {
    // Tanpa aksi pembatasan: `list:*_only` hanya alias izin, sedangkan
    // pembatasan dicocokkan persis — yang dibaca adalah `workorders:*_only`.
    actions: [
      "read",
      "create",
      "update",
      "delete",
      "cancel",
      "verify",
      "reminder",
      "approve_request",
    ],
    description: "Daftar Work Order",
  },

  // ====== USERS & ROLES ======
  users: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Manajemen pengguna",
  },
  investors: {
    actions: [
      "read",
      "create",
      "update",
      "delete",
      "manage",
      "verify",
      "approve",
      "mark_paid",
    ],
    description: "Manajemen data investor, setoran, dan bagi hasil",
  },
  tax: {
    actions: ["read", "manage", "calculate", "mark_paid"],
    description: "Manajemen pajak, PPN, PPh, BHP/USO",
  },
  mitra: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Data mitra",
  },
  withdrawals: {
    actions: ["read", "create", "update", "delete", "verify", "site_only"],
    description: "Penarikan komisi mitra",
  },
  roles: {
    actions: ["read", "create", "update", "delete"],
    description: "Manajemen role",
  },
  department: {
    // Tanpa `site_only`: `Departments` adalah master data se-tenant tanpa `siteId`.
    // Site dan departemen adalah dua sumbu pembatasan terpisah yang hanya
    // bersinggungan di `User` (punya `siteId` DAN `departmentId`).
    actions: ["read", "create", "update", "delete"],
    description: "Manajemen department",
  },
  site: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Manajemen site",
  },

  // ====== NETWORK ======
  map: {
    actions: ["read", "create", "update", "delete"],
    description: "Manajemen Peta Jaringan (ODP/ODC/Fiber)",
  },
  network: {
    actions: ["read", "create", "update", "delete"],
    description: "Menu network (parent)",
  },
  mikrotik: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "MikroTik routers",
  },
  radius: {
    // Tanpa `site_only`: data RADIUS ada di database terpisah
    // (`prisma/schema.radius.prisma`) yang tidak punya kolom site sama sekali —
    // isolasinya hanya `tenantId`. Menawarkan toggle site di sini berarti
    // menjanjikan pembatasan yang mustahil ditegakkan.
    actions: ["read", "create", "update", "delete"],
    description: "Radius server",
  },
  acs_dashboard: {
    actions: ["read"],
    description: "Dashboard ACS",
  },
  acs_mapping: {
    actions: ["read", "create", "update", "delete"],
    description: "Pemetaan perangkat OLT/ONT",
  },
  acs_devices: {
    actions: ["read", "create", "update", "delete"],
    description: "Semua device ONT di ACS",
  },

  // ====== PAKET ======
  // Entri eksplisit karena default tidak lagi menawarkan pembatasan.
  // `site_only` dibaca lewat `checkSiteRestriction(..., "<resource>")`.
  bandwidth: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Paket bandwidth",
  },
  profileppp: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Profile PPP",
  },
  harga: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Harga paket",
  },

  // ====== PELANGGAN ======
  ppp: {
    // `ppp:site_only` dibaca bersama `pelanggan:site_only`
    // (`PELANGGAN_PPP_SITE_ONLY_PERMISSIONS`, `INVOICE_SITE_ONLY_PERMISSIONS`).
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Pelanggan PPP",
  },
  pelanggan: {
    // `downgrade_paket`: boleh menurunkan pelanggan ke paket yang lebih
    // murah. `update` saja tidak cukup; pelanggan sendiri hanya bisa upgrade.
    actions: [
      "read",
      "create",
      "update",
      "delete",
      "site_only",
      "downgrade_paket",
    ],
    description: "Data pelanggan; downgrade paket = boleh turunkan paket",
  },
  reseller: {
    // Tanpa `site_only`/`department_only`: `Reseller` tidak punya `siteId`;
    // isolasinya hanya `tenantId`.
    actions: ["read", "create", "update", "delete"],
    description: "Reseller, outlet, kepatuhan izin/PKS, dan komisi",
  },

  // ====== SETTINGS ======
  umum: {
    actions: ["read", "update"],
    description: "Pengaturan umum",
  },
  logo: {
    actions: ["read", "update"],
    description: "Logo perusahaan",
  },
  email: {
    actions: ["read", "update"],
    description: "Pengaturan email",
  },
  whatsapp: {
    actions: ["read", "update"],
    description: "Pengaturan WhatsApp",
  },
  payment_gateway: {
    actions: ["read", "update"],
    description: "Pengaturan payment gateway",
  },
  invoice_contoh: {
    actions: ["read", "create", "update", "delete"],
    description: "Invoice contoh untuk demo dan contoh format",
  },
  api: {
    actions: ["read", "create", "update", "delete"],
    description: "API keys",
  },
  nada_dering: {
    actions: ["read"],
    description: "Pengaturan nada dering notifikasi",
  },

  // ====== OTHERS ======
  announcement: {
    // Tanpa `site_only`: model `Announcement` tidak punya `siteId` maupun relasi
    // ke `Sites`. Penargetannya lewat enum `target` dan `tenantId`; pembatasan
    // per-site butuh kolom/tabel baru lebih dulu.
    actions: ["read", "create", "update", "delete"],
    description: "Pengumuman",
  },
  support: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Support tickets",
  },
  finance: {
    actions: ["read", "site_only"],
    description: "Menu finance (parent)",
  },
  accounts: {
    actions: ["read", "create", "update", "delete"],
    description: "Buku kas dan rekening bank",
  },
  // `invoices`/`transactions`: `site_only` dibaca lewat
  // `INVOICE_SITE_ONLY_PERMISSIONS` (lib/api/financial-permissions.ts).
  invoices: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Invoice pelanggan",
  },
  transactions: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Transaksi keuangan",
  },
  manual_payments: {
    actions: ["read", "create", "update", "delete", "verify", "site_only"],
    description: "Verifikasi pembayaran manual",
  },
  expense: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Pengeluaran",
  },

  // ====== CHAT MODULE ======
  chat: {
    actions: ["read", "create"],
    description:
      "Fitur chat untuk komunikasi - read: baca pesan, create: kirim pesan",
  },
  broadcast: {
    actions: ["create"],
    description: "Kirim broadcast ke semua users",
  },

  // ====== APP VERSION ======
  app_version: {
    actions: ["read", "create", "update", "delete"],
    description: "Manajemen versi aplikasi mobile",
  },
  // ====== MARKETING MODULE ======
  marketing: {
    // Tanpa `site_only`: permission menu induk — tidak ada route yang dijaga
    // `marketing:read`. Datanya dilayani `sales`, `sales_dashboard`, dan
    // `canvasing`, yang ketiganya sudah menegakkan pembatasan site lewat
    // `User.siteId`.
    actions: ["read", "create", "update", "delete"],
    description: "Menu marketing (parent)",
  },
  coupon: {
    // Tanpa pembatasan lingkup: model `Coupon` tidak punya `siteId` maupun
    // relasi ke site, jadi `coupon:site_only` mustahil ditegakkan. Toggle yang
    // tidak bisa ditegakkan lebih berbahaya daripada tidak ada toggle — pemilik
    // role menyalakannya dan mengira datanya terbatas.
    actions: ["read", "create", "update", "delete"],
    description: "Manajemen kupon diskon",
  },
  canvasing: {
    actions: ["read", "create", "update", "delete", "verify", "site_only"], // 'verify' for approval/rejection
    description: "Request canvasing dari sales coverage",
  },
  sales_dashboard: {
    actions: ["read", "site_only"],
    description: "Dashboard performa sales dan canvasing team",
  },
  sales: {
    actions: ["read", "create", "update", "delete", "site_only"],
    description: "Manajemen user sales dan target",
  },
  presurvei: {
    // Tanpa `site_only`: pembatasan per-site presurvei belum ditegakkan kode
    // mana pun (Fase 3). Menampilkan togglenya membuat admin yakin pembatasan
    // itu nyata padahal no-op.
    actions: ["read", "create", "update", "delete"],
    description: "Kegiatan sales & marketing dan prospek presurvei",
  },
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
  presurvei_rencana: {
    // Tanpa `view_all` = kepala sales: hanya dirinya + anggota timnya
    // (`User.kepalaSalesId`). Dengan `view_all` = seluruh sales tenant.
    // Tidak ada `delete`: rencana dibatalkan (tercatat), tidak dihapus.
    actions: ["read", "create", "update", "view_all"],
    displayName: "Rencana & Penugasan",
    description:
      "Rencana kunjungan & penugasan sales; view_all = semua sales, tanpanya hanya tim sendiri",
  },

  // ====== MOBILE APP RESOURCES (m_*) ======
  m_dashboard: {
    actions: ["read"],
    displayName: "Beranda",
    description: "Akses menu Beranda di mobile app",
  },
  m_work_order: {
    actions: ["read", "create", "update"],
    displayName: "Work Order",
    description: "Lihat, ajukan, dan update Work Order",
  },
  m_barang_masuk: {
    actions: ["read", "create"],
    displayName: "Barang Masuk",
    description: "Input stok barang masuk ke gudang",
  },
  m_barang: {
    // `site_only` menjadi sumbu pembatasan gudang untuk seluruh inventory
    // mobile: pengambilan, pengembalian, dan daftar stok semuanya disaring
    // lewat `isInventorySiteRestricted`. Tanpa dicantumkan di sini, admin tidak
    // punya tombol untuk mematikannya walau pembatasannya nyata berlaku.
    actions: ["read", "site_only"],
    displayName: "Barang",
    description: "Lihat daftar barang & stok",
  },
  m_barang_keluar: {
    actions: ["read", "create"],
    displayName: "Barang Keluar",
    description: "Ambil stok untuk pasang/kerja",
  },
  m_absensi: {
    actions: ["read", "create"],
    displayName: "Absensi",
    description: "Check In / Check Out harian",
  },
  m_lembur: {
    actions: ["read", "create"],
    displayName: "Lembur",
    description: "Pengajuan lembur",
  },
  m_izin: {
    actions: ["read", "create"],
    displayName: "Izin & Cuti",
    description: "Pengajuan izin, sakit, dan cuti",
  },
  m_holidays: {
    actions: ["read"],
    displayName: "Kalender Libur",
    description: "Lihat hari libur nasional & perusahaan",
  },
  m_topology: {
    actions: ["read"],
    displayName: "Peta Jaringan",
    description: "Topology map jaringan",
  },
  m_canvasing: {
    // `cashout`: izinkan non-sales (mis. teknisi) mencairkan bonus canvasing.
    // Sales selalu boleh mencairkan tanpa izin ini.
    actions: ["read", "create", "cashout"],
    displayName: "Canvasing",
    description: "Marketing & sales canvasing; cashout = boleh cairkan bonus",
  },
  m_presurvei: {
    actions: ["read", "create", "update"],
    displayName: "Presurvei",
    description: "Catat kegiatan dan prospek presurvei dari mobile",
  },
  m_chat: {
    actions: ["read", "create"],
    displayName: "Chat",
    description: "Pesan & diskusi tim",
  },
  m_salary: {
    actions: ["read"],
    displayName: "Slip Gaji",
    description: "Lihat slip gaji bulanan",
  },
  m_partners: {
    actions: ["read"],
    displayName: "Partners",
    description: "Lihat daftar partner/mitra kerja",
  },
};

/**
 * Aksi untuk resource tanpa entri katalog: CRUD saja. Pembatasan lingkup tidak
 * pernah jatuh dari default — ia wajib dideklarasikan bersama penegakannya.
 */
const DEFAULT_RESOURCE_ACTIONS: readonly ResourceAction[] = [
  "read",
  "create",
  "update",
  "delete",
];

/**
 * Aksi yang tersedia (dan digambar matriks role) untuk sebuah resource.
 * Resource tanpa entri katalog mendapat CRUD tanpa toggle pembatasan.
 */
export function getResourceCapabilities(resource: string): ResourceAction[] {
  const capability = RESOURCE_CAPABILITIES[resource.toLowerCase()];
  if (capability) {
    return capability.actions;
  }
  return [...DEFAULT_RESOURCE_ACTIONS];
}

/**
 * Get human-readable display name for a resource.
 * Falls back to formatted resource name if not configured.
 */
export function getResourceDisplayName(resource: string): string {
  const capability = RESOURCE_CAPABILITIES[resource.toLowerCase()];
  if (capability?.displayName) {
    return capability.displayName;
  }
  return resource.replace(/^m_/, "").replace(/^k_/, "").replace(/_/g, " ");
}

/**
 * Check if an action is available for a resource
 */
export function isActionAvailable(
  resource: string,
  action: ResourceAction,
): boolean {
  const capabilities = getResourceCapabilities(resource);
  return capabilities.includes(action);
}

/**
 * Filter actions based on resource capabilities
 */
export function filterAvailableActions(
  resource: string,
  actions: ResourceAction[],
): ResourceAction[] {
  const capabilities = getResourceCapabilities(resource);
  return actions.filter((action) => capabilities.includes(action));
}
