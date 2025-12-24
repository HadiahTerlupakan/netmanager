
import { PrismaClient } from '@prisma/client'
import { convertAndSaveBase64 } from '../lib/utils/image-upload'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
    console.log('Starting Overtime Photo Migration...')

    // Find all overtime records that might have base64 in startPhoto or endPhoto
    // We check if it starts with 'data:image'
    const overtimes = await prisma.overtime.findMany({
        where: {
            OR: [
                { startPhoto: { startsWith: 'data:image' } },
                { endPhoto: { startsWith: 'data:image' } }
            ]
        },
        include: { user: true } // Need user ID for file naming
    })

    console.log(`Found ${overtimes.length} records with Base64 photos.`)

    for (const ot of overtimes) {
        console.log(`Processing Overtime ID: ${ot.id}`)
        const updates: any = {}

        // Process Start Photo
        if (ot.startPhoto && ot.startPhoto.startsWith('data:image')) {
            try {
                const dateStr = ot.createdAt.toISOString().split('T')[0]
                const uploadDir = `public/uploads/overtime/${dateStr}`
                const fileName = `${ot.userId}_start_${ot.createdAt.getTime()}`

                const url = await convertAndSaveBase64(
                    ot.startPhoto,
                    uploadDir,
                    fileName,
                    'employee-attendance',
                    ot.userId
                )
                updates.startPhoto = url
                console.log(`  - Converted Start Photo -> ${url}`)
            } catch (e: any) {
                console.error(`  - Failed to convert Start Photo: ${e.message}`)
            }
        }

        // Process End Photo
        if (ot.endPhoto && ot.endPhoto.startsWith('data:image')) {
            try {
                const dateStr = ot.createdAt.toISOString().split('T')[0]
                const uploadDir = `public/uploads/overtime/${dateStr}`
                const fileName = `${ot.userId}_end_${ot.endTime ? ot.endTime.getTime() : Date.now()}`

                const url = await convertAndSaveBase64(
                    ot.endPhoto,
                    uploadDir,
                    fileName,
                    'employee-attendance',
                    ot.userId
                )
                updates.endPhoto = url
                console.log(`  - Converted End Photo -> ${url}`)
            } catch (e: any) {
                console.error(`  - Failed to convert End Photo: ${e.message}`)
            }
        }

        if (Object.keys(updates).length > 0) {
            await prisma.overtime.update({
                where: { id: ot.id },
                data: updates
            })
            console.log(`  - Updated record in database.`)
        }
    }

    console.log('Migration completed.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
