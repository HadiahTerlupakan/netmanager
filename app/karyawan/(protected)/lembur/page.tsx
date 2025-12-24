import { ensureEmployeeAccess } from '@/lib/server-auth'
import LemburClient from './LemburClient'

export const metadata = {
    title: 'Lembur | Portal Karyawan',
}

import { HolidayRepository } from '@/modules/attendance/repositories/HolidayRepository'

export default async function LemburPage() {
    await ensureEmployeeAccess('k_absensi:read')

    // Check for holiday
    const holidayRepo = new HolidayRepository()
    const today = new Date()
    const { isHoliday, holiday } = await holidayRepo.isHoliday(today)

    return <LemburClient holidayInfo={isHoliday ? holiday : null} />
}
