import { ensurePermission } from '@/lib/rbac'
import { PppClientCreateForm } from './PppNewClient'

export default async function Page() {
    await ensurePermission('pelanggan:create')
    return <PppClientCreateForm />
}
