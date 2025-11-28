"use client"

import { useState, useEffect, createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  HiOutlineHome,
  HiOutlineDocumentText,
  HiOutlineUser,
  HiOutlineInformationCircle,
  HiXMark,
  HiArrowRightOnRectangle,
  HiOutlineCurrencyDollar,
  HiOutlineChartBar,
  HiOutlineBanknotes,
  HiOutlineDocumentChartBar,
  HiChevronDown,
  HiChevronRight,
} from 'react-icons/hi2'

// Context for sidebar state
const SidebarContext = createContext<{
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}>({
  isOpen: false,
  setIsOpen: () => { },
})

export const useSidebar = () => useContext(SidebarContext)

export default function FinanceSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [financeUser, setFinanceUser] = useState<any>(null)
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({})

  // Auto-expand menu based on active route
  useEffect(() => {
    const newOpenMenus: Record<string, boolean> = {}

    menuItems.forEach(item => {
      if (item.submenu) {
        const hasActiveSubmenu = item.submenu.some(sub => pathname?.startsWith(sub.href))
        newOpenMenus[item.label] = hasActiveSubmenu
      }
    })

    setOpenMenus(newOpenMenus)
  }, [pathname])

  useEffect(() => {
    const financeData = localStorage.getItem('finance_data')
    if (financeData) {
      try {
        setFinanceUser(JSON.parse(financeData))
      } catch (error) {
        console.error('Error parsing finance data:', error)
      }
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('finance_token')
    localStorage.removeItem('finance_data')
    router.push('/finance/login')
  }

  const menuItems = [
    {
      href: '/finance',
      label: 'Beranda',
      icon: HiOutlineHome,
    },
    {
      href: '/finance/tagihan',
      label: 'Tagihan',
      icon: HiOutlineDocumentText,
    },
    {
      href: '/finance/cashflow',
      label: 'Cashflow & Pengeluaran',
      icon: HiOutlineBanknotes,
    },
    {
      href: '/finance/ar',
      label: 'Accounts Receivable',
      icon: HiOutlineCurrencyDollar,
    },
    {
      href: '/finance/bank-reconciliation',
      label: 'Bank Reconciliation',
      icon: HiOutlineBanknotes,
    },
    {
      href: '/finance/mrr-dashboard',
      label: 'MRR/ARR Dashboard',
      icon: HiOutlineChartBar,
    },
    {
      label: 'Tax Management',
      icon: HiOutlineDocumentChartBar,
      submenu: [
        {
          href: '/finance/tax',
          label: 'Dashboard',
        },
        {
          href: '/finance/tax/reports/ppn',
          label: 'Laporan PPN',
        },
        {
          href: '/finance/tax/reports/pph',
          label: 'Laporan PPh',
        },
        {
          href: '/finance/tax/deadlines',
          label: 'Filing Deadlines',
        },
        {
          href: '/finance/uso',
          label: 'BHP & USO',
        },
      ],
    },
    {
      label: 'Budget Management',
      icon: HiOutlineChartBar,
      submenu: [
        {
          href: '/finance/budget',
          label: 'Dashboard',
        },
        {
          href: '/finance/budget/planning',
          label: 'Budget Planning',
        },
        {
          href: '/finance/deferred',
          label: 'Deferred Revenue',
        },
        {
          href: '/finance/budget/analysis',
          label: 'Budget Analysis',
        },
      ],
    },
    {
      href: '/finance/reports',
      label: 'Reports',
      icon: HiOutlineDocumentChartBar,
    },
    {
      href: '/finance/laporan',
      label: 'Laporan',
      icon: HiOutlineChartBar,
    },
    {
      href: '/finance/profil',
      label: 'Profil',
      icon: HiOutlineUser,
    },
    {
      href: '/finance/bantuan',
      label: 'Bantuan',
      icon: HiOutlineInformationCircle,
    },
  ]

  const isActive = (href: string) => {
    if (href === '/finance') {
      return pathname === '/finance'
    }
    return pathname?.startsWith(href)
  }

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => {
      const newState: Record<string, boolean> = {}
      // Close all menus
      Object.keys(prev).forEach(key => {
        newState[key] = false
      })
      // Toggle the clicked menu
      newState[label] = !prev[label]
      return newState
    })
  }

  // Expose toggle function globally for header button
  useEffect(() => {
    ; (window as any).toggleFinanceSidebar = () => setIsOpen(!isOpen)
    return () => {
      delete (window as any).toggleFinanceSidebar
    }
  }, [isOpen])

  // Close sidebar when route changes on mobile
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
        {/* Overlay - Only on mobile */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed top-0 left-0 h-full w-64 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
            }`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-400 to-teal-500 text-white p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <HiOutlineCurrencyDollar className="w-6 h-6" />
                </div>
                <h2 className="text-lg font-bold">Finance</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors md:hidden"
                aria-label="Close menu"
              >
                <HiXMark className="w-6 h-6" />
              </button>
            </div>

            {/* User Info */}
            {financeUser && (
              <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
                <p className="text-sm font-medium truncate">{financeUser.name || financeUser.email}</p>
                <p className="text-xs text-white/80 truncate">{financeUser.email}</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {menuItems.map((item, index) => {
                const isActive = item.href ? pathname === item.href : false
                const hasActiveSubmenu = item.submenu?.some(sub => pathname === sub.href)

                return (
                  <div key={index}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-medium'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                      >
                        <item.icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </Link>
                    ) : (
                      <div>
                        {/* Dropdown Header - Clickable */}
                        <button
                          onClick={() => toggleMenu(item.label)}
                          className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg transition-all ${hasActiveSubmenu
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-medium'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <item.icon className="h-5 w-5" />
                            <span>{item.label}</span>
                          </div>
                          {/* Chevron Icon */}
                          {openMenus[item.label] ? (
                            <HiChevronDown className="h-4 w-4" />
                          ) : (
                            <HiChevronRight className="h-4 w-4" />
                          )}
                        </button>

                        {/* Submenu - Collapsible */}
                        {item.submenu && openMenus[item.label] && (
                          <div className="ml-8 mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200">
                            {item.submenu.map((subItem, subIndex) => (
                              <Link
                                key={subIndex}
                                href={subItem.href}
                                onClick={() => setIsOpen(false)}
                                className={`block px-4 py-2 text-sm rounded-lg transition-all ${pathname === subItem.href
                                  ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-medium'
                                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                  }`}
                              >
                                {subItem.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
            >
              <HiArrowRightOnRectangle className="w-5 h-5" />
              <span>Keluar</span>
            </button>
          </div>
        </aside>
      </>
    </SidebarContext.Provider>
  )
}

