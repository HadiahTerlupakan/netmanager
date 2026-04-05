import { ensurePermission } from '@/lib/rbac'
import { PppClientRenewForm } from './PppRenewClient'

export default async function Page() {
    await ensurePermission('pelanggan:update')
    return <PppClientRenewForm />
}
