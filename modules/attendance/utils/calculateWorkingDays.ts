import { HolidayRepository } from '../repositories/HolidayRepository'
import { toStartOfDay } from '@/lib/utils/server-datetime'

export async function calculateWorkingDays(
  startDate: Date,
  endDate: Date,
  workDaysStr: string | null = null,
  holidayRepository: HolidayRepository = new HolidayRepository(),
  tenantId: string
): Promise<number> {
  let days = 0
  const curDate = new Date(startDate)
  const lastDate = new Date(endDate)

  curDate.setTime(toStartOfDay(curDate).getTime())
  lastDate.setTime(toStartOfDay(lastDate).getTime())

  const defaultWorkDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const allowedDays = workDaysStr ? workDaysStr.split(',').map((d: string) => d.trim()) : defaultWorkDays
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  while (curDate <= lastDate) {
    const dayIndex = curDate.getDay()
    const dayName = dayNames[dayIndex]

    if (allowedDays.includes(dayName)) {
      const { isHoliday } = await holidayRepository.isHoliday(curDate, tenantId)
      if (!isHoliday) {
        days++
      }
    }

    curDate.setDate(curDate.getDate() + 1)
  }

  return days
}
