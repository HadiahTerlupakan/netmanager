import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, isSuperAdmin } from '@/lib/auth'
import { z } from 'zod'
import { FinanceService } from '@/modules/finance/services/FinanceService'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

const financeService = new FinanceService()

const transactionSchema = z.object({
  date: z.string().or(z.date()),
  amount: z.number().min(1, 'Jumlah harus lebih dari 0'),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().min(1, 'Kategori wajib dipilih'),
  description: z.string().optional(),
  referenceId: z.string().optional(),
  accountId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized()

    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const categoryId = searchParams.get('categoryId') || undefined
    const accountId = searchParams.get('accountId') || undefined
    const siteIdParam = searchParams.get('siteId') || undefined

    const userPermissions = session.permissions || []
    const isSuper = isSuperAdmin(session)
    const isSiteRestricted = userPermissions.includes('finance_transaction:site_only') && !isSuper

    let filterSiteId: string | undefined = siteIdParam
    if (isSiteRestricted) {
        if (!session.siteId) {
             return NextResponse.json([])
        }
        filterSiteId = session.siteId
    }

    const transactions = await financeService.getTransactions({
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(accountId ? { accountId } : {}),
      ...(filterSiteId ? { siteId: filterSiteId } : {})
    })

    return NextResponse.json(transactions)
  } catch (error) {
    console.error('Error fetching transactions:', error)
    const message = error instanceof Error ? error.message : 'Gagal mengambil data transaksi'
    return ApiErrors.internalError(message)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized()

    const json = await req.json()
    const result = transactionSchema.safeParse(json)

    if (!result.success) {
        return ApiErrors.badRequest(result.error.issues[0]?.message || 'Validasi gagal')
    }

    const { date, description, referenceId, accountId, ...rest } = result.data

    const transaction = await financeService.createTransaction({
      ...rest,
      date: date || new Date(),
      createdById: session.id,
      ...(description ? { description } : {}),
      ...(referenceId ? { referenceId } : {}),
      ...(accountId ? { accountId } : {})
    })

    return apiSuccess(transaction, { status: 201, message: 'Transaksi berhasil dicatat' })
  } catch (error) {
    console.error('Error creating transaction:', error)
    const message = error instanceof Error ? error.message : 'Gagal mencatat transaksi'
    return ApiErrors.internalError(message)
  }
}
