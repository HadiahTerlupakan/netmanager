import { randomUUID } from 'crypto'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { convertAndSaveImage, isImageFile } from '@/lib/utils/image-upload'
import path from 'path'
import { unlink } from 'fs/promises'
import { logActivitySafe } from '@/lib/logger'

/**
 * GET /api/settings/logo
 * Mengambil pengaturan logo
 */
export const GET = createHandler({ auth: true }, async () => {
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

  return apiSuccess({
    logoInvoice: settingsMap.get('LOGO_INVOICE') || null,
    logoAplikasi: settingsMap.get('LOGO_APLIKASI') || null,
  })
})

/**
 * POST /api/settings/logo
 * Upload logo baru
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const type = formData.get('type') as string | null

  if (!file) {
    return ApiErrors.badRequest('File tidak ditemukan')
  }

  if (!type || (type !== 'invoice' && type !== 'aplikasi')) {
    return ApiErrors.badRequest('Type harus invoice atau aplikasi')
  }

  // Validasi tipe file
  if (!isImageFile(file)) {
    return ApiErrors.badRequest('File harus berupa gambar (PNG, JPG, JPEG)')
  }

  // Validasi ukuran file (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return ApiErrors.badRequest('Ukuran file maksimal 5MB')
  }

  // Direktori upload untuk logo
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos')
  const fileName = type === 'invoice' ? 'logo-invoice' : 'logo-aplikasi'

  // Ambil logo lama untuk dihapus nanti
  const settingKey = type === 'invoice' ? 'LOGO_INVOICE' : 'LOGO_APLIKASI'
  const oldSetting = await prisma.settings.findFirst({ where: { key: settingKey },
  })

  // Konversi dan simpan gambar
  let logoPath: string
  try {
    logoPath = await convertAndSaveImage(file, uploadDir, fileName)
  } catch (error) {
    console.error('Error saving image:', error)
    return ApiErrors.internalError('Gagal menyimpan file gambar')
  }

  // Pastikan path dimulai dengan /
  const normalizedPath = logoPath.startsWith('/') ? logoPath : `/${logoPath}`

  // Verifikasi file benar-benar tersimpan
  const fullPath = path.join(process.cwd(), 'public', normalizedPath)
  const fs = await import('fs/promises')
  try {
    await fs.access(fullPath)
  } catch (_accessError) {
    console.error('Logo file not found after upload:', fullPath)
    throw new Error('File logo gagal disimpan')
  }

  // Simpan path ke database
  {
    const existing = await prisma.settings.findFirst({ where: { key: settingKey } })
    if (existing) {
      await prisma.settings.update({ 
        where: { id: existing.id }, 
        data: {
          value: normalizedPath,
          description: type === 'invoice' ? 'Logo untuk invoice' : 'Logo untuk aplikasi',
          updatedAt: new Date(),
        } 
      })
    } else {
      await prisma.settings.create({ 
        data: {
          id: randomUUID(),
          key: settingKey,
          value: normalizedPath,
          description: type === 'invoice' ? 'Logo untuk invoice' : 'Logo utama aplikasi',
          encrypted: false,
          updatedAt: new Date()
        } 
      })
    }
  }

  // System Log
  if (ctx.session?.user?.id) {
    logActivitySafe({
      action: 'UPDATE',
      subject: 'Settings',
      userId: ctx.session.user.id,
      details: { key: settingKey, value: normalizedPath }
    })
  }

  // Hapus logo lama jika ada
  if (oldSetting?.value) {
    try {
      const oldLogoPath = path.join(process.cwd(), 'public', oldSetting.value)
      // Check if the old path is different from new path before deleting
      // (Though filenames are fixed here based on type, so it overwrites mostly, but safest to check)
      if (path.resolve(oldLogoPath) !== path.resolve(fullPath)) {
         // Actually, convertAndSaveImage overwrites if same filename.
         // If filename changed (e.g. extension change), we might want to delete old.
         // But let's keep it simple and match original logic logic.
         // Original logic: just tries to unlink oldSetting.value
         await unlink(oldLogoPath)
      }
    } catch (unlinkError) {
      // Ignore error jika file tidak ditemukan
      console.warn('Failed to delete old logo:', unlinkError)
    }
  }

  return apiSuccess({
    success: true,
    logoPath: normalizedPath,
  })
})

/**
 * DELETE /api/settings/logo
 * Hapus logo
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
  const body = await req.json()
  const { type } = body

  if (!type || (type !== 'invoice' && type !== 'aplikasi')) {
    return ApiErrors.badRequest('Type harus invoice atau aplikasi')
  }

  const settingKey = type === 'invoice' ? 'LOGO_INVOICE' : 'LOGO_APLIKASI'

  // Ambil logo lama untuk dihapus
  const oldSetting = await prisma.settings.findFirst({ where: { key: settingKey },
  })

  // Hapus dari database
  await prisma.settings.deleteMany({
    where: { key: settingKey },
  })

  // System Log
  if (ctx.session?.user?.id) {
    logActivitySafe({
      action: 'DELETE',
      subject: 'Settings',
      userId: ctx.session.user.id,
      details: { key: settingKey }
    })
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

  return apiSuccess({ success: true })
})
