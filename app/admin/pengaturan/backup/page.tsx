import { ensurePermission, hasPermission } from '@/lib/rbac'
import { ClientComponent } from './DatabaseBackupClient'

export default async function DatabaseBackupPage() {
    await ensurePermission('backup_database:read')
    const canResetDatabase = await hasPermission('backup_database:delete')

    return <ClientComponent canResetDatabase={canResetDatabase} />
}
