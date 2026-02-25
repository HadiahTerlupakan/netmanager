import { NextRequest } from 'next/server'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { prismaBilling } from '@/lib/prisma-billing'
import { prisma } from '@/lib/prisma'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { PaymentGatewayManager } from '@/modules/finance/services/payment-gateway/gateway-manager'
import { PrismaClient } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const authResult = await requireCustomerAuth(request)
        if (authResult.response) {
            return authResult.response
        }

        const gatewayManager = new PaymentGatewayManager(prismaBilling as unknown as PrismaClient)
        const providers = await gatewayManager.getEnabledProviders()

        const paymentMethods = []

        const duitku = providers.find(p => p.provider === 'DUITKU')
        if (duitku) {
            // Note: In a fully dynamic setup, we could call Duitku's getPaymentMethod API.
            // Here we expose the most popular ones for the UI.
            // Duitku Codes: 
            // BC = BCA VA, M2 = Mandiri VA, BR = BRI VA, B1 = CIMB VA
            // SP = ShopeePay/QRIS
            // FT = Ritel (Alfamart/Indomaret) 

            paymentMethods.push({
                id: 'duitku_bca',
                name: 'BCA Virtual Account',
                provider: 'DUITKU',
                type: 'VA',
                code: 'BC',
                group: 'Virtual Account'
            })
            paymentMethods.push({
                id: 'duitku_mandiri',
                name: 'Mandiri Virtual Account',
                provider: 'DUITKU',
                type: 'VA',
                code: 'M2',
                group: 'Virtual Account'
            })
            paymentMethods.push({
                id: 'duitku_bri',
                name: 'BRI Virtual Account',
                provider: 'DUITKU',
                type: 'VA',
                code: 'BR',
                group: 'Virtual Account'
            })
            paymentMethods.push({
                id: 'duitku_qris',
                name: 'QRIS (Gopay, OVO, Dana, LinkAja)',
                provider: 'DUITKU',
                type: 'QRIS',
                code: 'SP',
                group: 'E-Wallet & QRIS'
            })
            paymentMethods.push({
                id: 'duitku_alfamart',
                name: 'Alfamart / Indomaret',
                provider: 'DUITKU',
                type: 'RETAIL',
                code: 'FT',
                group: 'Minimarket'
            })
        }

        const moota = providers.find(p => p.provider === 'MOOTA')
        if (moota) {
            paymentMethods.push({
                id: 'moota_transfer',
                name: 'Transfer Bank Otomatis',
                provider: 'MOOTA',
                type: 'AUTO_TRANSFER',
                code: 'MOOTA_MANUAL',
                group: 'Transfer Bank'
            })
        }

        // Fetch active manual company bank accounts
        const companyBankAccounts = await prisma.companyBankAccount.findMany({
            where: { isActive: true },
            orderBy: { priority: 'asc' }
        });

        // Add them to the manual methods list
        companyBankAccounts.forEach(account => {
            paymentMethods.push({
                id: `manual_${account.id}`,
                name: account.bankName,
                provider: 'MANUAL',
                type: 'MANUAL',
                code: `MANUAL_${account.id}`,
                group: 'Transfer Manual',
                details: {
                    bankName: account.bankName,
                    accountName: account.accountName,
                    accountNumber: account.accountNumber,
                }
            })
        })

        // Fallback if no specific provider recognized but one is enabled
        if (paymentMethods.length === 0 && providers.length > 0) {
            paymentMethods.push({
                id: 'generic_gateway',
                name: 'Online Payment',
                provider: providers[0].provider,
                type: 'ONLINE',
                code: 'ONLINE',
                group: 'Online Payment'
            })
        }

        return apiSuccess(paymentMethods)
    } catch (error) {
        console.error('[Payment Methods Error]:', error)
        return ApiErrors.internalError('Gagal memuat metode pembayaran')
    }
}
