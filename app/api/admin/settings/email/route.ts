import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { encryptApiKey, decryptApiKey } from '@/lib/utils/encryption'


import { verifyAuth } from '@/lib/auth'
export async function GET(request: NextRequest) {
    try {
        // Authentication check
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get email settings from Settings table
        const settings = await prisma.settings.findMany({
            where: {
                key: {
                    in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'FROM_NAME', 'FROM_EMAIL']
                }
            }
        })

        const settingsMap: Record<string, string> = {}
        for (const setting of settings) {
            if (setting.key === 'SMTP_PASS' && setting.value) {
                // TEMP DEBUG: Return actual decrypted password to see what's saved
                try {
                    const decryptedPass = decryptApiKey(setting.value)
                    settingsMap[setting.key] = decryptedPass
                    console.log(`[Email Settings GET] Password loaded, length: ${decryptedPass.length}`)
                } catch (error) {
                    console.error('[Email Settings GET] Failed to decrypt password:', error)
                    settingsMap[setting.key] = 'DECRYPTION_ERROR'
                }
            } else {
                settingsMap[setting.key] = setting.value || ''
            }
        }

        return NextResponse.json({
            smtpHost: settingsMap['SMTP_HOST'] || '',
            smtpPort: settingsMap['SMTP_PORT'] || '587',
            smtpuser: settingsMap['SMTP_USER'] || '',
            smtpPass: settingsMap['SMTP_PASS'] || '',
            fromName: settingsMap['FROM_NAME'] || '',
            fromEmail: settingsMap['FROM_EMAIL'] || ''
        })
    } catch (error: any) {
        console.error('Error fetching email settings:', error)
        return NextResponse.json(
            { error: 'Failed to fetch settings', details: error.message },
            { status: 500 }
        )
    }
}

export async function PUT(request: NextRequest) {
    try {
        // Authentication check
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json()
        const { smtpHost, smtpPort, smtpUser, smtpPass, fromName, fromEmail } = body

        // Prepare settings to save
        const settingsToSave = [
            { key: 'SMTP_HOST', value: smtpHost, encrypted: false },
            { key: 'SMTP_PORT', value: smtpPort, encrypted: false },
            { key: 'SMTP_USER', value: smtpUser, encrypted: false },
            { key: 'FROM_NAME', value: fromName, encrypted: false },
            { key: 'FROM_EMAIL', value: fromEmail, encrypted: false },
        ]

        // Only update password if provided (not empty)
        if (smtpPass) {
            // Trim and remove spaces (Gmail App Passwords have spaces)
            const cleanedPass = smtpPass.trim().replace(/\s+/g, '')
            console.log(`[Email Settings] Saving password, length: ${cleanedPass.length}`)
            const encryptedPass = encryptApiKey(cleanedPass)
            settingsToSave.push({ key: 'SMTP_PASS', value: encryptedPass, encrypted: true })
        }

        for (const setting of settingsToSave) {
            await prisma.settings.upsert({
                where: { key: setting.key },
                create: {
                    id: randomUUID(),
                    key: setting.key,
                    value: setting.value,
                    encrypted: setting.encrypted,
                    description: `Email configuration: ${setting.key}`,
                    updatedAt: new Date()
                },
                update: {
                    value: setting.value,
                    encrypted: setting.encrypted,
                    updatedAt: new Date()
                }
            })
        }

        return NextResponse.json({ success: true, message: 'Settings saved successfully' })
    } catch (error: any) {
        console.error('Error saving email settings:', error)
        return NextResponse.json(
            { error: 'Failed to save settings', details: error.message },
            { status: 500 }
        )
    }
}
