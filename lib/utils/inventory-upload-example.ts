/**
 * Example usage of image upload utility for inventory transactions
 * This file demonstrates how to use the extended image upload functionality
 */

import { uploadInventoryPhotos, validateInventoryPhotos, isImageFile } from './image-upload'
import type { PhotoMetadata } from '@/types/inventory'

/**
 * Example: Upload photos for inventory masuk transaction
 */
export async function handleInventoryMasukPhotos(
  files: File[],
  transactionId: string,
  userId: string
): Promise<{ success: boolean; photos?: PhotoMetadata[]; errors?: string[] }> {
  try {
    // Validate files
    const validation = validateInventoryPhotos(files, 5, 5) // max 5 photos, 5MB each
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      }
    }

    // Upload photos
    const uploadDir = 'public/uploads/inventory/masuk'
    const uploadedUrls = await uploadInventoryPhotos(
      files,
      transactionId,
      'inventory-masuk',
      uploadDir
    )

    // Create photo metadata
    const photoMetadata: PhotoMetadata[] = uploadedUrls.map((url, index) => {
      const file = files[index]
      const fileName = `${transactionId}_photo_${index + 1}.webp`

      return {
        url,
        filename: fileName,
        size: file.size,
        format: 'webp',
        uploadedAt: new Date().toISOString(),
        uploadedBy: userId
      }
    })

    return {
      success: true,
      photos: photoMetadata
    }
  } catch (error: any) {
    return {
      success: false,
      errors: [error.message]
    }
  }
}

/**
 * Example: Upload photos for inventory keluar transaction
 */
export async function handleInventoryKeluarPhotos(
  files: File[],
  transactionId: string,
  userId: string
): Promise<{ success: boolean; photos?: PhotoMetadata[]; errors?: string[] }> {
  try {
    // Validate files
    const validation = validateInventoryPhotos(files, 5, 5) // max 5 photos, 5MB each
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors
      }
    }

    // Upload photos
    const uploadDir = 'public/uploads/inventory/keluar'
    const uploadedUrls = await uploadInventoryPhotos(
      files,
      transactionId,
      'inventory-keluar',
      uploadDir
    )

    // Create photo metadata
    const photoMetadata: PhotoMetadata[] = uploadedUrls.map((url, index) => {
      const file = files[index]
      const fileName = `${transactionId}_photo_${index + 1}.webp`

      return {
        url,
        filename: fileName,
        size: file.size,
        format: 'webp',
        uploadedAt: new Date().toISOString(),
        uploadedBy: userId,
        caption: `Foto keluar barang ${index + 1}`
      }
    })

    return {
      success: true,
      photos: photoMetadata
    }
  } catch (error: any) {
    return {
      success: false,
      errors: [error.message]
    }
  }
}

/**
 * Example: Process photos from form data
 */
export function processPhotosFromFormData(formData: FormData): File[] {
  const photos: File[] = []

  // Handle multiple photo uploads (e.g., from input with name="photos[]")
  const photoEntries = formData.getAll('photos')

  for (const entry of photoEntries) {
    if (entry instanceof File && isImageFile(entry)) {
      photos.push(entry)
    }
  }

  // Alternative: handle named photo fields (e.g., photo_1, photo_2, etc.)
  for (let i = 1; i <= 5; i++) {
    const photo = formData.get(`photo_${i}`) as File
    if (photo && isImageFile(photo)) {
      photos.push(photo)
    }
  }

  return photos
}

/**
 * Example usage in API route:
 *
 * ```typescript
 * import { handleInventoryMasukPhotos } from '@/lib/utils/inventory-upload-example'
 *
 * export async function POST(request: Request) {
 *   try {
 *     const formData = await request.formData()
 *     const transactionId = formData.get('transactionId') as string
 *     const userId = formData.get('userId') as string
 *
 *     const photos = processPhotosFromFormData(formData)
 *
 *     const result = await handleInventoryMasukPhotos(photos, transactionId, userId)
 *
 *     if (!result.success) {
 *       return Response.json(
 *         { error: 'Upload failed', errors: result.errors },
 *         { status: 400 }
 *       )
 *     }
 *
 *     // Save result.photos to database as JSON in fotoMetadata field
 *     await prisma.inventoryMasuk.update({
 *       where: { id: transactionId },
 *       data: {
 *         fotoMetadata: result.photos
 *       }
 *     })
 *
 *     return Response.json({ success: true, photos: result.photos })
 *   } catch (error) {
 *     return Response.json(
 *       { error: 'Internal server error' },
 *       { status: 500 }
 *     )
 *   }
 * }
 * ```
 */