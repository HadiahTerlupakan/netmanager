import { prisma } from '@/lib/prisma'
import { sendPushNotification } from '@/modules/notification/services/ExpoPushService'
import { createNotification } from '@/modules/notification/services/NotificationService'
import { toStartOfDay, toEndOfDay } from '@/lib/utils/datetime'


/**
 * Attendance Alert Service
 * Handles notifications for missing/incomplete attendance
 * Uses per-user work schedule settings (startWorkTime, endWorkTime)
 */

interface UserSchedule {
    userId: string
    userName: string | null
    startWorkTime: string
    endWorkTime: string
    workDays: string | null
    pushToken: string | null
}

/**
 * Parse time string (HH:mm) to Date object for today
 */
function parseTimeToDate(timeStr: string, date: Date = new Date()): Date {
    const parts = timeStr.split(':').map(Number)
    const hours = parts[0] ?? 0
    const minutes = parts[1] ?? 0
    const result = new Date(date)
    result.setHours(hours, minutes, 0, 0)
    return result
}

/**
 * Check if current time is past the reminder time
 * @param workTime - Work start/end time (HH:mm)
 * @param reminderMinutes - Minutes after workTime to trigger reminder
 * @param currentTime - Current time
 * @param windowMinutes - How long the reminder window stays open (default 30 min)
 */
function isInReminderWindow(
    workTime: string,
    reminderMinutes: number = 30,
    currentTime: Date = new Date(),
    windowMinutes: number = 30
): boolean {
    const workDate = parseTimeToDate(workTime, currentTime)
    const reminderStart = new Date(workDate.getTime() + reminderMinutes * 60 * 1000)
    const reminderEnd = new Date(reminderStart.getTime() + windowMinutes * 60 * 1000)

    return currentTime >= reminderStart && currentTime <= reminderEnd
}

/**
 * Get day name in English (MON, TUE, WED, etc.)
 */
function getDayName(date: Date = new Date()): string {
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    return days[date.getDay()] ?? 'SUN'
}

/**
 * Check if user works on given day
 */
function isWorkDay(workDays: string | null, date: Date = new Date()): boolean {
    if (!workDays) return true // Default: all days are work days

    const dayName = getDayName(date)
    const workDayList = workDays.toUpperCase().split(',').map(d => d.trim())

    return workDayList.includes(dayName)
}

/**
 * Get users who need check-in reminder based on their individual schedules
 */
export async function getUsersNeedingCheckInReminder(
    reminderMinutes: number = 30
): Promise<UserSchedule[]> {
    const now = new Date()

    const startOfDay = new Date(now)
    startOfDay.setTime(toStartOfDay(startOfDay).getTime())
    const endOfDay = new Date(now)
    endOfDay.setTime(toEndOfDay(endOfDay).getTime())

    // Get all active users with push tokens and work schedule configured
    const users = await prisma.user.findMany({
        where: {
            isActive: true,
            pushToken: { not: null },
            startWorkTime: { not: null }
        },
        select: {
            id: true,
            name: true,
            startWorkTime: true,
            endWorkTime: true,
            workDays: true,
            pushToken: true
        }
    })

    // Get users who have already checked in today
    const checkedInToday = await prisma.attendance.findMany({
        where: {
            checkIn: { gte: startOfDay, lte: endOfDay }
        },
        select: { userId: true }
    })
    const checkedInUserIds = new Set(checkedInToday.map(a => a.userId))

    // Filter users who:
    // 1. Haven't checked in today
    // 2. Are within their reminder window
    // 3. Work on this day
    return users.filter(user => {
        if (checkedInUserIds.has(user.id)) return false
        if (!user.startWorkTime) return false
        if (!isWorkDay(user.workDays, now)) return false
        if (!isInReminderWindow(user.startWorkTime, reminderMinutes, now)) return false

        return true
    }).map(user => ({
        userId: user.id,
        userName: user.name,
        startWorkTime: user.startWorkTime!,
        endWorkTime: user.endWorkTime || '17:00',
        workDays: user.workDays,
        pushToken: user.pushToken
    }))
}

/**
 * Get users who need check-out reminder based on their individual schedules
 */
export async function getUsersNeedingCheckOutReminder(
    reminderMinutes: number = 30,
    windowMinutes: number = 30
): Promise<UserSchedule[]> {
    const now = new Date()

    const startOfDay = new Date(now)
    startOfDay.setTime(toStartOfDay(startOfDay).getTime())
    const endOfDay = new Date(now)
    endOfDay.setTime(toEndOfDay(endOfDay).getTime())

    // Get users who checked in but haven't checked out
    const incompleteAttendance = await prisma.attendance.findMany({
        where: {
            checkIn: { gte: startOfDay, lte: endOfDay },
            checkOut: null,
            user: {
                isActive: true,
                pushToken: { not: null },
                endWorkTime: { not: null },
                workingHourMode: { not: 'FLEXIBLE' }
            }
        },
        include: {
            user: {
                select: {
                    id: true,
                    name: true,
                    startWorkTime: true,
                    endWorkTime: true,
                    workDays: true,
                    pushToken: true
                }
            }
        },
        distinct: ['userId']
    })

    // Filter users within their check-out reminder window
    return incompleteAttendance.filter(att => {
        const user = att.user
        if (!user.endWorkTime) return false
        if (!isWorkDay(user.workDays, now)) return false
        if (!isInReminderWindow(user.endWorkTime, reminderMinutes, now, windowMinutes)) return false

        return true
    }).map(att => ({
        userId: att.user.id,
        userName: att.user.name,
        startWorkTime: att.user.startWorkTime || '08:00',
        endWorkTime: att.user.endWorkTime!,
        workDays: att.user.workDays,
        pushToken: att.user.pushToken
    }))
}

/**
 * Send check-in reminders to users based on their schedules
 */
export async function processCheckInReminders(
    reminderMinutes: number = 30
): Promise<{ usersNotified: number; details: string[] }> {
    try {
        const users = await getUsersNeedingCheckInReminder(reminderMinutes)

        if (users.length === 0) {
            console.log('[AttendanceAlert] No users need check-in reminder at this time')
            return { usersNotified: 0, details: [] }
        }

        const details: string[] = []
        let notified = 0

        // Send individual notifications with personalized time info
        for (const user of users) {
            if (user.pushToken) {
                await sendPushNotification(
                    user.userId,
                    '⏰ Reminder Absensi',
                    `Anda belum check-in hari ini. Jam kerja Anda: ${user.startWorkTime}`,
                    {
                        type: 'attendance_reminder',
                        action: 'check_in'
                    }
                )
                notified++
                details.push(`${user.userName} (${user.startWorkTime})`)
            }
        }

        console.log(`[AttendanceAlert] Sent check-in reminder to ${notified} users`)
        return { usersNotified: notified, details }
    } catch (error) {
        console.error('[AttendanceAlert] Error sending check-in reminders:', error)
        return { usersNotified: 0, details: [] }
    }
}

/**
 * Send check-out reminders to users based on their schedules
 */
export async function processCheckOutReminders(
    reminderMinutes: number = 30
): Promise<{ usersNotified: number; details: string[] }> {
    try {
        const users = await getUsersNeedingCheckOutReminder(reminderMinutes)

        if (users.length === 0) {
            console.log('[AttendanceAlert] No users need check-out reminder at this time')
            return { usersNotified: 0, details: [] }
        }

        const details: string[] = []
        let notified = 0

        for (const user of users) {
            if (user.pushToken) {
                await sendPushNotification(
                    user.userId,
                    '🏠 Reminder Check-Out',
                    `Anda belum check-out hari ini. Jam pulang Anda: ${user.endWorkTime}`,
                    {
                        type: 'attendance_reminder',
                        action: 'check_out'
                    }
                )
                notified++
                details.push(`${user.userName} (${user.endWorkTime})`)
            }
        }

        console.log(`[AttendanceAlert] Sent check-out reminder to ${notified} users`)
        return { usersNotified: notified, details }
    } catch (error) {
        console.error('[AttendanceAlert] Error sending check-out reminders:', error)
        return { usersNotified: 0, details: [] }
    }
}

/**
 * Send individual attendance alert to a specific user
 */
export async function sendAttendanceAlertToUser(
    userId: string,
    type: 'missing_checkin' | 'missing_checkout' | 'late'
): Promise<boolean> {
    const messages = {
        missing_checkin: {
            title: '⚠️ Absensi Tidak Lengkap',
            body: 'Anda belum melakukan check-in hari ini.'
        },
        missing_checkout: {
            title: '⚠️ Absensi Tidak Lengkap',
            body: 'Anda belum melakukan check-out hari ini.'
        },
        late: {
            title: '⏰ Keterlambatan Terdeteksi',
            body: 'Anda tercatat terlambat masuk hari ini.'
        }
    }

    const message = messages[type]

    // Create notification in database
    await createNotification({
        type: 'ALERT',
        priority: 'NORMAL',
        title: message.title,
        message: message.body,
        userId,
        sourceType: 'ATTENDANCE',
        link: '/attendance'
    })

    return true
}

/**
 * Process incomplete attendance for end of day reporting
 */
export async function processIncompleteAttendance(): Promise<{
    missingCheckOut: number
    usersNotified: string[]
}> {
    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setTime(toStartOfDay(startOfDay).getTime())
    const endOfDay = new Date(now)
    endOfDay.setTime(toEndOfDay(endOfDay).getTime())

    // Find users who checked in but didn't check out
    const incomplete = await prisma.attendance.findMany({
        where: {
            checkIn: { gte: startOfDay, lte: endOfDay },
            checkOut: null,
            user: {
                workingHourMode: { not: 'FLEXIBLE' }
            }
        },
        select: { userId: true, user: { select: { name: true } } }
    })

    const usersNotified: string[] = []

    for (const att of incomplete) {
        await sendAttendanceAlertToUser(att.userId, 'missing_checkout')
        usersNotified.push(att.user.name || att.userId)
    }

    return {
        missingCheckOut: incomplete.length,
        usersNotified
    }
}

// New Function: Late Checkout Reminder (3-4 hours after shift)
export async function processLateCheckOutReminders(): Promise<{ usersNotified: number; details: string[] }> {
    // 3 hours (180 mins) to 4 hours (240 mins) window
    // so reminderMinutes = 180, windowMinutes = 60
    const reminderMinutes = 180
    const windowMinutes = 60

    try {
        const users = await getUsersNeedingCheckOutReminder(reminderMinutes, windowMinutes)

        if (users.length === 0) {
            return { usersNotified: 0, details: [] }
        }

        const details: string[] = []
        let notified = 0

        for (const user of users) {
            if (user.pushToken) {
                await sendPushNotification(
                    user.userId,
                    '🛑 Belum Absen Pulang?',
                    `Sudah 3 jam lewat dari jam pulang (${user.endWorkTime}). Jangan lupa Check-Out agar tidak kena penalti!`,
                    {
                        type: 'attendance_reminder',
                        action: 'check_out'
                    }
                )
                notified++
                details.push(`${user.userName} (${user.endWorkTime})`)
            }
        }

        console.log(`[AttendanceAlert] Sent LATE check-out reminder to ${notified} users`)
        return { usersNotified: notified, details }
    } catch (error) {
        console.error('[AttendanceAlert] Error sending late check-out reminders:', error)
        return { usersNotified: 0, details: [] }
    }
}

/**
 * Main function to be called by cron job every 15 minutes
 * Automatically checks all users based on their individual schedules
 */
export async function runScheduledAttendanceCheck(
    reminderMinutes: number = 30
): Promise<{
    checkIn: { usersNotified: number; details: string[] }
    checkOut: { usersNotified: number; details: string[] }
    lateCheckOut: { usersNotified: number; details: string[] }
    flexible: { usersNotified: number; details: string[] }
}> {
    const [checkInResult, checkOutResult, lateCheckOutResult, flexibleReminderResult] = await Promise.all([
        processCheckInReminders(reminderMinutes),
        processCheckOutReminders(reminderMinutes),
        processLateCheckOutReminders(),
        processFlexibleReminders()
    ])

    console.log('[AttendanceAlert] Scheduled check completed:', {
        checkIn: checkInResult.usersNotified,
        checkOut: checkOutResult.usersNotified,
        lateCheckOut: lateCheckOutResult.usersNotified,
        flexible: flexibleReminderResult.usersNotified
    })

    return {
        checkIn: checkInResult,
        checkOut: checkOutResult,
        lateCheckOut: lateCheckOutResult,
        flexible: flexibleReminderResult
    }
}

/**
 * Send reminders to Flexible users who have exceeded their target hours
 * Triggers every ~1 hour after passing the target duration
 */
export async function processFlexibleReminders(): Promise<{ usersNotified: number; details: string[] }> {
    try {
        const now = new Date()
        const startOfDay = new Date(now)
        startOfDay.setTime(toStartOfDay(startOfDay).getTime())
        const endOfDay = new Date(now)
        endOfDay.setTime(toEndOfDay(endOfDay).getTime())

        // Find Flexible users currently Checked-In (CheckOut is null)
        // Note: Removed the gte: startOfDay constraint to allow notifications for sessions started on previous days
        const activeFlexibleSessions = await prisma.attendance.findMany({
            where: {
                checkOut: null,
                user: {
                    isActive: true,
                    pushToken: { not: null },
                    workingHourMode: 'FLEXIBLE'
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        flexibleTargetHour: true,
                        pushToken: true
                    }
                }
            }
        })

        if (activeFlexibleSessions.length === 0) {
            return { usersNotified: 0, details: [] }
        }

        const details: string[] = []
        let notified = 0

        for (const session of activeFlexibleSessions) {
            const checkInTime = new Date(session.checkIn).getTime()
            const currentTime = now.getTime()
            const durationHours = (currentTime - checkInTime) / (1000 * 60 * 60)
            const targetHours = session.user.flexibleTargetHour || 8

            // Only notify if duration exceeds target
            if (durationHours > targetHours) {
                const excessHours = durationHours - targetHours

                // Logic to trigger roughly every hour (within 15 min window of the cron job)
                // e.g., if excess is 1.05h (1h 3m) -> Notify
                // if excess is 2.1h (2h 6m) -> Notify
                // Using modulo 1 check
                const remainder = excessHours % 1

                // Trigger if we are in the first 0.25 (15 mins) of a new hour block
                // OR if it's the very first time crossing the threshold (within first 15 mins)
                if (remainder >= 0 && remainder <= 0.25) {

                    const hoursWorked = Math.floor(durationHours)
                    const minutesWorked = Math.round((durationHours % 1) * 60)

                    await sendPushNotification(
                        session.user.id,
                        '⏰ Reminder Check-Out (Fleksibel)',
                        `Halo ${session.user.name}, durasi kerja Anda sudah mencapai ${hoursWorked} jam ${minutesWorked} menit (Target: ${targetHours} jam). Harap segera Check-Out jika sudah selesai.`,
                        {
                            type: 'attendance_reminder',
                            action: 'check_out'
                        }
                    )

                    notified++
                    details.push(`${session.user.name} (${hoursWorked}h ${minutesWorked}m)`)
                }
            }
        }

        if (notified > 0) {
            console.log(`[AttendanceAlert] Sent FLEXIBLE reminder to ${notified} users`)
        }

        return { usersNotified: notified, details }
    } catch (error) {
        console.error('[AttendanceAlert] Error sending flexible reminders:', error)
        return { usersNotified: 0, details: [] }
    }
}

// ==========================================
// LEGACY FUNCTIONS (for backward compatibility)
// ==========================================

/**
 * @deprecated Use processCheckInReminders() instead
 */
export async function sendCheckInReminder(): Promise<number> {
    const result = await processCheckInReminders()
    return result.usersNotified
}

/**
 * @deprecated Use processCheckOutReminders() instead
 */
export async function sendCheckOutReminder(): Promise<number> {
    const result = await processCheckOutReminders()
    return result.usersNotified
}

/**
 * @deprecated Use runScheduledAttendanceCheck() instead
 */
export async function runDailyAttendanceCheck(): Promise<void> {
    await runScheduledAttendanceCheck()
}
