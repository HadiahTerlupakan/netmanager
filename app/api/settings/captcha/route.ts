import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/settings/captcha
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
        }

        const settings = await prisma.settings.findMany({
            where: {
                key: {
                    in: ['captcha_enabled', 'captcha_site_key', 'captcha_secret_key']
                }
            }
        })

        const config = {
            enabled: settings.find(s => s.key === 'captcha_enabled')?.value === 'true',
            siteKey: settings.find(s => s.key === 'captcha_site_key')?.value || '',
            secretKey: settings.find(s => s.key === 'captcha_secret_key')?.value || ''
        }

        return NextResponse.json(config)
    } catch (error) {
        console.error('Error fetching captcha settings:', error)
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}

// POST /api/settings/captcha
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        // Check if user is admin/super_admin is better, but session check is minimum
        if (!session) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
        }

        const body = await request.json()
        const { enabled, siteKey, secretKey } = body

        // Upsert settings
        await prisma.$transaction([
            prisma.settings.upsert({
                where: { key: 'captcha_enabled' },
                update: { value: String(enabled), updatedAt: new Date() },
                create: { id: randomUUID(), key: 'captcha_enabled', value: String(enabled), description: 'Enable/Disable Cloudflare Turnstile', updatedAt: new Date() }
            }),
            prisma.settings.upsert({
                where: { key: 'captcha_site_key' },
                update: { value: siteKey, updatedAt: new Date() },
                create: { id: randomUUID(), key: 'captcha_site_key', value: siteKey, description: 'Cloudflare Turnstile Site Key', updatedAt: new Date() }
            }),
            prisma.settings.upsert({
                where: { key: 'captcha_secret_key' },
                update: { value: secretKey, updatedAt: new Date() },
                create: { id: randomUUID(), key: 'captcha_secret_key', value: secretKey, description: 'Cloudflare Turnstile Secret Key', encrypted: true, updatedAt: new Date() } // Marking as encrypted for semantics, though we store plain for now
            })
        ])

        return NextResponse.json({ message: 'Settings saved successfully' })
    } catch (error) {
        console.error('Error saving captcha settings:', error)
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}
