import { NextRequest, NextResponse } from 'next/server'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'

// POST - Register push token
export async function POST(request: NextRequest) {
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
        const { pushToken } = body


        if (!pushToken) {
            return NextResponse.json({ error: 'Push token wajib diisi' }, { status: 400 })
        }

        // Unique Token Enforcement: Remove this token from any other users/customers
        // This prevents "Shared Device" notification leaks
        await prisma.user.updateMany({
            where: {
                pushToken: pushToken,
                id: { not: user.id as string }
            },
            data: {
                pushToken: null,
                pushTokenUpdatedAt: null
            }
        })
        await prisma.pelanggan.updateMany({
            where: {
                pushToken: pushToken,
                id: { not: user.id as string }
            },
            data: {
                pushToken: null,
                pushTokenUpdatedAt: null
            }
        })
        await prisma.mitra.updateMany({
            where: {
                pushToken: pushToken,
                id: { not: user.id as string }
            },
            data: {
                pushToken: null,
                pushTokenUpdatedAt: null
            }
        })

        // Update user (or customer) with push token
        if (user.role === 'CUSTOMER') {
            await prisma.pelanggan.update({
                where: { id: user.id as string },
                data: {
                    pushToken: pushToken,
                    pushTokenUpdatedAt: new Date()
                }
            })
        } else if (user.role === 'MITRA') {
            await prisma.mitra.update({
                where: { id: user.id as string },
                data: {
                    pushToken: pushToken,
                    pushTokenUpdatedAt: new Date()
                }
            })
        } else {
            // Update User Table (Employees)
            await prisma.user.update({
                where: { id: user.id as string },
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
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json({ error: 'Token wajib diisi' }, { status: 401 })
        }

        const user = await verifyMobileToken(token)
        if (!user) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
        }

        // Remove push token from correct table
        if (user.role === 'CUSTOMER') {
            await prisma.pelanggan.update({
                where: { id: user.id as string },
                data: {
                    pushToken: null,
                    pushTokenUpdatedAt: null
                }
            })
        } else if (user.role === 'MITRA') {
            await prisma.mitra.update({
                where: { id: user.id as string },
                data: {
                    pushToken: null,
                    pushTokenUpdatedAt: null
                }
            })
        } else {
            await prisma.user.update({
                where: { id: user.id as string },
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
