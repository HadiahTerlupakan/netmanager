import { ensurePermission } from '@/lib/rbac'
import { DeviceDetailClient } from './DeviceDetailClient'

export const metadata = {
  title: 'ONT Device Detail - Network Manager',
}

export default async function AcsDeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await ensurePermission('acs:read')
  const resolvedParams = await params
  return <DeviceDetailClient deviceId={resolvedParams.id} />
}
