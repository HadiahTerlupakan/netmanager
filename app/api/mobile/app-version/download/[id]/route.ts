import { NextRequest, NextResponse } from 'next/server'
import { getAppVersionService } from '@/modules/app-version'
import { isR2Enabled, getR2Settings } from '@/lib/utils/r2-client'
import fs from 'fs/promises'
import path from 'path'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/mobile/app-version/download/[id] - Download APK file
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const service = getAppVersionService()
        const apkInfo = await service.getApkForDownload(id)

        if (!apkInfo) {
            return NextResponse.json({ error: 'APK tidak ditemukan' }, { status: 404 })
        }

        const apkUrl = apkInfo.url

        // Check if it's an R2 URL (full URL) or local path
        if (apkUrl.startsWith('http://') || apkUrl.startsWith('https://')) {
            // Redirect to R2 URL for direct download
            return NextResponse.redirect(apkUrl)
        } else {
            // Local file - stream it
            const filePath = path.join(process.cwd(), 'public', apkUrl)
            
            try {
                const fileBuffer = await fs.readFile(filePath)
                
                return new NextResponse(fileBuffer, {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/vnd.android.package-archive',
                        'Content-Disposition': `attachment; filename="${apkInfo.filename}"`,
                        'Content-Length': fileBuffer.length.toString()
                    }
                })
            } catch (fileError) {
                console.error('Error reading APK file:', fileError)
                return NextResponse.json({ error: 'APK file tidak ditemukan di server' }, { status: 404 })
            }
        }
    } catch (error: any) {
        console.error('Error downloading APK:', error)
        return NextResponse.json({ error: error.message || 'Failed to download APK' }, { status: 500 })
    }
}
