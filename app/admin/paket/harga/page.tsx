import { ensurePermission } from '@/lib/rbac'
import HargaList from './HargaList'

export const dynamic = 'force-dynamic'

export default async function HargaPage() {
    await ensurePermission('harga:read')

    return <HargaList />
}
