import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { testR2Connection } from '@/lib/utils/r2-client'

/**
 * POST /api/settings/api/r2/test
 * Test koneksi ke Cloudflare R2
 */
export async function POST(req: NextRequest) {
    try {
        // Cek autentikasi
        const session = await getServerSession(authConfig)
        if (!session) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
        }

        // Cek role admin
        if (false) {
            return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
        }

        const body = await req.json()
        const { accountId, accessKeyId, secretAccessKey, bucketName } = body

        // Validate required fields
        if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
            return NextResponse.json(
                { error: 'Semua field wajib diisi untuk test koneksi' },
                { status: 400 }
            )
        }

        // Test connection
        const result = await testR2Connection({
            accountId,
            accessKeyId,
            secretAccessKey,
            bucketName,
            publicUrl: ''
        })

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: 'Koneksi ke Cloudflare R2 berhasil!'
            })
        } else {
            return NextResponse.json(
                { error: result.error || 'Koneksi gagal' },
                { status: 400 }
            )
        }
    } catch (error: unknown) {
        console.error('Error testing R2 connection:', error)
        return NextResponse.json(
            { error: (error as Error).message || 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}
