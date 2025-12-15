import { NextRequest, NextResponse } from 'next/server'
import { requireCustomerAuth, getCustomerById } from '@/lib/customer-auth'

export async function GET(request: NextRequest) {
    try {
        // Require authentication
        const authResult = await requireCustomerAuth(request)
        if (authResult.response) {
            return authResult.response
        }

        const { session } = authResult

        // Get full customer data
        const customer = await getCustomerById(session.id)

        if (!customer) {
            return NextResponse.json(
                { error: 'Data pelanggan tidak ditemukan' },
                { status: 404 }
            )
        }

        // Return customer profile
        return NextResponse.json({
            success: true,
            customer: {
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
                paket: customer.hargaPaket ? {
                    id: customer.hargaPaket.id,
                    nama: customer.hargaPaket.name,
                    harga: customer.hargaPaket.harga,
                    bandwidth: customer.hargaPaket.bandwidth ? {
                        nama: customer.hargaPaket.bandwidth.name,
                        download: customer.hargaPaket.bandwidth.maxLimitDownload,
                        upload: customer.hargaPaket.bandwidth.maxLimitUpload,
                    } : null,
                } : null,
                lokasi: {
                    provinsi: customer.provinsi,
                    kabupatenKota: customer.kabupatenKota,
                    kecamatan: customer.kecamatan,
                    kelurahanDesa: customer.kelurahanDesa,
                    latitude: customer.latitude,
                    longitude: customer.longitude,
                },
            },
        })
    } catch (error) {
        console.error('[Customer Me Error]:', error)
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}
