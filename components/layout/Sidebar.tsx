"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  FiBarChart,
  FiGlobe,
  FiServer,
  FiActivity,
  FiSmartphone,
  FiPlus,
  FiClipboard,
  FiZap,
  FiLink,
  FiHome,
  FiMap,
  FiUsers,
  FiChevronRight,
  FiChevronDown,
  FiWifi,
  FiArchive,
  FiGrid,
  FiLayers,
  FiFile,
  FiShoppingCart,
  FiDatabase,
  FiUser,
  FiDollarSign,
  FiTrendingUp,
  FiCreditCard,
  FiKey,
  FiSettings,
  FiImage,
  FiMail,
  FiMessageSquare,
  FiCode,
  FiShield,
  FiClock,
  FiCalendar,
  FiUser as FiUserGroup,
  FiHelpCircle,
  FiTool,
  FiBox,
  FiTruck,
  FiDownload,
  FiUpload,
  FiFileText,
} from 'react-icons/fi'
import { useSettings } from '@/hooks/useSettings'
import { useSession } from 'next-auth/react'
import { useEmployeePermissions } from '@/components/providers/EmployeePermissionContext'
import { getAllFeatures } from '@/lib/utils/permissions'

type NavItem = {
  href: string
  label: string
  icon: ReactNode
  permission?: string
  children?: NavItem[]
}

export default function Sidebar() {
  const pathname = usePathname()
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set())
  const { settings } = useSettings()
  const { data: session } = useSession()
  const { permissions, isAdmin } = useEmployeePermissions()
  const appName = settings?.namaAplikasi || 'NetManager'

  // Get user permissions from EmployeePermissionContext
  const userPermissions = useMemo(() => {
    // ADMIN users get all features
    if (isAdmin()) {
      return getAllFeatures()
    }

    // Use permissions from EmployeePermissionContext (includes custom roles)
    if (permissions?.allowedFeatures && permissions.allowedFeatures.length > 0) {
      return permissions.allowedFeatures
    }

    // Fallback for base roles without custom role assignments
    if (session?.user?.role === 'HR') {
      return ['DASHBOARD', 'USERS', 'HELPDESK', 'HRIS']
    }
    if (session?.user?.role === 'FINANCE') {
      return ['DASHBOARD', 'FINANCE']
    }

    return ['DASHBOARD'] // Default permissions
  }, [permissions, session, isAdmin])

  // Filter menu items based on permissions
  const filterNavItem = (item: NavItem): NavItem | null => {
    // If item has no permission requirement, show it
    if (!item.permission) {
      // Filter children if exist
      if (item.children) {
        const filteredChildren = item.children
          .map(filterNavItem)
          .filter((child): child is NavItem => child !== null)

        // Only show parent if it has visible children or no permission requirement
        if (filteredChildren.length > 0) {
          return { ...item, children: filteredChildren }
        }
      }
      return item
    }

    // Check if user has permission for this menu
    if (userPermissions.includes(item.permission)) {
      // Filter children if exist
      if (item.children) {
        const filteredChildren = item.children
          .map(filterNavItem)
          .filter((child): child is NavItem => child !== null)

        return { ...item, children: filteredChildren }
      }
      return item
    }

    return null
  }

  const allNavItems: NavItem[] = [
    { href: '/admin', label: 'Dashboard', icon: <FiBarChart className="w-5 h-5" />, permission: 'DASHBOARD' },
    { href: '/admin/roles', label: 'Roles', icon: <FiShield className="w-5 h-5" />, permission: 'ROLES' },
    {
      href: '/admin/network',
      label: 'Network',
      icon: <FiGlobe className="w-5 h-5" />,
      permission: 'NETWORK',
      children: [
        { href: '/admin/network/mikrotik', label: 'MikroTik', icon: <FiServer className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/radius', label: 'RADIUS', icon: <FiKey className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/network/olt', label: 'OLT', icon: <FiActivity className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/network/onu', label: 'All ONU', icon: <FiSmartphone className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/network/onu/new', label: 'Add ONU', icon: <FiPlus className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/network/onutype', label: 'Onu Type', icon: <FiClipboard className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/network/speedprofiles', label: 'Speed Profiles', icon: <FiZap className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/network/vlan', label: 'VLAN', icon: <FiLink className="w-4 h-4" />, permission: 'NETWORK' },
      ],
    },
    {
      href: '/admin/ftth',
      label: 'FTTH',
      icon: <FiWifi className="w-5 h-5" />,
      permission: 'FTTH',
      children: [
        { href: '/admin/ftth/otb', label: 'OTB', icon: <FiServer className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/ftth/odc', label: 'ODC', icon: <FiArchive className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/ftth/odp', label: 'ODP', icon: <FiGrid className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/ftth/closure', label: 'Join BOX/Closure', icon: <FiLayers className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/ftth/pole', label: 'Pole/Tiang', icon: <FiZap className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/ftth/kmz', label: 'KMZ', icon: <FiFile className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/ftth/map', label: 'Topology Map', icon: <FiMap className="w-4 h-4" />, permission: 'NETWORK' },
      ],
    },
    {
      href: '/admin/paket',
      label: 'Paket',
      icon: <FiShoppingCart className="w-5 h-5" />,
      permission: 'PAKET',
      children: [
        { href: '/admin/paket/bandwidth', label: 'Bandwidth', icon: <FiDatabase className="w-4 h-4" />, permission: 'PELANGGAN' },
        { href: '/admin/paket/profileppp', label: 'Profile PPP', icon: <FiUser className="w-4 h-4" />, permission: 'PELANGGAN' },
        { href: '/admin/paket/harga', label: 'Harga Paket', icon: <FiDollarSign className="w-4 h-4" />, permission: 'PELANGGAN' },
      ],
    },
    {
      href: '/admin/pelanggan',
      label: 'Pelanggan',
      icon: <FiUsers className="w-5 h-5" />,
      permission: 'PELANGGAN',
      children: [
        { href: '/admin/pelanggan/ppp', label: 'Pelanggan PPP', icon: <FiUser className="w-4 h-4" />, permission: 'PELANGGAN' },
      ],
    },
    {
      href: '/admin/inventory',
      label: 'Inventory',
      icon: <FiBox className="w-5 h-5" />,
      permission: 'INVENTORY',
      children: [
        { href: '/admin/inventory', label: 'Dashboard', icon: <FiBarChart className="w-4 h-4" />, permission: 'INVENTORY' },
        { href: '/admin/inventory/barang', label: 'Barang', icon: <FiBox className="w-4 h-4" />, permission: 'INVENTORY' },
        { href: '/admin/inventory/masuk', label: 'Barang Masuk', icon: <FiDownload className="w-4 h-4" />, permission: 'INVENTORY' },
        { href: '/admin/inventory/keluar', label: 'Barang Keluar', icon: <FiUpload className="w-4 h-4" />, permission: 'INVENTORY' },
        { href: '/admin/inventory/transfer', label: 'Transfer Antar Gudang', icon: <FiTruck className="w-4 h-4" />, permission: 'INVENTORY' },
        { href: '/admin/inventory/restock', label: 'Restock Management', icon: <FiTrendingUp className="w-4 h-4" />, permission: 'INVENTORY' },
        { href: '/admin/inventory/opname', label: 'Stock Opname', icon: <FiClipboard className="w-4 h-4" />, permission: 'INVENTORY' },
        { href: '/admin/inventory/gudang', label: 'Gudang', icon: <FiHome className="w-4 h-4" />, permission: 'INVENTORY' },
      ],
    },
    { href: '/admin/users', label: 'Users', icon: <FiUsers className="w-5 h-5" />, permission: 'USERS' },
    {
      href: '/admin/helpdesk',
      label: 'Helpdesk',
      icon: <FiHelpCircle className="w-5 h-5" />,
      permission: 'HELPDESK',
      children: [
        { href: '/admin/helpdesk', label: 'Dashboard', icon: <FiBarChart className="w-4 h-4" />, permission: 'HELPDESK' },
        { href: '/admin/helpdesk/tiket', label: 'Semua Tiket', icon: <FiHelpCircle className="w-4 h-4" />, permission: 'HELPDESK' },
      ],
    },
    {
      href: '/admin/workorders',
      label: 'Work Orders',
      icon: <FiTool className="w-5 h-5" />,
      permission: 'WORKORDERS',
      children: [
        { href: '/admin/workorders', label: 'Dashboard', icon: <FiBarChart className="w-4 h-4" />, permission: 'WORKORDERS' },
        { href: '/admin/workorders/list', label: 'All Work Orders', icon: <FiClipboard className="w-4 h-4" />, permission: 'WORKORDERS' },
      ],
    },
    {
      href: '/admin/hris',
      label: 'HRIS',
      icon: <FiUserGroup className="w-5 h-5" />,
      permission: 'HRIS',
      children: [
        { href: '/admin/hris', label: 'Dashboard', icon: <FiBarChart className="w-4 h-4" />, permission: 'HRIS' },
        { href: '/admin/hris/departments', label: 'Departments', icon: <FiHome className="w-4 h-4" />, permission: 'HRIS' },

        { href: '/admin/hris/attendance', label: 'Attendance', icon: <FiClock className="w-4 h-4" />, permission: 'HRIS' },
        { href: '/admin/hris/leaves', label: 'Leave Management', icon: <FiCalendar className="w-4 h-4" />, permission: 'HRIS' },
        { href: '/admin/hris/payroll', label: 'Payroll', icon: <FiTrendingUp className="w-4 h-4" />, permission: 'HRIS' },
      ],
    },
    {
      href: '/admin/finance',
      label: 'Finance',
      icon: <FiDollarSign className="w-5 h-5" />,
      permission: 'FINANCE',
      children: [
        { href: '/admin/finance/tagihan', label: 'Tagihan', icon: <FiFileText className="w-4 h-4" />, permission: 'FINANCE' },
        { href: '/admin/finance/cashflow', label: 'Cashflow & Pengeluaran', icon: <FiTrendingUp className="w-4 h-4" />, permission: 'FINANCE' },
        { href: '/admin/finance/bank-accounts', label: 'Rekening Bank', icon: <FiTrendingUp className="w-4 h-4" />, permission: 'FINANCE' },
      ]
    },
    {
      href: '/admin/pengaturan',
      label: 'Pengaturan',
      icon: <FiSettings className="w-5 h-5" />,
      permission: 'PENGATURAN',
      children: [
        { href: '/admin/pengaturan/umum', label: 'Umum', icon: <FiSettings className="w-4 h-4" />, permission: 'PENGATURAN' },
        { href: '/admin/pengaturan/logo', label: 'Logo Perusahaan', icon: <FiImage className="w-4 h-4" />, permission: 'PENGATURAN' },
        { href: '/admin/pengaturan/email', label: 'Email', icon: <FiMail className="w-4 h-4" />, permission: 'PENGATURAN' },
        { href: '/admin/pengaturan/whatsapp', label: 'WhatsApp', icon: <FiMessageSquare className="w-4 h-4" />, permission: 'PENGATURAN' },
        { href: '/admin/pengaturan/oauth', label: 'OAuth', icon: <FiKey className="w-4 h-4" />, permission: 'PENGATURAN' },
        { href: '/admin/pengaturan/payment-gateway', label: 'Payment Gateway', icon: <FiCreditCard className="w-4 h-4" />, permission: 'PENGATURAN' },
        { href: '/admin/pengaturan/api', label: 'API', icon: <FiCode className="w-4 h-4" />, permission: 'PENGATURAN' },
      ]
    },
  ]

  const navItems = useMemo(() => {
    return allNavItems
      .map(filterNavItem)
      .filter((item): item is NavItem => item !== null)
  }, [allNavItems, userPermissions])

  // Auto-expand menu jika pathname aktif (only on pathname change)
  useEffect(() => {
    const menusToExpand: string[] = []
    navItems.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some(
          (child) => pathname === child.href || pathname?.startsWith(child.href + '/')
        )
        if (hasActiveChild && !expandedMenus.has(item.href)) {
          menusToExpand.push(item.href)
        }
      }
    })
    // Only update if there are new menus to expand
    if (menusToExpand.length > 0) {
      setExpandedMenus((prev) => {
        const newSet = new Set(prev)
        menusToExpand.forEach(href => newSet.add(href))
        return newSet
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]) // Only depend on pathname, not navItems

  const toggleMenu = (href: string) => {
    setExpandedMenus((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(href)) {
        newSet.delete(href)
      } else {
        newSet.add(href)
      }
      return newSet
    })
  }

  const isMenuExpanded = (href: string) => expandedMenus.has(href)

  return (
    <aside className="hidden w-64 shrink-0 bg-white border-r border-gray-200 dark:bg-gray-900 dark:border-gray-800 md:block">
      <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent truncate" title={appName}>
          {appName}
        </h2>
      </div>
      <nav className="p-3 space-y-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          const hasChildren = item.children && item.children.length > 0
          const isExpanded = hasChildren ? isMenuExpanded(item.href) : false

          if (hasChildren) {
            const hasActiveChild = item.children!.some(
              (child) => pathname === child.href || pathname?.startsWith(child.href + '/')
            )

            return (
              <div key={item.href} className="space-y-0.5">
                <button
                  onClick={() => toggleMenu(item.href)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group ${isActive || hasActiveChild
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`transition-colors duration-200 ${isActive || hasActiveChild ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'}`}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  <FiChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                <div
                  className={`grid transition-all duration-200 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                >
                  <div className="overflow-hidden">
                    <div className="relative border-l-2 border-gray-100 dark:border-gray-800 ml-5 my-1 pl-3 space-y-1">
                      {item.children!.map((child) => {
                        const isChildActive =
                          pathname === child.href || pathname?.startsWith(child.href + '/')
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${isChildActive
                              ? 'bg-indigo-50/80 text-indigo-600 dark:bg-indigo-900/10 dark:text-indigo-400'
                              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/30'
                              }`}
                          >
                            <span className="opacity-70">{child.icon}</span>
                            <span>{child.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group ${isActive
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
            >
              <div className={`transition-colors duration-200 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'}`}>
                {item.icon}
              </div>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
