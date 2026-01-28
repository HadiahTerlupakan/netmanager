import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { RegistrationRepository } from '@/modules/registration/repositories/RegistrationRepository'

const registrationRepository = new RegistrationRepository()

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/registrations - List all registrations
 * Refactored to use RegistrationRepository (thin controller pattern)
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await hasPermission('registration:read'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const registrations = await registrationRepository.findAll()

        return NextResponse.json(registrations)
    } catch (error) {
        console.error('Fetch Registrations Error:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        )
    }
}
