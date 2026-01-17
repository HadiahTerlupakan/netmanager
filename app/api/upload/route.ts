import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { convertAndSaveImage } from '@/lib/utils/image-upload'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    // Support both single 'file' and multiple 'files'
    const files = formData.getAll('file').concat(formData.getAll('files')) as File[]
    const folder = formData.get('folder') as string || 'uploads'

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    const uploadedUrls: string[] = []

    for (const file of files) {
      if (file instanceof File) {
         // Validate file type
        if (!file.type.startsWith('image/')) {
          continue // Skip non-image files
        }

        // Sanitize folder name for filename (replace / with -)
        const safeName = folder.replace(/\//g, '-')
        const imageUrl = await convertAndSaveImage(
          file,
          `public/${folder}`,
          `${safeName}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          'marketing', // Generic type
          folder
        )
        uploadedUrls.push(imageUrl)
      }
    }

    if (uploadedUrls.length === 0) {
       return NextResponse.json({ error: 'No valid images uploaded' }, { status: 400 })
    }

    // Return single URL if only one file was uploaded (for backward compatibility if needed, 
    // but better to return standardized structure. 
    // However, existing ImageUpload expects { url: string } for single file. 
    // Let's return { url: string, urls: string[] } to support both.
    
    return NextResponse.json({ 
      url: uploadedUrls[0], 
      urls: uploadedUrls 
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}
