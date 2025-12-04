import sharp from 'sharp'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { isR2Enabled, uploadToR2, generateR2Key } from './r2-client'

export type UploadType = 'pelanggan' | 'payment-proofs' | 'logos' | 'kmz'

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

// Re-export R2 utilities for convenience
export { isR2Enabled, uploadToR2, generateR2Key } from './r2-client'
