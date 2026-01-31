/**
 * Admin Attendance Single Record Routes
 * Migrated to use standardized middleware and validation
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  withAuth, 
  withPermission, 
  withErrorHandler, 
  withRateLimit,
  RateLimits,
  ValidationError,
  NotFoundError,
  applyRBACRestrictions,
  type RBACFilterContext
} from '@/lib/middleware'
import { apiSuccess } from '@/lib/api-response'
import { attendanceUpdateSchema } from '@/lib/validations/attendance'
import { idSchema } from '@/lib/validations/common'
import { logger } from '@/lib/logger'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/attendance/[id]
 * Retrieve single attendance record
 */
export const GET = withErrorHandler(
  withAuth(
    withPermission('attendance:read',
      applyRBACRestrictions(
        { 
          sitePermission: 'attendance:site_only', 
          departmentPermission: 'attendance:department_only' 
        },
        withRateLimit(RateLimits.STANDARD,
          async (context, routeContext) => {
            const { filters } = context as RBACFilterContext<{ siteId?: string; departmentId?: string }>
            const { id } = await (routeContext as RouteContext).params

            // Validate ID format
            const parseResult = idSchema.safeParse(id)
            if (!parseResult.success) {
              throw new ValidationError('ID tidak valid', {
                errors: parseResult.error.flatten().fieldErrors
              })
            }

            // Fetch attendance with user details
            const attendance = await prisma.attendance.findUnique({
              where: { id: parseResult.data },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                    siteId: true,
                    departmentId: true,
                    departments: { select: { name: true } },
                    sites: { select: { name: true } }
                  }
                }
              }
            })

            if (!attendance) {
              throw new NotFoundError('Data absensi tidak ditemukan')
            }

            // Apply RBAC filtering on the retrieved record
            const recordUser = attendance.user
            if (filters.siteId && recordUser.siteId !== filters.siteId) {
              throw new NotFoundError('Data absensi tidak ditemukan')
            }
            if (filters.departmentId && recordUser.departmentId !== filters.departmentId) {
              throw new NotFoundError('Data absensi tidak ditemukan')
            }

            return apiSuccess(attendance)
          }
        )
      )
    )
  )
)

/**
 * PATCH /api/admin/attendance/[id]
 * Update attendance record (admin correction)
 */
export const PATCH = withErrorHandler(
  withAuth(
    withPermission('attendance:update',
      applyRBACRestrictions(
        { 
          sitePermission: 'attendance:site_only', 
          departmentPermission: 'attendance:department_only' 
        },
        async ({ user, request, filters }, routeContext) => {
          const { id } = await (routeContext as RouteContext).params

          // Validate ID format
          const idParseResult = idSchema.safeParse(id)
          if (!idParseResult.success) {
            throw new ValidationError('ID tidak valid', {
              errors: idParseResult.error.flatten().fieldErrors
            })
          }

          // Parse and validate request body
          const body = await request.json()
          const parseResult = attendanceUpdateSchema.safeParse(body)

          if (!parseResult.success) {
            throw new ValidationError('Data tidak valid', {
              errors: parseResult.error.flatten().fieldErrors
            })
          }

          const { checkIn, checkOut, status, notes } = parseResult.data

          // Fetch existing attendance to get userId and User details
          const existingAttendance = await prisma.attendance.findUnique({
            where: { id: idParseResult.data },
            include: { user: true }
          })

          if (!existingAttendance) {
            throw new NotFoundError('Data absensi tidak ditemukan')
          }

          // Apply RBAC filtering
          const recordUser = existingAttendance.user
          if (filters.siteId && recordUser.siteId !== filters.siteId) {
            throw new NotFoundError('Data absensi tidak ditemukan')
          }
          if (filters.departmentId && recordUser.departmentId !== filters.departmentId) {
            throw new NotFoundError('Data absensi tidak ditemukan')
          }

          // Prepare update data
          const updateData: Prisma.AttendanceUpdateInput = {}
          if (checkIn) updateData.checkIn = new Date(checkIn)
          if (checkOut !== undefined) updateData.checkOut = checkOut ? new Date(checkOut) : null
          if (notes !== undefined) updateData.notes = notes

          // Auto-calculate status if checkIn changes
          if (checkIn && existingAttendance.user.startWorkTime && existingAttendance.user.workingHourMode !== 'FLEXIBLE') {
            const userDetails = existingAttendance.user

            // Fetch Tolerance Setting and Timezone
            const [toleranceSetting, timezoneSetting] = await Promise.all([
              prisma.settings.findFirst({
                where: { key: 'GENERAL_ATTENDANCE_TOLERANCE' }
              }),
              prisma.settings.findFirst({
                where: { key: 'GENERAL_TIMEZONE' }
              })
            ])

            const toleranceMinutes = toleranceSetting?.value ? parseInt(toleranceSetting.value) : 0
            const timezone = timezoneSetting?.value || 'Asia/Jakarta'

            const parts = userDetails.startWorkTime!.split(':')
            const schedHour = Number(parts[0]) || 0
            const schedMinute = Number(parts[1]) || 0

            // 1. Parse the new checkIn time
            const checkInDate = new Date(checkIn)

            // 2. Convert checkIn to Wall Clock Time in Target Timezone
            const checkInInTz = new Date(checkInDate.toLocaleString('en-US', { timeZone: timezone }))

            // 3. Create Schedule for THAT day (in Timezone Context)
            const scheduleTime = new Date(checkInInTz)
            scheduleTime.setHours(schedHour, schedMinute, 0, 0)

            const toleranceMs = toleranceMinutes * 60 * 1000
            const lateThreshold = new Date(scheduleTime.getTime() + toleranceMs)

            // Determine status by comparing "Wall Clock" times
            updateData.status = checkInInTz > lateThreshold ? 'LATE' : 'ON_TIME'
          } else if (status) {
            // If checkIn didn't change (or user has no schedule), allow manual status update
            updateData.status = status
          }

          const updated = await prisma.attendance.update({
            where: { id: idParseResult.data },
            data: updateData,
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                  image: true,
                  departments: { select: { name: true } },
                  sites: { select: { name: true } }
                }
              }
            }
          })

          // System Log
          try {
            await logger.logActivity({
              action: 'UPDATE',
              subject: 'Attendance',
              userId: user.id,
              details: { id: idParseResult.data, updates: updateData }
            })
          } catch (e) { 
            console.error('Logging failed', e) 
          }

          return apiSuccess(updated, { message: 'Absensi berhasil diperbarui' })
        }
      )
    )
  )
)

/**
 * DELETE /api/admin/attendance/[id]
 * Remove attendance record
 */
export const DELETE = withErrorHandler(
  withAuth(
    withPermission('attendance:delete',
      applyRBACRestrictions(
        { 
          sitePermission: 'attendance:site_only', 
          departmentPermission: 'attendance:department_only' 
        },
        async ({ user, filters }, routeContext) => {
          const { id } = await (routeContext as RouteContext).params

          // Validate ID format
          const parseResult = idSchema.safeParse(id)
          if (!parseResult.success) {
            throw new ValidationError('ID tidak valid', {
              errors: parseResult.error.flatten().fieldErrors
            })
          }

          // Check existence and apply RBAC
          const existing = await prisma.attendance.findUnique({
            where: { id: parseResult.data },
            include: { user: true }
          })

          if (!existing) {
            throw new NotFoundError('Data absensi tidak ditemukan')
          }

          // Apply RBAC filtering
          const recordUser = existing.user
          if (filters.siteId && recordUser.siteId !== filters.siteId) {
            throw new NotFoundError('Data absensi tidak ditemukan')
          }
          if (filters.departmentId && recordUser.departmentId !== filters.departmentId) {
            throw new NotFoundError('Data absensi tidak ditemukan')
          }

          await prisma.attendance.delete({
            where: { id: parseResult.data }
          })

          // System Log
          try {
            await logger.logActivity({
              action: 'DELETE',
              subject: 'Attendance',
              userId: user.id,
              details: { id: parseResult.data }
            })
          } catch (e) { 
            console.error('Logging failed', e) 
          }

          return apiSuccess({ id: parseResult.data }, { message: 'Absensi berhasil dihapus' })
        }
      )
    )
  )
)
