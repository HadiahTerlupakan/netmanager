import { prismaAuth } from '@/lib/prisma'
import { prismaMitraAuth } from '@/lib/prisma-mitra'

export type RoleToExclude = 'EMPLOYEE' | 'CUSTOMER' | 'MITRA'

/**
 * Checks if an identifier (email, username, or ID) exists across all user types
 * (Pelanggan, User/Employee, Mitra) to prevent cross-role conflicts.
 * This is crucial for unified login where users authenticate regardless of role.
 */
export async function checkGlobalIdentifier(
    identifier: string,
    excludeRole?: RoleToExclude,
    excludeId?: string
): Promise<{ exists: true; role: string; field: string } | { exists: false }> {
    if (!identifier) return { exists: false }

    const id = identifier.trim()
    const idLower = id.toLowerCase()

    // 1. Check Pelanggan
    if (excludeRole !== 'CUSTOMER') {
        const pelanggan = await prismaAuth.pelanggan.findFirst({
            where: {
                OR: [
                    { username: { equals: idLower, mode: 'insensitive' } },
                    { idPelanggan: { equals: idLower, mode: 'insensitive' } },
                    { email: { equals: idLower, mode: 'insensitive' } }
                ],
                ...(excludeId ? { id: { not: excludeId } } : {})
            },
            select: { id: true, username: true, idPelanggan: true, email: true }
        })

        if (pelanggan) {
            let field = 'identifier'
            if (pelanggan.username?.toLowerCase() === idLower) field = 'username'
            else if (pelanggan.idPelanggan?.toLowerCase() === idLower) field = 'ID Pelanggan'
            else if (pelanggan.email?.toLowerCase() === idLower) field = 'email'

            return { exists: true, role: 'Pelanggan', field }
        }
    }

    // 2. Check User (Karyawan)
    if (excludeRole !== 'EMPLOYEE') {
        // Use prismaAuth (un-isolated) because email is global unique
        const user = await prismaAuth.user.findFirst({
            where: {
                email: { equals: idLower, mode: 'insensitive' },
                ...(excludeId ? { id: { not: excludeId } } : {})
            },
            select: { id: true }
        })

        if (user) {
            return { exists: true, role: 'Karyawan', field: 'email' }
        }
    }

    // 3. Check Mitra
    if (excludeRole !== 'MITRA') {
        const mitra = await prismaMitraAuth.mitra.findFirst({
            where: {
                email: { equals: idLower, mode: 'insensitive' },
                ...(excludeId ? { id: { not: excludeId } } : {})
            },
            select: { id: true }
        })

        if (mitra) {
            return { exists: true, role: 'Mitra', field: 'email' }
        }
    }

    return { exists: false }
}
