import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
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

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        const profile = await prisma.user.findUnique({
            where: { id: session.user.id },
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
    } catch (error: any) {
        console.error('Profile fetch error:', error)
        return ApiErrors.internalError('Gagal mengambil data profil')
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        const body = await request.json()
        
        // Validate with Zod
        const parseResult = updateProfileSchema.safeParse(body)
        if (!parseResult.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parseResult.error.flatten().fieldErrors }
            )
        }

        const { name, phone } = parseResult.data
        const updateData: { name?: string; phone?: string } = {}
        if (name !== undefined) updateData.name = name
        if (phone !== undefined) updateData.phone = phone

        if (Object.keys(updateData).length === 0) {
            return apiError('Tidak ada field untuk diupdate', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        const updated = await prisma.user.update({
            where: { id: session.user.id },
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
    } catch (error: any) {
        console.error('Profile update error:', error)
        return ApiErrors.internalError('Gagal memperbarui profil')
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return ApiErrors.unauthorized('Session tidak valid')
        }

        const body = await request.json()
        
        // Validate with Zod
        const parseResult = changePasswordSchema.safeParse(body)
        if (!parseResult.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parseResult.error.flatten().fieldErrors }
            )
        }

        const { currentPassword, newPassword } = parseResult.data

        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
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
            where: { id: session.user.id },
            data: { passwordHash: newPasswordHash }
        })

        return apiSuccess(null, { message: 'Password berhasil diubah' })
    } catch (error: any) {
        console.error('Password change error:', error)
        return ApiErrors.internalError('Gagal mengubah password')
    }
}
