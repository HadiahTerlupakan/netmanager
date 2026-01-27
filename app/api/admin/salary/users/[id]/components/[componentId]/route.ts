import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// DELETE - Remove component from user
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; componentId: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { componentId } = await params

        await prisma.userSalaryComponent.delete({
            where: { id: componentId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Error removing component:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
