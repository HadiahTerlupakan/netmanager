import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { z } from 'zod'
import { FinanceService } from '@/modules/finance/services/FinanceService'
import { logger } from '@/lib/logger'

const financeService = new FinanceService()

const categorySchema = z.object({
  name: z.string().min(1, 'Nama kategori wajib diisi'),
  type: z.enum(['INCOME', 'EXPENSE']),
  description: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await verifyAuth(req)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const categories = await financeService.getAllCategories()
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching categories:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await verifyAuth(req)
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  try {
    const json = await req.json()
    const result = categorySchema.safeParse(json)

    if (!result.success) {
      return new NextResponse(result.error.issues[0]?.message || 'Validasi gagal', { status: 400 })
    }

    const { description, ...rest } = result.data
    const category = await financeService.createCategory({
        ...rest,
        ...(description ? { description } : {})
    })

    await logger.logActivity({
        action: 'CREATE',
        subject: 'FinanceCategory',
        details: { id: category.id, name: category.name, type: category.type },
        userId: session.id
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error('Error creating category:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
