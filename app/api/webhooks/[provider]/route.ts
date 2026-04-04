import { AutomaticBillingService } from '@/modules/finance/services/AutomaticBillingService'
import { NextRequest, NextResponse } from 'next/server'
import { prismaBilling } from '@/lib/prisma-billing';
import { PaymentGatewayManager } from '@/modules/finance/services/payment-gateway/gateway-manager'

/**
 * Signature header mapping per payment gateway provider.
 * Each provider sends webhook signatures in different headers.
 */
const SIGNATURE_HEADERS: Record<string, string> = {
    XENDIT: 'x-callback-token',
    MIDTRANS: '',              // Midtrans includes signature in body
    TRIPAY: 'x-callback-signature',
    DUITKU: '',                // Duitku includes signature in body
    BRI: 'x-signature',
    BCA: 'x-bca-signature',
    DANA: 'x-dana-signature',
    MOOTA: 'signature',    // Moota uses Signature header with HMAC SHA-256 string
}

/**
 * POST /api/webhooks/[provider]
 * 
 * Receives payment webhook callbacks from external payment gateway providers.
 * This endpoint is public (no auth) — security is via webhook signature verification.
 * 
 * Flow:
 * 1. Extract provider from URL params
 * 2. Parse request body
 * 3. Extract signature from provider-specific header
 * 4. Verify signature + process webhook via PaymentGatewayManager
 * 5. Update Payment record (gatewayStatus, transactionId, etc.)
 * 6. Update linked Invoice(s) status
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ provider: string }> }
) {
    const { provider } = await params
    const providerType = provider.toUpperCase()

    try {
        // Validate provider is supported
        const supportedProviders = Object.keys(SIGNATURE_HEADERS)
        if (!supportedProviders.includes(providerType)) {
            console.warn(`[Webhook] Unknown provider: ${providerType}`)
            return NextResponse.json(
                { error: 'Unknown payment provider' },
                { status: 400 }
            )
        }

        // Parse request body
        const rawBody = await request.text()
        let payload: Record<string, unknown>

        try {
            payload = JSON.parse(rawBody)
        } catch {
            // Fallback for form-urlencoded payloads (e.g. Duitku uses x-www-form-urlencoded)
            try {
                const searchParams = new URLSearchParams(rawBody)
                payload = Object.fromEntries(searchParams.entries())

                // Check if it's completely empty or invalid (empty form decoding still succeeds technically, but with zero keys)
                if (Object.keys(payload).length === 0 && rawBody.length > 0) {
                    throw new Error('Fallback URLSearchParams yielded empty result')
                }
            } catch {
                console.error(`[Webhook] Invalid body from ${providerType}: Not JSON or Form-Urlencoded`)
                return NextResponse.json(
                    { error: 'Invalid request body' },
                    { status: 400 }
                )
            }
        }

        // Extract signature from provider-specific header
        const signatureHeader = SIGNATURE_HEADERS[providerType]
        const signature = signatureHeader
            ? (request.headers.get(signatureHeader) ?? undefined)
            : undefined

        // Find Payment record using UN-ISOLATED client to discover tenantId from orderId/amount
        // This is necessary because webhooks don't have user context/headers
        const { prismaBillingAuth } = await import('@/lib/prisma-billing');
        let payment = null;

        // Peak into body for orderId to find tenant early (required for signature verification config)
        let earlyOrderId: string | undefined;
        if (providerType === 'MIDTRANS') earlyOrderId = (payload.order_id as string);
        else if (providerType === 'XENDIT') earlyOrderId = (payload.external_id as string);
        else if (providerType === 'TRIPAY') earlyOrderId = (payload.merchant_ref as string);
        else if (providerType === 'DUITKU') earlyOrderId = (payload.merchantOrderId as string);
        else if (providerType === 'BRI') earlyOrderId = (payload.custCode as string) || (payload.brivaNo as string);
        else if (providerType === 'BCA') earlyOrderId = (payload.CustomerID as string) || (payload.TransactionID as string);
        else if (providerType === 'DANA') earlyOrderId = (payload.merchantOrderId as string) || (payload.orderId as string);

        if (earlyOrderId) {
            payment = await prismaBillingAuth.payment.findFirst({
                where: { reference: earlyOrderId },
            })
        }

        // Process webhook through gateway manager (passing tenantId discovered from payment)
        const gatewayManager = new PaymentGatewayManager()
        const webhookResult = await gatewayManager.processWebhook(
            providerType, 
            payload, 
            signature, 
            rawBody, 
            payment?.tenantId || undefined
        )

        console.log(`[Webhook] ${providerType} processed:`, {
            orderId: webhookResult.orderId,
            status: webhookResult.status,
            transactionId: webhookResult.transactionId,
            tenantId: payment?.tenantId
        })

        // Map webhook status 
        const gatewayStatusMap: Record<string, string> = {
            PAID: 'PAID',
            PENDING: 'PENDING',
            EXPIRED: 'EXPIRED',
            CANCELLED: 'CANCELLED',
            FAILED: 'FAILED',
        }
        const gatewayStatus = gatewayStatusMap[webhookResult.status] || 'FAILED'

        // If payment wasn't found early (e.g. Moota by amount), find it now with webhookResult
        if (!payment) {
            if (providerType === 'MOOTA' && webhookResult.amount) {
                const amountVal = Number(webhookResult.amount)
                payment = await prismaBillingAuth.payment.findFirst({
                    where: { amount: amountVal },
                    orderBy: { createdAt: 'desc' }
                })
                if (payment) webhookResult.orderId = payment.reference || payment.id
            } else {
                payment = await prismaBillingAuth.payment.findFirst({
                    where: { reference: webhookResult.orderId },
                })
            }
        }

        if (!payment) {
            console.warn(`[Webhook] Payment not found for ${providerType === 'MOOTA' ? 'amount: ' + webhookResult.amount : 'orderId: ' + webhookResult.orderId}`)

            if (providerType === 'MOOTA' && webhookResult.raw) {
                try {
                    const rawData = webhookResult.raw as Record<string, unknown>;
                    // Check if already exists to avoid duplicates
                    const existing = await prismaBilling.unmatchedMutation.findUnique({
                        where: { transactionId: rawData.mutation_id as string }
                    })

                    if (!existing) {
                        await prismaBilling.unmatchedMutation.create({
                            data: {
                                provider: 'MOOTA',
                                transactionId: rawData.mutation_id as string,
                                amount: Number(rawData.amount),
                                description: (rawData.description as string) || 'Mutasi masuk dari Moota',
                                type: (rawData.type as string) || 'CR',
                                date: rawData.date ? new Date(rawData.date as string) : new Date(),
                                bankId: (rawData.bank_id as string) || null,
                                rawPayload: JSON.parse(JSON.stringify(rawData)),
                                status: 'PENDING'
                            }
                        })
                        console.log(`[Webhook] Unmatched mutation recorded: ${rawData.mutation_id} (${rawData.amount})`)
                    }
                } catch (unmatchedErr) {
                    console.error('[Webhook] Failed to save unmatched mutation:', unmatchedErr)
                }
            }

            return NextResponse.json({ status: 'ok', message: 'Payment record not found' })
        }

        // Prevent race conditions and duplicate processing using atomic database checks
        if (payment.gatewayStatus === 'PAID') {
            console.log(`[Webhook] Payment ${payment.id} already PAID, skipping duplicate event`)
            return NextResponse.json({ status: 'ok', message: 'Already processed' })
        }

        // Execute update in a transaction using UN-ISOLATED client
        // to bypass the requirement for X-Tenant-Id headers in the webhook POST request
        await prismaBillingAuth.$transaction(async (tx) => {
            // Double check inside transaction for concurrency safety
            const currentPayment = await tx.payment.findUnique({ where: { id: payment!.id } });
            if (currentPayment && currentPayment.gatewayStatus === 'PAID') {
                return;
            }

            // Update Payment record with gateway response
            await tx.payment.update({
                where: { id: payment!.id },
                data: {
                    gatewayStatus: gatewayStatus as unknown,
                    transactionId: webhookResult.transactionId || null,
                    gatewayProvider: providerType,
                    ...(webhookResult.paymentMethod ? { paymentMethod: webhookResult.paymentMethod as unknown } : {}),
                    ...(webhookResult.paidAt ? { paymentDate: webhookResult.paidAt } : {}),
                },
            })

            // If payment is confirmed (PAID), update linked invoices transactionally
            if (gatewayStatus === 'PAID') {
                await updateInvoicesOnPaymentTx(tx as unknown as Parameters<typeof updateInvoicesOnPaymentTx>[0], payment!.id, payment!.notes)
            }
        })

        // If payment expired/cancelled/failed, update gateway status only
        if (['EXPIRED', 'CANCELLED', 'FAILED'].includes(gatewayStatus)) {
            console.log(`[Webhook] Payment ${payment.id} marked as ${gatewayStatus}`)
        }

        // Handle side-effects that require the new state and should happen outside the database transaction
        if (gatewayStatus === 'PAID') {
            // Re-fetch invoices linked to payment using un-isolated client
            let invoiceIds: string[] = [];
            try {
                if (payment.notes) {
                    const metadata = JSON.parse(payment.notes);
                    if (Array.isArray(metadata.invoiceIds)) invoiceIds = metadata.invoiceIds;
                }
            } catch {}
            if (invoiceIds.length === 0 && payment.invoiceId) {
                invoiceIds = [payment.invoiceId];
            }
            for (const invId of invoiceIds) {
                const inv = await prismaBillingAuth.invoice.findUnique({ where: { id: invId } });
                if (inv?.status === 'PAID') {
                    // Trigger side-effects (service should handle its own isolation if needed, 
                    // or we might need to mock headers if it uses isolated clients internally)
                    await AutomaticBillingService.handleInvoicePaid(invId).catch(err => 
                        console.error(`[Webhook] Error triggering side-effects for invoice ${invId}:`, err)
                    );
                }
            }
        }

        // Always return 200 to acknowledge receipt
        return NextResponse.json({ status: 'ok' })

    } catch (error) {
        const err = error as Error
        console.error(`[Webhook] Error processing ${providerType}:`, err.message, err.stack)

        // Return 200 for signature errors (don't retry invalid webhooks)
        if (err.message.includes('Invalid webhook signature')) {
            return NextResponse.json(
                { status: 'error', message: 'Invalid signature' },
                { status: 401 }
            )
        }

        // Return 500 for server errors (gateway will retry)
        return NextResponse.json(
            { status: 'error', message: 'Internal server error' },
            { status: 500 }
        )
    }
}

/**
 * Update all linked invoices when payment is confirmed.
 * Parses invoiceIds from payment notes metadata and updates each invoice.
 */
async function updateInvoicesOnPaymentTx(tx: Parameters<Parameters<typeof import('@prisma/client-billing').PrismaClient.prototype.$transaction>[0]>[0], paymentId: string, notes: string | null) {
    // Try to extract invoiceIds from notes metadata
    let invoiceIds: string[] = []

    if (notes) {
        try {
            const metadata = JSON.parse(notes)
            if (Array.isArray(metadata.invoiceIds)) {
                invoiceIds = metadata.invoiceIds
            }
        } catch {
            // Notes is plain text, not JSON metadata
        }
    }

    // If no invoiceIds from notes, try from direct payment-invoice link
    if (invoiceIds.length === 0) {
        const payment = await tx.payment.findUnique({
            where: { id: paymentId },
            select: { invoiceId: true },
        })

        if (payment?.invoiceId) {
            invoiceIds = [payment.invoiceId]
        }
    }

    if (invoiceIds.length === 0) {
        console.log(`[Webhook] No invoices linked to payment ${paymentId}`)
        return
    }

    // Update each invoice's paid amount and status
    for (const invoiceId of invoiceIds) {
        const invoice = await tx.invoice.findUnique({
            where: { id: invoiceId },
            include: { payment: true },
        })

        if (!invoice) {
            console.warn(`[Webhook] Invoice ${invoiceId} not found`)
            continue
        }

        // Calculate total paid from all PAID payments
        const totalPaid = invoice.payment.reduce((sum: bigint, p: { gatewayStatus?: string | null; amount: bigint | number }) => {
            // Only count payments that are confirmed (PAID or no gateway status = manual)
            if (!p.gatewayStatus || p.gatewayStatus === 'PAID') {
                return sum + BigInt(p.amount)
            }
            return sum
        }, BigInt(0))

        // Determine invoice status
        let invoiceStatus: string
        if (totalPaid >= invoice.totalAmount) {
            invoiceStatus = 'PAID'
        } else if (totalPaid > BigInt(0)) {
            invoiceStatus = 'PARTIAL_PAID'
        } else {
            invoiceStatus = invoice.status
        }

        await tx.invoice.update({
            where: { id: invoiceId },
            data: {
                paidAmount: totalPaid,
                status: invoiceStatus as unknown,
                ...(invoiceStatus === 'PAID' ? { paidAt: new Date() } : {}),
            },
        })

        if (invoiceStatus === 'PAID') {
            // AutomaticBillingService.handleInvoicePaid is now handled outside the transaction block
        }

        console.log(`[Webhook] Invoice ${invoiceId} updated: status=${invoiceStatus}, paidAmount=${totalPaid}`)
    }
}
