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
} from 'react-icons/hi2'
import { getWithExpiry, removeWithExpiry } from '@/lib/utils/storage-with-expiry'

// Types
interface PelangganData {
  id: string
  idPelanggan: string
  nama: string
  username: string
  status: string
  [key: string]: any
}

// Context for sidebar state
const SidebarContext = createContext<{
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}>({
  isOpen: false,
  setIsOpen: () => { },
})

export const useSidebar = () => useContext(SidebarContext)

export default function PelangganSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [pelanggan, setPelanggan] = useState<PelangganData | null>(null)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  // Load pelanggan data dengan getWithExpiry
  const loadPelangganData = () => {
    try {
      const data = getWithExpiry<PelangganData>('pelanggan_data')
      if (data) {
        setPelanggan(data)
      } else {
        // Data expired atau tidak ada
        setPelanggan(null)
      }
    } catch (error) {
      console.error('Error loading pelanggan data:', error)
      setPelanggan(null)
    }
  }

  // Initial load dan auto-refresh
  useEffect(() => {
    loadPelangganData()

    // Auto-refresh setiap 30 detik untuk sinkronisasi
    const intervalId = setInterval(loadPelangganData, 30000)

    // Refresh when window gains focus
    const handleFocus = () => loadPelangganData()
    window.addEventListener('focus', handleFocus)

    // Refresh when visibility changes
    const handleVisibilityChange = () => {
      if (!document.hidden) loadPelangganData()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('pelanggan_token')
    removeWithExpiry('pelanggan_data')
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
    ; (window as any).togglePelangganSidebar = () => setIsOpen(!isOpen)
    return () => {
      delete (window as any).togglePelangganSidebar
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

  // Swipe gesture handlers
  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    // Close sidebar on left swipe (swipe left to close)
    if (isLeftSwipe && isOpen && window.innerWidth < 768) {
      setIsOpen(false)
    }
  }

  return (
    <SidebarContext.Provider value={{ isOpen, setIsOpen }}>
      <>
        {/* Overlay - Only on mobile */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
            onClick={() => setIsOpen(false)}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />
        )}

        {/* Sidebar - Desktop: always visible, Mobile: toggle */}
        <aside
          className={`fixed md:sticky top-0 left-0 h-screen w-64 shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shadow-xl md:shadow-none z-50 transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
            }`}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Header */}
          <div className="h-16 md:h-20 flex items-center justify-between px-4 md:px-6 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-sky-400 to-cyan-500 md:bg-none md:from-transparent md:to-transparent">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-sky-100 dark:bg-sky-900/20 md:bg-white/20 rounded-xl flex items-center justify-center transition-all duration-200">
                <span className="text-xl md:text-2xl font-bold text-sky-600 dark:text-sky-400 md:text-white">N</span>
              </div>
              <h2 className="text-lg md:text-xl font-bold text-white md:text-gray-900 dark:md:text-white">NetManager</h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/10 md:hover:bg-gray-100 dark:md:hover:bg-gray-800 rounded-xl transition-all duration-200 md:hidden text-white active:scale-95"
              aria-label="Close menu"
            >
              <HiXMark className="w-6 h-6" />
            </button>
          </div>

          {/* User Info - Mobile only */}
          {pelanggan && (
            <div className="md:hidden bg-gradient-to-r from-sky-400 to-cyan-500 px-4 pb-4">
              <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm text-white">
                <p className="text-sm font-semibold truncate">{pelanggan.nama}</p>
                <p className="text-xs text-white/90 truncate mt-1">ID: {pelanggan.idPelanggan}</p>
              </div>
            </div>
          )}

          {/* User Info - Desktop only */}
          {pelanggan && (
            <div className="hidden md:block px-4 py-4 border-b border-gray-200 dark:border-gray-800">
              <div className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-4">
                <p className="text-sm md:text-base font-semibold text-gray-900 dark:text-white truncate">{pelanggan.nama}</p>
                <p className="text-xs md:text-sm text-sky-600 dark:text-sky-400 truncate mt-1">ID: {pelanggan.idPelanggan}</p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm md:text-base font-medium rounded-xl transition-all duration-200 ${active
                    ? 'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400 shadow-sm'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 active:scale-95'
                    }`}
                >
                  <Icon className="w-5 h-5 md:w-6 md:h-6" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm md:text-base font-medium rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 active:scale-95"
            >
              <HiArrowRightOnRectangle className="w-5 h-5 md:w-6 md:h-6" />
              <span>Keluar</span>
            </button>
          </div>
        </aside>
      </>
    </SidebarContext.Provider>
  )
}
