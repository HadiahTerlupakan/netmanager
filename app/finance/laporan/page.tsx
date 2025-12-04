"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function FinanceLaporanPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect ke halaman reports yang lengkap
    router.replace('/finance/reports')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <div className="text-gray-500 dark:text-gray-400">Mengalihkan ke halaman laporan...</div>
      </div>
    </div>
  )
}




