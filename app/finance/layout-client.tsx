"use client"

import { usePathname } from 'next/navigation'
import { SessionProvider } from 'next-auth/react'
import FinanceSidebar from '@/components/finance/FinanceSidebar'

export default function FinanceLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/finance/login'

  return (
    <SessionProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {!isLoginPage && <FinanceSidebar />}
        <div className={isLoginPage ? '' : 'md:ml-64'}>
          {children}
        </div>
      </div>
    </SessionProvider>
  )
}
