import { NextResponse } from 'next/server'
import { apiError, apiSuccess, ErrorCodes } from '@/lib/api-response'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { prisma } from '@/lib/prisma'
import { prismaMitra } from '@/lib/prisma-mitra'

export async function GET(request: Request) {
    try {
        const authResult = await getMobileAuthPayload(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const user = authResult

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
                return apiError('Mitra tidak ditemukan', ErrorCodes.NOT_FOUND, { status: 404 })
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

            return apiSuccess({
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
            return apiError('User tidak ditemukan', ErrorCodes.NOT_FOUND, { status: 404 })
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

        return apiSuccess({
            ...profile,
            features, // Array of feature names with canvasing override logic
            isOnLeave
        })
    } catch (error: unknown) {
        console.error('Profile fetch error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return apiError(errorMessage, ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}

export async function PATCH(request: Request) {
    try {
        const authResult = await getMobileAuthPayload(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const user = authResult

        const body = await request.json()
        const { name, phone } = body

        const updateData: { name?: string; phone?: string } = {}
        if (name !== undefined) updateData.name = name
        if (phone !== undefined) updateData.phone = phone

        if (Object.keys(updateData).length === 0) {
            return apiError('Tidak ada field yang diubah', ErrorCodes.VALIDATION_ERROR, { status: 400 })
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

        return apiSuccess(updated)
    } catch (error: unknown) {
        console.error('Profile update error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return apiError(errorMessage, ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}
