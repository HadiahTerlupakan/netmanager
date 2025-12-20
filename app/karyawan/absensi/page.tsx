import AttendancePageContent from '@/components/attendance/AttendancePageContent'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Absensi | Portal Karyawan',
    description: 'Halaman absensi harian karyawan',
}

import { ensureEmployeeAccess } from '@/lib/server-auth'

export default async function AbsensiPage() {
    await ensureEmployeeAccess('k_absensi:read')
    return (
        <AttendancePageContent />
    )
}
