import { prisma } from '@/lib/prisma'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { hash } from 'bcryptjs'
import { updateInvestorSchema } from '@/lib/validations/investor'

export const GET = createHandler({ 
    auth: true, 
    permissions: ['investors:read'] 
}, async (_req, ctx) => {
    const { id } = ctx.params

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
        return ApiErrors.notFound('Investor tidak ditemukan')
    }

    return apiSuccess(investor)
})

export const PUT = createHandler({ 
    auth: true, 
    permissions: ['investors:update'] 
}, async (req, ctx) => {
    const { id } = ctx.params
    const body = await req.json()
    
    // Validate with schema
    const validatedData = updateInvestorSchema.parse({ ...body, id })
    const { username, password, namaLengkap, perusahaan, email, noTelp } = validatedData

    // Cek existing
    const existingInvestor = await prisma.investor.findUnique({
        where: { id }
    })

    if (!existingInvestor) {
        return ApiErrors.notFound('Investor tidak ditemukan')
    }

    // Cek username duplicate if changed
    if (username && username !== existingInvestor.username) {
        const checkUsername = await prisma.investor.findUnique({
            where: { username }
        })
        if (checkUsername) {
            return ApiErrors.badRequest('Username sudah digunakan')
        }
    }

    // Cek email duplicate if changed
    if (email && email !== existingInvestor.email) {
        const checkEmail = await prisma.investor.findUnique({
            where: { email }
        })
        if (checkEmail) {
            return ApiErrors.badRequest('Email sudah digunakan')
        }
    }

    const updateData: {
        username: string;
        namaLengkap: string;
        perusahaan: string | null;
        email: string;
        noTelp: string | null;
        passwordHash?: string;
    } = {
        username: username || existingInvestor.username,
        namaLengkap: namaLengkap || existingInvestor.namaLengkap,
        perusahaan: perusahaan ?? existingInvestor.perusahaan,
        email: email || existingInvestor.email,
        noTelp: noTelp ?? existingInvestor.noTelp,
    }

    if (password && password.trim() !== '') {
        updateData.passwordHash = await hash(password, 12)
    }

    const updatedInvestor = await prisma.investor.update({
        where: { id },
        data: updateData
    })

    ctx.validated = { id, username, namaLengkap, companies: perusahaan, email } // Sync for audit log (exclude password)

    // Remove passwords before returning
    const { passwordHash: _, ...safeInvestor } = updatedInvestor

    return apiSuccess(safeInvestor)
})

export const PATCH = createHandler({ 
    auth: true, 
    permissions: ['investors:update'] 
}, async (req, ctx) => {
    const { id } = ctx.params
    const { isActive } = await req.json()

    const existingInvestor = await prisma.investor.findUnique({
        where: { id }
    })

    if (!existingInvestor) {
        return ApiErrors.notFound('Investor tidak ditemukan')
    }

    const updatedInvestor = await prisma.investor.update({
        where: { id },
        data: { isActive }
    })

    ctx.validated = { id, isActive } // Sync for audit log
    return apiSuccess(updatedInvestor)
})

export const DELETE = createHandler({ 
    auth: true, 
    permissions: ['investors:delete'] 
}, async (_req, ctx) => {
    const { id } = ctx.params

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
        return ApiErrors.notFound('Investor tidak ditemukan')
    }

    if (investor._count.rabProjects > 0 || investor._count.payouts > 0) {
        return ApiErrors.badRequest('Gagal menghapus investor karena masih terkait dengan Proyek RAB atau riwayat Payout. Silakan Nonaktifkan akun saja.')
    }

    await prisma.investor.delete({
        where: { id }
    })

    ctx.validated = { id, deletedAt: new Date(), username: investor.username } // Sync for audit log
    return apiSuccess({ message: 'Investor berhasil dihapus' })
})
