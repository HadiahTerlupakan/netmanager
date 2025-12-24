import { ensureEmployeeAccess } from '@/lib/server-auth'
import DashboardClient from './DashboardClient'

export const metadata = {
    title: 'Dashboard Karyawan | NetManager',
}

import { HolidayRepository } from '@/modules/attendance/repositories/HolidayRepository'

export default async function KaryawanDashboardPage() {
    await ensureEmployeeAccess()

    // Check for holiday
    const holidayRepo = new HolidayRepository()
    const today = new Date()
    // Adjust to Jakarta time if needed, but server time is likely sufficient.
    // However, explicit timezone handling is safer if server is UTC.
    // For now, assuming server time (UTC+7 as per metadata) is correct local time.
    const { isHoliday, holiday } = await holidayRepo.isHoliday(today)

    return <DashboardClient holidayInfo={isHoliday ? holiday : null} />
}
