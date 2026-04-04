import { prisma } from '@/modules/database'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { hash } from 'bcryptjs'
import { investorSchema } from '@/lib/validations/investor'

export const GET = createHandler({ 
    auth: true, 
    permissions: ['investors:read'] 
}, async () => {
    const investors = await prisma.investor.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            _count: {
                select: { rabProjects: true }
            }
        }
    })

    // Sembunyikan field sensitif dan pastikan serialisasi BigInt jika ada (lewat apiSuccess)
    const safeInvestors = investors.map(({ passwordHash: _, ...investor }) => investor)

    return apiSuccess(safeInvestors)
})

export const POST = createHandler({ 
    auth: true, 
    permissions: ['investors:create'],
    schema: investorSchema
}, async (req, ctx) => {
    const { username, password, namaLengkap, perusahaan, noTelp, email, tenantId } = ctx.validated

    if (!password) {
        return ApiErrors.badRequest('Password wajib diisi untuk membuat investor baru')
    }

    const existingUser = await prisma.investor.findUnique({
        where: { username }
    })

    if (existingUser) {
        return ApiErrors.badRequest('Username sudah digunakan')
    }

    const passwordHash = await hash(password, 12)

    const investor = await prisma.investor.create({
        data: {
            username,
            passwordHash,
            namaLengkap,
            perusahaan,
            noTelp,
            email,
            tenantId,
            isActive: true
        }
    })

    // Remove passwords before returning
    const { passwordHash: _, ...safeInvestor } = investor

    return apiSuccess(safeInvestor, { status: 201 })
})
