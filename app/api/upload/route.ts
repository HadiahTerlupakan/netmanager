import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { convertAndSaveImage } from '@/lib/utils/image-upload'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return ApiErrors.unauthorized('Session tidak valid')
  }

  try {
    const formData = await req.formData()
    const files = formData.getAll('file').concat(formData.getAll('files')) as File[]
    const folder = formData.get('folder') as string || 'uploads'

    if (!files || files.length === 0) {
      return apiError('Tidak ada file yang diupload', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    const uploadedUrls: string[] = []

    for (const file of files) {
      if (file instanceof File) {
        if (!file.type.startsWith('image/')) {
          continue
        }

        const safeName = folder.replace(/\//g, '-')
        const imageUrl = await convertAndSaveImage(
          file,
          `public/${folder}`,
          `${safeName}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          'marketing',
          folder
        )
        uploadedUrls.push(imageUrl)
      }
    }

    if (uploadedUrls.length === 0) {
      return apiError('Tidak ada gambar valid yang diupload', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }
    
    return apiSuccess({
      url: uploadedUrls[0],
      urls: uploadedUrls
    }, { message: 'Upload berhasil' })
  } catch (error: unknown) {
    console.error('Upload error:', error)
    return ApiErrors.internalError('Gagal mengupload gambar')
  }
}
