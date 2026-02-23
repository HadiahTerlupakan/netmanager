import { ensurePermission } from '@/lib/rbac'
import { DevicesClient } from './DevicesClient'

export const metadata = {
  title: 'ONT Devices - Network Manager',
}

export default async function AcsDevicesPage() {
  await ensurePermission('acs:read')
  return <DevicesClient />
}