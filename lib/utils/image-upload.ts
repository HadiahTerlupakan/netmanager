import sharp from 'sharp'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

/**
 * Konversi dan simpan gambar ke WebP format
 * @param file File yang akan dikonversi
 * @param uploadDir Direktori upload
 * @param fileName Nama file output (tanpa extension)
 * @returns Path relatif file yang disimpan (untuk URL)
 */
export async function convertAndSaveImage(
  file: File,
  uploadDir: string,
  fileName: string
): Promise<string> {
  try {
    // Pastikan direktori ada
    await mkdir(uploadDir, { recursive: true })

    // Baca file sebagai buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Path file output (selalu .webp)
    const outputPath = path.join(uploadDir, `${fileName}.webp`)

    // Konversi ke WebP dengan optimasi
    // Quality 85 adalah sweet spot antara kualitas dan ukuran file
    await sharp(buffer)
      .webp({ quality: 85, effort: 6 })
      .toFile(outputPath)

    // Return path relatif untuk URL
    const publicPath = path.join(process.cwd(), 'public')
    let relativePath = outputPath.replace(publicPath, '')
    relativePath = relativePath.replace(/\\/g, '/') // Normalize path separator untuk URL
    
    // Pastikan path dimulai dengan /
    if (!relativePath.startsWith('/')) {
      relativePath = '/' + relativePath
    }
    
    console.log('Image saved:', {
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
 * @param file File yang akan disimpan
 * @param uploadDir Direktori upload
 * @param fileName Nama file output (dengan extension)
 * @returns Path relatif file yang disimpan (untuk URL)
 */
export async function saveFile(
  file: File,
  uploadDir: string,
  fileName: string
): Promise<string> {
  try {
    // Pastikan direktori ada
    await mkdir(uploadDir, { recursive: true })

    // Path file output
    const outputPath = path.join(uploadDir, fileName)

    // Baca file sebagai buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Simpan file
    await writeFile(outputPath, buffer)

    // Return path relatif untuk URL
    const relativePath = outputPath.replace(path.join(process.cwd(), 'public'), '')
    return relativePath.replace(/\\/g, '/') // Normalize path separator untuk URL
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

