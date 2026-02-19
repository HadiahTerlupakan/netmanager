import { randomUUID } from 'crypto'
import { createHandler, apiSuccess } from '@/lib/api'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/settings/captcha
export const GET = createHandler({ auth: true }, async () => {
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

    return apiSuccess(config)
})

// POST /api/settings/captcha
export const POST = createHandler({ auth: true }, async (req, _ctx) => {
    const body = await req.json()
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

    return apiSuccess({ message: 'Settings saved successfully' })
})
