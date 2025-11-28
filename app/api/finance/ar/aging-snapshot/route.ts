import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { ARRepository } from '@/lib/repositories/ARRepository'

const prisma = new PrismaClient()
const arRepo = new ARRepository(prisma)

export async function POST(request: NextRequest) {
    try {
        // Auth check
        const token = request.headers.get('x-finance-token')
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const snapshot = await arRepo.createAgingSnapshot()

        return NextResponse.json({
            success: true,
            snapshotId: snapshot.id,
            message: 'Aging snapshot created successfully'
        })
    } catch (error: any) {
        console.error('Error creating aging snapshot:', error)
        return NextResponse.json(
            { error: 'Failed to create aging snapshot', details: error.message },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    try {
        // Auth check
        const token = request.headers.get('x-finance-token')
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const limit = parseInt(searchParams.get('limit') || '30')

        const snapshots = await arRepo.findAgingSnapshots(limit)

        // Convert BigInt to string
        const data = snapshots.map((snapshot) => ({
            ...snapshot,
            current: snapshot.current.toString(),
            overdue30: snapshot.overdue30.toString(),
            overdue60: snapshot.overdue60.toString(),
            overdue90: snapshot.overdue90.toString(),
            totalOutstanding: snapshot.totalOutstanding.toString()
        }))

        return NextResponse.json({ data })
    } catch (error: any) {
        console.error('Error fetching aging snapshots:', error)
        return NextResponse.json(
            { error: 'Failed to fetch aging snapshots', details: error.message },
            { status: 500 }
        )
    }
}
