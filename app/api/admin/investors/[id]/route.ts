
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensurePermission } from '@/lib/rbac'
import bcrypt from 'bcryptjs'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await ensurePermission('users:read') // Assuming GET requires read permission

        const { id } = await params

        const investor = await prisma.investor.findUnique({
            where: { id },
            select: {
                id: true,
                username: true,
                namaLengkap: true,
                perusahaan: true,
                email: true,
                noTelp: true,
                isActive: true,
                createdAt: true,
                updatedAt: true,
            }
        })

        if (!investor) {
            return NextResponse.json({ message: 'Investor tidak ditemukan' }, { status: 404 })
        }

        return NextResponse.json(investor)
    } catch (error: unknown) {
        console.error('Get Investor error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json(
            { message: errorMessage },
            { status: errorMessage?.includes('Permission') ? 403 : 500 }
        )
    }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await ensurePermission('users:update')

        const { id } = await params
        const body = await req.json()
        const { username, password, namaLengkap, perusahaan, email, noTelp } = body

        // Cek existing
        const existingInvestor = await prisma.investor.findUnique({
            where: { id }
        })

        if (!existingInvestor) {
            return NextResponse.json({ message: 'Investor tidak ditemukan' }, { status: 404 })
        }

        // Cek username duplicate if changed
        if (username && username !== existingInvestor.username) {
            const checkUsername = await prisma.investor.findUnique({
                where: { username }
            })
            if (checkUsername) {
                return NextResponse.json({ message: 'Username sudah digunakan' }, { status: 400 })
            }
        }

        // Cek email duplicate if changed
        if (email && email !== existingInvestor.email) {
            const checkEmail = await prisma.investor.findUnique({
                where: { email }
            })
            if (checkEmail) {
                return NextResponse.json({ message: 'Email sudah digunakan' }, { status: 400 })
            }
        }

        const updateData: Record<string, string | undefined> = {
            username: username || existingInvestor.username,
            namaLengkap: namaLengkap || existingInvestor.namaLengkap,
            perusahaan,
            email,
            noTelp,
        }

        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10)
            const hashedPassword = await bcrypt.hash(password, salt)
            updateData.password = password // Keeping plaintext temporarily if legacy login needs it but hashed below
            updateData.passwordHash = hashedPassword
        }

        const updatedInvestor = await prisma.investor.update({
            where: { id },
            data: updateData
        })

        // Remove passwords before returning
        const safeInvestor = { ...updatedInvestor, password: '', passwordHash: '' }

        return NextResponse.json(safeInvestor)
    } catch (error: unknown) {
        console.error('Update Investor error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json(
            { message: errorMessage },
            { status: errorMessage?.includes('Permission') ? 403 : 500 }
        )
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await ensurePermission('users:update')

        const { id } = await params
        const { isActive } = await request.json()

        const existingInvestor = await prisma.investor.findUnique({
            where: { id }
        })

        if (!existingInvestor) {
            return NextResponse.json({ message: 'Investor tidak ditemukan' }, { status: 404 })
        }

        const updatedInvestor = await prisma.investor.update({
            where: { id },
            data: { isActive }
        })

        return NextResponse.json(updatedInvestor)
    } catch (error: unknown) {
        console.error('Patch Investor error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json(
            { message: errorMessage },
            { status: errorMessage?.includes('Permission') ? 403 : 500 }
        )
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await ensurePermission('users:delete')

        const { id } = await params

        // Check relation
        const investor = await prisma.investor.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { rabProjects: true, payouts: true }
                }
            }
        })

        if (!investor) {
            return NextResponse.json({ message: 'Investor tidak ditemukan' }, { status: 404 })
        }

        if (investor._count.rabProjects > 0 || investor._count.payouts > 0) {
            return NextResponse.json(
                { message: 'Gagal menghapus investor karena masih terkait dengan Proyek RAB atau riwayat Payout. Silakan Nonaktifkan akun saja.' },
                { status: 400 }
            )
        }

        await prisma.investor.delete({
            where: { id }
        })

        return NextResponse.json({ success: true, message: 'Investor berhasil dihapus' })
    } catch (error: unknown) {
        console.error('Delete Investor error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json(
            { message: errorMessage },
            { status: errorMessage?.includes('Permission') ? 403 : 500 }
        )
    }
}
