import { NextRequest, NextResponse } from 'next/server'
import { getAppVersionService } from '@/modules/app-version'

// GET /api/mobile/app-version/check - Check for updates (Public endpoint)
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const currentVersionCode = parseInt(searchParams.get('versionCode') || '0')
        const platform = searchParams.get('platform') || 'android'

        if (!currentVersionCode) {
            return NextResponse.json(
                { error: 'versionCode wajib diisi' },
                { status: 400 }
            )
        }

        const service = getAppVersionService()
        const result = await service.checkForUpdate(currentVersionCode, platform)

        return NextResponse.json({
            success: true,
            ...result
        })
    } catch (error: unknown) {
        console.error('Error checking app version:', error)
        const errorMessage = error instanceof Error ? error.message : 'Gagal memeriksa versi'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
