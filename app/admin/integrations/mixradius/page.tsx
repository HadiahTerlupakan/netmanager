import { ensurePermission } from '@/lib/rbac'
import MixRadiusClient from './MixRadiusClient'
import { prisma } from '@/modules/database'
import { redirect } from 'next/navigation'

export default async function MixRadiusPage() {
  await ensurePermission('mixradius:read')

  // Check if mode is MIKROTIK_API, if so, redirect
  const setting = await prisma.settings.findFirst({
    where: { key: 'PPP_CONNECTION_MODE' }
  })
  
  if (setting?.value === 'MIKROTIK_API') {
    redirect('/admin/dashboard')
  }

  return <MixRadiusClient />
}

export const metadata = {
  title: 'MixRadius Integration',
  description: 'Data pelanggan dari sistem MixRadius eksternal',
}
