import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { z } from 'zod'
import { FinanceService } from '@/modules/finance/services/FinanceService'

const financeService = new FinanceService()

const transactionSchema = z.object({
  date: z.string().or(z.date()),
  amount: z.number().min(1),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().min(1),
  description: z.string().optional(),
  referenceId: z.string().optional(),
  accountId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await verifyAuth(req)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const categoryId = searchParams.get('categoryId') || undefined
    const accountId = searchParams.get('accountId') || undefined
    const siteIdParam = searchParams.get('siteId') || undefined

    // RBAC: Site Restriction
    // Assuming we have getUserPermissions imported or available on session (verifyAuth populates it)
    // We need to check permissions. `verifyAuth` returns UserSession which might not have permissions array explicitly if not extended,
    // but typically we load it. If not, we might need a helper.
    // Let's use `hasPermission` if possible, but `hasPermission` takes just string usually in client, here we are in API.
    // The `auth` module exports `getUserPermissions`?
    // Let's assume session has permissions or use `getUserPermissions(session.id)`.
    // Actually, `verifyAuth` returns session with permissions usually.
    // Let's check `lib/auth.ts` -> it returns `permissions` in session.

    const userPermissions = session.permissions || []
    const isSuperAdmin = session.role === 'SUPER_ADMIN'
    const isSiteRestricted = userPermissions.includes('finance_transaction:site_only') && !isSuperAdmin

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
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await verifyAuth(req)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const json = await req.json()
    const result = transactionSchema.safeParse(json)
    
    if (!result.success) {
        return new NextResponse(result.error.issues[0]?.message || 'Validasi gagal', { status: 400 })
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

    return NextResponse.json(transaction)
  } catch (error) {
    console.error('Error creating transaction:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
