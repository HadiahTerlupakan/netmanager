import { ensurePermission } from '@/lib/rbac'
import RadiusDashboard from './RadiusDashboard'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function RadiusPage() {
    await ensurePermission('radius:read')

    // Check if mode is MIKROTIK_API, if so, redirect
    const setting = await prisma.settings.findFirst({
        where: { key: 'PPP_CONNECTION_MODE' }
    })
    
    if (setting?.value === 'MIKROTIK_API') {
        redirect('/admin/network/mikrotik')
    }

    return <RadiusDashboard />
}
