
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth-helpers'

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAdmin(request)
        if (session instanceof NextResponse) {
            return session
        }

        const { id } = await params

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 })
        }

        // Optional: Check if exists first, or just delete
        await prisma.attendance.delete({
            where: { id }
        })

        return NextResponse.json({ success: true, message: 'Attendance deleted successfully' })

    } catch (error: any) {
        console.error('Error deleting attendance:', error)
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Data not found' }, { status: 404 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
