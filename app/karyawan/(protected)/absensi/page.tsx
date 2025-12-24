import AttendancePageContent from '@/components/attendance/AttendancePageContent'
import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Absensi | Portal Karyawan',
    description: 'Halaman absensi harian karyawan',
}

import { ensureEmployeeAccess } from '@/lib/server-auth'

import { HolidayRepository } from '@/modules/attendance/repositories/HolidayRepository'

export default async function AbsensiPage() {
    await ensureEmployeeAccess('k_absensi:read')

    // Check for holiday
    const holidayRepo = new HolidayRepository()
    const today = new Date()
    const { isHoliday, holiday } = await holidayRepo.isHoliday(today)

    return (
        <AttendancePageContent holidayInfo={isHoliday ? holiday : null} />
    )
}
