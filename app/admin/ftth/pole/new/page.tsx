import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './PoleNewClient'

export default async function Page() {
    await ensurePermission('pole:create')
    return <ClientComponent />
}
