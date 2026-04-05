import { ensurePermission } from '@/lib/rbac'
import { PppClientEditForm } from './PppEditClient'

export default async function Page() {
    await ensurePermission('pelanggan:update')
    return <PppClientEditForm />
}
