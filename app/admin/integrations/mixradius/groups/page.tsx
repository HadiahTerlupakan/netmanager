import { ensurePermission } from '@/lib/rbac'
import MixRadiusGroupsClient from './MixRadiusGroupsClient'

export const metadata = {
  title: 'Manajemen Site - MixRadius Integration',
}

export default async function MixRadiusGroupsPage() {
  await ensurePermission('mixradius:read')
  return <MixRadiusGroupsClient />
}
