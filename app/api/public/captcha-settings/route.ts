import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/public/captcha-settings
 * Public endpoint to get captcha settings for registration page
 * Only returns enabled status and siteKey (NOT secretKey)
 */
export async function GET() {
    try {
        const settings = await prisma.settings.findMany({
            where: {
                key: {
                    in: ['captcha_enabled', 'captcha_site_key']
                }
            }
        })

        const enabled = settings.find(s => s.key === 'captcha_enabled')?.value === 'true'
        const siteKey = settings.find(s => s.key === 'captcha_site_key')?.value || ''

        return NextResponse.json({
            enabled,
            siteKey: enabled ? siteKey : '' // Only return siteKey if enabled
        })
    } catch (error) {
        console.error('Error fetching public captcha settings:', error)
        return NextResponse.json({ enabled: false, siteKey: '' })
    }
}
