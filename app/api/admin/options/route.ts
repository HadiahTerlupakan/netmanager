import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const [sites, departments] = await Promise.all([
            prisma.sites.findMany({
                where: { isActive: true },
                select: { id: true, name: true }
            }),
            prisma.departments.findMany({
                select: { id: true, name: true },
                orderBy: { name: 'asc' }
            })
        ])

        return NextResponse.json({
            sites,
            departments
        })
    } catch (error) {
        console.error('Error fetching options:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
