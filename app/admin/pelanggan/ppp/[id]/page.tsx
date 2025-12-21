import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './PppDetailClient'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    await ensurePermission('pelanggan:read')
    return await ClientComponent({ params })
}
