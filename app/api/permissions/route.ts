import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'

export async function GET() {
    // Allow read if user can manage roles
    if (!await hasPermission('role:read') && !await hasPermission('role:create') && !await hasPermission('role:update')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    try {
        const permissions = await prisma.permission.findMany({
            orderBy: [
                { resource: 'asc' },
                { action: 'asc' }
            ]
        })
        return NextResponse.json(permissions)
    } catch (error) {
        console.error('Error fetching permissions:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
