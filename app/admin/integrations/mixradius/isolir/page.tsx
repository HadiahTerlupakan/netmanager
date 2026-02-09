import { ensurePermission } from '@/lib/rbac'
import MixRadiusClient from '../MixRadiusClient'

export const metadata = {
  title: 'MixRadius Isolir',
  description: 'Daftar pelanggan isolir/suspend',
}

export default async function MixRadiusIsolirPage() {
  await ensurePermission('mixradius:read')
  return <MixRadiusClient defaultStatus="Isolir" viewMode="isolir" />
}
