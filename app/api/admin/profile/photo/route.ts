import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { convertAndSaveImage } from '@/lib/utils/image-upload'

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const formData = await request.formData()
        const photo = formData.get('photo') as File

        if (!photo) {
            return NextResponse.json({ error: 'Photo is required' }, { status: 400 })
        }

        if (!photo.type.startsWith('image/')) {
            return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
        }

        const MAX_SIZE = 5 * 1024 * 1024 // 5MB
        if (photo.size > MAX_SIZE) {
            return NextResponse.json({ error: 'Photo size max 5MB' }, { status: 400 })
        }

        const uploadDir = 'public/uploads/profiles'
        const fileName = `${session.user.id}_${Date.now()}`

        const imageUrl = await convertAndSaveImage(
            photo,
            uploadDir,
            fileName,
            'user-profile',
            session.user.id
        )

        const updated = await prisma.user.update({
            where: { id: session.user.id },
            data: { image: imageUrl },
            select: {
                id: true,
                name: true,
                image: true
            }
        })

        return NextResponse.json({ success: true, data: updated })
    } catch (error: any) {
        console.error('Profile photo upload error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
