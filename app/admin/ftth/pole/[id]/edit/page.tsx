import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './PoleEditClient'

export default async function Page() {
    await ensurePermission('pole:update')
    return <ClientComponent />
}
