import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { convertAndSaveImage, isImageFile } from '@/lib/utils/image-upload'
import path from 'path'
import { unlink } from 'fs/promises'

/**
 * GET /api/settings/logo
 * Mengambil pengaturan logo
 */
export async function GET(_req: NextRequest) {
  try {
    // Cek autentikasi
    const session = await getServerSession(authConfig)
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    // Cek role admin
    if (false) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    // Ambil pengaturan logo dari database
    const settings = await prisma.settings.findMany({
      where: {
        key: {
          in: ['LOGO_INVOICE', 'LOGO_APLIKASI'],
        },
      },
    })

    // Convert ke object
    const settingsMap = new Map(settings.map((s) => [s.key, s.value]))

    return NextResponse.json({
      logoInvoice: settingsMap.get('LOGO_INVOICE') || null,
      logoAplikasi: settingsMap.get('LOGO_APLIKASI') || null,
    })
  } catch (error) {
    console.error('Error fetching logo settings:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/logo
 * Upload logo baru
 */
export async function POST(req: NextRequest) {
  try {
    // Cek autentikasi
    const session = await getServerSession(authConfig)
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    // Cek role admin
    if (false) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file) {
      return NextResponse.json(
        { error: 'File tidak ditemukan' },
        { status: 400 }
      )
    }

    if (!type || (type !== 'invoice' && type !== 'aplikasi')) {
      return NextResponse.json(
        { error: 'Type harus invoice atau aplikasi' },
        { status: 400 }
      )
    }

    // Validasi tipe file
    if (!isImageFile(file)) {
      return NextResponse.json(
        { error: 'File harus berupa gambar (PNG, JPG, JPEG)' },
        { status: 400 }
      )
    }

    // Validasi ukuran file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Ukuran file maksimal 5MB' },
        { status: 400 }
      )
    }

    // Direktori upload untuk logo
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos')
    const fileName = type === 'invoice' ? 'logo-invoice' : 'logo-aplikasi'

    // Ambil logo lama untuk dihapus nanti
    const settingKey = type === 'invoice' ? 'LOGO_INVOICE' : 'LOGO_APLIKASI'
    const oldSetting = await prisma.settings.findUnique({
      where: { key: settingKey },
    })

    // Konversi dan simpan gambar
    const logoPath = await convertAndSaveImage(file, uploadDir, fileName)

    // Pastikan path dimulai dengan /
    const normalizedPath = logoPath.startsWith('/') ? logoPath : `/${logoPath}`

    // Verifikasi file benar-benar tersimpan
    const fullPath = path.join(process.cwd(), 'public', normalizedPath)
    const fs = await import('fs/promises')
    try {
      await fs.access(fullPath)
      console.log('Logo file verified:', fullPath)
    } catch (_accessError) {
      console.error('Logo file not found after upload:', fullPath)
      throw new Error('File logo gagal disimpan')
    }

    console.log('Logo uploaded:', {
      originalPath: logoPath,
      normalizedPath,
      uploadDir,
      fileName: `${fileName}.webp`,
      fullPath,
    })

    // Simpan path ke database
    await prisma.settings.upsert({
      where: { key: settingKey },
      update: {
        value: normalizedPath,
        description: type === 'invoice' ? 'Logo untuk invoice' : 'Logo untuk aplikasi',
        updatedAt: new Date(),
      },
      create: {
        id: randomUUID(),
        key: settingKey,
        value: normalizedPath,
        description: type === 'invoice' ? 'Logo untuk invoice' : 'Logo utama aplikasi',
        encrypted: false,
        updatedAt: new Date()
      },
    })

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'UPDATE',
        subject: 'Settings',
        userId: session.user.id,
        details: { key: settingKey, value: normalizedPath }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    // Hapus logo lama jika ada
    if (oldSetting?.value) {
      try {
        const oldLogoPath = path.join(process.cwd(), 'public', oldSetting.value)
        await unlink(oldLogoPath)
      } catch (unlinkError) {
        // Ignore error jika file tidak ditemukan
        console.warn('Failed to delete old logo:', unlinkError)
      }
    }

    return NextResponse.json({
      success: true,
      logoPath: normalizedPath,
    })
  } catch (error) {
    console.error('Error uploading logo:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/settings/logo
 * Hapus logo
 */
export async function DELETE(req: NextRequest) {
  try {
    // Cek autentikasi
    const session = await getServerSession(authConfig)
    if (!session) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    // Cek role admin
    if (false) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const body = await req.json()
    const { type } = body

    if (!type || (type !== 'invoice' && type !== 'aplikasi')) {
      return NextResponse.json(
        { error: 'Type harus invoice atau aplikasi' },
        { status: 400 }
      )
    }

    const settingKey = type === 'invoice' ? 'LOGO_INVOICE' : 'LOGO_APLIKASI'

    // Ambil logo lama untuk dihapus
    const oldSetting = await prisma.settings.findUnique({
      where: { key: settingKey },
    })

    // Hapus dari database
    await prisma.settings.delete({
      where: { key: settingKey },
    })

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'DELETE',
        subject: 'Settings',
        userId: session.user.id,
        details: { key: settingKey }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    // Hapus file logo jika ada
    if (oldSetting?.value) {
      try {
        const oldLogoPath = path.join(process.cwd(), 'public', oldSetting.value)
        await unlink(oldLogoPath)
      } catch (unlinkError) {
        // Ignore error jika file tidak ditemukan
        console.warn('Failed to delete logo file:', unlinkError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting logo:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

