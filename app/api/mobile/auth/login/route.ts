import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { compare } from 'bcryptjs'
import { signMobileToken } from '@/lib/mobile-auth'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { email, password, versionCode } = body

        if (!email || !password) {
            return NextResponse.json({ 
                success: false,
                error: 'Email dan password harus diisi' 
            }, { status: 400 })
        }

        // 1. Find User
        const user = await prisma.user.findUnique({
            where: { email },
            include: { 
                role: {
                    include: {
                        permission: true
                    }
                } 
            }
        })

        if (!user || !user.passwordHash) {
            return NextResponse.json({ 
                success: false,
                error: 'Email tidak terdaftar atau akun tidak aktif' 
            }, { status: 401 })
        }

        // 2. Verify Password
        const isValid = await compare(password, user.passwordHash)
        if (!isValid) {
            return NextResponse.json({ 
                success: false,
                error: 'Password yang Anda masukkan salah' 
            }, { status: 401 })
        }

        // 3. Verify Mobile App Access
        // Check "Akses Mobile App" (stored as accessEmployeePanel)
        const hasMobileAccess = user.role?.accessEmployeePanel || user.role?.name === 'SUPER_ADMIN'
        
        if (!hasMobileAccess) {
            return NextResponse.json({ 
                success: false,
                error: 'Akun Anda tidak memiliki akses ke aplikasi mobile. Hubungi administrator.' 
            }, { status: 403 })
        }

        // Update version info if provided
        if (versionCode) {
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    lastVersionCode: parseInt(versionCode),
                    lastVersionName: body.versionName,
                    lastVersionUpdate: new Date()
                }
            })
        }

        // 3. Generate Token
        const tokenPayload = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role?.name || 'USER'
        }
        const token = await signMobileToken(tokenPayload)

        // Extract features with canvasing override logic
        const { getUserFeaturesWithCanvasing } = await import('@/lib/canvasing-access')
        const features = await getUserFeaturesWithCanvasing(user.id)

        // 4. Return Data
        return NextResponse.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role?.name,
                workDays: user.workDays,
                workingHourMode: user.workingHourMode,
                isSales: user.isSales,
                features // Features now include canvasing override logic
            }
        })

    } catch (error) {
        console.error('Mobile Login Error:', error)
        return NextResponse.json({ 
            success: false,
            error: 'Terjadi kesalahan server. Silakan coba lagi.' 
        }, { status: 500 })
    }
}
