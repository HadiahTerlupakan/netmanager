import { NextRequest, NextResponse } from 'next/server'
import { requireCustomerAuth } from '@/lib/customer-auth'
import { CustomerUsageService } from '@/modules/pelanggan/services/CustomerUsageService'

const usageService = new CustomerUsageService()

/**
 * GET - Get customer connection status and usage data
 * Refactored to use CustomerUsageService (thin controller pattern)
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await requireCustomerAuth(request)
        if (authResult.response) {
            return authResult.response
        }

        const usageData = await usageService.getUsageData(authResult.session.id)

        return NextResponse.json({
            success: true,
            ...usageData,
        })
    } catch (error: any) {
        console.error('[Customer Usage Error]:', error)
        
        if (error.message === 'Data pelanggan tidak ditemukan') {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }
        
        return NextResponse.json(
            { error: error.message || 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}
