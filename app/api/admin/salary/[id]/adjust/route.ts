
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalaryAuditService } from '@/modules/salary/services/SalaryAuditService'
import { z } from 'zod'

const adjustSchema = z.object({
    name: z.string().min(1, 'Nama komponen wajib diisi'),
    type: z.enum(['EARNING', 'DEDUCTION']),
    amount: z.number().min(0, 'Jumlah harus lebih besar dari 0'),
    notes: z.string().min(1, 'Catatan / Alasan wajib diisi')
})

export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || !session.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        const json = await req.json()
        const body = adjustSchema.parse(json)
        const { id } = await params

        const service = new SalaryAuditService()
        await service.addManualAdjustment(
            id,
            body.name,
            body.type,
            body.amount,
            body.notes,
            session.user.id
        )

        return NextResponse.json({ success: true })
        
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return new NextResponse('Invalid request data', { status: 400 })
        }
        console.error('Adjustment error:', error)
        return new NextResponse(error.message || 'Internal Server Error', { status: 500 })
    }
}
