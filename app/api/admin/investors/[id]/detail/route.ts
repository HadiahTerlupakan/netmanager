import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensurePermission } from '@/lib/rbac'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await ensurePermission('users:read')

        const { id } = await params

        const investor = await prisma.investor.findUnique({
            where: { id },
            include: {
                rabProjects: {
                    include: {
                        rabProject: {
                            include: {
                                site: {
                                    select: { id: true, name: true }
                                }
                            }
                        }
                    }
                },
                payouts: {
                    orderBy: { date: 'desc' },
                    take: 5
                }
            }
        })

        if (!investor) {
            return NextResponse.json({ message: 'Investor tidak ditemukan' }, { status: 404 })
        }

        const safeInvestor = { ...investor, password: '', passwordHash: '' }

        return NextResponse.json(safeInvestor)
    } catch (error: unknown) {
        console.error('Get Investor detail error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json(
            { message: errorMessage },
            { status: errorMessage?.includes('Permission') ? 403 : 500 }
        )
    }
}
