import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalaryConfigRepository } from '@/modules/salary/repositories/SalaryConfigRepository'

const configRepo = new SalaryConfigRepository()

/**
 * GET /api/admin/salary/config - Get salary configuration
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const config = await configRepo.getOrCreateConfig()

        return NextResponse.json({ config })
    } catch (error) {
        console.error('Error fetching salary config:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch config' },
            { status: 500 }
        )
    }
}

/**
 * PUT /api/admin/salary/config - Update salary configuration
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
            // Create new config if no ID provided
            const config = await configRepo.createConfig(updateData)
            return NextResponse.json({ success: true, config })
        }

        const config = await configRepo.updateConfig(id, updateData)

        return NextResponse.json({ success: true, config })
    } catch (error) {
        console.error('Error updating salary config:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to update config' },
            { status: 500 }
        )
    }
}
