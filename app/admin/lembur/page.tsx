import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './LemburClient'

export default async function Page() {
    await ensurePermission('lembur:read')
    return <ClientComponent />
}
