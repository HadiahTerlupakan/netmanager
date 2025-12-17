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
  HiOutlineArrowTrendingUp,
  HiOutlineCreditCard,
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
  HiOutlineCurrencyDollar,
  HiXMark, // For close button
  HiArrowRightOnRectangle, // For logout visual
  HiSparkles,
  HiOutlineClipboardDocumentList,
  HiOutlineShieldCheck,
  HiOutlineDocumentText,
} from 'react-icons/hi2'
import { useSettings } from '@/hooks/useSettings'
import { useSession, signOut } from 'next-auth/react'

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
  const appName = settings?.namaAplikasi || 'NetManager'
  const [isOpen, setIsOpen] = useState(false)

  // Filter menu items - now just returns all items without filtering
  const filterNavItem = (item: NavItem): NavItem | null => {
    // Return all items without permission check
    if (item.children) {
      const filteredChildren = item.children
        .map(filterNavItem)
        .filter((child): child is NavItem => child !== null)

      return { ...item, children: filteredChildren }
    }
    return item
  }

  const allNavItems: NavItem[] = [
    { href: '/admin', label: 'Dashboard', icon: <HiOutlineChartBar className="w-5 h-5" />, permission: 'DASHBOARD', exact: true },
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
      href: '/admin/workorders',
      label: 'Work Orders',
      icon: <HiOutlineWrench className="w-5 h-5" />,
      permission: 'WORKORDERS',
      children: [
        { href: '/admin/workorders', label: 'Dashboard', icon: <HiOutlineChartBar className="w-4 h-4" />, permission: 'WORKORDERS', exact: true },
        { href: '/admin/workorders/list', label: 'All Work Orders', icon: <HiOutlineClipboard className="w-4 h-4" />, permission: 'WORKORDERS' },
        { href: '/admin/workorders/sites', label: 'Sites', icon: <HiOutlineMap className="w-4 h-4" />, permission: 'WORKORDERS' },
        { href: '/admin/workorders/departments', label: 'Departments', icon: <HiOutlineUserGroup className="w-4 h-4" />, permission: 'WORKORDERS' },
      ],
    },
    { href: '/admin/support', label: 'Dukungan', icon: <HiOutlineChatBubbleLeftRight className="w-5 h-5" />, permission: 'SUPPORT' },
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
        // Removed OAuth as per previous instructions, keeping others
        { href: '/admin/pengaturan/payment-gateway', label: 'Payment Gateway', icon: <HiOutlineCreditCard className="w-4 h-4" />, permission: 'PENGATURAN' },
        { href: '/admin/pengaturan/api', label: 'API', icon: <HiOutlineCodeBracket className="w-4 h-4" />, permission: 'PENGATURAN' },
      ]
    },
    {
      href: '/admin/log',
      label: 'System Log',
      icon: <HiOutlineClipboardDocumentList className="w-5 h-5" />,
      permission: 'SYSTEM_LOG',
      children: [
        { href: '/admin/log/login', label: 'Log Login', icon: <HiOutlineShieldCheck className="w-4 h-4" />, permission: 'SYSTEM_LOG' },
        { href: '/admin/log/activity', label: 'Log Aktivitas', icon: <HiOutlineDocumentText className="w-4 h-4" />, permission: 'SYSTEM_LOG' },
      ],
    },
  ]

  const navItems = useMemo(() => {
    return allNavItems
      .map(filterNavItem)
      .filter((item): item is NavItem => item !== null)
  }, [allNavItems])

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
        {/* Mobile Overlay with Blur */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ease-out"
            onClick={() => setIsOpen(false)}
          />
        )}

        <aside
          className={`fixed md:sticky top-0 left-0 h-screen w-72 shrink-0 bg-white dark:bg-gray-950 border-r border-gray-100 dark:border-gray-800 z-50 transform transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
            } shadow-2xl md:shadow-none`}
        >
          {/* Modern Logo Section */}
          <div className="h-24 flex items-center px-8 relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <HiSparkles className="w-24 h-24 text-indigo-500 rotate-12" />
            </div>

            <div className="relative z-10 flex items-center gap-3 w-full">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white transform rotate-3 hover:rotate-6 transition-transform duration-300">
                <span className="font-bold text-xl">{appName.charAt(0)}</span>
              </div>
              <div className="flex flex-col justify-center overflow-hidden">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate tracking-tight leading-none" title={appName}>
                  {appName}
                </h2>
                <span className="text-[10px] font-medium text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mt-1">Admin Portal</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="ml-auto p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 md:hidden text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close menu"
              >
                <HiXMark className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Navigation Area */}
          <nav className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800 scrollbar-track-transparent hover:scrollbar-thumb-gray-300 dark:hover:scrollbar-thumb-gray-700">
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : (pathname === item.href || pathname?.startsWith(item.href + '/'))

                const hasChildren = item.children && item.children.length > 0
                const isExpanded = hasChildren ? isMenuExpanded(item.href) : false
                const hasActiveChild = hasChildren && item.children!.some(
                  (child) => {
                    if (child.exact) return pathname === child.href
                    return pathname === child.href || pathname?.startsWith(child.href + '/')
                  }
                )

                if (hasChildren) {
                  return (
                    <div key={item.href} className="space-y-1 mb-1">
                      <button
                        onClick={() => toggleMenu(item.href)}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden ${isActive || hasActiveChild
                          ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-900/10'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200'
                          }`}
                      >
                        {/* Active Indicator Line */}
                        {(isActive || hasActiveChild) && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full" />
                        )}

                        <div className="flex items-center gap-3.5 z-10">
                          <span className={`transition-colors duration-200 ${isActive || hasActiveChild ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`}>
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </div>
                        <HiChevronDown
                          className={`w-4 h-4 text-gray-400 transition-transform duration-300 ease-in-out ${isExpanded ? 'rotate-180 text-indigo-500' : ''}`}
                        />
                      </button>

                      <div
                        className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 translate-y-0' : 'grid-rows-[0fr] opacity-0 -translate-y-2'}`}
                      >
                        <div className="overflow-hidden">
                          <div className="relative border-l-2 border-gray-100 dark:border-gray-800 ml-6 my-1 pl-3 space-y-1">
                            {item.children!.map((child) => {
                              const isChildActive = child.exact
                                ? pathname === child.href
                                : pathname === child.href || pathname?.startsWith(child.href + '/')

                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group/child ${isChildActive
                                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/20'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                                    }`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${isChildActive ? 'bg-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-900/30' : 'bg-gray-300 dark:bg-gray-600 group-hover/child:bg-gray-400'
                                    }`} />
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
                    className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden mb-1 ${isActive
                      ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/80 dark:bg-indigo-900/10 shadow-sm shadow-indigo-100/50 dark:shadow-none'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                  >
                    {/* Active Indicator Line */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full" />
                    )}

                    <div className={`transition-colors duration-200 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`}>
                      {item.icon}
                    </div>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </nav>

          {/* User Profile Section */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 shrink-0">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900 dark:to-violet-900 flex items-center justify-center border-2 border-white dark:border-gray-700 shadow-sm shrink-0">
                {session?.user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt={session.user.name || 'User'} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-indigo-600 dark:text-indigo-300">
                    {(session?.user?.name || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {session?.user?.name || 'User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {session?.user?.email || 'admin@example.com'}
                </p>
              </div>
              <button
                onClick={() => signOut()}
                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                title="Sign Out"
              >
                <HiArrowRightOnRectangle className="w-5 h-5" />
              </button>
            </div>
          </div>
        </aside>
      </>
    </SidebarContext.Provider>
  )
}
