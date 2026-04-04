import { NextResponse, NextRequest } from 'next/server'
import { prisma } from '@/modules/database'
import { prismaMitra } from '@/modules/database'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { apiError, ErrorCodes } from '@/lib/api-response'

function parseVersionCode(value: unknown): number | null {
    if (typeof value !== 'string' && typeof value !== 'number') {
        return null
    }

    const normalized = String(value).trim()
    if (!/^\d+$/.test(normalized)) {
        return null
    }

    const parsed = Number(normalized)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export async function POST(req: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(req)
        if (authResult instanceof Response) {
            return authResult
        }

        const session = authResult
        const tenantId = session.tenantId as string

        const body = await req.json()
        const { versionCode, versionName } = body
        const parsedVersionCode = parseVersionCode(versionCode)

        if (parsedVersionCode === null) {
            return apiError('versionCode harus berupa angka bulat positif', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        if (!versionCode) {
            return apiError('versionCode wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        // Update the correct table based on user type
        if (session.role === 'CUSTOMER') {
            await prisma.pelanggan.update({
                where: { id: session.id , tenantId },
                data: {
                    lastVersionCode: parsedVersionCode,
                    lastVersionName: versionName,
                    lastVersionUpdate: new Date()
                }
            })
        } else if (session.role === 'MITRA') {
            await prismaMitra.mitra.update({
                where: { id: session.id },
                data: {
                    lastVersionCode: parsedVersionCode,
                    lastVersionName: versionName,
                    lastVersionUpdate: new Date()
                }
            })
        } else {
            await prisma.user.update({
                where: { id: session.id , tenantId },
                data: {
                    lastVersionCode: parsedVersionCode,
                    lastVersionName: versionName,
                    lastVersionUpdate: new Date()
                }
            })
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Error reporting app version:', error)
        return apiError('Terjadi kesalahan server', ErrorCodes.INTERNAL_ERROR, { status: 500 })
    }
}
