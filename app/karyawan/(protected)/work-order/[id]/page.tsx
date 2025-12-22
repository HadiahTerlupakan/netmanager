
import { ensureEmployeeAccess } from '@/lib/server-auth'
import WorkOrderDetailClient from './WorkOrderDetailClient'

export default async function WorkOrderDetailPage() {
    await ensureEmployeeAccess('k_work_order:read')

    return <WorkOrderDetailClient />
}
