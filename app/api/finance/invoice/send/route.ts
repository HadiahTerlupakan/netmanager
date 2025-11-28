import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { InvoiceDeliveryService } from '@/lib/services/invoice-delivery-service'

const prisma = new PrismaClient()
const deliveryService = new InvoiceDeliveryService(prisma)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { tagihanId, channel, recipient } = body

        if (!tagihanId || !channel) {
            return NextResponse.json(
                { error: 'Missing required fields: tagihanId, channel' },
                { status: 400 }
            )
        }

        // Send invoice
        const results = await deliveryService.sendInvoice({
            tagihanId,
            channel,
            recipient
        })

        // Check if any succeeded
        const hasSuccess = results.some(r => r.success)
        const allFailed = results.every(r => !r.success)

        return NextResponse.json({
            success: hasSuccess,
            results,
            message: allFailed
                ? 'Failed to send invoice via all channels'
                : hasSuccess && results.length > 1
                    ? 'Invoice sent successfully via some channels'
                    : 'Invoice sent successfully'
        }, {
            status: allFailed ? 500 : 200
        })
    } catch (error: any) {
        console.error('Error sending invoice:', error)
        return NextResponse.json(
            { error: 'Failed to send invoice', details: error.message },
            { status: 500 }
        )
    }
}
