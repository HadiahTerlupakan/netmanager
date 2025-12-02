import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptApiKey } from '@/lib/utils/encryption'
import nodemailer from 'nodemailer'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        let { smtpHost, smtpPort, smtpUser, smtpPass, fromName, fromEmail, testEmail } = body

        // If password is empty, try to load from database (testing saved config)
        if (!smtpPass) {
            const savedSettings = await prisma.settings.findUnique({
                where: { key: 'SMTP_PASS' }
            })

            if (savedSettings?.value) {
                smtpPass = decryptApiKey(savedSettings.value)
                console.log(`[Test Email] Loaded password from DB, length: ${smtpPass.length}`)
            } else {
                console.log('[Test Email] No saved password found in database')
            }
        } else {
            // Trim and remove spaces from provided password
            smtpPass = smtpPass.trim().replace(/\s+/g, '')
            console.log(`[Test Email] Using provided password, length: ${smtpPass.length}`)
        }

        // If still no password, return error
        if (!smtpPass) {
            return NextResponse.json(
                { success: false, message: 'SMTP password is required. Please enter password or save configuration first.' },
                { status: 400 }
            )
        }

        // If other fields are empty, try to load from database too
        if (!smtpHost || !smtpUser) {
            const settings = await prisma.settings.findMany({
                where: {
                    key: { in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'FROM_NAME', 'FROM_EMAIL'] }
                }
            })

            const settingsMap: Record<string, string> = {}
            for (const setting of settings) {
                settingsMap[setting.key] = setting.value || ''
            }

            smtpHost = smtpHost || settingsMap['SMTP_HOST']
            smtpPort = smtpPort || settingsMap['SMTP_PORT']
            smtpUser = smtpUser || settingsMap['SMTP_USER']
            fromName = fromName || settingsMap['FROM_NAME']
            fromEmail = fromEmail || settingsMap['FROM_EMAIL']
        }

        // Create transporter with provided settings
        console.log(`[Test Email] SMTP Config - Host: ${smtpHost}, Port: ${smtpPort}, User: ${smtpUser}`)
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt(smtpPort),
            secure: smtpPort === '465',
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        })

        console.log('[Test Email] Attempting to send test email...')
        // Send test email
        await transporter.sendMail({
            from: `"${fromName || 'NetManager ISP'}" <${fromEmail || smtpUser}>`,
            to: testEmail || fromEmail || smtpUser,
            subject: 'Test Email from NetManager',
            html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #10b981;">✅ Email Configuration Test</h2>
          <p>This is a test email to verify your SMTP configuration.</p>
          <p><strong>Settings:</strong></p>
          <ul>
            <li>SMTP Host: ${smtpHost}</li>
            <li>SMTP Port: ${smtpPort}</li>
            <li>SMTP User: ${smtpUser}</li>
            <li>From: ${fromName || 'NetManager ISP'} &lt;${fromEmail || smtpUser}&gt;</li>
          </ul>
          <p style="margin-top: 20px; color: #10b981; font-weight: bold;">
            If you received this email, your configuration is working correctly!
          </p>
        </div>
      `
        })

        return NextResponse.json({
            success: true,
            message: 'Test email sent successfully!'
        })
    } catch (error: any) {
        console.error('Error sending test email:', error)
        return NextResponse.json(
            {
                success: false,
                message: error.message || 'Failed to send test email'
            },
            { status: 500 }
        )
    }
}
