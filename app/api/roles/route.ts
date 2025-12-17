import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { z } from 'zod'

const roleSchema = z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    permissions: z.array(z.string()), // Array of permission IDs
    accessAdminPanel: z.boolean().optional().default(false),
    accessEmployeePanel: z.boolean().optional().default(false)
})

export async function GET() {
    if (!await hasPermission('role:read')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    try {
        const roles = await prisma.role.findMany({
            include: {
                _count: {
                    select: { users: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        })
        return NextResponse.json(roles)
    } catch (error) {
        console.error('Error fetching roles:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    if (!await hasPermission('role:create')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    try {
        const body = await req.json()
        const { name, description, permissions, accessAdminPanel, accessEmployeePanel } = roleSchema.parse(body)

        const role = await prisma.role.create({
            data: {
                name,
                description,
                accessAdminPanel,
                accessEmployeePanel,
                permissions: {
                    connect: permissions.map(id => ({ id }))
                }
            }
        })

        return NextResponse.json(role)
    } catch (error) {
        console.error('Error creating role:', error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Validation Error', details: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
