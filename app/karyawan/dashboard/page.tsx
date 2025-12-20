import { ensureEmployeeAccess } from '@/lib/server-auth'
import DashboardClient from './DashboardClient'

export const metadata = {
    title: 'Dashboard Karyawan | NetManager',
}

export default async function KaryawanDashboardPage() {
    await ensureEmployeeAccess()
    return <DashboardClient />
}
