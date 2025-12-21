import { ensurePermission } from '@/lib/rbac'
import { ClientComponent } from './ReportClient'

export default async function ReportPage() {
    await ensurePermission('report:read')
    return <ClientComponent />
}
