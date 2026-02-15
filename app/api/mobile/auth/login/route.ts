import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { compare } from 'bcryptjs'
import { signMobileToken } from '@/lib/mobile-auth'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        // DEBUG LOGGING
        console.log('[MobileAuth] Login Request Body:', JSON.stringify(body, null, 2))
        
        const { email, password, versionCode, loginType } = body 

        if (!email || !password) {
            return NextResponse.json({ 
                success: false,
                error: 'Email/Username dan password harus diisi' 
            }, { status: 400 })
        }

        // ==========================================
        // CUSTOMER LOGIN (Local Database - Pelanggan Table)
        // ==========================================
        if (loginType === 'CUSTOMER') {
            try {
                console.log(`[MobileLogin] Attempting Customer Login. Identifier: ${email}`)

                // Search in local Pelanggan table
                // Allow login by: Username (PPPoE), ID Pelanggan, or Email
                const customer = await prisma.pelanggan.findFirst({
                    where: {
                        OR: [
                            { username: email },
                            { idPelanggan: email },
                            { email: email }
                        ]
                    },
                    include: {
                        hargaPaket: true // Include plan details
                    }
                })

                if (!customer) {
                    console.log(`[MobileLogin] Customer not found for: ${email}`)
                    return NextResponse.json({
                        success: false,
                        error: 'ID Pelanggan atau Username tidak ditemukan'
                    }, { status: 401 })
                }

                console.log(`[MobileLogin] Customer found: ${customer.nama} (${customer.id}). Verifying password...`)

                // Verify Password
                // Check against 'password' (PPPoE/Plain) OR 'passwordLogin' (Portal Plain) OR 'passwordHash' (Secure)
                // In many ISPs, customers use their PPPoE password for portal
                let isPasswordValid = false
                
                // Debug log (don't log passwords in production, but useful for dev)
                // console.log(`[MobileLogin] Input: ${password}, DB Plain: ${customer.password}, DB Login: ${customer.passwordLogin}`)

                // 1. Check Plain text (Common for PPP synchronization)
                if (customer.password && customer.password === password) isPasswordValid = true
                if (customer.passwordLogin && customer.passwordLogin === password) isPasswordValid = true

                // 2. Check Hash (If user changed password via portal securely)
                if (!isPasswordValid && customer.passwordHash) {
                    isPasswordValid = await compare(password, customer.passwordHash)
                }

                if (!isPasswordValid) {
                    console.log(`[MobileLogin] Password mismatch for customer: ${customer.id}`)
                    return NextResponse.json({
                        success: false,
                        error: 'Password salah'
                    }, { status: 401 })
                }

                console.log(`[MobileLogin] Login Success for customer: ${customer.nama}`)

                // Generate Token for Customer
                const tokenPayload = {
                    id: customer.id,
                    email: customer.username, // Use username as identifier
                    name: customer.nama,
                    role: 'CUSTOMER',
                    memberId: customer.idPelanggan
                }
                
                const token = await signMobileToken(tokenPayload)

                return NextResponse.json({
                    success: true,
                    token,
                    user: {
                        id: customer.id,
                        name: customer.nama,
                        email: customer.username,
                        role: 'CUSTOMER',
                        isSales: false,
                        features: {
                            canvasing: false,
                            attendance: false,
                            workOrder: true
                        },
                        // Extra customer data for dashboard
                        memberId: customer.idPelanggan,
                        planName: customer.hargaPaket?.name || 'Paket Internet',
                        address: customer.alamat
                    }
                })

            } catch (error) {
                console.error('[Login] Customer Login Error:', error)
                return NextResponse.json({
                    success: false,
                    error: 'Terjadi kesalahan saat login pelanggan.'
                }, { status: 500 })
            }
        }

        // ==========================================
        // EMPLOYEE LOGIN (Default)
        // ==========================================

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
