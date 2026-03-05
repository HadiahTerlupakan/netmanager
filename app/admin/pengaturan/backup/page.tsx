import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './DatabaseBackupClient'

export default async function DatabaseBackupPage() {
    await ensurePermission('backup_database:read')
    return <ClientComponent />
}
