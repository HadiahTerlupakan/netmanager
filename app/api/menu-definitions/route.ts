/**
 * Menu Definitions API
 * 
 * GET /api/menu-definitions - Get all menu definitions
 * GET /api/menu-definitions?portal=admin - Filter by portal
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const { searchParams } = new URL(request.url)
        const portal = searchParams.get('portal')

        const where: any = {
            isActive: true,
        }

        if (portal) {
            where.portal = portal
        }

        const menuDefinitions = await prisma.menuDefinition.findMany({
            where,
            orderBy: [
                { sortOrder: 'asc' },
            ],
        })

        // Build hierarchical structure
        const topLevelMenus = menuDefinitions.filter(m => !m.parentCode)
        const subMenus = menuDefinitions.filter(m => m.parentCode)

        const hierarchicalMenus = topLevelMenus.map(menu => ({
            ...menu,
            children: subMenus
                .filter(sub => sub.parentCode === menu.code)
                .sort((a, b) => a.sortOrder - b.sortOrder),
        }))

        return NextResponse.json({
            success: true,
            data: hierarchicalMenus,
            flat: menuDefinitions,
        })
    } catch (error) {
        console.error('Error fetching menu definitions:', error)
        return NextResponse.json(
            { error: 'Failed to fetch menu definitions' },
            { status: 500 }
        )
    }
}
