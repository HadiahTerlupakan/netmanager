import { NextRequest, NextResponse } from 'next/server'
import { requireCustomerAuth, getCustomerById } from '@/lib/customer-auth'
import { prisma } from '@/lib/prisma'
import { DiscountType } from '@prisma/client'

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

        if (!customer.hargaPaket) {
            return NextResponse.json(
                { error: 'Paket langganan tidak ditemukan' },
                { status: 404 }
            )
        }

        const paket = customer.hargaPaket

        // Calculate next bill amount with discounts and PPN
        let basePrice = paket.harga
        let discountAmount = 0
        let ppnAmount = 0

        // Apply discount if applicable
        if (paket.useDiscount && paket.discountValue) {
            if (paket.discountType === DiscountType.PERCENT) {
                discountAmount = Math.round(basePrice * (paket.discountValue / 100))
            } else {
                discountAmount = paket.discountValue
            }
        }

        const afterDiscount = basePrice - discountAmount

        // Apply PPN if applicable
        if (paket.usePPN && paket.ppnPercentage) {
            ppnAmount = Math.round(afterDiscount * (paket.ppnPercentage / 100))
        }

        const totalPrice = afterDiscount + ppnAmount

        // Get available packages for upgrade
        const availablePackages = await prisma.hargaPaket.findMany({
            where: {
                status: 'AKTIF',
                harga: { gt: paket.harga },
            },
            include: {
                bandwidth: true,
            },
            orderBy: { harga: 'asc' },
            take: 5,
        })

        return NextResponse.json({
            success: true,
            package: {
                id: paket.id,
                nama: paket.name,
                harga: paket.harga,
                durasi: paket.durasi,
                durasiUnit: paket.durasiUnit,
                usePPN: paket.usePPN,
                ppnPercentage: paket.ppnPercentage,
                useDiscount: paket.useDiscount,
                discountType: paket.discountType,
                discountValue: paket.discountValue,
                bandwidth: paket.bandwidth ? {
                    nama: paket.bandwidth.name,
                    download: paket.bandwidth.maxLimitDownload,
                    upload: paket.bandwidth.maxLimitUpload,
                    downloadSpeed: paket.bandwidth.downloadSpeed,
                    uploadSpeed: paket.bandwidth.uploadSpeed,
                } : null,
                isFeatured: paket.featured,
            },
            subscription: {
                tanggalAktif: customer.tanggalAktif,
                jatuhTempo: customer.jatuhTempo,
                status: customer.status,
                daysUntilDue: Math.ceil(
                    (new Date(customer.jatuhTempo).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                ),
            },
            billing: {
                basePrice,
                discountAmount,
                afterDiscount,
                ppnAmount,
                totalPrice,
            },
            upgradeOptions: availablePackages.map((pkg) => ({
                id: pkg.id,
                nama: pkg.name,
                harga: pkg.harga,
                priceDifference: pkg.harga - paket.harga,
                bandwidth: pkg.bandwidth ? {
                    nama: pkg.bandwidth.name,
                    download: pkg.bandwidth.maxLimitDownload,
                    upload: pkg.bandwidth.maxLimitUpload,
                } : null,
            })),
        })
    } catch (error) {
        console.error('[Customer Package Error]:', error)
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}
