import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Get user's salary components
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id: userId } = await params

        const components = await prisma.userSalaryComponent.findMany({
            where: { 
                userId,
                isActive: true
            },
            include: {
                component: true
            },
            orderBy: { component: { sortOrder: 'asc' } }
        })

        return NextResponse.json({ components })
    } catch (error) {
        console.error('[API] Error fetching user components:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// POST - Assign component to user
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id: userId } = await params
        const body = await request.json()
        const { componentId, amount, notes } = body

        if (!componentId) {
            return NextResponse.json({ error: 'Component ID diperlukan' }, { status: 400 })
        }

        // Check if already assigned
        const existing = await prisma.userSalaryComponent.findUnique({
            where: {
                userId_componentId: { userId, componentId }
            }
        })

        if (existing) {
            // Update existing
            await prisma.userSalaryComponent.update({
                where: { id: existing.id },
                data: { amount, notes, isActive: true }
            })
        } else {
            // Create new
            await prisma.userSalaryComponent.create({
                data: {
                    userId,
                    componentId,
                    amount: amount || 0,
                    notes
                }
            })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('[API] Error assigning component:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
