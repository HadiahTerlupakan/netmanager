import { NextRequest, NextResponse } from 'next/server'
import { hasPermission, getCurrentUser } from '@/lib/rbac'
import { getMitraWalletService } from '@/modules/mitra'

const walletService = getMitraWalletService()

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission('users:read', user, { silent: true }))) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')

    const [balanceResult, transactionsResult] = await Promise.all([
        walletService.getBalance(id),
        walletService.getTransactions(id, page),
    ])

    if (!balanceResult.success) {
        return NextResponse.json({ success: false, error: balanceResult.error }, { status: 404 })
    }

    return NextResponse.json({
        success: true,
        data: {
            balance: balanceResult.data,
            transactions: transactionsResult.success ? transactionsResult.data : { transactions: [], total: 0 },
        },
    })
}

// Admin manual adjustment
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission('users:update', user, { silent: true }))) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    try {
        const body = await request.json()
        const { amount, description } = body

        if (!amount || !description) {
            return NextResponse.json({ success: false, error: 'Amount dan deskripsi harus diisi' }, { status: 400 })
        }

        const result = await walletService.addAdjustment(id, amount, description, user.id!)

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 })
        }

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }
}
