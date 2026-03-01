import { NextResponse } from 'next/server'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { prismaMitra } from '@/lib/prisma-mitra'

export async function GET(request: Request) {
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

        // Handle Mitra users - separate table
        if (user.role === 'MITRA') {
            const mitra = await prismaMitra.mitra.findUnique({
                where: { id: user.id as string },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    isActive: true,
                    mitraType: true,
                    nik: true,
                    fotoDiri: true,
                    createdAt: true,
                    siteId: true,
                    requiresFaceVerification: true,
                }
            })

            if (!mitra) {
                return NextResponse.json({ error: 'Mitra tidak ditemukan' }, { status: 404 })
            }

            // Fetch site from main DB
            const sites = mitra.siteId ? await prisma.sites.findUnique({
                where: { id: mitra.siteId },
                select: { id: true, name: true }
            }) : null

            // Mitra features are hardcoded based on mitraType
            const features = [
                ...(mitra.mitraType === 'MITRA_SALES' ? ['m_canvasing'] : []),
                ...(mitra.mitraType === 'MITRA_TEKNISI' ? ['m_work_order', 'm_barang', 'm_barang_masuk', 'm_barang_keluar'] : []),
            ]

            return NextResponse.json({
                success: true,
                data: {
                    id: mitra.id,
                    name: mitra.name,
                    email: mitra.email,
                    phone: mitra.phone,
                    image: mitra.fotoDiri, // Use face verification selfie as profile photo
                    nik: mitra.nik,
                    fotoDiri: mitra.fotoDiri,
                    createdAt: mitra.createdAt.toISOString(),
                    mitraType: mitra.mitraType,
                    requiresFaceVerification: mitra.requiresFaceVerification,
                    workingHourMode: null,
                    startWorkTime: null,
                    endWorkTime: null,
                    workDays: null,
                    canvasingTarget: null,
                    isSales: mitra.mitraType === 'MITRA_SALES',
                    departments: null,
                    sites: sites ? [sites] : [],
                    role: { id: 'mitra', name: 'MITRA' },
                    features,
                    isOnLeave: false, // Mitra don't have leave system
                }
            })
        }

        // Handle regular User (Karyawan)
        const profile = await prisma.user.findUnique({
            where: { id: user.id as string },
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
                canvasingTarget: true,
                isSales: true, // Add isSales flag
                departments: {
                    select: { id: true, name: true }
                },
                sites: {
                    select: { id: true, name: true }
                },
                role: {
                    select: {
                        id: true,
                        name: true,
                        permission: {
                            select: {
                                resource: true,
                                action: true
                            }
                        }
                    }
                }
            }
        })

        if (!profile) {
            return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
        }

        // Extract features with canvasing override logic
        const { getUserFeaturesWithCanvasing } = await import('@/lib/canvasing-access')
        const features = await getUserFeaturesWithCanvasing(profile.id)

        // Check for active leave
        const now = new Date(); const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const activeLeave = await prisma.leaveRequest.findFirst({
            where: {
                userId: user.id as string,
                status: 'APPROVED',
                startDate: { lte: now },
                endDate: { gte: startOfToday }
            }
        })
        const isOnLeave = !!activeLeave

        return NextResponse.json({
            success: true,
            data: {
                ...profile,
                features, // Array of feature names with canvasing override logic
                isOnLeave
            }
        })
    } catch (error: unknown) {
        console.error('Profile fetch error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

export async function PATCH(request: Request) {
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
        const { name, phone } = body

        const updateData: { name?: string; phone?: string } = {}
        if (name !== undefined) updateData.name = name
        if (phone !== undefined) updateData.phone = phone

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'Tidak ada field yang diubah' }, { status: 400 })
        }

        const updated = await prisma.user.update({
            where: { id: user.id as string },
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
    } catch (error: unknown) {
        console.error('Profile update error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
