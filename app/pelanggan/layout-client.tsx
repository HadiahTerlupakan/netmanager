"use client"

import { usePathname } from 'next/navigation'
import PelangganSidebar from '@/components/pelanggan/PelangganSidebar'

export default function PelangganLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/pelanggan/login'

  return (
    <div className="min-h-screen bg-gray-50">
      {!isLoginPage && <PelangganSidebar />}
      <div className={isLoginPage ? '' : 'md:ml-64'}>
        {children}
      </div>
    </div>
  )
}



