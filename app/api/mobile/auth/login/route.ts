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

        // IMPORTANT: Log what we received to debug why "loginType" might be wrong
        console.log(`[MobileAuth] Parsed: email=${email}, loginType=${loginType}`)

        if (!email || !password) {
            return NextResponse.json({ 
                success: false,
                error: 'Email/Username dan password harus diisi' 
            }, { status: 400 })
        }

        // SMART LOGIN - AUTO DETECT
        // If loginType is provided, try that first.
        // If not found in that table, fallback to the other table SILENTLY.
        
        let targetType = loginType || 'EMPLOYEE' // Default to EMPLOYEE if undefined
        let userFound = false
        
        // Strategy: 
        // 1. Try Primary Target (based on tab)
        // 2. If user NOT FOUND, try Secondary Target
        // 3. If user FOUND but password wrong, FAIL (don't try other to prevent ambiguity)

        // ==========================================
        // ATTEMPT 1: Primary Target
        // ==========================================
        if (targetType === 'CUSTOMER') {
             // ... Customer Logic ...
             // If not found -> try employee
        } else {
             // ... Employee Logic ...
             // If not found -> try customer
        }
        
        // REFACTORING LOGIC TO BE CLEANER:
        
        // Helper: Try Login as Customer
        const tryCustomerLogin = async () => {
            const customer = await prisma.pelanggan.findFirst({
                where: {
                    OR: [
                        { username: { equals: email, mode: 'insensitive' } },
                        { idPelanggan: { equals: email, mode: 'insensitive' } },
                        { email: { equals: email, mode: 'insensitive' } }
                    ]
                },
                include: { hargaPaket: true }
            })
            
            if (!customer) return { found: false }
            
            // User found, check password
            let isPasswordValid = false
            if (customer.password && customer.password === password) isPasswordValid = true
            if (customer.passwordLogin && customer.passwordLogin === password) isPasswordValid = true
            if (!isPasswordValid && customer.passwordHash) {
                isPasswordValid = await compare(password, customer.passwordHash)
            }

            if (!isPasswordValid) return { found: true, success: false, error: 'Password salah' }

            // Success
            const { generatePelangganAccessToken } = await import('@/lib/jwt')
            const token = generatePelangganAccessToken({
                id: customer.id,
                idPelanggan: customer.idPelanggan,
                nama: customer.nama,
                username: customer.username,
                status: customer.status
            }, '7d')

            return {
                found: true,
                success: true,
                data: {
                    token,
                    user: {
                        id: customer.id,
                        name: customer.nama,
                        email: customer.username,
                        role: 'CUSTOMER',
                        isSales: false,
                        features: { canvasing: false, attendance: false, workOrder: true },
                        memberId: customer.idPelanggan,
                        planName: customer.hargaPaket?.name || 'Paket Internet',
                        address: customer.alamat
                    }
                }
            }
        }

        // Helper: Try Login as Employee
        const tryEmployeeLogin = async () => {
            const user = await prisma.user.findUnique({
                where: { email },
                include: { role: { include: { permission: true } } }
            })

            if (!user) return { found: false }
            if (!user.passwordHash) return { found: false } // Treat no password as not found/inactive

            const isValid = await compare(password, user.passwordHash)
            if (!isValid) return { found: true, success: false, error: 'Password salah' }

            // Check Access
            const hasMobileAccess = user.role?.accessEmployeePanel || user.role?.name === 'SUPER_ADMIN'
            if (!hasMobileAccess) return { found: true, success: false, error: 'Akun tidak memiliki akses mobile app', status: 403 }

            // Update version
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

            const tokenPayload = {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role?.name || 'USER'
            }
            const token = await signMobileToken(tokenPayload)
            const { getUserFeaturesWithCanvasing } = await import('@/lib/canvasing-access')
            const features = await getUserFeaturesWithCanvasing(user.id)

            return {
                found: true,
                success: true,
                data: {
                    token,
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role?.name,
                        workDays: user.workDays,
                        workingHourMode: user.workingHourMode,
                        isSales: user.isSales,
                        features
                    }
                }
            }
        }

        // EXECUTION FLOW
        let result
        console.log(`[MobileLogin] Strategy: ${loginType === 'CUSTOMER' ? 'Customer First' : 'Employee First'}`)

        if (loginType === 'CUSTOMER') {
            result = await tryCustomerLogin()
            if (!result.found) {
                console.log('[MobileLogin] Customer not found, falling back to Employee check...')
                const empResult = await tryEmployeeLogin()
                if (empResult.found) result = empResult // Override if found as employee
            }
        } else {
            result = await tryEmployeeLogin()
            if (!result.found) {
                console.log('[MobileLogin] Employee not found, falling back to Customer check...')
                const custResult = await tryCustomerLogin()
                if (custResult.found) result = custResult // Override if found as customer
            }
        }

        // Final Response Handler
        if (!result.found) {
            return NextResponse.json({ success: false, error: 'Email/ID tidak ditemukan' }, { status: 401 })
        }

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: result.status || 401 })
        }

        return NextResponse.json({
            success: true,
            ...result.data
        })

    } catch (error) {
        console.error('Mobile Login Error:', error)
        return NextResponse.json({ 
            success: false,
            error: 'Terjadi kesalahan server. Silakan coba lagi.' 
        }, { status: 500 })
    }
}
