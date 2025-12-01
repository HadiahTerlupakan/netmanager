"use client"

import { usePathname } from 'next/navigation'
import PelangganSidebar from '@/components/pelanggan/PelangganSidebar'

export default function PelangganLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/pelanggan/login'

  if (isLoginPage) {
    return children
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <PelangganSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
    </div>
  )
}
