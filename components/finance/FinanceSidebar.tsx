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
              {menuItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active
                      ? 'bg-emerald-50 text-emerald-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
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

