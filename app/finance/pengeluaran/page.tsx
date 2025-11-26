"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function FinancePengeluaranPage() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/finance/cashflow')
  }, [router])

  return null
}
