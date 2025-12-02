import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { WhatsAppService } from '@/lib/services/whatsapp/whatsapp-service'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { phone } = body

        if (!phone) {
            return NextResponse.json(
                { success: false, message: 'Phone number is required' },
                { status: 400 }
            )
        }

        // Clean phone number format
        const cleanPhone = phone.replace(/[^0-9]/g, '')

        // Ensure starts with 62 (Indonesia)
        const formattedPhone = cleanPhone.startsWith('0')
            ? '62' + cleanPhone.substring(1)
            : cleanPhone.startsWith('62')
                ? cleanPhone
                : '62' + cleanPhone

        const whatsappService = new WhatsAppService(prisma)
        const result = await whatsappService.testConnection(formattedPhone)

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: 'Test message sent successfully! Check your WhatsApp.',
                messageId: result.messageId
            })
        } else {
            return NextResponse.json({
                success: false,
                message: result.error || 'Failed to send test message'
            }, { status: 400 })
        }

    } catch (error: any) {
        console.error('Error testing WhatsApp:', error)
        return NextResponse.json(
            { success: false, message: error.message || 'Failed to test WhatsApp' },
            { status: 500 }
        )
    }
}
