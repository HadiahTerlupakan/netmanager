import { ensureMainTenant } from '@/lib/rbac'
import TenantsClient from './TenantsClient'

export default async function TenantsPage() {
    await ensureMainTenant()
    return <TenantsClient />
}
