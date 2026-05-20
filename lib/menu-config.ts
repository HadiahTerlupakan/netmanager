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

export interface MenuConfig {
  code: string; // Unique identifier
  name: string; // Display name
  path: string | null; // Route path, null if only parent container
  icon?: string | undefined; // Icon name from react-icons/hi2 (optional)
  children?: MenuConfig[] | undefined; // Submenu items
  exact?: boolean | undefined; // Match path exactly (for dashboard routes)
  section?: string | undefined; // Section label for grouping
  divider?: boolean | undefined; // Show divider before this item
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

  // ═══════════════════════════════════════════
  // SDM & KEHADIRAN
  // ═══════════════════════════════════════════
  {
    code: "USERS",
    name: "Karyawan",
    path: "/admin/users",
    icon: "HiOutlineUsers",
    section: "SDM",
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
  },
  {
    code: "KEHADIRAN",
    name: "Kehadiran",
    path: "/admin/kehadiran",
    icon: "HiOutlineClipboardDocumentCheck",
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
    children: [
      {
        code: "SALARY.SALARY",
        name: "Daftar Gaji",
        path: "/admin/salary",
        icon: "HiOutlineClipboardDocumentList",
        exact: true,
      },
      {
        code: "SALARY.USERS",
        name: "Karyawan Digaji",
        path: "/admin/salary/users",
        icon: "HiOutlineUsers",
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
    ],
  },
  {
    code: "ACCOUNTING",
    name: "Akuntansi",
    path: "/admin/akuntansi",
    icon: "HiOutlineCalculator",
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

/**
 * Helper: Flatten menu config untuk list semua menu (parent + children)
 */
export function flattenMenuConfig(menus: MenuConfig[]): MenuConfig[] {
  const result: MenuConfig[] = [];
  for (const menu of menus) {
    result.push(menu);
    if (menu.children && menu.children.length > 0) {
      result.push(...flattenMenuConfig(menu.children));
    }
  }
  return result;
}

/**
 * Helper: Get all menu codes
 */
export function getAllMenuCodes(
  menus: MenuConfig[] = ADMIN_MENU_CONFIG,
): string[] {
  return flattenMenuConfig(menus).map((m) => m.code);
}

/**
 * Helper: Convert MenuConfig to format expected by PermissionMatrixEditor
 */
export function toPermissionMenuFormat(
  menus: MenuConfig[] = ADMIN_MENU_CONFIG,
) {
  return menus.map((menu) => ({
    id: menu.code,
    code: menu.code,
    name: menu.name,
    parentCode: null as string | null,
    path: menu.path,
    icon: (menu.icon || null) as string | null,
    sortOrder: 0,
    portal: "admin",
    children: menu.children?.map((child) => ({
      id: child.code,
      code: child.code,
      name: child.name,
      parentCode: menu.code as string | null,
      path: child.path,
      icon: (child.icon || null) as string | null,
      sortOrder: 0,
      portal: "admin",
    })),
  }));
}
