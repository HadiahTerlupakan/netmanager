import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { z } from 'zod'

const roleSchema = z.object({
    name: z.string().min(2),
    description: z.string().optional(),
    permissions: z.array(z.string()), // Array of permission IDs
    accessAdminPanel: z.boolean().optional().default(false),
    accessEmployeePanel: z.boolean().optional().default(false),
    isRestricted: z.boolean().optional().default(false)
})

export async function GET(req: Request) {
    if (!await hasPermission('role:read')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    try {
        const { searchParams } = new URL(req.url)
        const filterRestricted = searchParams.get('filterRestricted') === 'true'

        let whereClause: any = {}

        if (filterRestricted) {
            const { getServerSession } = await import('next-auth')
            const { authConfig } = await import('@/lib/auth')
            const session = await getServerSession(authConfig)

            if (session?.user) {
                // Get current user's role ID
                const currentUser = await prisma.user.findUnique({
                    where: { id: session.user.id },
                    select: { roleId: true, role: { select: { name: true } } }
                })

                if (currentUser?.role?.name !== 'SUPER_ADMIN') {
                    whereClause = {
                        OR: [
                            { isRestricted: false },
                            { id: currentUser?.roleId || '' }
                        ]
                    }
                }
            }
        }

        const roles = await prisma.role.findMany({
            where: whereClause,
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
        const { name, description, permissions, accessAdminPanel, accessEmployeePanel, isRestricted } = roleSchema.parse(body)

        const role = await prisma.role.create({
            data: {
                name,
                description,
                accessAdminPanel,
                accessEmployeePanel,
                isRestricted,
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
