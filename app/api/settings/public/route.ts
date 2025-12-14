import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/settings/public
 * Public endpoint for settings needed by external portals (employee portal)
 * No authentication required
 */
export async function GET(request: NextRequest) {
    try {
        // Get general settings
        const generalSettings = await prisma.settings.findFirst({
            where: { key: 'general' }
        })

        // Get logo settings
        const logoSettings = await prisma.settings.findFirst({
            where: { key: 'logo' }
        })

        let general: any = {}
        let logo: any = {}

        if (generalSettings?.value) {
            try {
                general = typeof generalSettings.value === 'string'
                    ? JSON.parse(generalSettings.value)
                    : generalSettings.value
            } catch {
                general = {}
            }
        }

        if (logoSettings?.value) {
            try {
                logo = typeof logoSettings.value === 'string'
                    ? JSON.parse(logoSettings.value)
                    : logoSettings.value
            } catch {
                logo = {}
            }
        }

        // Return only public-safe settings
        return NextResponse.json({
            success: true,
            data: {
                namaAplikasi: general.namaAplikasi || 'NetManager',
                perusahaan: general.perusahaan || '',
                logoAplikasi: logo.logoAplikasi || null,
                logoInvoice: logo.logoInvoice || null,
            }
        })
    } catch (error: any) {
        console.error('[API] Get public settings error:', error)
        return NextResponse.json(
            { success: false, error: 'Failed to load settings' },
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
