import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { convertAndSaveImage, isImageFile, saveFile } from '@/lib/utils/image-upload'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) return session

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = formData.get('folder') as string || 'general'

    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah' }, { status: 400 })
    }

    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(7)
    // Clean original filename of spaces and special chars
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').split('.')[0]
    const fileName = `${originalName}_${timestamp}_${randomStr}`

    const uploadDir = `public/uploads/${folder}`
    let url = ''

    if (isImageFile(file)) {
      url = await convertAndSaveImage(file, uploadDir, fileName, 'user-profile')
    } else {
      // If it's a PDF or something else
      url = await saveFile(file, uploadDir, `${fileName}.${file.name.split('.').pop()}`, 'user-profile')
    }

    // Return path without public/ prefix, ensuring it starts with /
    const publicUrl = url.replace(/^public\//, '/').replace(/^\/?/, '/')

    return NextResponse.json({ success: true, url: publicUrl })
  } catch (error) {
    logger.error('Error in generic upload endpoint', error as Error)
    return NextResponse.json({ error: 'Gagal mengunggah file' }, { status: 500 })
  }
}
