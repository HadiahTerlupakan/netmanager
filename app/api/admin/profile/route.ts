import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'
import * as z from 'zod'

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

// GET /api/admin/profile - Get current user profile
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const profile = await prisma.user.findUnique({
        where: { id: ctx.session!.user.id },
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
        return ApiErrors.notFound('User')
    }

    return apiSuccess(profile)
})

// PATCH /api/admin/profile - Update current user profile
export const PATCH = createHandler({ 
    auth: true, 
    schema: updateProfileSchema 
}, async (req, ctx) => {
    const { name, phone } = ctx.validated
    const updateData: { name?: string; phone?: string } = {}
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone

    if (Object.keys(updateData).length === 0) {
        return apiError('Tidak ada field untuk diupdate', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    const updated = await prisma.user.update({
        where: { id: ctx.session!.user.id },
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
})

// POST /api/admin/profile - Change user password
export const POST = createHandler({ 
    auth: true, 
    schema: changePasswordSchema 
}, async (req, ctx) => {
    const { currentPassword, newPassword } = ctx.validated

    const dbUser = await prisma.user.findUnique({
        where: { id: ctx.session!.user.id },
        select: { id: true, passwordHash: true }
    })

    if (!dbUser || !dbUser.passwordHash) {
        return ApiErrors.notFound('User')
    }

    const isValidPassword = await bcrypt.compare(currentPassword, dbUser.passwordHash)
    if (!isValidPassword) {
        return apiError('Password lama salah', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10)
    
    await prisma.user.update({
        where: { id: ctx.session!.user.id },
        data: { passwordHash: newPasswordHash }
    })

    return apiSuccess(null, { message: 'Password berhasil diubah' })
})
