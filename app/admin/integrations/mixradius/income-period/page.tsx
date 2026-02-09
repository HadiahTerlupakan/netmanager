import { ensureAnyPermission } from '@/lib/rbac'
import IncomePeriodClient from './IncomePeriodClient'

export const metadata = {
  title: 'Laporan Pendapatan MixRadius',
}

export default async function IncomePeriodPage() {
  await ensureAnyPermission(['mixradius_income:read', 'mixradius:read'])
  return <IncomePeriodClient />
}
