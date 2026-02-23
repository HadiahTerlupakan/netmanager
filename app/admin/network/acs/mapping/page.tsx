import { ensurePermission } from '@/lib/rbac'
import { AcsMappingClient } from './AcsMappingClient'

export const metadata = {
  title: 'ACS Map - Network Manager',
}

export default async function AcsMappingPage() {
  await ensurePermission('acs:read')
  return <AcsMappingClient />
}
