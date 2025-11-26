"use client"

import { usePathname } from 'next/navigation'
import FinanceSidebar from '@/components/finance/FinanceSidebar'

export default function FinanceLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/finance/login'

  return (
    <div className="min-h-screen bg-gray-50">
      {!isLoginPage && <FinanceSidebar />}
      <div className={isLoginPage ? '' : 'md:ml-64'}>
        {children}
      </div>
    </div>
  )
}

