import { NextRequest } from 'next/server'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { prismaBilling } from '@/lib/prisma-billing'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const authResult = await requireCustomerAuth(request)
    if (authResult.response) {
        return authResult.response
    }

    const { searchParams } = new URL(request.url)
    const invoiceId = searchParams.get('invoiceId')

    if (!invoiceId) {
        return new Response('Missing invoiceId', { status: 400 })
    }

    const stream = new ReadableStream({
        async start(controller) {
            let keepChecking = true

            // Send initial connection event
            controller.enqueue(`event: connected\ndata: connected\n\n`)

            // Prevent keeping connection alive forever -> timeout after 30 minutes
            const timeout = setTimeout(() => {
                keepChecking = false
                try { controller.close() } catch (_e) { /* ignore */ }
            }, 30 * 60 * 1000)

            // When client disconnects
            request.signal.addEventListener('abort', () => {
                keepChecking = false
                clearTimeout(timeout)
                try { controller.close() } catch (_e) { /* ignore */ }
            })

            while (keepChecking) {
                try {
                    // Check invoice status. MUST verify pelangganId for security.
                    const invoice = await prismaBilling.invoice.findUnique({
                        where: {
                            id: invoiceId,
                            pelangganId: authResult.session.id
                        },
                        select: {
                            status: true,
                            id: true,
                            payment: {
                                orderBy: { paymentDate: 'desc' },
                                take: 1,
                                select: { gatewayStatus: true, id: true }
                            }
                        }
                    })

                    if (invoice) {
                        let finalStatus: string = invoice.status;

                        // If invoice is not PAID, check if the latest manual payment just got FAILED/CANCELLED
                        if (invoice.status !== 'PAID' && invoice.payment.length > 0) {
                            const latestPayment = invoice.payment[0];
                            if (latestPayment.gatewayStatus === 'FAILED' || latestPayment.gatewayStatus === 'CANCELLED') {
                                finalStatus = 'FAILED';
                            }
                        }

                        const payload = JSON.stringify({ status: finalStatus })
                        controller.enqueue(`data: ${payload}\n\n`)

                        if (finalStatus === 'PAID' || finalStatus === 'FAILED') {
                            keepChecking = false
                            clearTimeout(timeout)
                            try { controller.close() } catch (_e) { /* ignore */ }
                            break
                        }
                    } else {
                        // Invoice not found or doesn't belong to player
                        keepChecking = false
                        clearTimeout(timeout)
                        try { controller.close() } catch (_e) { /* ignore */ }
                        break
                    }

                    // Wait 5 seconds before checking database again
                    await new Promise(resolve => setTimeout(resolve, 5000))
                } catch (error) {
                    console.error('[SSE Generator Error]:', error)
                    keepChecking = false
                    clearTimeout(timeout)
                    try { controller.close() } catch (_e) { /* ignore */ }
                    break
                }
            }
        }
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    })
}
