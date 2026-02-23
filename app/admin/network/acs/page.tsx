import { ensurePermission } from '@/lib/rbac'
import { AcsDashboardClient } from './AcsDashboardClient'

export const metadata = {
  title: 'ACS Dashboard - Network Manager',
}

export default async function AcsDashboardPage() {
  await ensurePermission('acs:read')
  return <AcsDashboardClient />
}
