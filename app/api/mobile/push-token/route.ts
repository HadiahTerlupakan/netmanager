import { NextRequest, NextResponse } from 'next/server'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { prisma } from '@/modules/database'
import { prismaMitra } from '@/modules/database'
import { apiError, ErrorCodes } from '@/lib/api-response'

// POST - Register push token
export async function POST(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const userId = authResult.id as string
        const tenantId = authResult.tenantId as string
        const userRole = authResult.role as string | undefined
        if (!userId) {
            return apiError('Token tidak valid', ErrorCodes.UNAUTHORIZED, { status: 401 })
        }

        const body = await request.json()
        const { pushToken } = body


        if (!pushToken) {
            return apiError('Push token wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        // Unique Token Enforcement: Remove this token from any other users/customers
        // This prevents "Shared Device" notification leaks
        await prisma.user.updateMany({
            where: {
                pushToken: pushToken,
                id: { not: userId },
                tenantId
            },
            data: {
                pushToken: null,
                pushTokenUpdatedAt: null
            }
        })
        await prisma.pelanggan.updateMany({
            where: {
                pushToken: pushToken,
                id: { not: userId },
                tenantId
            },
            data: {
                pushToken: null,
                pushTokenUpdatedAt: null
            }
        })
        await prismaMitra.mitra.updateMany({
            where: {
                pushToken: pushToken,
                id: { not: userId }
            },
            data: {
                pushToken: null,
                pushTokenUpdatedAt: null
            }
        })

        // Update user (or customer) with push token
        if (userRole === 'CUSTOMER') {
            await prisma.pelanggan.update({
                where: { id: userId, tenantId },
                data: {
                    pushToken: pushToken,
                    pushTokenUpdatedAt: new Date()
                }
            })
        } else if (userRole === 'MITRA') {
            await prismaMitra.mitra.update({
                where: { id: userId },
                data: {
                    pushToken: pushToken,
                    pushTokenUpdatedAt: new Date()
                }
            })
        } else {
            // Update User Table (Employees)
            await prisma.user.update({
                where: { id: userId, tenantId },
                data: {
                    pushToken: pushToken,
                    pushTokenUpdatedAt: new Date()
                }
            })
        }

        return NextResponse.json({ success: true, message: 'Push token terdaftar' })

    } catch (error: unknown) {
        console.error('Push token registration error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

// DELETE - Remove push token (on logout)
export async function DELETE(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const userId = authResult.id as string
        const tenantId = authResult.tenantId as string
        const userRole = authResult.role as string | undefined
        if (!userId) {
            return apiError('Token tidak valid', ErrorCodes.UNAUTHORIZED, { status: 401 })
        }

        // Remove push token from correct table
        if (userRole === 'CUSTOMER') {
            await prisma.pelanggan.update({
                where: { id: userId, tenantId },
                data: {
                    pushToken: null,
                    pushTokenUpdatedAt: null
                }
            })
        } else if (userRole === 'MITRA') {
            await prismaMitra.mitra.update({
                where: { id: userId },
                data: {
                    pushToken: null,
                    pushTokenUpdatedAt: null
                }
            })
        } else {
            await prisma.user.update({
                where: { id: userId, tenantId },
                data: {
                    pushToken: null,
                    pushTokenUpdatedAt: null
                }
            })
        }

        return NextResponse.json({ success: true, message: 'Push token dihapus' })
    } catch (error: unknown) {
        console.error('Push token removal error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
