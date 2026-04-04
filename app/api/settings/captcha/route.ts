import { randomUUID } from 'crypto'
import { createHandler, apiSuccess } from '@/lib/api'
import { prisma } from '@/modules/database'

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

    // Update settings one by one for simplicity and safety
    const settingsToSave = [
        { key: 'captcha_enabled', value: String(enabled), description: 'Enable/Disable Cloudflare Turnstile', encrypted: false },
        { key: 'captcha_site_key', value: siteKey, description: 'Cloudflare Turnstile Site Key', encrypted: false },
        { key: 'captcha_secret_key', value: secretKey, description: 'Cloudflare Turnstile Secret Key', encrypted: true }
    ]

    for (const setting of settingsToSave) {
        const existing = await prisma.settings.findFirst({
            where: { key: setting.key }
        })
        if (existing) {
            await prisma.settings.update({
                where: { id: existing.id },
                data: { value: setting.value, updatedAt: new Date() }
            })
        } else {
            await prisma.settings.create({
                data: {
                    id: randomUUID(),
                    key: setting.key,
                    value: setting.value,
                    description: setting.description,
                    encrypted: setting.encrypted,
                    updatedAt: new Date()
                }
            })
        }
    }

    return apiSuccess({ message: 'Settings saved successfully' })
})
