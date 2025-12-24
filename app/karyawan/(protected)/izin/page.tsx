import { ensureEmployeeAccess } from '@/lib/server-auth'
import LeaveClient from './LeaveClient'

export const metadata = {
    title: 'Izin & Cuti | Portal Karyawan',
}

export default async function IzinPage() {
    await ensureEmployeeAccess('k_absensi:read')
    return <LeaveClient />
}
