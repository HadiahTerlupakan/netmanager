/**
 * Attendance Photo Service
 * Centralized photo processing for check-in and check-out
 * Reduces code duplication across API routes
 */

import { convertAndSaveImage } from '@/lib/utils/image-upload'
import { ATTENDANCE_CONSTANTS } from '@/modules/attendance/constants'

export class AttendancePhotoService {
  /**
   * Process and upload attendance photo
   * Handles both File objects and base64 strings
   * 
   * @param photo - Photo as File or base64 string
   * @param userId - User ID for file naming
   * @param type - 'checkin' or 'checkout'
   * @returns URL of uploaded photo or null if no photo provided
   * @throws Error if validation fails
   */
  async processPhoto(
    photo: File | string | null,
    userId: string,
    type: 'checkin' | 'checkout'
  ): Promise<string | null> {
    // Return null if no photo provided
    if (!photo) {
      return null
    }

    // Handle File object
    if (photo instanceof File) {
      // Validate file type
      if (!photo.type.startsWith('image/')) {
        throw new Error('File harus berupa gambar')
      }
      
      // Validate file size
      if (photo.size > ATTENDANCE_CONSTANTS.MAX_PHOTO_SIZE) {
        const maxSizeMB = ATTENDANCE_CONSTANTS.MAX_PHOTO_SIZE / (1024 * 1024)
        throw new Error(`Ukuran foto maksimal ${maxSizeMB}MB`)
      }
      
      // Generate upload path and filename
      const dateStr = new Date().toISOString().split('T')[0] // YYYY-MM-DD
      const uploadDir = `${ATTENDANCE_CONSTANTS.PHOTO_UPLOAD_DIR}/${dateStr}`
      const fileName = `${userId}_${type}_${Date.now()}`
      
      // Convert and save image
      return await convertAndSaveImage(
        photo,
        uploadDir,
        fileName,
        'employee-attendance',
        userId
      )
    }
    
    // Handle base64 string
    if (typeof photo === 'string') {
      // Convert base64 to file
      const response = await fetch(photo)
      const blob = await response.blob()
      const file = new File([blob], `${type}.jpg`, { type: 'image/jpeg' })
      return this.processPhoto(file, userId, type)
    }
    
    // Invalid photo type
    throw new Error('Format foto tidak valid')
  }
}
