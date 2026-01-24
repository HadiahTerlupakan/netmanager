import { NextResponse, NextRequest } from 'next/server'
import { authorize, isAuthError } from '@/lib/authorization-middleware'
import { LeaveBalanceRepository, DEFAULT_LEAVE_QUOTAS } from '@/modules/attendance/repositories/LeaveBalanceRepository'
import { LeaveType } from '@prisma/client'

const leaveBalanceRepo = new LeaveBalanceRepository()

/**
 * @swagger
 * /api/admin/leave-balance:
 *   get:
 *     summary: Get all leave balances
 *     tags: [Leave Balance]
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Year to get balances for (default current year)
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 */
export async function GET(req: NextRequest) {
    const auth = await authorize(req, { permissions: ['attendance:read'] })
    if (isAuthError(auth)) return auth.error

    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const userId = searchParams.get('userId')

    try {
        if (userId) {
            // Get balances for specific user
            const balances = await leaveBalanceRepo.getUserBalances(userId, year)
            
            // Fill in missing types with defaults
            const allTypes = Object.keys(DEFAULT_LEAVE_QUOTAS) as LeaveType[]
            const existingTypes = new Set(balances.map(b => b.leaveType))
            
            const filledBalances = allTypes.map(type => {
                const existing = balances.find(b => b.leaveType === type)
                if (existing) {
                    return {
                        ...existing,
                        remaining: existing.quota - existing.used
                    }
                }
                return {
                    leaveType: type,
                    quota: DEFAULT_LEAVE_QUOTAS[type],
                    used: 0,
                    remaining: DEFAULT_LEAVE_QUOTAS[type]
                }
            })

            return NextResponse.json({ balances: filledBalances, year })
        }

        // Get all balances for admin view
        const balances = await leaveBalanceRepo.getAllBalances(year)
        return NextResponse.json({ balances, year })
    } catch (error: any) {
        console.error('Error fetching leave balances:', error)
        return NextResponse.json({ error: 'Gagal mengambil data saldo cuti' }, { status: 500 })
    }
}

/**
 * @swagger
 * /api/admin/leave-balance:
 *   post:
 *     summary: Set leave quota for a user
 *     tags: [Leave Balance]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *               year:
 *                 type: integer
 *               quotas:
 *                 type: object
 *                 description: Leave type to quota mapping
 */
export async function POST(req: NextRequest) {
    const auth = await authorize(req, { permissions: ['attendance:update'] })
    if (isAuthError(auth)) return auth.error

    try {
        const { userId, year, quotas } = await req.json()

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 })
        }

        const targetYear = year || new Date().getFullYear()

        // Update each provided quota
        const updatePromises = Object.entries(quotas).map(([type, quota]) =>
            leaveBalanceRepo.upsertQuota(userId, targetYear, type as LeaveType, quota as number)
        )

        await Promise.all(updatePromises)

        // Return updated balances
        const balances = await leaveBalanceRepo.getUserBalances(userId, targetYear)
        return NextResponse.json({ 
            message: 'Kuota cuti berhasil diperbarui',
            balances 
        })
    } catch (error: any) {
        console.error('Error updating leave quota:', error)
        return NextResponse.json({ error: 'Gagal memperbarui kuota cuti' }, { status: 500 })
    }
}
