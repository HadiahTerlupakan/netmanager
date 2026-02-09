import { ensurePermission } from '@/lib/rbac'
import MixRadiusClient from './MixRadiusClient'

export default async function MixRadiusPage() {
  await ensurePermission('mixradius:read')
  return <MixRadiusClient />
}

export const metadata = {
  title: 'MixRadius Integration',
  description: 'Data pelanggan dari sistem MixRadius eksternal',
}
