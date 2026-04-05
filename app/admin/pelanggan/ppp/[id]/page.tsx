import { ensurePermission } from '@/lib/rbac'
import { PppClientDetailView } from './PppDetailClient'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    await ensurePermission('pelanggan:read')
    return await PppClientDetailView({ params })
}
