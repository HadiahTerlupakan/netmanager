import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './OnuRegisterClient'

export default async function Page() {
    await ensurePermission('onu:create')
    return <ClientComponent />
}
