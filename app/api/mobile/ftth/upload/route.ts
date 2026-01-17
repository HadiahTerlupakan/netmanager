import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { convertAndSaveImage } from '@/lib/utils/image-upload'

export async function POST(request: Request) {
  // Verify mobile authentication
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = authHeader.split(' ')[1]
  const payload = await verifyMobileToken(token)

  if (!payload) {
    return NextResponse.json({ error: 'Invalid Token' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const deviceId = formData.get('deviceId') as string
    const deviceType = formData.get('deviceType') as string

    if (!file || !deviceId || !deviceType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type. Only images are allowed.' }, { status: 400 })
    }

    // Determine target model
    let updatePromise;
    const uploadDir = `public/uploads/ftth/${deviceType}`
    let imageUrl: string;

    // Save image
    try {
       imageUrl = await convertAndSaveImage(
        file,
        uploadDir,
        `${deviceType}_${deviceId}_${Date.now()}`,
        'marketing',
        deviceId
      )
    } catch (uploadError: any) {
      console.error('Image upload failed:', uploadError)
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    // Update Database - Appending to images array
    const updateData = {
      images: {
        push: imageUrl
      }
    }

    switch (deviceType) {
      case 'otb':
        updatePromise = prisma.otb.update({
          where: { id: deviceId },
          data: updateData
        })
        break
      case 'odc':
        updatePromise = prisma.odc.update({
          where: { id: deviceId },
          data: updateData
        })
        break
      case 'odp':
        updatePromise = prisma.odp.update({
          where: { id: deviceId },
          data: updateData
        })
        break
      case 'joinbox':
        updatePromise = prisma.joinbox.update({
          where: { id: deviceId },
          data: updateData
        })
        break
      case 'pole':
        updatePromise = prisma.pole.update({
          where: { id: deviceId },
          data: updateData
        })
        break
      default:
        return NextResponse.json({ error: 'Invalid device type' }, { status: 400 })
    }

    await updatePromise

    return NextResponse.json({ 
      success: true, 
      imageUrl: imageUrl 
    })

  } catch (error: any) {
    console.error('Error uploading FTTH image:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
