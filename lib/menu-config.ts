/**
 * Static Menu Configuration
 *
 * Fixed menu configuration for admin portal.
 * Used by:
 * - Sidebar (components/layout/Sidebar.tsx)
 *
 * HOW TO ADD NEW MENU:
 * 1. Tambahkan menu baru ke array ADMIN_MENU_CONFIG di bawah
 * 2. Format: { code: 'CODE', name: 'Display Name', path: '/admin/path', icon: 'IconName' }
 * 3. Untuk submenu, tambahkan property `children` dengan array submenu
 * 4. Restart aplikasi untuk melihat perubahan
 */

import type { FeatureModuleCode } from "@/lib/feature-modules";

export interface MenuConfig {
  code: string; // Unique identifier
  name: string; // Display name
  path: string | null; // Route path, null if only parent container
  icon?: string | undefined; // Icon name from react-icons/hi2 (optional)
  children?: MenuConfig[] | undefined; // Submenu items
  exact?: boolean | undefined; // Match path exactly (for dashboard routes)
  section?: string | undefined; // Section label for grouping
  divider?: boolean | undefined; // Show divider before this item
  superAdminOnly?: boolean | undefined; // Hide from non-super-admin users
  /**
   * Feature module yang harus aktif untuk tenant agar item ini muncul di sidebar.
   * Lihat `lib/feature-modules.ts` untuk daftar valid. Bila tidak diset → item
   * selalu muncul (independen dari tenant feature flag). Tag hanya menu utama
   * (parent); children mengikuti parent.
   */
  featureModule?: FeatureModuleCode | undefined;
  /**
   * Bila `true`, item ini hanya tampil ketika setting global
   * `FULL_RADIUS_MODE` aktif. Dipakai untuk modul accel-ppp yang
   * di-gating server-side oleh `requireFullRadiusMode()`.
   */
  requiresFullRadiusMode?: boolean | undefined;
}

/**
 * Admin Portal Menu Configuration
 *
 * Menu codes menggunakan format:
 * - Parent: 'NETWORK', 'FTTH', 'PELANGGAN', etc.
 * - Child: 'NETWORK.MIKROTIK', 'NETWORK.OLT', etc.
 *
 * Grouped by functional categories for better navigation
 */
export const ADMIN_MENU_CONFIG: MenuConfig[] = [
  // ═══════════════════════════════════════════
  // UTAMA
  // ═══════════════════════════════════════════
  {
    code: "DASHBOARD",
    name: "Dashboard",
    path: "/admin",
    icon: "HiOutlineChartBar",
    exact: true,
    section: "Utama",
  },

  // ═══════════════════════════════════════════
  // OPERASIONAL
  // ═══════════════════════════════════════════
  {
    code: "NETWORK",
    name: "Network",
    path: "/admin/network",
    icon: "HiOutlineGlobeAlt",
    section: "Operasional",
    featureModule: "network",
    children: [
      {
        code: "NETWORK.MAP",
        name: "Topology Map",
        path: "/admin/map",
        icon: "HiOutlineMap",
      },
      {
        code: "NETWORK.MIKROTIK",
        name: "MikroTik",
        path: "/admin/network/mikrotik",
        icon: "HiOutlineServer",
      },
      {
        code: "NETWORK.ACCEL_PPP",
        name: "Accel-PPP",
        path: "/admin/network/accel-ppp",
        icon: "HiOutlineCpuChip",
        requiresFullRadiusMode: true,
      },
      {
        code: "NETWORK.RADIUS",
        name: "RADIUS",
        path: "/admin/network/radius",
        icon: "HiOutlineKey",
      },
      {
        code: "NETWORK.ACS_DEVICES",
        name: "ONT Devices",
        path: "/admin/network/acs/devices",
        icon: "HiOutlineWifi",
      },
    ],
  },
  {
    code: "OLT",
    name: "OLT Management",
    path: "/admin/olt",
    icon: "HiOutlineServerStack",
    section: "Operasional",
    featureModule: "olt",
    children: [
      {
        code: "OLT.DEVICES",
        name: "Perangkat OLT",
        path: "/admin/olt/devices",
        icon: "HiOutlineServer",
      },
      {
        code: "OLT.ONU",
        name: "ONU",
        path: "/admin/olt/onu",
        icon: "HiOutlineWifi",
      },
      {
        code: "OLT.UNREGISTERED",
        name: "ONU Unregistered",
        path: "/admin/olt/onu/unregistered",
        icon: "HiOutlineExclamationCircle",
      },
      {
        code: "OLT.LOGS",
        name: "Command Logs",
        path: "/admin/olt/logs",
        icon: "HiOutlineDocumentText",
      },
      {
        code: "OLT.BANDWIDTH",
        name: "Bandwidth Profiles",
        path: "/admin/olt/bandwidth-profiles",
        icon: "HiOutlineArrowsRightLeft",
      },
      {
        code: "OLT.MONITORING",
        name: "Monitoring",
        path: "/admin/olt/monitoring",
        icon: "HiOutlineChartBar",
      },
      {
        code: "OLT.ALERTS",
        name: "Alerts",
        path: "/admin/olt/alerts",
        icon: "HiOutlineBellAlert",
      },
    ],
  },
  {
    code: "PAKET",
    name: "Paket Internet",
    path: "/admin/paket",
    icon: "HiOutlineWifi",
    children: [
      {
        code: "PAKET.BANDWIDTH",
        name: "Bandwidth",
        path: "/admin/paket/bandwidth",
        icon: "HiOutlineCircleStack",
      },
      {
        code: "PAKET.PROFILEPPP",
        name: "Profile PPP",
        path: "/admin/paket/profileppp",
        icon: "HiOutlineUser",
      },
      {
        code: "PAKET.HARGA",
        name: "Harga Paket",
        path: "/admin/paket/harga",
        icon: "HiOutlineCurrencyDollar",
      },
    ],
  },
  {
    code: "PELANGGAN",
    name: "Pelanggan",
    path: "/admin/pelanggan",
    icon: "HiOutlineUsers",
    featureModule: "pelanggan",
    children: [
      {
        code: "PELANGGAN.PPP",
        name: "Pelanggan PPP",
        path: "/admin/pelanggan/ppp",
        icon: "HiOutlineUser",
      },
      {
        code: "PELANGGAN.REGISTRATION",
        name: "Registrasi Baru",
        path: "/admin/registrations",
        icon: "HiOutlineClipboardDocumentCheck",
      },
    ],
  },
  {
    code: "WORKORDERS",
    name: "Work Orders",
    path: "/admin/workorders",
    icon: "HiOutlineWrench",
    featureModule: "work-order",
    children: [
      {
        code: "WORKORDERS.WORK_ORDER_DASHBOARD",
        name: "Dashboard",
        path: "/admin/workorders",
        icon: "HiOutlineChartBar",
        exact: true,
      },
      {
        code: "WORKORDERS.LIST",
        name: "Daftar WO",
        path: "/admin/workorders/list",
        icon: "HiOutlineClipboardDocumentList",
      },
      {
        code: "WORKORDERS.SITE",
        name: "Per Site",
        path: "/admin/workorders/sites",
        icon: "HiOutlineBuildingOffice",
      },
      {
        code: "WORKORDERS.DEPARTMENT",
        name: "Per Departemen",
        path: "/admin/workorders/departments",
        icon: "HiOutlineUserGroup",
      },
      {
        code: "WORKORDERS.SLA",
        name: "Aturan SLA",
        path: "/admin/workorders/slas",
        icon: "HiOutlineShieldCheck",
      },
    ],
  },

  // ═══════════════════════════════════════════
  // INVENTORY & PROCUREMENT
  // ═══════════════════════════════════════════
  {
    code: "INVENTORY",
    name: "Inventory",
    path: "/admin/inventory",
    icon: "HiOutlineCube",
    section: "Inventaris",
    featureModule: "inventory",
    children: [
      {
        code: "INVENTORY.INVENTORY",
        name: "Dashboard",
        path: "/admin/inventory",
        icon: "HiOutlineChartBar",
        exact: true,
      },
      {
        code: "INVENTORY.BARANG",
        name: "Master Barang",
        path: "/admin/inventory/barang",
        icon: "HiOutlineCube",
      },
      {
        code: "INVENTORY.GUDANG",
        name: "Gudang",
        path: "/admin/inventory/gudang",
        icon: "HiOutlineHome",
      },
      {
        code: "INVENTORY.MASUK",
        name: "Barang Masuk",
        path: "/admin/inventory/masuk",
        icon: "HiOutlineArrowDownTray",
      },
      {
        code: "INVENTORY.KELUAR",
        name: "Barang Keluar",
        path: "/admin/inventory/keluar",
        icon: "HiOutlineArrowUpTray",
      },
      {
        code: "INVENTORY.TRANSFER",
        name: "Transfer Gudang",
        path: "/admin/inventory/transfer",
        icon: "HiOutlineTruck",
      },
      {
        code: "INVENTORY.OPNAME",
        name: "Stock Opname",
        path: "/admin/inventory/opname",
        icon: "HiOutlineClipboard",
      },
      {
        code: "INVENTORY.RESTOCK",
        name: "Restock",
        path: "/admin/inventory/restock",
        icon: "HiOutlineArrowTrendingUp",
      },
    ],
  },

  // ───────────────────────── Procurement ─────────────────────────
  // Sub-modul terpisah dari Inventory karena fokus ke pengadaan eksternal:
  // supplier, PO, GRN, RTV, approval threshold. Code child dipakai
  // resolver permission (`split(".").pop()`) untuk cek `<resource>:read`.
  {
    code: "PROCUREMENT",
    name: "Procurement",
    path: "/admin/procurement",
    icon: "HiOutlineShoppingCart",
    section: "Inventaris",
    featureModule: "inventory",
    children: [
      {
        code: "PROCUREMENT.PROCUREMENT",
        name: "Dashboard",
        path: "/admin/procurement",
        icon: "HiOutlineChartBar",
        exact: true,
      },
      {
        code: "PROCUREMENT.SUPPLIER",
        name: "Master Supplier",
        path: "/admin/procurement/suppliers",
        icon: "HiOutlineUserGroup",
      },
      {
        code: "PROCUREMENT.PURCHASE_REQUESTS",
        name: "Purchase Request",
        path: "/admin/procurement/purchase-requests",
        icon: "HiOutlineClipboardDocumentList",
      },
      {
        code: "PROCUREMENT.PURCHASE_ORDERS",
        name: "Purchase Order",
        path: "/admin/procurement/purchase-orders",
        icon: "HiOutlineDocumentText",
      },
      {
        code: "PROCUREMENT.GOODS_RECEIPT",
        name: "Goods Receipt",
        path: "/admin/procurement/goods-receipts",
        icon: "HiOutlineInbox",
      },
      {
        code: "PROCUREMENT.GOODS_RETURN",
        name: "Retur Vendor",
        path: "/admin/procurement/goods-returns",
        icon: "HiOutlineArrowUturnLeft",
      },
      {
        code: "PROCUREMENT.MARKET_PRICE",
        name: "Referensi Harga",
        path: "/admin/procurement/market-price",
        icon: "HiOutlineCurrencyDollar",
      },
      {
        code: "PROCUREMENT.APPROVAL_THRESHOLDS",
        name: "Approval Threshold",
        path: "/admin/procurement/approval-thresholds",
        icon: "HiOutlineShieldCheck",
      },
    ],
  },

  // ═══════════════════════════════════════════
  // SDM & KEHADIRAN
  // ═══════════════════════════════════════════
  {
    code: "USERS",
    name: "Karyawan",
    path: "/admin/users",
    icon: "HiOutlineUsers",
    section: "SDM",
    featureModule: "users",
  },
  {
    code: "MITRA",
    name: "Mitra",
    path: "/admin/mitra",
    icon: "HiOutlineUserGroup",
    children: [
      {
        code: "MITRA.LIST",
        name: "Daftar Mitra",
        path: "/admin/mitra",
        icon: "HiOutlineUsers",
        exact: true,
      },
      {
        code: "MITRA.WITHDRAWALS",
        name: "Penarikan Komisi",
        path: "/admin/mitra/withdrawals",
        icon: "HiOutlineBanknotes",
      },
    ],
  },
  {
    code: "INVESTORS",
    name: "Investor",
    path: "/admin/investors",
    icon: "HiOutlineBriefcase",
    featureModule: "investor",
    children: [
      {
        code: "INVESTORS.LIST",
        name: "Daftar Investor",
        path: "/admin/investors",
        icon: "HiOutlineUsers",
        exact: true,
      },
      {
        code: "INVESTORS.DEPOSITS",
        name: "Setoran Masuk",
        path: "/admin/investors/deposits",
        icon: "HiOutlineBanknotes",
      },
      {
        code: "INVESTORS.PROFIT_SHARES",
        name: "Bagi Hasil",
        path: "/admin/investors/profit-shares",
        icon: "HiOutlineChartPie",
      },
    ],
  },
  {
    code: "KEHADIRAN",
    name: "Kehadiran",
    path: "/admin/kehadiran",
    icon: "HiOutlineClipboardDocumentCheck",
    featureModule: "attendance",
    children: [
      {
        code: "KEHADIRAN.REPORT",
        name: "Laporan",
        path: "/admin/kehadiran/laporan",
        icon: "HiOutlineDocumentText",
      },
      {
        code: "KEHADIRAN.ATTENDANCE",
        name: "Data Absensi",
        path: "/admin/attendance",
        icon: "HiOutlineClipboardDocumentList",
      },
      {
        code: "KEHADIRAN.LIVE_TRACKING",
        name: "Live Tracking",
        path: "/admin/kehadiran/live-map",
        icon: "HiOutlineMapPin",
      },
      {
        code: "KEHADIRAN.SHIFT",
        name: "Shift Kerja",
        path: "/admin/kehadiran/shift",
        icon: "HiOutlineArrowPath",
      },
      {
        code: "KEHADIRAN.LEMBUR",
        name: "Lembur",
        path: "/admin/lembur",
        icon: "HiOutlineClock",
      },
      {
        code: "KEHADIRAN.IZIN",
        name: "Izin & Cuti",
        path: "/admin/kehadiran/izin",
        icon: "HiOutlineClipboardDocumentCheck",
      },
      {
        code: "KEHADIRAN.HOLIDAY",
        name: "Hari Libur",
        path: "/admin/kehadiran/holidays",
        icon: "HiOutlineCalendar",
      },
    ],
  },
  {
    code: "SALARY",
    name: "Penggajian",
    path: "/admin/salary",
    icon: "HiOutlineCurrencyDollar",
    featureModule: "salary",
    children: [
      {
        code: "SALARY.SALARY",
        name: "Daftar Gaji",
        path: "/admin/salary",
        icon: "HiOutlineClipboardDocumentList",
        exact: true,
      },
      {
        code: "SALARY.PROFILES",
        name: "Profil Karyawan",
        path: "/admin/salary/profiles",
        icon: "HiOutlineUserGroup",
      },
      {
        code: "SALARY.COMPONENTS",
        name: "Komponen Gaji",
        path: "/admin/salary/components",
        icon: "HiOutlineCog6Tooth",
      },
      {
        code: "SALARY.CONFIG",
        name: "Konfigurasi",
        path: "/admin/salary/config",
        icon: "HiOutlineAdjustmentsHorizontal",
      },
    ],
  },

  // ═══════════════════════════════════════════
  // PEMASARAN
  // ═══════════════════════════════════════════
  {
    code: "MARKETING",
    name: "Marketing",
    path: "/admin/marketing",
    icon: "HiOutlineMegaphone",
    section: "Pemasaran",
    featureModule: "marketing",
    children: [
      {
        code: "MARKETING.SALES_DASHBOARD",
        name: "Dashboard",
        path: "/admin/marketing/sales-dashboard",
        icon: "HiOutlineChartBar",
      },
      {
        code: "MARKETING.SALES",
        name: "Tim Sales",
        path: "/admin/marketing/sales",
        icon: "HiOutlineUsers",
      },
      {
        code: "MARKETING.CANVASING",
        name: "Canvasing",
        path: "/admin/marketing/canvasing",
        icon: "HiOutlineClipboardDocumentList",
      },
      {
        code: "MARKETING.COUPON",
        name: "Kupon",
        path: "/admin/marketing/coupons",
        icon: "HiOutlineTicket",
      },
    ],
  },
  {
    code: "ANNOUNCEMENT",
    name: "Pengumuman",
    path: "/admin/announcement",
    icon: "HiOutlineSpeakerWave",
  },

  // ═══════════════════════════════════════════
  // KEUANGAN
  // ═══════════════════════════════════════════
  {
    code: "FINANCE",
    name: "Keuangan",
    path: "/admin/finance",
    icon: "HiOutlineBuildingLibrary",
    section: "Keuangan",
    featureModule: "finance",
    children: [
      {
        code: "FINANCE.ACCOUNTS",
        name: "Kas & Bank",
        path: "/admin/finance/accounts",
        icon: "HiOutlineBuildingLibrary",
      },
      {
        code: "FINANCE.MANUAL_PAYMENTS",
        name: "Verifikasi Manual",
        path: "/admin/finance/manual-payments",
        icon: "HiOutlineShieldCheck",
      },
      {
        code: "FINANCE.AR_AGING",
        name: "AR Aging",
        path: "/admin/finance/ar-aging",
        icon: "HiOutlineChartBar",
      },
      {
        code: "FINANCE.EXECUTIVE",
        name: "Executive Dashboard",
        path: "/admin/finance/executive",
        icon: "HiOutlinePresentationChartLine",
      },
    ],
  },
  {
    code: "ACCOUNTING",
    name: "Akuntansi",
    path: "/admin/akuntansi",
    icon: "HiOutlineCalculator",
    featureModule: "accounting",
    children: [
      {
        code: "ACCOUNTING.JOURNAL",
        name: "Jurnal",
        path: "/admin/akuntansi/jurnal",
        icon: "HiOutlineDocumentText",
      },
      {
        code: "ACCOUNTING.COA",
        name: "Chart of Accounts",
        path: "/admin/akuntansi/coa",
        icon: "HiOutlineListBullet",
      },
      {
        code: "ACCOUNTING.PERIOD",
        name: "Periode",
        path: "/admin/akuntansi/periode",
        icon: "HiOutlineCalendarDays",
      },
      {
        code: "ACCOUNTING.RECONCILIATION",
        name: "Rekonsiliasi",
        path: "/admin/akuntansi/rekonsiliasi",
        icon: "HiOutlineScale",
      },
      {
        code: "ACCOUNTING.REPORTS",
        name: "Laporan",
        path: "/admin/akuntansi/laporan",
        icon: "HiOutlineChartPie",
      },
    ],
  },
  {
    code: "TAX",
    name: "Pajak",
    path: "/admin/pajak",
    icon: "HiOutlineReceiptPercent",
    featureModule: "tax",
    children: [
      {
        code: "TAX.DASHBOARD",
        name: "Dashboard Pajak",
        path: "/admin/pajak",
        icon: "HiOutlineChartBar",
        exact: true,
      },
      {
        code: "TAX.CONFIG",
        name: "Konfigurasi",
        path: "/admin/pajak/konfigurasi",
        icon: "HiOutlineCog6Tooth",
      },
      {
        code: "TAX.TRANSACTIONS",
        name: "Transaksi Pajak",
        path: "/admin/pajak/transaksi",
        icon: "HiOutlineDocumentText",
      },
      {
        code: "TAX.BHP_USO",
        name: "BHP & USO",
        path: "/admin/pajak/bhp-uso",
        icon: "HiOutlinePresentationChartBar",
      },
      {
        code: "TAX.EXPORT",
        name: "Export Laporan",
        path: "/admin/pajak/export",
        icon: "HiOutlineArrowDownTray",
      },
    ],
  },

  // ═══════════════════════════════════════════
  // KOMUNIKASI
  // ═══════════════════════════════════════════
  {
    code: "SUPPORT",
    name: "Tiket Support",
    path: "/admin/support",
    icon: "HiOutlineChatBubbleLeftRight",
    section: "Komunikasi",
  },
  {
    code: "CHAT",
    name: "Chat",
    path: "/admin/chat",
    icon: "HiOutlineChatBubbleLeftRight",
    featureModule: "chat",
  },

  // ═══════════════════════════════════════════
  // WEBSITE (Super Admin Only)
  // ═══════════════════════════════════════════
  {
    code: "WEBSITE",
    name: "Website",
    path: null,
    icon: "HiOutlineGlobeAlt",
    section: "Website",
    superAdminOnly: true,
    children: [
      { code: "WEBSITE.HERO", name: "Hero", path: "/admin/website/hero" },
      { code: "WEBSITE.FITUR", name: "Fitur", path: "/admin/website/fitur" },
      {
        code: "WEBSITE.PRICING",
        name: "Pricing",
        path: "/admin/website/pricing",
      },
      {
        code: "WEBSITE.TESTIMONIAL",
        name: "Testimonial",
        path: "/admin/website/testimonial",
      },
      { code: "WEBSITE.FAQ", name: "FAQ", path: "/admin/website/faq" },
      {
        code: "WEBSITE.FOOTER",
        name: "Footer",
        path: "/admin/website/footer",
      },
    ],
  },

  // ═══════════════════════════════════════════
  // SISTEM
  // ═══════════════════════════════════════════
  {
    code: "TENANT",
    name: "Tenants",
    path: "/admin/tenants",
    icon: "HiOutlineBuildingOffice",
    section: "Sistem",
  },
  {
    code: "INTEGRATION",
    name: "Integrasi",
    path: "/admin/integrations",
    icon: "HiOutlineArrowsRightLeft",
    section: "Sistem",
    featureModule: "integrations",
    children: [
      {
        code: "INTEGRATION.MIXRADIUS",
        name: "MixRadius",
        path: "/admin/integrations/mixradius",
        icon: "HiOutlineCloud",
      },
      {
        code: "INTEGRATION.MIXRADIUS_ISOLIR",
        name: "Isolir",
        path: "/admin/integrations/mixradius/isolir",
        icon: "HiOutlineNoSymbol",
      },
      {
        code: "INTEGRATION.MIXRADIUS_SITES",
        name: "Sites",
        path: "/admin/integrations/mixradius/groups",
        icon: "HiOutlineBuildingOffice",
      },
      {
        code: "INTEGRATION.MIXRADIUS_INVESTOR_SITES",
        name: "Site Investor",
        path: "/admin/integrations/mixradius/investor-sites",
        icon: "HiOutlineCurrencyDollar",
      },
      {
        code: "INTEGRATION.MIXRADIUS_ACCOUNTS",
        name: "Akun",
        path: "/admin/integrations/mixradius/accounts",
        icon: "HiOutlineServer",
      },
      {
        code: "INTEGRATION.MIXRADIUS_INCOME",
        name: "Pendapatan",
        path: "/admin/integrations/mixradius/income-period",
        icon: "HiOutlineCurrencyDollar",
      },
      {
        code: "INTEGRATION.MIXRADIUS_EXPENSES",
        name: "Pengeluaran",
        path: "/admin/integrations/mixradius/expenses",
        icon: "HiOutlineCreditCard",
      },
      {
        code: "INTEGRATION.MIXRADIUS_PROFIT_LOSS",
        name: "Laba Rugi",
        path: "/admin/integrations/mixradius/profit-loss",
        icon: "HiOutlineChartBar",
      },
    ],
  },
  {
    code: "PENGATURAN",
    name: "Pengaturan",
    path: "/admin/pengaturan",
    icon: "HiOutlineCog6Tooth",
    children: [
      {
        code: "PENGATURAN.UMUM",
        name: "Umum",
        path: "/admin/pengaturan/umum",
        icon: "HiOutlineCog6Tooth",
      },
      {
        code: "PENGATURAN.ROLES",
        name: "Hak Akses",
        path: "/admin/pengaturan/hak-akses",
        icon: "HiOutlineShieldCheck",
      },
      {
        code: "PENGATURAN.LOGO",
        name: "Logo",
        path: "/admin/pengaturan/logo",
        icon: "HiOutlinePhoto",
      },
      {
        code: "PENGATURAN.EMAIL",
        name: "Email",
        path: "/admin/pengaturan/email",
        icon: "HiOutlineEnvelope",
      },
      {
        code: "PENGATURAN.WHATSAPP",
        name: "WhatsApp",
        path: "/admin/pengaturan/whatsapp",
        icon: "HiOutlineChatBubbleLeftRight",
      },
      {
        code: "PENGATURAN.PAYMENT_GATEWAY",
        name: "Payment",
        path: "/admin/pengaturan/payment-gateway",
        icon: "HiOutlineCreditCard",
      },
      {
        code: "PENGATURAN.API",
        name: "API",
        path: "/admin/pengaturan/api",
        icon: "HiOutlineCodeBracket",
      },
      {
        code: "PENGATURAN.NADA_DERING",
        name: "Nada Dering",
        path: "/admin/pengaturan/nada-dering",
        icon: "HiOutlineSpeakerWave",
      },
      {
        code: "PENGATURAN.ACS",
        name: "ACS & Vendor",
        path: "/admin/pengaturan/acs",
        icon: "HiOutlineServerStack",
      },
      {
        code: "PENGATURAN.APP_VERSION",
        name: "Update Aplikasi",
        path: "/admin/pengaturan/app-update",
        icon: "HiOutlineDevicePhoneMobile",
      },
      {
        code: "PENGATURAN.BACKUP_DATABASE",
        name: "Backup Database",
        path: "/admin/pengaturan/backup",
        icon: "HiOutlineCircleStack",
      },
    ],
  },
  {
    code: "SYSTEM_LOG",
    name: "Log Sistem",
    path: "/admin/log",
    icon: "HiOutlineClipboardDocumentList",
    children: [
      {
        code: "SYSTEM_LOG.LOGIN",
        name: "Log Login",
        path: "/admin/log/login",
        icon: "HiOutlineShieldCheck",
      },
      {
        code: "SYSTEM_LOG.ACTIVITY",
        name: "Log Aktivitas",
        path: "/admin/log/activity",
        icon: "HiOutlineDocumentText",
      },
    ],
  },
];

export const EMPLOYEE_MENU_CONFIG: MenuConfig[] = [
  {
    code: "DASHBOARD",
    name: "Beranda",
    path: "/karyawan/dashboard",
    icon: "HiOutlineHome",
    exact: true,
  },
  {
    code: "WORK_ORDER",
    name: "Work Order",
    path: "/karyawan/work-order",
    icon: "HiOutlineClipboard",
  },
  {
    code: "INVENTORY",
    name: "Barang",
    path: "/karyawan/barang",
    icon: "HiOutlineCube",
  },
  {
    code: "ATTENDANCE",
    name: "Absensi",
    path: "/karyawan/absensi",
    icon: "HiOutlineQrCode",
  },
  {
    code: "PROFILE",
    name: "Profil",
    path: "/karyawan/profil",
    icon: "HiOutlineUser",
  },
];

export {
  flattenMenuConfig,
  getAllMenuCodes,
  toPermissionMenuFormat,
} from "./menu-config-helpers";
