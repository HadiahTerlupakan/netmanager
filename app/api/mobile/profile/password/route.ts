import { NextResponse } from 'next/server'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { prisma } from '@/modules/database'
import { prismaMitra } from '@/modules/database'
import { logger } from '@/lib/logger'
import bcrypt from 'bcryptjs'
import { apiError, ErrorCodes } from '@/lib/api-response'

export async function POST(request: Request) {
    try {
        const authResult = await getMobileAuthPayload(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const userId = authResult.id as string
        const tenantId = authResult.tenantId as string

        const body = await request.json()
        const { currentPassword, newPassword, confirmPassword } = body

        if (!currentPassword || !newPassword || !confirmPassword) {
            return apiError('Password lama, password baru, dan konfirmasi password wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        if (newPassword !== confirmPassword) {
            return apiError('Password baru dan konfirmasi password tidak cocok', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        if (newPassword.length < 6) {
            return apiError('Password harus minimal 6 karakter', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        const role = authResult.role as string | undefined

        // Pengecekan current password bergantung pada role
        let dbUserPasswordHash: string | null = null

        if (role === 'MITRA') {
            const dbMitra = await prismaMitra.mitra.findUnique({
                where: { id: userId },
                select: { passwordHash: true }
            })
            if (!dbMitra) return apiError('User Mitra tidak ditemukan', ErrorCodes.NOT_FOUND, { status: 404 })
            dbUserPasswordHash = dbMitra.passwordHash
        } else if (role === 'CUSTOMER') {
            const dbCustomer = await prisma.pelanggan.findFirst({
                where: { id: userId, tenantId },
                select: { passwordHash: true }
            })
            if (!dbCustomer) return apiError('User Pelanggan tidak ditemukan', ErrorCodes.NOT_FOUND, { status: 404 })
            dbUserPasswordHash = dbCustomer.passwordHash
        } else {
            const dbUser = await prisma.user.findFirst({
                where: { id: userId, tenantId },
                select: { passwordHash: true }
            })
            if (!dbUser) return apiError('User tidak ditemukan', ErrorCodes.NOT_FOUND, { status: 404 })
            dbUserPasswordHash = dbUser.passwordHash
        }

        if (!dbUserPasswordHash) {
            return apiError('Password belum diatur, silakan hubungi admin', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        const isValidPassword = await bcrypt.compare(currentPassword, dbUserPasswordHash)
        if (!isValidPassword) {
            return apiError('Password lama salah', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10)

        // Update password bergantung pada role
        if (role === 'MITRA') {
            await prismaMitra.mitra.update({
                where: { id: userId },
                data: { passwordHash: newPasswordHash }
            })
        } else if (role === 'CUSTOMER') {
            await prisma.pelanggan.update({
                where: { id: userId, tenantId },
                data: { passwordHash: newPasswordHash }
            })
        } else {
            await prisma.user.update({
                where: { id: userId, tenantId },
                data: { passwordHash: newPasswordHash }
            })
        }

        await logger.logActivity({
            action: 'UPDATE',
            subject: 'Password Change',
            details: {
                method: 'mobile_app',
                role: role || 'USER',
                timestamp: new Date().toISOString()
            },
            userId,
            tenantId
        })

        return NextResponse.json({ success: true, message: 'Password berhasil diubah' })
    } catch (error: unknown) {
        console.error('Password change error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
