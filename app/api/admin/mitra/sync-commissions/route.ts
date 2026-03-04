
import { NextResponse } from 'next/server'
import { prismaMitra } from '@/lib/prisma-mitra'
import { ensurePermission } from '@/lib/rbac'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
    try {
        await ensurePermission('mitra:update') // Or a specific payout permission

        const body = await req.json()
        const { mitraId, amount, description, referenceId } = body

        if (!mitraId || !amount || !referenceId) {
            return NextResponse.json({ message: 'Data tidak lengkap' }, { status: 400 })
        }

        // 1. Check if this referenceId already exists to prevent double payout
        const existingTx = await prismaMitra.mitraTransaction.findFirst({
            where: { referenceId }
        })

        if (existingTx) {
            return NextResponse.json({
                success: false,
                message: 'Komisi untuk invoice ini sudah pernah disinkronisasi sebelumnya.'
            }, { status: 400 })
        }

        // 2. Add transaction to wallet
        await prismaMitra.$transaction(async (tx) => {
            // Find wallet
            const wallet = await tx.mitraWallet.findUnique({
                where: { mitraId }
            })

            if (!wallet) {
                throw new Error('Wallet mitra tidak ditemukan')
            }

            // Create transaction
            await tx.mitraTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: 'EARNING',
                    amount: Number(amount),
                    description,
                    referenceId
                }
            })

            // Update wallet balance
            await tx.mitraWallet.update({
                where: { id: wallet.id },
                data: {
                    balance: { increment: Number(amount) },
                    totalEarnings: { increment: Number(amount) }
                }
            })
        })

        return NextResponse.json({ success: true, message: 'Berhasil mensinkronisasi komisi ke wallet' })
    } catch (error: unknown) {
        logger.error('Sync Commission error:', error as Error)
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json(
            { message: errorMessage },
            { status: 500 }
        )
    }
}
