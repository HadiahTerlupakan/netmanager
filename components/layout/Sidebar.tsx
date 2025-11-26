"use client"
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { 
  HiOutlineChartBar, 
  HiOutlineGlobeAlt, 
  HiOutlineServer, 
  HiOutlineSignal,
  HiOutlineDevicePhoneMobile,
  HiOutlinePlus,
  HiOutlineClipboardDocumentList,
  HiOutlineBolt,
  HiOutlineLink,
  HiOutlineCube,
  HiOutlineBuildingOffice,
  HiOutlinePaperClip,
  HiOutlineMap,
  HiOutlineUsers,
  HiChevronRight,
  HiOutlineWifi,
  HiOutlineArchiveBox,
  HiOutlineSquares2X2,
  HiOutlineRectangleStack,
  HiOutlineDocument,
  HiOutlineShoppingCart,
  HiOutlineCircleStack,
  HiOutlineUserCircle,
  HiOutlineCurrencyDollar,
  HiOutlineUserGroup,
  HiOutlineCog6Tooth,
  HiOutlineKey,
  HiOutlineDocumentText,
  HiOutlineAdjustmentsHorizontal,
  HiOutlinePhoto,
  HiOutlineBanknotes
} from 'react-icons/hi2'

type NavItem = {
  href: string
  label: string
  icon: ReactNode
  children?: NavItem[]
}

export default function Sidebar() {
  const pathname = usePathname()
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set())

  const navItems: NavItem[] = useMemo(() => [
    { href: '/admin', label: 'Dashboard', icon: <HiOutlineChartBar className="w-5 h-5" /> },
    {
      href: '/admin/network',
      label: 'Network',
      icon: <HiOutlineGlobeAlt className="w-5 h-5" />,
      children: [
        { href: '/admin/network/mikrotik', label: 'MikroTik', icon: <HiOutlineServer className="w-4 h-4" /> },
        { href: '/admin/network/olt', label: 'OLT', icon: <HiOutlineSignal className="w-4 h-4" /> },
        { href: '/admin/network/onu', label: 'All ONU', icon: <HiOutlineDevicePhoneMobile className="w-4 h-4" /> },
        { href: '/admin/network/onu/new', label: 'Add ONU', icon: <HiOutlinePlus className="w-4 h-4" /> },
        { href: '/admin/network/onutype', label: 'Onu Type', icon: <HiOutlineClipboardDocumentList className="w-4 h-4" /> },
        { href: '/admin/network/speedprofiles', label: 'Speed Profiles', icon: <HiOutlineBolt className="w-4 h-4" /> },
        { href: '/admin/network/vlan', label: 'VLAN', icon: <HiOutlineLink className="w-4 h-4" /> },
      ],
    },
    {
      href: '/admin/ftth',
      label: 'FTTH',
      icon: <HiOutlineWifi className="w-5 h-5" />,
      children: [
        { href: '/admin/ftth/otb', label: 'OTB', icon: <HiOutlineServer className="w-4 h-4" /> },
        { href: '/admin/ftth/odc', label: 'ODC', icon: <HiOutlineArchiveBox className="w-4 h-4" /> },
        { href: '/admin/ftth/odp', label: 'ODP', icon: <HiOutlineSquares2X2 className="w-4 h-4" /> },
        { href: '/admin/ftth/closure', label: 'Join BOX/Closure', icon: <HiOutlineRectangleStack className="w-4 h-4" /> },
        { href: '/admin/ftth/pole', label: 'Pole/Tiang', icon: <HiOutlineBolt className="w-4 h-4" /> },
        { href: '/admin/ftth/kmz', label: 'KMZ', icon: <HiOutlineDocument className="w-4 h-4" /> },
        { href: '/admin/ftth/map', label: 'Topology Map', icon: <HiOutlineMap className="w-4 h-4" /> },
      ],
    },
    {
      href: '/admin/paket',
      label: 'Paket',
      icon: <HiOutlineShoppingCart className="w-5 h-5" />,
      children: [
        { href: '/admin/paket/bandwidth', label: 'Bandwidth', icon: <HiOutlineCircleStack className="w-4 h-4" /> },
        { href: '/admin/paket/profileppp', label: 'Profile PPP', icon: <HiOutlineUserCircle className="w-4 h-4" /> },
        { href: '/admin/paket/harga', label: 'Harga Paket', icon: <HiOutlineCurrencyDollar className="w-4 h-4" /> },
      ],
    },
    {
      href: '/admin/pelanggan',
      label: 'Pelanggan',
      icon: <HiOutlineUserGroup className="w-5 h-5" />,
      children: [
        { href: '/admin/pelanggan/ppp', label: 'Pelanggan PPP', icon: <HiOutlineUserCircle className="w-4 h-4" /> },
      ],
    },
    { href: '/admin/users', label: 'Users', icon: <HiOutlineUsers className="w-5 h-5" /> },
    {
      href: '/admin/finance',
      label: 'Finance',
      icon: <HiOutlineCurrencyDollar className="w-5 h-5" />,
      children: [
        { href: '/admin/finance/cashflow', label: 'Cashflow', icon: <HiOutlineBanknotes className="w-4 h-4" /> },
        { href: '/admin/finance/pengeluaran', label: 'Pengeluaran', icon: <HiOutlineDocumentText className="w-4 h-4" /> },
      ],
    },
    {
      href: '/admin/pengaturan',
      label: 'Pengaturan',
      icon: <HiOutlineCog6Tooth className="w-5 h-5" />,
      children: [
        { href: '/admin/pengaturan/umum', label: 'Pengaturan Umum', icon: <HiOutlineAdjustmentsHorizontal className="w-4 h-4" /> },
        { href: '/admin/pengaturan/api', label: 'API', icon: <HiOutlineKey className="w-4 h-4" /> },
        { href: '/admin/pengaturan/logo', label: 'Pengaturan Logo', icon: <HiOutlinePhoto className="w-4 h-4" /> },
      ],
    },
  ], [])

  // Auto-expand menu jika pathname aktif
  useEffect(() => {
    navItems.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some(
          (child) => pathname === child.href || pathname?.startsWith(child.href + '/')
        )
        if (hasActiveChild) {
          setExpandedMenus((prev) => new Set(prev).add(item.href))
        }
      }
    })
  }, [pathname, navItems])

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
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">NetManager</h2>
      </div>
      <nav className="p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          const hasChildren = item.children && item.children.length > 0
          const isExpanded = hasChildren ? isMenuExpanded(item.href) : false

          if (hasChildren) {
            const hasActiveChild = item.children!.some(
              (child) => pathname === child.href || pathname?.startsWith(child.href + '/')
            )

            return (
              <div key={item.href}>
                <button
                  onClick={() => toggleMenu(item.href)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-150 ${
                    isActive || hasActiveChild
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  <HiChevronRight className={`w-4 h-4 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children!.map((child) => {
                      const isChildActive =
                        pathname === child.href || pathname?.startsWith(child.href + '/')
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-all duration-150 ${
                            isChildActive
                              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
                              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                          }`}
                        >
                          {child.icon}
                          <span>{child.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}


