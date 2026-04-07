import { ensurePermission } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import MixRadiusClient from './MixRadiusClient'
import { MixRadiusPageService } from '@/modules/integrations'

export default async function MixRadiusPage() {
  await ensurePermission('mixradius:read')

  const pageService = new MixRadiusPageService()

  if (await pageService.shouldRedirectToDashboard()) {
    redirect('/admin/dashboard')
  }

  return <MixRadiusClient />
}

export const metadata = {
  title: 'MixRadius Integration',
  description: 'Data pelanggan dari sistem MixRadius eksternal',
}
