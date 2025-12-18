import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
    try {
        const session = await getServerSession(authOptions)

        // Basic check for admin (assuming roleId or similar exists, or simply authenticating for now)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const registrations = await prisma.registration.findMany({
            orderBy: {
                createdAt: 'desc'
            }
        })

        return NextResponse.json(registrations)
    } catch (error) {
        console.error('Fetch Registrations Error:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
