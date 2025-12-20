
import {
    HiOutlineChartBar,
    HiOutlineGlobeAlt,
    HiOutlineServer,
    HiOutlinePresentationChartLine,
    HiOutlineDevicePhoneMobile,
    HiPlus,
    HiOutlineClipboard,
    HiOutlineBolt,
    HiOutlineLink,
    HiOutlineHome,
    HiOutlineMap,
    HiOutlineUsers,
    HiOutlineWifi,
    HiOutlineArchiveBox,
    HiOutlineSquares2X2,
    HiOutlineQueueList,
    HiOutlineDocument,
    HiOutlineShoppingCart,
    HiOutlineCircleStack, // Database replacement
    HiOutlineUser,
    HiOutlineArrowTrendingUp,
    HiOutlineCurrencyDollar,
    HiOutlineKey,
    HiOutlineCog6Tooth,
    HiOutlinePhoto,
    HiOutlineEnvelope,
    HiOutlineChatBubbleLeftRight,
    HiOutlineCodeBracket,
    HiOutlineClock,
    HiOutlineCalendar,
    HiOutlineUserGroup,
    HiOutlineWrench,
    HiOutlineCube,
    HiOutlineTruck,
    HiOutlineArrowDownTray,
    HiOutlineArrowUpTray,
    HiOutlineClipboardDocumentList,
    HiOutlineShieldCheck,
    HiOutlineDocumentText,
    HiOutlineMegaphone,
    HiOutlineBriefcase,
    HiOutlineCreditCard,
} from 'react-icons/hi2'
import React, { ReactNode } from 'react'

export type NavItem = {
    href: string
    label: string
    icon: ReactNode
    permission?: string
    children?: NavItem[]
    exact?: boolean
}

export const ADMIN_NAV_ITEMS: NavItem[] = [
    { href: '/admin', label: 'Dashboard', icon: <HiOutlineChartBar className="w-5 h-5" />, permission: 'DASHBOARD', exact: true },
    {
        href: '/admin/network',
        label: 'Network',
        icon: <HiOutlineGlobeAlt className="w-5 h-5" />,
        permission: 'NETWORK',
        children: [
            { href: '/admin/network/mikrotik', label: 'MikroTik', icon: <HiOutlineServer className="w-4 h-4" />, permission: 'MIKROTIK' },
            { href: '/admin/network/radius', label: 'RADIUS', icon: <HiOutlineKey className="w-4 h-4" />, permission: 'RADIUS' },
            { href: '/admin/network/olt', label: 'OLT', icon: <HiOutlinePresentationChartLine className="w-4 h-4" />, permission: 'OLT' },
            { href: '/admin/network/onu', label: 'All ONU', icon: <HiOutlineDevicePhoneMobile className="w-4 h-4" />, permission: 'ONU', exact: true },
            { href: '/admin/network/onu/new', label: 'Add ONU', icon: <HiPlus className="w-4 h-4" />, permission: 'ONU' },
            { href: '/admin/network/onutype', label: 'Onu Type', icon: <HiOutlineClipboard className="w-4 h-4" />, permission: 'ONUTYPE' },
            { href: '/admin/network/speedprofiles', label: 'Speed Profiles', icon: <HiOutlineBolt className="w-4 h-4" />, permission: 'SPEEDPROFILE' },
            { href: '/admin/network/vlan', label: 'VLAN', icon: <HiOutlineLink className="w-4 h-4" />, permission: 'VLAN' },
        ],
    },
    {
        href: '/admin/ftth',
        label: 'FTTH',
        icon: <HiOutlineWifi className="w-5 h-5" />,
        permission: 'FTTH',
        children: [
            { href: '/admin/ftth/otb', label: 'OTB', icon: <HiOutlineServer className="w-4 h-4" />, permission: 'OTB' },
            { href: '/admin/ftth/odc', label: 'ODC', icon: <HiOutlineArchiveBox className="w-4 h-4" />, permission: 'ODC' },
            { href: '/admin/ftth/odp', label: 'ODP', icon: <HiOutlineSquares2X2 className="w-4 h-4" />, permission: 'ODP' },
            { href: '/admin/ftth/closure', label: 'Join BOX/Closure', icon: <HiOutlineQueueList className="w-4 h-4" />, permission: 'CLOSURE' },
            { href: '/admin/ftth/pole', label: 'Pole/Tiang', icon: <HiOutlineBolt className="w-4 h-4" />, permission: 'POLE' },
            { href: '/admin/ftth/kmz', label: 'KMZ', icon: <HiOutlineDocument className="w-4 h-4" />, permission: 'KMZ' },
            { href: '/admin/ftth/map', label: 'Topology Map', icon: <HiOutlineMap className="w-4 h-4" />, permission: 'MAP' },
        ],
    },
    {
        href: '/admin/paket',
        label: 'Paket',
        icon: <HiOutlineShoppingCart className="w-5 h-5" />,
        permission: 'PAKET',
        children: [
            { href: '/admin/paket/bandwidth', label: 'Bandwidth', icon: <HiOutlineCircleStack className="w-4 h-4" />, permission: 'BANDWIDTH' },
            { href: '/admin/paket/profileppp', label: 'Profile PPP', icon: <HiOutlineUser className="w-4 h-4" />, permission: 'PROFILEPPP' },
            { href: '/admin/paket/harga', label: 'Harga Paket', icon: <HiOutlineCurrencyDollar className="w-4 h-4" />, permission: 'HARGA' },
        ],
    },
    {
        href: '/admin/pelanggan',
        label: 'Pelanggan',
        icon: <HiOutlineUsers className="w-5 h-5" />,
        permission: 'PELANGGAN',
        children: [
            { href: '/admin/pelanggan/ppp', label: 'Pelanggan PPP', icon: <HiOutlineUser className="w-4 h-4" />, permission: 'PPP' },
            { href: '/admin/registrations', label: 'Pendaftaran Baru', icon: <HiOutlineDocumentText className="w-4 h-4" />, permission: 'REGISTRATION' },
        ],
    },
    {
        href: '/admin/inventory',
        label: 'Inventory',
        icon: <HiOutlineCube className="w-5 h-5" />,
        permission: 'INVENTORY',
        children: [
            { href: '/admin/inventory', label: 'Dashboard', icon: <HiOutlineChartBar className="w-4 h-4" />, permission: 'INVENTORY', exact: true },
            { href: '/admin/inventory/barang', label: 'Barang', icon: <HiOutlineCube className="w-4 h-4" />, permission: 'BARANG' },
            { href: '/admin/inventory/masuk', label: 'Barang Masuk', icon: <HiOutlineArrowDownTray className="w-4 h-4" />, permission: 'MASUK' },
            { href: '/admin/inventory/keluar', label: 'Barang Keluar', icon: <HiOutlineArrowUpTray className="w-4 h-4" />, permission: 'KELUAR' },
            { href: '/admin/inventory/transfer', label: 'Transfer Antar Gudang', icon: <HiOutlineTruck className="w-4 h-4" />, permission: 'TRANSFER' },
            { href: '/admin/inventory/restock', label: 'Restock Management', icon: <HiOutlineArrowTrendingUp className="w-4 h-4" />, permission: 'RESTOCK' },
            { href: '/admin/inventory/opname', label: 'Stock Opname', icon: <HiOutlineClipboard className="w-4 h-4" />, permission: 'OPNAME' },
            { href: '/admin/inventory/gudang', label: 'Gudang', icon: <HiOutlineHome className="w-4 h-4" />, permission: 'GUDANG' },
        ],
    },
    { href: '/admin/users', label: 'Users', icon: <HiOutlineUsers className="w-5 h-5" />, permission: 'USER' },
    {
        href: '/admin/workorders',
        label: 'Work Orders',
        icon: <HiOutlineWrench className="w-5 h-5" />,
        permission: 'WORKORDERS',
        children: [
            { href: '/admin/workorders', label: 'Dashboard', icon: <HiOutlineChartBar className="w-4 h-4" />, permission: 'WORK_ORDER_DASHBOARD', exact: true },
            { href: '/admin/workorders/list', label: 'All Work Orders', icon: <HiOutlineClipboard className="w-4 h-4" />, permission: 'LIST' },
            { href: '/admin/workorders/sites', label: 'Sites', icon: <HiOutlineMap className="w-4 h-4" />, permission: 'SITE' },
            { href: '/admin/workorders/departments', label: 'Departments', icon: <HiOutlineUserGroup className="w-4 h-4" />, permission: 'DEPARTMENT' },
        ],
    },
    {
        href: '/admin/kehadiran',
        label: 'Kehadiran',
        icon: <HiOutlineClock className="w-5 h-5" />,
        permission: 'ATTENDANCE',
        children: [
            { href: '/admin/kehadiran/laporan', label: 'Laporan', icon: <HiOutlinePresentationChartLine className="w-4 h-4" />, permission: 'REPORT' },
            { href: '/admin/attendance', label: 'Absensi', icon: <HiOutlineClock className="w-4 h-4" />, permission: 'ATTENDANCE' },
            { href: '/admin/lembur', label: 'Lembur', icon: <HiOutlineBriefcase className="w-4 h-4" />, permission: 'LEMBUR' },
        ],
    },
    { href: '/admin/support', label: 'Dukungan', icon: <HiOutlineChatBubbleLeftRight className="w-5 h-5" />, permission: 'SUPPORT' },
    { href: '/admin/announcements', label: 'Pengumuman', icon: <HiOutlineMegaphone className="w-5 h-5" />, permission: 'ANNOUNCEMENT' },
    {
        href: '/admin/finance',
        label: 'Data Keuangan',
        icon: <HiOutlineCurrencyDollar className="w-5 h-5" />,
        permission: 'FINANCE',
        children: [
            { href: '/admin/finance/pendapatan-harian', label: 'Pendapatan Harian', icon: <HiOutlineDocumentText className="w-4 h-4" />, permission: 'DAILY_INCOME' },
            { href: '/admin/finance/pendapatan-periode', label: 'Pendapatan Periode', icon: <HiOutlineCalendar className="w-4 h-4" />, permission: 'PERIOD_INCOME' },
            { href: '/admin/finance/pengeluaran', label: 'Pengeluaran', icon: <HiOutlineCreditCard className="w-4 h-4" />, permission: 'EXPENSE' },
            { href: '/admin/finance/laba-rugi', label: 'Laba Rugi', icon: <HiOutlineChartBar className="w-4 h-4" />, permission: 'PROFIT_LOSS' },
        ],
    },
    {
        href: '/admin/pengaturan',
        label: 'Pengaturan',
        icon: <HiOutlineCog6Tooth className="w-5 h-5" />,
        permission: 'PENGATURAN',
        children: [
            { href: '/admin/pengaturan/umum', label: 'Umum', icon: <HiOutlineCog6Tooth className="w-4 h-4" />, permission: 'GENERAL' },
            { href: '/admin/pengaturan/logo', label: 'Logo Perusahaan', icon: <HiOutlinePhoto className="w-4 h-4" />, permission: 'LOGO' },
            { href: '/admin/pengaturan/email', label: 'Email', icon: <HiOutlineEnvelope className="w-4 h-4" />, permission: 'EMAIL' },
            { href: '/admin/pengaturan/whatsapp', label: 'WhatsApp', icon: <HiOutlineChatBubbleLeftRight className="w-4 h-4" />, permission: 'WHATSAPP' },
            { href: '/admin/settings/roles', label: 'Hak Akses & Role', icon: <HiOutlineShieldCheck className="w-4 h-4" />, permission: 'ROLES' },
            { href: '/admin/pengaturan/payment-gateway', label: 'Payment Gateway', icon: <HiOutlineCreditCard className="w-4 h-4" />, permission: 'PAYMENT_GATEWAY' },
            { href: '/admin/pengaturan/api', label: 'API', icon: <HiOutlineCodeBracket className="w-4 h-4" />, permission: 'API' },
        ]
    },
    {
        href: '/admin/log',
        label: 'System Log',
        icon: <HiOutlineClipboardDocumentList className="w-5 h-5" />,
        permission: 'SYSTEM_LOG',
        children: [
            { href: '/admin/log/login', label: 'Log Login', icon: <HiOutlineShieldCheck className="w-4 h-4" />, permission: 'LOGIN' },
            { href: '/admin/log/activity', label: 'Log Aktivitas', icon: <HiOutlineDocumentText className="w-4 h-4" />, permission: 'ACTIVITY' },
        ],
    },
]
