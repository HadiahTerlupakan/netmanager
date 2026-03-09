import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { convertAndSaveImage, isImageFile, saveFile } from '@/lib/utils/image-upload'
import { sanitizeUploadFolder, validateUploadFile } from '@/lib/upload/upload-policy'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folderResult = sanitizeUploadFolder(formData.get('folder') as string | null)

    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah' }, { status: 400 })
    }

    if (!folderResult.ok || !folderResult.folder) {
      return NextResponse.json({ error: folderResult.error }, { status: 400 })
    }

    const validation = validateUploadFile({
      folder: folderResult.folder,
      mimeType: file.type,
      size: file.size,
      fileName: file.name,
    })

    if (!validation.ok || !validation.safeBaseName || !validation.extension) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(7)
    // Clean original filename of spaces and special chars
    const fileName = `${validation.safeBaseName}_${timestamp}_${randomStr}`

    const uploadDir = `public/uploads/${folderResult.folder}`
    let url = ''

    if (isImageFile(file)) {
      url = await convertAndSaveImage(file, uploadDir, fileName, 'user-profile')
    } else {
      url = await saveFile(file, uploadDir, `${fileName}.${validation.extension}`, 'user-profile')
    }

    // Return path without public/ prefix, ensuring it starts with /
    const publicUrl = url.replace(/^public\//, '/').replace(/^\/?/, '/')

    return NextResponse.json({ success: true, url: publicUrl })
  } catch (error) {
    logger.error('Error in generic upload endpoint', error as Error)
    return NextResponse.json({ error: 'Gagal mengunggah file' }, { status: 500 })
  }
}
