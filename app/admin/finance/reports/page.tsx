import type { Metadata } from 'next'
import ReportsClient from './ReportsClient'

export const metadata: Metadata = {
  title: 'Laporan Keuangan',
}

export default function FinanceReportsPage() {
  return <ReportsClient />
}
