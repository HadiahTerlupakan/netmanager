import { ensurePermission } from '@/lib/rbac'
import MitraListClient from './MitraListClient'

export const dynamic = 'force-dynamic'

export default async function MitraPage() {
    await ensurePermission('users:read')
    return <MitraListClient />
}
