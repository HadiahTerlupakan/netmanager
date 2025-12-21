import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './AnnouncementDetailClient'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    await ensurePermission('announcement:read')
    return await ClientComponent({ params })
}
