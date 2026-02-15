import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { compare } from 'bcryptjs'
import { signMobileToken } from '@/lib/mobile-auth'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { email, password, versionCode, loginType } = body // Accept loginType

        if (!email || !password) {
            return NextResponse.json({ 
                success: false,
                error: 'Email/Username dan password harus diisi' 
            }, { status: 400 })
        }

        // ==========================================
        // CUSTOMER LOGIN (MixRadius)
        // ==========================================
        if (loginType === 'CUSTOMER') {
            try {
                // Dynamic Import to avoid circular deps if any
                const { MixRadiusService } = await import('@/modules/integrations/services/MixRadiusService')
                const mixRadiusService = new MixRadiusService()

                // 1. Search Customer by Username (or MemberID)
                // We use fetchCustomersPPP with search parameter
                const searchResult = await mixRadiusService.fetchCustomersPPP({
                    search: email, // User inputs username/ID here
                    length: 1,
                    // searchType: 'username' // Prioritize username search - REMOVED to allow broader search
                    searchType: 'all' // Search in all fields (username, member_id, etc.)
                })

                const customer = searchResult.data[0]

                if (!customer) {
                    return NextResponse.json({
                        success: false,
                        error: 'ID Pelanggan tidak ditemukan'
                    }, { status: 401 })
                }

                // 2. Verify Password
                // MixRadius often returns cleartext password in the customer object. 
                // WARNING: Ideally we should use a proper auth endpoint, but standard Radius admins usually expose it.
                if (customer.password !== password) {
                    return NextResponse.json({
                        success: false,
                        error: 'Password salah'
                    }, { status: 401 })
                }

                // 3. Generate Token for Customer
                const tokenPayload = {
                    id: customer.id, // MixRadius ID
                    email: customer.username, // Use username as email/identifier
                    name: customer.fullname,
                    role: 'CUSTOMER', // Special Role
                    memberId: customer.member_id // Store member ID for reference
                }
                
                const token = await signMobileToken(tokenPayload)

                return NextResponse.json({
                    success: true,
                    token,
                    user: {
                        id: customer.id,
                        name: customer.fullname,
                        email: customer.username, // Username as identifier
                        role: 'CUSTOMER',
                        isSales: false,
                        features: {
                            canvasing: false,
                            attendance: false, // Customers don't do attendance
                            workOrder: true // Customers can create tickets
                        },
                        // Extra customer data
                        mixRadiusId: customer.id,
                        memberId: customer.member_id,
                        planName: customer.plan_name
                    }
                })

            } catch (error) {
                console.error('[Login] Customer Login Error:', error)
                return NextResponse.json({
                    success: false,
                    error: 'Gagal menghubungi server pelanggan. Coba lagi nanti.'
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
