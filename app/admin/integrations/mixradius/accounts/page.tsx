
import { ensurePermission } from '@/lib/rbac'
import MixRadiusAccountsClient from './MixRadiusAccountsClient'

export const metadata = {
  title: 'Akun MixRadius',
}

export default async function MixRadiusAccountsPage() {
  // Ensure user has read permission
  await ensurePermission('mixradius:read')

  return <MixRadiusAccountsClient />
}
