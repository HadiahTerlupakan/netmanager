import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const locations = await prisma.odc.findMany({
            select: {
                location: true
            },
            where: {
                location: {
                    not: null
                }
            },
            distinct: ['location'],
            orderBy: {
                location: 'asc'
            }
        })

        // Filter out empty strings if any and map to simple array
        const uniqueLocations = locations
            .map(l => l.location)
            .filter((l): l is string => typeof l === 'string' && l.trim().length > 0)

        return NextResponse.json(uniqueLocations)
    } catch (error) {
        console.error('Error fetching locations:', error)
        return NextResponse.json(
            { error: 'Failed to fetch locations' },
            { status: 500 }
        )
    }
}
