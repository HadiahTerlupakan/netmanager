import { prisma } from '@/lib/prisma'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { hash } from 'bcryptjs'

export const GET = createHandler({ 
    auth: true, 
    permissions: ['users:read'] 
}, async () => {
    const investors = await prisma.investor.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            _count: {
                select: { rabProjects: true }
            }
        }
    })

    // Sembunyikan field sensitif
    const safeInvestors = investors.map(({ password: _, passwordHash: __, ...investor }) => investor)

    return apiSuccess(safeInvestors)
})

export const POST = createHandler({ 
    auth: true, 
    permissions: ['users:create'] 
}, async (req, ctx) => {
    const body = await req.json()
    const { username, password, namaLengkap, perusahaan, noTelp, email } = body

    if (!username || !password || !namaLengkap) {
        return ApiErrors.badRequest('Data tidak lengkap (username, password, namaLengkap wajib diisi)')
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
            password, // Legacy support, ideally removed in G1.1 but kept if still needed for now
            passwordHash,
            namaLengkap,
            perusahaan,
            noTelp,
            email,
            isActive: true
        }
    })

    ctx.validated = { username, namaLengkap, perusahaan, email } // Sync for audit log (exclude password)

    // Remove passwords before returning
    const { password: _, passwordHash: __, ...safeInvestor } = investor

    return apiSuccess(safeInvestor, { status: 201 })
})
