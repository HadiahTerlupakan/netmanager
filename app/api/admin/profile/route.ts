import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true, data: profile })
    } catch (error: any) {
        console.error('Profile fetch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { name, phone } = body

        const updateData: { name?: string; phone?: string } = {}
        if (name !== undefined) updateData.name = name
        if (phone !== undefined) updateData.phone = phone

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
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

        return NextResponse.json({ success: true, data: updated })
    } catch (error: any) {
        console.error('Profile update error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { currentPassword, newPassword, confirmPassword } = body

        if (!currentPassword || !newPassword || !confirmPassword) {
            return NextResponse.json({ 
                error: 'Semua field harus diisi' 
            }, { status: 400 })
        }

        if (newPassword !== confirmPassword) {
            return NextResponse.json({ 
                error: 'Password baru dan konfirmasi tidak cocok' 
            }, { status: 400 })
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ 
                error: 'Password minimal 6 karakter' 
            }, { status: 400 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { id: true, passwordHash: true }
        })

        if (!dbUser || !dbUser.passwordHash) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const isValidPassword = await bcrypt.compare(currentPassword, dbUser.passwordHash)
        if (!isValidPassword) {
            return NextResponse.json({ error: 'Password lama salah' }, { status: 400 })
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10)
        
        await prisma.user.update({
            where: { id: session.user.id },
            data: { passwordHash: newPasswordHash }
        })

        return NextResponse.json({ success: true, message: 'Password berhasil diubah' })
    } catch (error: any) {
        console.error('Password change error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
