import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/settings/public
 * Public endpoint for settings needed by external portals (employee portal)
 * No authentication required
 */
export async function GET(_request: NextRequest) {
    try {
        // Get general settings
        const generalSettings = await prisma.settings.findFirst({
            where: { key: 'general' }
        })

        // Get logo settings
        const logoSettings = await prisma.settings.findFirst({
            where: { key: 'logo' }
        })

        let general: Record<string, unknown> = {}
        let logo: Record<string, unknown> = {}

        if (generalSettings?.value) {
            try {
                general = typeof generalSettings.value === 'string'
                    ? JSON.parse(generalSettings.value)
                    : generalSettings.value as Record<string, unknown>
            } catch {
                general = {}
            }
        }

        if (logoSettings?.value) {
            try {
                logo = typeof logoSettings.value === 'string'
                    ? JSON.parse(logoSettings.value)
                    : logoSettings.value as Record<string, unknown>
            } catch {
                logo = {}
            }
        }

        // Return only public-safe settings
        return NextResponse.json({
            success: true,
            data: {
                namaAplikasi: (general.namaAplikasi as string) || 'NetManager',
                perusahaan: (general.perusahaan as string) || '',
                logoAplikasi: (logo.logoAplikasi as string) || null,
                logoInvoice: (logo.logoInvoice as string) || null,
            }
        })
    } catch (error) {
        console.error('[API] Get public settings error:', error)
        return NextResponse.json(
            { success: false, error: 'Gagal memuat pengaturan' },
            { status: 500 }
        )
    }
}

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    })
}
