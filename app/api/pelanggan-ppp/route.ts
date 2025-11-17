import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/pelanggan-ppp
 * Mendapatkan daftar pelanggan PPP
 */
export async function GET(req: NextRequest) {
  try {
    // Cek autentikasi
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const where: any = {}
    if (status) {
      where.status = status
    }

    const pelanggans = await prisma.pelanggan.findMany({
      where,
      include: {
        hargaPaket: {
          include: {
            profilePPP: true,
            bandwidth: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(pelanggans)
  } catch (error: any) {
    console.error('Error fetching pelanggans:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/pelanggan-ppp
 * Membuat pelanggan PPP baru
 */
export async function POST(req: NextRequest) {
  try {
    // Cek autentikasi
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      idPelanggan,
      nama,
      username,
      password,
      passwordLogin,
      hargaPaketId,
      tipe,
      tanggalAktif,
      jatuhTempo,
      status,
      alamat,
      noTelp,
      email,
      catatan,
    } = body

    // Validasi required fields
    if (!idPelanggan || !nama || !username || !password || !passwordLogin || !hargaPaketId || !tanggalAktif || !jatuhTempo) {
      return NextResponse.json(
        { error: 'Semua field wajib harus diisi' },
        { status: 400 }
      )
    }

    // Validasi format ID Pelanggan (8 digit angka)
    if (!/^\d{8}$/.test(idPelanggan.trim())) {
      return NextResponse.json(
        { error: 'ID Pelanggan harus 8 digit angka' },
        { status: 400 }
      )
    }

    // Cek apakah ID Pelanggan sudah ada
    const existingPelanggan = await prisma.pelanggan.findUnique({
      where: { idPelanggan: idPelanggan.trim() },
    })

    if (existingPelanggan) {
      return NextResponse.json(
        { error: 'ID Pelanggan sudah digunakan. Silakan gunakan ID lain.' },
        { status: 409 }
      )
    }

    // Cek apakah HargaPaket ada
    const hargaPaket = await prisma.hargaPaket.findUnique({
      where: { id: hargaPaketId },
    })

    if (!hargaPaket) {
      return NextResponse.json(
        { error: 'Harga Paket tidak ditemukan' },
        { status: 404 }
      )
    }

    // Buat pelanggan baru
    const pelanggan = await prisma.pelanggan.create({
      data: {
        idPelanggan: idPelanggan.trim(),
        nama: nama.trim(),
        username: username.trim(),
        password: password.trim(), // Password PPPoE
        passwordLogin: passwordLogin.trim(), // Password Login Portal
        hargaPaketId,
        tipe: tipe || 'REGULER',
        tanggalAktif: new Date(tanggalAktif),
        jatuhTempo: new Date(jatuhTempo),
        status: status || 'AKTIF',
        alamat: alamat?.trim() || null,
        noTelp: noTelp?.trim() || null,
        email: email?.trim() || null,
        catatan: catatan?.trim() || null,
      },
      include: {
        hargaPaket: {
          include: {
            profilePPP: true,
            bandwidth: true,
          },
        },
      },
    })

    return NextResponse.json(pelanggan, { status: 201 })
  } catch (error: any) {
    console.error('Error creating pelanggan:', error)
    
    // Handle Prisma unique constraint error
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'ID Pelanggan sudah digunakan. Silakan gunakan ID lain.' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

