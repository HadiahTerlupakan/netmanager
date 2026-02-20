import { NextRequest, NextResponse } from 'next/server'
import { getAppVersionService } from '@/modules/app-version'
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
            // Proxy the R2 file with proper headers for Android APK installation
            // NOTE: Direct redirect (302) causes issues on Android because:
            // 1. Cross-origin redirect loses download context
            // 2. R2 serves the file without Content-Disposition header
            // 3. Android cannot recognize the downloaded file as an installable APK
            try {
                const r2Response = await fetch(apkUrl)

                if (!r2Response.ok) {
                    console.error('Error fetching APK from R2:', r2Response.status, r2Response.statusText)
                    return NextResponse.json({ error: 'Gagal mengunduh APK dari storage' }, { status: 502 })
                }

                const apkBuffer = await r2Response.arrayBuffer()

                return new NextResponse(apkBuffer, {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/vnd.android.package-archive',
                        'Content-Disposition': `attachment; filename="${apkInfo.filename}"`,
                        'Content-Length': apkBuffer.byteLength.toString(),
                        'Cache-Control': 'no-cache',
                    }
                })
            } catch (fetchError) {
                console.error('Error proxying APK from R2:', fetchError)
                return NextResponse.json({ error: 'Gagal mengunduh APK dari storage' }, { status: 502 })
            }
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
    } catch (error: unknown) {
        console.error('Error downloading APK:', error)
        const errorMessage = error instanceof Error ? error.message : 'Gagal mengunduh APK'
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}
