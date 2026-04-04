import { NextRequest, NextResponse } from 'next/server'

import { WebhookProcessingService } from '@/modules/finance'

const webhookProcessingService = new WebhookProcessingService()

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ provider: string }> },
) {
    const { provider } = await params
    const rawBody = await request.text()

    const result = await webhookProcessingService.process({
        providerType: provider,
        rawBody,
        headers: request.headers,
    })

    return NextResponse.json(result.body, { status: result.status })
}
