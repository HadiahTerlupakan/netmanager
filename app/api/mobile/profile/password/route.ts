import { NextResponse } from 'next/server'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json({ error: 'Token wajib diisi' }, { status: 401 })
        }

        const user = await verifyMobileToken(token)
        if (!user) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
        }

        const body = await request.json()
        const { currentPassword, newPassword, confirmPassword } = body

        if (!currentPassword || !newPassword || !confirmPassword) {
            return NextResponse.json({
                error: 'Password lama, password baru, dan konfirmasi password wajib diisi'
            }, { status: 400 })
        }

        if (newPassword !== confirmPassword) {
            return NextResponse.json({
                error: 'Password baru dan konfirmasi password tidak cocok'
            }, { status: 400 })
        }

        if (newPassword.length < 6) {
            return NextResponse.json({
                error: 'Password harus minimal 6 karakter'
            }, { status: 400 })
        }

        const role = user.role as string | undefined

        // Pengecekan current password bergantung pada role
        let dbUserPasswordHash: string | null = null

        if (role === 'MITRA') {
            const dbMitra = await prisma.mitra.findUnique({
                where: { id: user.id as string },
                select: { passwordHash: true }
            })
            if (!dbMitra) return NextResponse.json({ error: 'User Mitra tidak ditemukan' }, { status: 404 })
            dbUserPasswordHash = dbMitra.passwordHash
        } else if (role === 'CUSTOMER') {
            const dbCustomer = await prisma.pelanggan.findUnique({
                where: { id: user.id as string },
                select: { passwordHash: true }
            })
            if (!dbCustomer) return NextResponse.json({ error: 'User Pelanggan tidak ditemukan' }, { status: 404 })
            dbUserPasswordHash = dbCustomer.passwordHash
        } else {
            const dbUser = await prisma.user.findUnique({
                where: { id: user.id as string },
                select: { passwordHash: true }
            })
            if (!dbUser) return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
            dbUserPasswordHash = dbUser.passwordHash
        }

        if (!dbUserPasswordHash) {
            return NextResponse.json({ error: 'Password belum diatur, silakan hubungi admin' }, { status: 400 })
        }

        const isValidPassword = await bcrypt.compare(currentPassword, dbUserPasswordHash)
        if (!isValidPassword) {
            return NextResponse.json({ error: 'Password lama salah' }, { status: 400 })
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10)

        // Update password bergantung pada role
        if (role === 'MITRA') {
            await prisma.mitra.update({
                where: { id: user.id as string },
                data: { passwordHash: newPasswordHash }
            })
        } else if (role === 'CUSTOMER') {
            await prisma.pelanggan.update({
                where: { id: user.id as string },
                data: { passwordHash: newPasswordHash }
            })
        } else {
            await prisma.user.update({
                where: { id: user.id as string },
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
            userId: user.id as string
        })

        return NextResponse.json({ success: true, message: 'Password berhasil diubah' })
    } catch (error: unknown) {
        console.error('Password change error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
