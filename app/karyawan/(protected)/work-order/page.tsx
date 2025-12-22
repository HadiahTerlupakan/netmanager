import { ensureEmployeeAccess } from '@/lib/server-auth'
import WorkOrderListClient from './WorkOrderClient'

export const metadata = {
    title: 'Work Order | Portal Karyawan',
}

export default async function WorkOrderPage() {
    await ensureEmployeeAccess('k_work_order:read')
    return <WorkOrderListClient />
}
