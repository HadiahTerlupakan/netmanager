"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useMemo, createContext, useContext } from 'react'
import type { ReactNode } from 'react'
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
  HiChevronRight,
  HiChevronDown,
  HiOutlineWifi,
  HiOutlineArchiveBox,
  HiOutlineSquares2X2,
  HiOutlineQueueList,
  HiOutlineDocument,
  HiOutlineShoppingCart,
  HiOutlineCircleStack, // Database replacement
  HiOutlineUser,
  HiOutlineCurrencyDollar,
  HiOutlineArrowTrendingUp,
  HiOutlineCreditCard,
  HiOutlineKey,
  HiOutlineCog6Tooth,
  HiOutlinePhoto,
  HiOutlineEnvelope,
  HiOutlineChatBubbleLeftRight,
  HiOutlineCodeBracket,
  HiOutlineShieldCheck,
  HiOutlineClock,
  HiOutlineCalendar,
  HiOutlineUserGroup,
  HiOutlineQuestionMarkCircle,
  HiOutlineWrench,
  HiOutlineCube,
  HiOutlineTruck,
  HiOutlineArrowDownTray,
  HiOutlineArrowUpTray,
  HiOutlineDocumentText,
  HiXMark, // For close button
} from 'react-icons/hi2'
import { useSettings } from '@/hooks/useSettings'
import { useSession } from 'next-auth/react'
import { useEmployeePermissions } from '@/components/providers/EmployeePermissionContext'
import { getAllFeatures } from '@/lib/utils/permissions'

// Context for sidebar state
const SidebarContext = createContext<{
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}>({
  isOpen: false,
  setIsOpen: () => { },
})

export const useSidebar = () => useContext(SidebarContext)

type NavItem = {
  href: string
  label: string
  icon: ReactNode
  permission?: string
  children?: NavItem[]
  exact?: boolean
}

export default function Sidebar() {
  const pathname = usePathname()
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set())
  const { settings } = useSettings()
  const { data: session } = useSession()
  const { permissions, isAdmin } = useEmployeePermissions()
  const appName = settings?.namaAplikasi || 'NetManager'
  const [isOpen, setIsOpen] = useState(false)

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
    { href: '/admin', label: 'Dashboard', icon: <HiOutlineChartBar className="w-5 h-5" />, permission: 'DASHBOARD', exact: true },
    { href: '/admin/roles', label: 'Roles', icon: <HiOutlineShieldCheck className="w-5 h-5" />, permission: 'ROLES' },
    {
      href: '/admin/network',
      label: 'Network',
      icon: <HiOutlineGlobeAlt className="w-5 h-5" />,
      permission: 'NETWORK',
      children: [
        { href: '/admin/network/mikrotik', label: 'MikroTik', icon: <HiOutlineServer className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/radius', label: 'RADIUS', icon: <HiOutlineKey className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/network/olt', label: 'OLT', icon: <HiOutlinePresentationChartLine className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/network/onu', label: 'All ONU', icon: <HiOutlineDevicePhoneMobile className="w-4 h-4" />, permission: 'NETWORK', exact: true },
        { href: '/admin/network/onu/new', label: 'Add ONU', icon: <HiPlus className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/network/onutype', label: 'Onu Type', icon: <HiOutlineClipboard className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/network/speedprofiles', label: 'Speed Profiles', icon: <HiOutlineBolt className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/network/vlan', label: 'VLAN', icon: <HiOutlineLink className="w-4 h-4" />, permission: 'NETWORK' },
      ],
    },
    {
      href: '/admin/ftth',
      label: 'FTTH',
      icon: <HiOutlineWifi className="w-5 h-5" />,
      permission: 'FTTH',
      children: [
        { href: '/admin/ftth/otb', label: 'OTB', icon: <HiOutlineServer className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/ftth/odc', label: 'ODC', icon: <HiOutlineArchiveBox className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/ftth/odp', label: 'ODP', icon: <HiOutlineSquares2X2 className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/ftth/closure', label: 'Join BOX/Closure', icon: <HiOutlineQueueList className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/ftth/pole', label: 'Pole/Tiang', icon: <HiOutlineBolt className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/ftth/kmz', label: 'KMZ', icon: <HiOutlineDocument className="w-4 h-4" />, permission: 'NETWORK' },
        { href: '/admin/ftth/map', label: 'Topology Map', icon: <HiOutlineMap className="w-4 h-4" />, permission: 'NETWORK' },
      ],
    },
    {
      href: '/admin/paket',
      label: 'Paket',
      icon: <HiOutlineShoppingCart className="w-5 h-5" />,
      permission: 'PAKET',
      children: [
        { href: '/admin/paket/bandwidth', label: 'Bandwidth', icon: <HiOutlineCircleStack className="w-4 h-4" />, permission: 'PELANGGAN' },
        { href: '/admin/paket/profileppp', label: 'Profile PPP', icon: <HiOutlineUser className="w-4 h-4" />, permission: 'PELANGGAN' },
        { href: '/admin/paket/harga', label: 'Harga Paket', icon: <HiOutlineCurrencyDollar className="w-4 h-4" />, permission: 'PELANGGAN' },
      ],
    },
    {
      href: '/admin/pelanggan',
      label: 'Pelanggan',
      icon: <HiOutlineUsers className="w-5 h-5" />,
      permission: 'PELANGGAN',
      children: [
        { href: '/admin/pelanggan/ppp', label: 'Pelanggan PPP', icon: <HiOutlineUser className="w-4 h-4" />, permission: 'PELANGGAN' },
      ],
    },
    {
      href: '/admin/inventory',
      label: 'Inventory',
      icon: <HiOutlineCube className="w-5 h-5" />,
      permission: 'INVENTORY',
      children: [
        { href: '/admin/inventory', label: 'Dashboard', icon: <HiOutlineChartBar className="w-4 h-4" />, permission: 'INVENTORY', exact: true },
        { href: '/admin/inventory/barang', label: 'Barang', icon: <HiOutlineCube className="w-4 h-4" />, permission: 'INVENTORY' },
        { href: '/admin/inventory/masuk', label: 'Barang Masuk', icon: <HiOutlineArrowDownTray className="w-4 h-4" />, permission: 'INVENTORY' },
        { href: '/admin/inventory/keluar', label: 'Barang Keluar', icon: <HiOutlineArrowUpTray className="w-4 h-4" />, permission: 'INVENTORY' },
        { href: '/admin/inventory/transfer', label: 'Transfer Antar Gudang', icon: <HiOutlineTruck className="w-4 h-4" />, permission: 'INVENTORY' },
        { href: '/admin/inventory/restock', label: 'Restock Management', icon: <HiOutlineArrowTrendingUp className="w-4 h-4" />, permission: 'INVENTORY' },
        { href: '/admin/inventory/opname', label: 'Stock Opname', icon: <HiOutlineClipboard className="w-4 h-4" />, permission: 'INVENTORY' },
        { href: '/admin/inventory/gudang', label: 'Gudang', icon: <HiOutlineHome className="w-4 h-4" />, permission: 'INVENTORY' },
      ],
    },
    { href: '/admin/users', label: 'Users', icon: <HiOutlineUsers className="w-5 h-5" />, permission: 'USERS' },
    {
      href: '/admin/helpdesk',
      label: 'Helpdesk',
      icon: <HiOutlineQuestionMarkCircle className="w-5 h-5" />,
      permission: 'HELPDESK',
      children: [
        { href: '/admin/helpdesk', label: 'Dashboard', icon: <HiOutlineChartBar className="w-4 h-4" />, permission: 'HELPDESK', exact: true },
        { href: '/admin/helpdesk/tiket', label: 'Semua Tiket', icon: <HiOutlineQuestionMarkCircle className="w-4 h-4" />, permission: 'HELPDESK' },
      ],
    },
    {
      href: '/admin/workorders',
      label: 'Work Orders',
      icon: <HiOutlineWrench className="w-5 h-5" />,
      permission: 'WORKORDERS',
      children: [
        { href: '/admin/workorders', label: 'Dashboard', icon: <HiOutlineChartBar className="w-4 h-4" />, permission: 'WORKORDERS', exact: true },
        { href: '/admin/workorders/list', label: 'All Work Orders', icon: <HiOutlineClipboard className="w-4 h-4" />, permission: 'WORKORDERS' },
      ],
    },
    {
      href: '/admin/hris',
      label: 'HRIS',
      icon: <HiOutlineUserGroup className="w-5 h-5" />,
      permission: 'HRIS',
      children: [
        { href: '/admin/hris', label: 'Dashboard', icon: <HiOutlineChartBar className="w-4 h-4" />, permission: 'HRIS', exact: true },
        { href: '/admin/hris/departments', label: 'Departments', icon: <HiOutlineHome className="w-4 h-4" />, permission: 'HRIS' },
        { href: '/admin/hris/sites', label: 'Sites / Area', icon: <HiOutlineMap className="w-4 h-4" />, permission: 'HRIS' },
        { href: '/admin/hris/attendance', label: 'Attendance', icon: <HiOutlineClock className="w-4 h-4" />, permission: 'HRIS' },
        { href: '/admin/hris/leaves', label: 'Leave Management', icon: <HiOutlineCalendar className="w-4 h-4" />, permission: 'HRIS' },
        { href: '/admin/hris/payroll', label: 'Payroll', icon: <HiOutlineArrowTrendingUp className="w-4 h-4" />, permission: 'HRIS' },
      ],
    },
    {
      href: '/admin/finance',
      label: 'Finance',
      icon: <HiOutlineCurrencyDollar className="w-5 h-5" />,
      permission: 'FINANCE',
      children: [
        { href: '/admin/finance/tagihan', label: 'Tagihan', icon: <HiOutlineDocumentText className="w-4 h-4" />, permission: 'FINANCE' },
        { href: '/admin/finance/cashflow', label: 'Cashflow & Pengeluaran', icon: <HiOutlineArrowTrendingUp className="w-4 h-4" />, permission: 'FINANCE' },
        { href: '/admin/finance/bank-accounts', label: 'Rekening Bank', icon: <HiOutlineArrowTrendingUp className="w-4 h-4" />, permission: 'FINANCE' },
      ]
    },
    {
      href: '/admin/pengaturan',
      label: 'Pengaturan',
      icon: <HiOutlineCog6Tooth className="w-5 h-5" />,
      permission: 'PENGATURAN',
      children: [
        { href: '/admin/pengaturan/umum', label: 'Umum', icon: <HiOutlineCog6Tooth className="w-4 h-4" />, permission: 'PENGATURAN' },
        { href: '/admin/pengaturan/logo', label: 'Logo Perusahaan', icon: <HiOutlinePhoto className="w-4 h-4" />, permission: 'PENGATURAN' },
        { href: '/admin/pengaturan/email', label: 'Email', icon: <HiOutlineEnvelope className="w-4 h-4" />, permission: 'PENGATURAN' },
        { href: '/admin/pengaturan/whatsapp', label: 'WhatsApp', icon: <HiOutlineChatBubbleLeftRight className="w-4 h-4" />, permission: 'PENGATURAN' },
        { href: '/admin/pengaturan/oauth', label: 'OAuth', icon: <HiOutlineKey className="w-4 h-4" />, permission: 'PENGATURAN' },
        { href: '/admin/pengaturan/payment-gateway', label: 'Payment Gateway', icon: <HiOutlineCreditCard className="w-4 h-4" />, permission: 'PENGATURAN' },
        { href: '/admin/pengaturan/api', label: 'API', icon: <HiOutlineCodeBracket className="w-4 h-4" />, permission: 'PENGATURAN' },
      ]
    },
  ]

  const navItems = useMemo(() => {
    return allNavItems
      .map(filterNavItem)
      .filter((item): item is NavItem => item !== null)
  }, [allNavItems, userPermissions])

  // Auto-expand menu
  useEffect(() => {
    const menusToExpand: string[] = []
    navItems.forEach((item) => {
      if (item.children) {
        // Parent is active if any child is active
        const hasActiveChild = item.children.some(
          (child) => {
            if (child.exact) {
              return pathname === child.href
            }
            return pathname === child.href || pathname?.startsWith(child.href + '/')
          }
        )
        if (hasActiveChild && !expandedMenus.has(item.href)) {
          menusToExpand.push(item.href)
        }
      }
    })

    if (menusToExpand.length > 0) {
      setExpandedMenus((prev) => {
        const newSet = new Set(prev)
        menusToExpand.forEach(href => newSet.add(href))
        return newSet
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

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

  // Mobile toggle integration
  useEffect(() => {
    ; (window as any).toggleAdminSidebar = () => setIsOpen(!isOpen)
    return () => {
      delete (window as any).toggleAdminSidebar
    }
  }, [isOpen])

  // Close on route change (mobile)
  useEffect(() => {
    const handleRouteChange = () => {
      if (window.innerWidth < 768) {
        setIsOpen(false)
      }
    }
    handleRouteChange()
  }, [pathname])

  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen }}>
      <>
        {/* Mobile Overlay */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
          />
        )}

        <aside
          className={`fixed md:sticky top-0 left-0 h-screen w-64 shrink-0 bg-white border-r border-gray-200 dark:bg-gray-900 dark:border-gray-800 z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
            }`}
        >
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent truncate" title={appName}>
              {appName}
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
            >
              <HiXMark className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-4rem)]">
            {navItems.map((item) => {
              // Parent is active if active child exists
              const isActive = item.exact
                ? pathname === item.href
                : (pathname === item.href || pathname?.startsWith(item.href + '/'))

              const hasChildren = item.children && item.children.length > 0
              const isExpanded = hasChildren ? isMenuExpanded(item.href) : false

              if (hasChildren) {
                const hasActiveChild = item.children!.some(
                  (child) => {
                    if (child.exact) {
                      return pathname === child.href
                    }
                    return pathname === child.href || pathname?.startsWith(child.href + '/')
                  }
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
                      <HiChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    <div
                      className={`grid transition-all duration-200 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                    >
                      <div className="overflow-hidden">
                        <div className="relative border-l-2 border-gray-100 dark:border-gray-800 ml-5 my-1 pl-3 space-y-1">
                          {item.children!.map((child) => {
                            const isChildActive = child.exact
                              ? pathname === child.href
                              : pathname === child.href || pathname?.startsWith(child.href + '/')

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
      </>
    </SidebarContext.Provider>
  )
}
