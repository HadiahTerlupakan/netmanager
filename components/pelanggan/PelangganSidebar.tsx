"use client"

import { useState, useEffect, createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  HiOutlineHome,
  HiOutlineDocumentText,
  HiOutlineUser,
  HiOutlineInformationCircle,
  HiBars3,
  HiXMark,
  HiArrowRightOnRectangle,
} from 'react-icons/hi2'

// Context for sidebar state
const SidebarContext = createContext<{
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}>({
  isOpen: false,
  setIsOpen: () => {},
})

export const useSidebar = () => useContext(SidebarContext)

export default function PelangganSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [pelanggan, setPelanggan] = useState<any>(null)

  useEffect(() => {
    const pelangganData = localStorage.getItem('pelanggan_data')
    if (pelangganData) {
      try {
        setPelanggan(JSON.parse(pelangganData))
      } catch (error) {
        console.error('Error parsing pelanggan data:', error)
      }
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('pelanggan_token')
    localStorage.removeItem('pelanggan_data')
    router.push('/pelanggan/login')
  }

  const menuItems = [
    {
      href: '/pelanggan',
      label: 'Beranda',
      icon: HiOutlineHome,
    },
    {
      href: '/pelanggan/tagihan',
      label: 'Tagihan',
      icon: HiOutlineDocumentText,
    },
    {
      href: '/pelanggan/profil',
      label: 'Profil',
      icon: HiOutlineUser,
    },
    {
      href: '/pelanggan/bantuan',
      label: 'Bantuan',
      icon: HiOutlineInformationCircle,
    },
  ]

  const isActive = (href: string) => {
    if (href === '/pelanggan') {
      return pathname === '/pelanggan'
    }
    return pathname?.startsWith(href)
  }

  // Expose toggle function globally for header button
  useEffect(() => {
    ;(window as any).togglePelangganSidebar = () => setIsOpen(!isOpen)
    return () => {
      delete (window as any).togglePelangganSidebar
    }
  }, [isOpen])

  // Close sidebar when route changes on mobile
  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsOpen(false)
    }
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
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-400 to-cyan-500 text-white p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <span className="text-xl font-bold">N</span>
              </div>
              <h2 className="text-lg font-bold">NetManager</h2>
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
          {pelanggan && (
            <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm">
              <p className="text-sm font-medium truncate">{pelanggan.nama}</p>
              <p className="text-xs text-white/80 truncate">ID: {pelanggan.idPelanggan}</p>
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
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    active
                      ? 'bg-sky-50 text-sky-600 font-medium'
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

