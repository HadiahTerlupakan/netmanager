import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { z } from 'zod'
import { FinanceService } from '@/modules/finance/services/FinanceService'

const financeService = new FinanceService()

const categorySchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi'),
  type: z.enum(['INCOME', 'EXPENSE']),
  description: z.string().optional(),
})

export async function GET(req: Request) {
  const session = await verifyAuth(req as any)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const categories = await financeService.getAllCategories()
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching categories:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await verifyAuth(req as any)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const json = await req.json()
    const result = categorySchema.safeParse(json)

    if (!result.success) {
      return new NextResponse(result.error.issues[0].message, { status: 400 })
    }

    const category = await financeService.createCategory(result.data)

    return NextResponse.json(category)
  } catch (error) {
    console.error('Error creating category:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
