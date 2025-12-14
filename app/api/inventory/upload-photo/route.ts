import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { validateInventoryPhotos, uploadInventoryPhotos } from '@/lib/utils/image-upload'
import * as path from 'path'

/**
 * POST /api/inventory/upload-photo
 * Upload photos for inventory transactions (masuk/keluar)
 *
 * Request body (form-data):
 * - photos: File[] (multiple files)
 * - transactionId: string (ID of inventory transaction)
 * - transactionType: 'inventory-masuk' | 'inventory-keluar'
 *
 * Response:
 * {
 *   success: true,
 *   message: "Photos uploaded successfully",
 *   data: {
 *     urls: string[],
 *     transactionId: string,
 *     transactionType: string,
 *     count: number
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    // Authentication
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) {
      return session // Return error response if authentication fails
    }

    // Parse form data
    const formData = await request.formData()

    // Extract photos (can be multiple)
    // FormData getAll method to get all files with the same name
    const photos = formData.getAll('photos') as File[]

    // Filter out non-file entries and empty files
    const validPhotos = photos.filter((file): file is File => {
      return file instanceof File && file.size > 0
    })

    const transactionId = formData.get('transactionId') as string
    const transactionType = formData.get('transactionType') as 'inventory-masuk' | 'inventory-keluar' | 'inventory-transfer'

    // Validate required fields
    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      )
    }

    if (!transactionType || !['inventory-masuk', 'inventory-keluar', 'inventory-transfer'].includes(transactionType)) {
      return NextResponse.json(
        { error: 'Transaction type must be "inventory-masuk", "inventory-keluar", or "inventory-transfer"' },
        { status: 400 }
      )
    }

    // Validate that at least one photo is provided
    if (validPhotos.length === 0) {
      return NextResponse.json(
        { error: 'At least one photo must be uploaded' },
        { status: 400 }
      )
    }

    // Validate photo files
    const validation = validateInventoryPhotos(validPhotos, 5, 5) // max 5 photos, 5MB each
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.errors
        },
        { status: 400 }
      )
    }

    // For temporary transaction IDs (starting with 'temp-'), skip verification
    // These will be created as part of the main form submission
    if (!transactionId.startsWith('temp-')) {
      // Verify transaction exists in database
      try {
        const dbStart = Date.now()

        if (transactionType === 'inventory-masuk') {
          const transaction = await prisma.barangMasuk.findUnique({
            where: { id: transactionId },
            select: { id: true, barangId: true, gudangId: true }
          })

          if (!transaction) {
            return NextResponse.json(
              { error: 'Inventory masuk transaction not found' },
              { status: 404 }
            )
          }
        } else if (transactionType === 'inventory-keluar') {
          const transaction = await prisma.barangKeluar.findUnique({
            where: { id: transactionId },
            select: { id: true, barangId: true, gudangId: true }
          })

          if (!transaction) {
            return NextResponse.json(
              { error: 'Inventory keluar transaction not found' },
              { status: 404 }
            )
          }
        } else if (transactionType === 'inventory-transfer') {
          const transaction = await prisma.transferAntarGudang.findUnique({
            where: { id: transactionId },
            select: { id: true, barangId: true }
          })

          if (!transaction) {
            return NextResponse.json(
              { error: 'Inventory transfer transaction not found' },
              { status: 404 }
            )
          }
        }

        logger.dbOperation('findUnique', transactionType, Date.now() - dbStart)
      } catch (dbError: any) {
        logger.error('Error verifying inventory transaction', dbError, {
          transactionId,
          transactionType
        })
        return NextResponse.json(
          { error: 'Failed to verify transaction' },
          { status: 500 }
        )
      }
    }

    // Prepare upload directory
    const uploadDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      transactionType,
      new Date().getFullYear().toString(),
      String(new Date().getMonth() + 1).padStart(2, '0')
    )

    // Upload photos
    let uploadedUrls: string[] = []
    try {
      uploadedUrls = await uploadInventoryPhotos(
        validPhotos,
        transactionId,
        transactionType,
        uploadDir
      )
    } catch (uploadError: any) {
      logger.error('Error uploading inventory photos', uploadError, {
        transactionId,
        transactionType,
        photoCount: photos.length
      })
      return NextResponse.json(
        { error: uploadError.message || 'Failed to upload photos' },
        { status: 500 }
      )
    }

    // In a future implementation, you might want to save these URLs to the database
    // For example, if you add a photos table or add photos field to existing tables:
    /*
    if (transactionType === 'inventory-masuk') {
      await prisma.barangMasuk.update({
        where: { id: transactionId },
        data: {
          photos: uploadedUrls // assuming you add a photos field
        }
      })
    } else {
      await prisma.barangKeluar.update({
        where: { id: transactionId },
        data: {
          photos: uploadedUrls // assuming you add a photos field
        }
      })
    }
    */

    logger.apiRequest('POST', '/api/inventory/upload-photo', 200, Date.now() - startTime, {
      userId: session.user.id,
      transactionId,
      transactionType,
      photoCount: uploadedUrls.length
    })

    return NextResponse.json({
      success: true,
      message: `${uploadedUrls.length} photo(s) uploaded successfully`,
      data: {
        urls: uploadedUrls,
        transactionId,
        transactionType,
        count: uploadedUrls.length
      }
    })

  } catch (error: any) {
    logger.error('Error in inventory photo upload endpoint', error, {
      path: '/api/inventory/upload-photo',
      method: 'POST',
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent')
    })

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to process photo upload'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/inventory/upload-photo
 * Get information about uploaded photos for a transaction
 *
 * Query parameters:
 * - transactionId: string (required)
 * - transactionType: 'inventory-masuk' | 'inventory-keluar' (required)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  try {
    // Authentication
    const session = await requireAdmin(request)
    if (session instanceof NextResponse) {
      return session // Return error response if authentication fails
    }

    const searchParams = request.nextUrl.searchParams
    const transactionId = searchParams.get('transactionId')
    const transactionType = searchParams.get('transactionType') as 'inventory-masuk' | 'inventory-keluar'

    // Validate query parameters
    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      )
    }

    if (!transactionType || !['inventory-masuk', 'inventory-keluar'].includes(transactionType)) {
      return NextResponse.json(
        { error: 'Transaction type must be either "inventory-masuk" or "inventory-keluar"' },
        { status: 400 }
      )
    }

    // For now, this endpoint returns information about the expected photo structure
    // In the future, you might query a database table that tracks uploaded photos

    logger.apiRequest('GET', '/api/inventory/upload-photo', 200, Date.now() - startTime, {
      userId: session.user.id,
      transactionId,
      transactionType
    })

    return NextResponse.json({
      transactionId,
      transactionType,
      message: 'Transaction found. Photo URLs would be returned here if stored in database.',
      note: 'This endpoint can be extended to return uploaded photo URLs from a database table.',
      expectedPhotoPattern: {
        inventoryMasuk: `/uploads/inventory-masuk/[year]/[month]/${transactionId}_photo_[index].webp`,
        inventoryKeluar: `/uploads/inventory-keluar/[year]/[month]/${transactionId}_photo_[index].webp`
      }
    })

  } catch (error: any) {
    logger.error('Error in inventory photo GET endpoint', error, {
      path: '/api/inventory/upload-photo',
      method: 'GET'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}