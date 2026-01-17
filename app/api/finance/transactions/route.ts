import { NextResponse } from 'next/server'
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

export async function GET(req: Request) {
  const session = await verifyAuth(req as any)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const categoryId = searchParams.get('categoryId') || undefined
    const accountId = searchParams.get('accountId') || undefined

    const transactions = await financeService.getTransactions({
      startDate,
      endDate,
      categoryId,
      accountId
    })

    return NextResponse.json(transactions)
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await verifyAuth(req as any)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const json = await req.json()
    const result = transactionSchema.safeParse(json)
    
    if (!result.success) {
        return new NextResponse(result.error.issues[0].message, { status: 400 })
    }

    const body = result.data

    const transaction = await financeService.createTransaction({
      ...body,
      date: body.date,
      createdById: session.id,
    })

    return NextResponse.json(transaction)
  } catch (error) {
    console.error('Error creating transaction:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
