import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { compare } from 'bcryptjs'
import { generatePelangganTokenPair } from '@/lib/jwt'
import { setCustomerAuthCookies } from '@/lib/customer-auth'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { identifier, password } = body

        // Validate input
        if (!identifier || !password) {
            return NextResponse.json(
                { error: 'ID Pelanggan/Email dan password harus diisi' },
                { status: 400 }
            )
        }

        // Find customer by idPelanggan or email
        const pelanggan = await prisma.pelanggan.findFirst({
            where: {
                OR: [
                    { idPelanggan: identifier.toUpperCase() },
                    { email: identifier.toLowerCase() },
                ],
            },
            select: {
                id: true,
                idPelanggan: true,
                nama: true,
                username: true,
                email: true,
                status: true,
                passwordHash: true,
            },
        })

        if (!pelanggan) {
            return NextResponse.json(
                { error: 'ID Pelanggan atau password salah' },
                { status: 401 }
            )
        }

        // Check if customer has password set
        if (!pelanggan.passwordHash) {
            return NextResponse.json(
                {
                    error: 'Akun belum diaktifkan',
                    message: 'Silakan hubungi customer service untuk mengaktifkan akun portal Anda'
                },
                { status: 403 }
            )
        }

        // Verify password
        const isPasswordValid = await compare(password, pelanggan.passwordHash)
        if (!isPasswordValid) {
            return NextResponse.json(
                { error: 'ID Pelanggan atau password salah' },
                { status: 401 }
            )
        }

        // Check if customer is active
        if (pelanggan.status !== 'AKTIF') {
            return NextResponse.json(
                {
                    error: 'Akun tidak aktif',
                    message: 'Status layanan Anda sedang tidak aktif. Hubungi customer service untuk informasi lebih lanjut.'
                },
                { status: 403 }
            )
        }

        // Generate tokens
        const tokens = await generatePelangganTokenPair({
            id: pelanggan.id,
            idPelanggan: pelanggan.idPelanggan,
            nama: pelanggan.nama,
            username: pelanggan.username,
            status: pelanggan.status,
        })

        // Create response with customer data
        const responseData = {
            success: true,
            message: 'Login berhasil',
            customer: {
                id: pelanggan.id,
                idPelanggan: pelanggan.idPelanggan,
                nama: pelanggan.nama,
                email: pelanggan.email,
            },
        }

        const response = NextResponse.json(responseData)

        // Set auth cookies
        setCustomerAuthCookies(response, tokens.accessToken, tokens.refreshToken)

        return response
    } catch (error) {
        console.error('[Customer Login Error]:', error)
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}
