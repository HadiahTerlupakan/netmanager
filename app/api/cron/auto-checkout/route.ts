import { NextResponse } from 'next/server'
import { AutoCheckoutService } from '@/modules/attendance/services/AutoCheckoutService'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
    try {
        const headersList = await headers()
        const authHeader = headersList.get('authorization')
        
        // Basic security check
        // In production this should be strictly enforced
        // if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        // }

        const count = await AutoCheckoutService.runAutoCheckout()

        return NextResponse.json({
            success: true,
            checkedOutCount: count,
            timestamp: new Date().toISOString()
        })
    } catch (error: any) {
        console.error('Error running auto-checkout:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

export async function GET(request: Request) {
    // Allow GET for easy testing via browser/curl if needed, or redirect to POST logic
    return POST(request)
}
