import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './BankAccountsClient'

export default async function Page() {
    await ensurePermission('bank_accounts:read')
    return <ClientComponent />
}
