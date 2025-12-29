import { ensurePermission } from '@/lib/rbac'
import { IzinClient } from './IzinClient'

export default async function Page() {
    await ensurePermission('izin:read')
    return <IzinClient />
}
