import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Get gudang list for karyawan
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const gudangs = await prisma.gudang.findMany({
            where: { isActive: true },
            select: {
                id: true,
                kode: true,
                nama: true,
                lokasi: true
            },
            orderBy: { nama: 'asc' }
        })

        return NextResponse.json({ gudangList: gudangs })
    } catch (error) {
        console.error('Error fetching gudangs:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
