import { NextResponse } from 'next/server'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')
        
        if (!token) {
            return NextResponse.json({ error: 'Token required' }, { status: 401 })
        }
        
        const user = await verifyMobileToken(token)
        if (!user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const body = await request.json()
        const { currentPassword, newPassword, confirmPassword } = body

        if (!currentPassword || !newPassword || !confirmPassword) {
            return NextResponse.json({ 
                error: 'Current password, new password, and confirm password are required' 
            }, { status: 400 })
        }

        if (newPassword !== confirmPassword) {
            return NextResponse.json({ 
                error: 'New password and confirm password do not match' 
            }, { status: 400 })
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ 
                error: 'Password must be at least 6 characters' 
            }, { status: 400 })
        }

        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { id: true, passwordHash: true }
        })

        if (!dbUser || !dbUser.passwordHash) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const isValidPassword = await bcrypt.compare(currentPassword, dbUser.passwordHash)
        if (!isValidPassword) {
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10)
        
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: newPasswordHash }
        })

        return NextResponse.json({ success: true, message: 'Password updated successfully' })
    } catch (error: any) {
        console.error('Password change error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
