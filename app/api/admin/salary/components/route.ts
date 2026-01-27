import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalaryComponentRepository } from '@/modules/salary/repositories/SalaryComponentRepository'
import { SalaryComponentType } from '@prisma/client'

const componentRepo = new SalaryComponentRepository()

/**
 * GET /api/admin/salary/components - List all components
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type') as SalaryComponentType | undefined
        const userId = searchParams.get('userId')

        const components = await componentRepo.findAll(type)

        // If userId specified, include user's component values
        let userComponents = null
        if (userId) {
            userComponents = await componentRepo.getUserComponents(userId)
        }

        return NextResponse.json({ 
            components,
            userComponents
        })
    } catch (error) {
        console.error('Error fetching components:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch components' },
            { status: 500 }
        )
    }
}

/**
 * POST /api/admin/salary/components - Create component or assign to user
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { action } = body

        if (action === 'assign') {
            // Assign component to user
            const { userId, componentId, amount, notes } = body
            if (!userId || !componentId || amount === undefined) {
                return NextResponse.json(
                    { error: 'userId, componentId, and amount are required' },
                    { status: 400 }
                )
            }

            const userComponent = await componentRepo.assignToUser(userId, componentId, amount, notes)
            return NextResponse.json({ success: true, userComponent })
        } else {
            // Create new component
            const { name, type, rateType, defaultAmount, description, sortOrder } = body
            if (!name || !type) {
                return NextResponse.json(
                    { error: 'name and type are required' },
                    { status: 400 }
                )
            }

            // Check if component with same name already exists
            const existingComponent = await componentRepo.findByName(name)
            
            let component;
            if (existingComponent) {
                // Validate if existing component matches requested types
                const reqRateType = rateType || 'FIXED'
                if (existingComponent.type !== type) {
                    return NextResponse.json(
                        { error: `Komponen "${name}" sudah ada dengan tipe berbeda (${existingComponent.type})` },
                        { status: 400 }
                    )
                }
                if (existingComponent.rateType !== reqRateType) {
                     return NextResponse.json(
                        { error: `Komponen "${name}" sudah ada dengan tipe rate berbeda (${existingComponent.rateType})` },
                        { status: 400 }
                    )
                }
                component = existingComponent
            } else {
                component = await componentRepo.create({
                    name,
                    type,
                    rateType: rateType || 'FIXED',
                    defaultAmount,
                    description,
                    sortOrder: sortOrder || 0
                })
            }

            return NextResponse.json({ success: true, component })
        }
    } catch (error) {
        console.error('Error creating component:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create component' },
            { status: 500 }
        )
    }
}

/**
 * PUT /api/admin/salary/components - Update component
 */
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { id, ...updateData } = body

        if (!id) {
            return NextResponse.json(
                { error: 'Component ID is required' },
                { status: 400 }
            )
        }

        const component = await componentRepo.update(id, updateData)

        return NextResponse.json({ success: true, component })
    } catch (error) {
        console.error('Error updating component:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to update component' },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/admin/salary/components - Delete component or remove from user
 */
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        const userId = searchParams.get('userId')
        const componentId = searchParams.get('componentId')

        if (userId && componentId) {
            // Remove component from user
            await componentRepo.removeFromUser(userId, componentId)
            return NextResponse.json({ success: true })
        } else if (id) {
            // Delete component
            await componentRepo.delete(id)
            return NextResponse.json({ success: true })
        } else {
            return NextResponse.json(
                { error: 'id or (userId + componentId) is required' },
                { status: 400 }
            )
        }
    } catch (error) {
        console.error('Error deleting component:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete component' },
            { status: 500 }
        )
    }
}
