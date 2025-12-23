
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

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAdmin(request)
        if (session instanceof NextResponse) {
            return session
        }

        const { id } = await params
        const body = await request.json()
        const { checkIn, checkOut, status, notes } = body

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 })
        }

        // Prepare update data
        const updateData: any = {}
        if (checkIn) updateData.checkIn = new Date(checkIn)
        if (checkOut) updateData.checkOut = new Date(checkOut)
        if (status) updateData.status = status
        if (notes !== undefined) updateData.notes = notes

        const updated = await prisma.attendance.update({
            where: { id },
            data: updateData
        })

        return NextResponse.json({ success: true, data: updated })

    } catch (error: any) {
        console.error('Error updating attendance:', error)
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Data not found' }, { status: 404 })
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
