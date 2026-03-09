import { NextResponse, NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { prismaMitra } from '@/lib/prisma-mitra'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'

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

        const body = await req.json()
        const { versionCode, versionName } = body
        const parsedVersionCode = parseVersionCode(versionCode)

        if (parsedVersionCode === null) {
            return NextResponse.json({ error: 'versionCode harus berupa angka bulat positif' }, { status: 400 })
        }

        if (!versionCode) {
            return NextResponse.json({ error: 'versionCode wajib diisi' }, { status: 400 })
        }

        // Update the correct table based on user type
        if (session.role === 'CUSTOMER') {
            await prisma.pelanggan.update({
                where: { id: session.id },
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
                where: { id: session.id },
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
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}
