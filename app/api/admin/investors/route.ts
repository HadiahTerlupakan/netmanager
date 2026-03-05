import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/rbac'
import { hash } from 'bcryptjs'

export async function GET() {
    try {
        const canRead = await hasPermission('users:read')
        if (!canRead) {
            return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
        }

        const investors = await prisma.investor.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { rabProjects: true }
                }
            }
        })

        return NextResponse.json(investors)
    } catch (error) {
        console.error('[ADMIN_INVESTORS_GET]', error)
        return NextResponse.json({ message: 'Terjadi kesalahan' }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const canWrite = await hasPermission('users:create')
        if (!canWrite) return NextResponse.json({ message: 'Forbidden' }, { status: 403 })

        const body = await req.json()
        const { username, password, namaLengkap, perusahaan, noTelp, email } = body

        if (!username || !password || !namaLengkap) {
            return NextResponse.json({ message: 'Data tidak lengkap' }, { status: 400 })
        }

        const existingUser = await prisma.investor.findUnique({
            where: { username }
        })

        if (existingUser) {
            return NextResponse.json({ message: 'Username sudah digunakan' }, { status: 400 })
        }

        const passwordHash = await hash(password, 12)

        const investor = await prisma.investor.create({
            data: {
                username,
                password, // Optional: store plain or just hash. Storing hash is safer.
                passwordHash,
                namaLengkap,
                perusahaan,
                noTelp,
                email,
                isActive: true
            }
        })

        return NextResponse.json(investor, { status: 201 })
    } catch (error) {
        console.error('[ADMIN_INVESTORS_POST]', error)
        return NextResponse.json({ message: 'Terjadi kesalahan' }, { status: 500 })
    }
}
