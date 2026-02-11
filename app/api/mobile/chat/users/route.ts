import { verifyMobileToken } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

// GET - Get list of users for starting new chat
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json({ error: 'Token wajib diisi' }, { status: 401 })
        }

        const user = await verifyMobileToken(token)
        if (!user) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search') || ''

        // Get all active users except current user
        const users = await prisma.user.findMany({
            where: {
                isActive: true,
                id: { not: user.id },
                ...(search && {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } }
                    ]
                })
            },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                departments: {
                    select: { name: true }
                },
                sites: {
                    select: { name: true }
                }
            },
            orderBy: { name: 'asc' },
            take: 50
        })

        return NextResponse.json({
            success: true,
            data: users.map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                image: u.image,
                department: u.departments?.name,
                site: u.sites?.name
            }))
        })
    } catch (error: unknown) {
        console.error('Error fetching users:', error)
        const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
