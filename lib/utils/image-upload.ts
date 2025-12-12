import sharp from 'sharp'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { isR2Enabled, uploadToR2, generateR2Key } from './r2-client'

export type UploadType = 'pelanggan' | 'payment-proofs' | 'logos' | 'kmz' | 'inventory-masuk' | 'inventory-keluar' | 'inventory-transfer' | 'employee-attendance' | 'workorder-completion'

/**
 * Konversi dan simpan gambar ke WebP format
 * Mendukung upload ke R2 jika diaktifkan, fallback ke local storage
 * @param file File yang akan dikonversi
 * @param uploadDir Direktori upload (untuk local storage)
 * @param fileName Nama file output (tanpa extension)
 * @param uploadType Tipe upload untuk R2 folder structure
 * @param subFolder Sub folder (optional, e.g., idPelanggan)
 * @returns URL file yang disimpan
 */
export async function convertAndSaveImage(
  file: File,
  uploadDir: string,
  fileName: string,
  uploadType?: UploadType,
  subFolder?: string
): Promise<string> {
  try {
    // Baca file sebagai buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Konversi ke WebP dengan optimasi
    const webpBuffer = await sharp(buffer)
      .webp({ quality: 85, effort: 6 })
      .toBuffer()

    // Check if R2 is enabled
    if (await isR2Enabled()) {
      // Upload to R2
      const key = generateR2Key(
        uploadType || 'pelanggan',
        `${fileName}.webp`,
        subFolder
      )

      const url = await uploadToR2(webpBuffer, key, 'image/webp')
      console.log('Image uploaded to R2:', { key, url })
      return url
    }

    // Fallback to local storage
    await mkdir(uploadDir, { recursive: true })
    const outputPath = path.join(uploadDir, `${fileName}.webp`)
    await writeFile(outputPath, webpBuffer)

    // Return path relatif untuk URL
    const publicPath = path.join(process.cwd(), 'public')
    let relativePath = outputPath.replace(publicPath, '')
    relativePath = relativePath.replace(/\\/g, '/') // Normalize path separator untuk URL

    // Pastikan path dimulai dengan /
    if (!relativePath.startsWith('/')) {
      relativePath = '/' + relativePath
    }

    console.log('Image saved locally:', {
      outputPath,
      publicPath,
      relativePath,
      fileName: `${fileName}.webp`
    })

    return relativePath
  } catch (error: any) {
    console.error('Error converting image to WebP:', error)
    throw new Error(`Gagal mengkonversi gambar: ${error.message}`)
  }
}

/**
 * Simpan file tanpa konversi (untuk file non-image seperti PDF)
 * Mendukung upload ke R2 jika diaktifkan, fallback ke local storage
 * @param file File yang akan disimpan
 * @param uploadDir Direktori upload (untuk local storage)
 * @param fileName Nama file output (dengan extension)
 * @param uploadType Tipe upload untuk R2 folder structure
 * @param subFolder Sub folder (optional, e.g., idPelanggan)
 * @returns URL file yang disimpan
 */
export async function saveFile(
  file: File,
  uploadDir: string,
  fileName: string,
  uploadType?: UploadType,
  subFolder?: string
): Promise<string> {
  try {
    // Baca file sebagai buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Check if R2 is enabled
    if (await isR2Enabled()) {
      // Upload to R2
      const key = generateR2Key(
        uploadType || 'pelanggan',
        fileName,
        subFolder
      )

      const url = await uploadToR2(buffer, key, file.type || 'application/octet-stream')
      console.log('File uploaded to R2:', { key, url })
      return url
    }

    // Fallback to local storage
    await mkdir(uploadDir, { recursive: true })
    const outputPath = path.join(uploadDir, fileName)
    await writeFile(outputPath, buffer)

    // Return path relatif untuk URL
    const relativePath = outputPath.replace(path.join(process.cwd(), 'public'), '')
    const normalizedPath = relativePath.replace(/\\/g, '/') // Normalize path separator untuk URL

    console.log('File saved locally:', { outputPath, relativePath: normalizedPath })
    return normalizedPath
  } catch (error: any) {
    console.error('Error saving file:', error)
    throw new Error(`Gagal menyimpan file: ${error.message}`)
  }
}

/**
 * Cek apakah file adalah gambar
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

/**
 * Upload multiple photos for inventory transactions
 * @param files Array of files to upload
 * @param transactionId ID of the inventory transaction (masuk/keluar)
 * @param transactionType Type of transaction ('inventory-masuk' or 'inventory-keluar')
 * @param uploadDir Base upload directory (for local storage)
 * @returns Array of URLs for uploaded photos
 */
export async function uploadInventoryPhotos(
  files: File[],
  transactionId: string,
  transactionType: 'inventory-masuk' | 'inventory-keluar' | 'inventory-transfer',
  uploadDir: string
): Promise<string[]> {
  const uploadedUrls: string[] = []

  try {
    // Filter for image files only
    const imageFiles = files.filter(file => isImageFile(file))

    if (imageFiles.length === 0) {
      throw new Error('Tidak ada file gambar yang valid')
    }

    // Upload each image with a sequential index
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i]
      const fileName = `${transactionId}_photo_${i + 1}`

      // Use the existing convertAndSaveImage function
      const url = await convertAndSaveImage(
        file,
        uploadDir,
        fileName,
        transactionType,
        transactionId
      )

      uploadedUrls.push(url)
    }

    console.log(`Successfully uploaded ${uploadedUrls.length} inventory photos for transaction ${transactionId}`)
    return uploadedUrls

  } catch (error: any) {
    console.error('Error uploading inventory photos:', error)
    throw new Error(`Gagal mengupload foto inventaris: ${error.message}`)
  }
}

/**
 * Validate inventory photo files
 * @param files Array of files to validate
 * @param maxPhotos Maximum number of photos allowed (default: 5)
 * @param maxSizeMB Maximum file size per photo in MB (default: 5)
 * @returns Validation result
 */
export function validateInventoryPhotos(
  files: File[],
  maxPhotos: number = 5,
  maxSizeMB: number = 5
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check number of files
  if (files.length > maxPhotos) {
    errors.push(`Maksimal ${maxPhotos} foto yang diizinkan`)
  }

  if (files.length === 0) {
    errors.push('Setidaknya satu foto harus diupload')
  }

  // Check each file
  files.forEach((file, index) => {
    // Check file type
    if (!isImageFile(file)) {
      errors.push(`File ke-${index + 1} bukan gambar yang valid`)
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      errors.push(`File ke-${index + 1} terlalu besar. Maksimal ${maxSizeMB}MB`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Re-export R2 utilities for convenience
export { isR2Enabled, uploadToR2, generateR2Key } from './r2-client'
