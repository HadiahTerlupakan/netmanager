/**
 * Admin Profile Routes
 * Migrated to use standardized middleware and validation
 */

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { 
  withAuth, 
  withErrorHandler,
  withRateLimit,
  RateLimits,
  ValidationError,
  NotFoundError
} from '@/lib/middleware'
import { apiSuccess } from '@/lib/api-response'
import { z } from 'zod'

/**
 * Validation schemas
 */
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password lama wajib diisi'),
  newPassword: z.string().min(6, 'Password minimal 6 karakter'),
  confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Password baru dan konfirmasi tidak cocok',
  path: ['confirmPassword'],
})

/**
 * GET /api/admin/profile
 * Get current user profile
 */
export const GET = withErrorHandler(
  withAuth(
    withRateLimit(RateLimits.STANDARD,
      async ({ user }) => {
        const profile = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            image: true,
            workingHourMode: true,
            startWorkTime: true,
            endWorkTime: true,
            workDays: true,
            departments: {
              select: { id: true, name: true }
            },
            sites: {
              select: { id: true, name: true }
            },
            role: {
              select: { id: true, name: true }
            }
          }
        })

        if (!profile) {
          throw new NotFoundError('User')
        }

        return apiSuccess(profile)
      }
    )
  )
)

/**
 * PATCH /api/admin/profile
 * Update current user profile
 */
export const PATCH = withErrorHandler(
  withAuth(
    async ({ user, request }) => {
      const body = await request.json()
      
      // Validate with Zod
      const parseResult = updateProfileSchema.safeParse(body)
      if (!parseResult.success) {
        throw new ValidationError('Data tidak valid', { 
          errors: parseResult.error.flatten().fieldErrors 
        })
      }

      const { name, phone } = parseResult.data
      const updateData: { name?: string; phone?: string } = {}
      if (name !== undefined) updateData.name = name
      if (phone !== undefined) updateData.phone = phone

      if (Object.keys(updateData).length === 0) {
        throw new ValidationError('Tidak ada field untuk diupdate', {})
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true
        }
      })

      return apiSuccess(updated, { message: 'Profil berhasil diperbarui' })
    }
  )
)

/**
 * POST /api/admin/profile
 * Change user password
 */
export const POST = withErrorHandler(
  withAuth(
    async ({ user, request }) => {
      const body = await request.json()
      
      // Validate with Zod
      const parseResult = changePasswordSchema.safeParse(body)
      if (!parseResult.success) {
        throw new ValidationError('Data tidak valid', { 
          errors: parseResult.error.flatten().fieldErrors 
        })
      }

      const { currentPassword, newPassword } = parseResult.data

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, passwordHash: true }
      })

      if (!dbUser || !dbUser.passwordHash) {
        throw new NotFoundError('User')
      }

      const isValidPassword = await bcrypt.compare(currentPassword, dbUser.passwordHash)
      if (!isValidPassword) {
        throw new ValidationError('Password lama salah', {})
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 10)
      
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash }
      })

      return apiSuccess(null, { message: 'Password berhasil diubah' })
    }
  )
)
