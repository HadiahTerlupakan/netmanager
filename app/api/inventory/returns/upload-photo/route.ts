import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { validateInventoryPhotos, uploadInventoryPhotos } from '@/lib/utils/image-upload'
import type { ReturnPhotoUploadResponse } from '@/types/inventory-returns'
import * as path from 'path'

/**
 * Authentication helper - requires valid session
 */
async function requireAuth() {
  const session: any = await getServerSession(authConfig as any)
  if (!session?.user) {
    return null
  }
  return session
}

/**
 * Helper function to check if user can access this return
 */
async function canAccessReturn(returnId: string, session: any): Promise<boolean> {
  // All authenticated users can access (role-based access handled at UI level)
  return !!session?.user
}

/**
 * POST /api/inventory/returns/upload-photo
 * Upload photos for return transactions
 * 
 * Request body (form-data):
 * - photos: File[] (multiple files)
 * - returnId: string (ID of return transaction)
 * 
 * Response:
 * {
 *   success: true,
 *   message: "Photos uploaded successfully",
 *   data: {
 *     urls: string[],
 *     returnId: string,
 *     count: number
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    // Authentication
    const session = await requireAuth()
    if (!session) {
      logger.warn('Unauthorized access attempt to POST /api/inventory/returns/upload-photo', {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent')
      })
      return NextResponse.json(
        { error: 'Unauthorized - Admin or Employee access required' },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await request.formData()

    // Extract photos (can be multiple)
    const photos = formData.getAll('photos') as File[]

    // Filter out non-file entries and empty files
    const validPhotos = photos.filter((file): file is File => {
      return file instanceof File && file.size > 0
    })

    const returnId = formData.get('returnId') as string

    // Validate required fields
    if (!returnId) {
      return NextResponse.json(
        { error: 'Return ID is required' },
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

    // Check if user can access this return
    const canAccess = await canAccessReturn(returnId, session)
    if (!canAccess) {
      logger.warn('Access denied to return for photo upload', {
        userId: session.user.id,
        returnId,
      })
      return NextResponse.json(
        { error: 'Access denied - You can only upload photos for your own returns' },
        { status: 403 }
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

    // Verify return exists in database
    // Note: This would verify against BarangReturn table when implemented
    // For now, we'll verify against BarangMasuk since returns create BarangMasuk records
    try {
      const dbStart = Date.now()

      const barangMasuk = await prisma.barangMasuk.findUnique({
        where: { id: returnId },
        select: { id: true, barangId: true, gudangId: true }
      })

      if (!barangMasuk) {
        return NextResponse.json(
          { error: 'Return transaction not found' },
          { status: 404 }
        )
      }

      logger.dbOperation('findUnique', 'BarangMasuk', Date.now() - dbStart)

      // Prepare upload directory
      const uploadDir = path.join(
        process.cwd(),
        'public',
        'uploads',
        'inventory-returns',
        new Date().getFullYear().toString(),
        String(new Date().getMonth() + 1).padStart(2, '0')
      )

      // Upload photos
      let uploadedUrls: string[] = []
      try {
        uploadedUrls = await uploadInventoryPhotos(
          validPhotos,
          returnId,
          'inventory-masuk', // Returns create BarangMasuk records
          uploadDir
        )
      } catch (uploadError: any) {
        logger.error('Error uploading return photos', uploadError, {
          returnId,
          photoCount: photos.length
        })
        return NextResponse.json(
          { error: uploadError.message || 'Failed to upload photos' },
          { status: 500 }
        )
      }

      // Update BarangMasuk record with photo URLs
      // In a real implementation, you might want to save these URLs to the database
      // For example, if you add a photos field to existing tables:
      await prisma.barangMasuk.update({
        where: { id: returnId },
        data: {
          fotoBukti: uploadedUrls
        }
      })

      logger.apiRequest('POST', '/api/inventory/returns/upload-photo', 200, Date.now() - startTime, {
        userId: session.user.id,
        returnId,
        photoCount: uploadedUrls.length
      })

      const response: ReturnPhotoUploadResponse = {
        success: true,
        message: `${uploadedUrls.length} photo(s) uploaded successfully`,
        data: {
          urls: uploadedUrls,
          returnId,
          count: uploadedUrls.length
        }
      }

      return NextResponse.json(response)

    } catch (dbError: any) {
      logger.error('Error verifying return transaction', dbError, {
        returnId
      })
      return NextResponse.json(
        { error: 'Failed to verify return transaction' },
        { status: 500 }
      )
    }

  } catch (error: any) {
    logger.error('Error in return photo upload endpoint', error, {
      path: '/api/inventory/returns/upload-photo',
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
 * GET /api/inventory/returns/upload-photo
 * Get information about uploaded photos for a return transaction
 * 
 * Query parameters:
 * - returnId: string (required)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  try {
    // Authentication
    const session = await requireAuth()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/returns/upload-photo')
      return NextResponse.json(
        { error: 'Unauthorized - Admin or Employee access required' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const returnId = searchParams.get('returnId')

    // Validate query parameters
    if (!returnId) {
      return NextResponse.json(
        { error: 'Return ID is required' },
        { status: 400 }
      )
    }

    // Check if user can access this return
    const canAccess = await canAccessReturn(returnId, session)
    if (!canAccess) {
      logger.warn('Access denied to return photo info', {
        userId: session.user.id,
        returnId,
      })
      return NextResponse.json(
        { error: 'Access denied - You can only view photos for your own returns' },
        { status: 403 }
      )
    }

    try {
      const dbStart = Date.now()

      // Get return transaction information
      const barangMasuk = await prisma.barangMasuk.findUnique({
        where: { id: returnId },
        select: {
          id: true,
          barangId: true,
          gudangId: true,
          fotoBukti: true,
          createdAt: true
        }
      })

      if (!barangMasuk) {
        return NextResponse.json(
          { error: 'Return transaction not found' },
          { status: 404 }
        )
      }

      logger.dbOperation('findUnique', 'BarangMasuk', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/returns/upload-photo', 200, Date.now() - startTime, {
        userId: session.user.id,
        returnId
      })

      return NextResponse.json({
        returnId,
        message: 'Return transaction found. Photo URLs returned from database.',
        photos: barangMasuk.fotoBukti || [],
        photoCount: barangMasuk.fotoBukti?.length || 0,
        createdAt: barangMasuk.createdAt,
        note: 'This endpoint can be extended to return uploaded photo URLs from a database table.',
        expectedPhotoPattern: {
          inventoryMasuk: `/uploads/inventory-masuk/[year]/[month]/${returnId}_photo_[index].webp`,
          inventoryReturns: `/uploads/inventory-returns/[year]/[month]/${returnId}_photo_[index].webp`
        }
      })

    } catch (dbError: any) {
      logger.error('Error fetching return photo info', dbError, {
        returnId
      })
      return NextResponse.json(
        { error: 'Failed to fetch return photo information' },
        { status: 500 }
      )
    }

  } catch (error: any) {
    logger.error('Error in return photo GET endpoint', error, {
      path: '/api/inventory/returns/upload-photo',
      method: 'GET'
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}