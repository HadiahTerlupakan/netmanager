import { NextRequest, NextResponse } from 'next/server'
import { requireCustomerAuth, getCustomerById } from '@/lib/customer-auth'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'

// GET - Get customer profile
export async function GET(request: NextRequest) {
    try {
        const authResult = await requireCustomerAuth(request)
        if (authResult.response) {
            return authResult.response
        }

        const customer = await getCustomerById(authResult.session.id)

        if (!customer) {
            return NextResponse.json(
                { error: 'Data pelanggan tidak ditemukan' },
                { status: 404 }
            )
        }

        return NextResponse.json({
            success: true,
            profile: {
                id: customer.id,
                idPelanggan: customer.idPelanggan,
                nama: customer.nama,
                username: customer.username,
                email: customer.email,
                noTelp: customer.noTelp,
                alamat: customer.alamat,
                status: customer.status,
                tipe: customer.tipe,
                tanggalAktif: customer.tanggalAktif,
                jatuhTempo: customer.jatuhTempo,
                lokasi: {
                    provinsi: customer.provinsi,
                    kabupatenKota: customer.kabupatenKota,
                    kecamatan: customer.kecamatan,
                    kelurahanDesa: customer.kelurahanDesa,
                },
                preferences: {
                    is2FAEnabled: customer.is2FAEnabled,
                    isBillNotifEnabled: customer.isBillNotifEnabled,
                    isPromoEnabled: customer.isPromoEnabled,
                },
                paket: (customer as any).hargaPaket ? {
                    nama: (customer as any).hargaPaket.name,
                    harga: (customer as any).hargaPaket.harga,
                    durasi: (customer as any).hargaPaket.durasi,
                    kecepatan: (customer as any).hargaPaket.description,
                    bandwidth: (customer as any).hargaPaket.bandwidth ? {
                        nama: (customer as any).hargaPaket.bandwidth.name,
                        download: (customer as any).hargaPaket.bandwidth.maxLimitDownload,
                        upload: (customer as any).hargaPaket.bandwidth.maxLimitUpload,
                    } : null,
                } : null,
            },
        })
    } catch (error) {
        console.error('[Customer Profile GET Error]:', error)
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}

// PATCH - Update customer phone or password only
export async function PATCH(request: NextRequest) {
    try {
        const authResult = await requireCustomerAuth(request)
        if (authResult.response) {
            return authResult.response
        }

        const body = await request.json()
        const {
            noTelp,
            currentPassword,
            newPassword,
            is2FAEnabled,
            isBillNotifEnabled,
            isPromoEnabled
        } = body

        const updateData: {
            noTelp?: string;
            passwordHash?: string;
            is2FAEnabled?: boolean;
            isBillNotifEnabled?: boolean;
            isPromoEnabled?: boolean;
        } = {}

        // Update preferences
        if (typeof is2FAEnabled === 'boolean') updateData.is2FAEnabled = is2FAEnabled
        if (typeof isBillNotifEnabled === 'boolean') updateData.isBillNotifEnabled = isBillNotifEnabled
        if (typeof isPromoEnabled === 'boolean') updateData.isPromoEnabled = isPromoEnabled

        // Update phone number
        if (noTelp !== undefined) {
            updateData.noTelp = noTelp
        }

        // Update password
        if (newPassword) {
            if (!currentPassword) {
                return NextResponse.json(
                    { error: 'Password saat ini harus diisi untuk mengganti password' },
                    { status: 400 }
                )
            }

            // Verify current password
            const customer = await prisma.pelanggan.findUnique({
                where: { id: authResult.session.id },
                select: { passwordHash: true },
            })

            if (!customer?.passwordHash) {
                return NextResponse.json(
                    { error: 'Akun tidak memiliki password' },
                    { status: 400 }
                )
            }

            const { compare } = await import('bcryptjs')
            const isValid = await compare(currentPassword, customer.passwordHash)
            if (!isValid) {
                return NextResponse.json(
                    { error: 'Password saat ini salah' },
                    { status: 401 }
                )
            }

            if (newPassword.length < 6) {
                return NextResponse.json(
                    { error: 'Password baru minimal 6 karakter' },
                    { status: 400 }
                )
            }

            updateData.passwordHash = await hash(newPassword, 10)
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: 'Tidak ada data yang diupdate' },
                { status: 400 }
            )
        }

        // Update customer
        const updated = await prisma.pelanggan.update({
            where: { id: authResult.session.id },
            data: updateData,
            select: {
                id: true,
                noTelp: true,
                updatedAt: true,
            },
        })

        return NextResponse.json({
            success: true,
            message: newPassword ? 'Password berhasil diubah' : 'Profil berhasil diupdate',
            updated: {
                noTelp: updated.noTelp,
                updatedAt: updated.updatedAt,
            },
        })
    } catch (error) {
        console.error('[Customer Profile PATCH Error]:', error)
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}
