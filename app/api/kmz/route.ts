import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getKmzRepository } from '@/lib/repositories'
import { kmzCreateSchema } from '@/lib/validations/kmz'
import { extractAndSaveKmz, getFileBuffer } from '@/lib/utils/kmz-handler'
import { randomBytes } from 'crypto'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

export async function GET(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  try {
    const { searchParams } = new URL(req.url)
    const siteId = searchParams.get('siteId') || undefined
    const kmzRepository = getKmzRepository()
    const kmzFiles = await kmzRepository.findAll(siteId)
    return NextResponse.json({ kmzFiles })
  } catch (error: any) {
    console.error('Error fetching KMZ files:', error)
    return NextResponse.json({ error: 'Failed to fetch KMZ files' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData: any = await req.formData()
    const file = formData.get('file') as File | null
    const nameRaw = formData.get('name')
    const descriptionRaw = formData.get('description')
    const lineColorRaw = formData.get('lineColor')
    const statusRaw = formData.get('status')
    
    const name = nameRaw ? String(nameRaw).trim() : null
    const description = descriptionRaw ? String(descriptionRaw).trim() : null
    const lineColor = lineColorRaw ? String(lineColorRaw).trim() : '#3388ff'
    const status = statusRaw ? String(statusRaw).trim() as 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE' : 'AKTIF'

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    if (!name || name.length === 0) {
      return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 })
    }

    // Get file buffer first
    const fileBuffer = await getFileBuffer(formData, 'file')

    // Validate file (check extension and size)
    const fileName = file.name || 'unknown'
    if (!fileName.toLowerCase().endsWith('.kmz')) {
      return NextResponse.json({ error: 'File harus berformat KMZ' }, { status: 400 })
    }

    if (fileBuffer.length === 0) {
      return NextResponse.json({ error: 'File tidak boleh kosong' }, { status: 400 })
    }

    if (fileBuffer.length > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File terlalu besar. Maksimal 50MB' }, { status: 400 })
    }

    // Validate name, description, lineColor, and status
    const parsed = kmzCreateSchema.safeParse({ 
      name, 
      description: description && description.length > 0 ? description : undefined,
      lineColor: lineColor || '#3388ff',
      status
    })
    if (!parsed.success) {
      const errors = parsed.error.flatten()
      const errorMessage = errors.formErrors?.[0] || Object.values(errors.fieldErrors || {})[0]?.[0] || 'Data tidak valid'
      console.error('Validation error:', errors)
      return NextResponse.json({ error: errorMessage }, { status: 400 })
    }

    // Generate unique ID for this KMZ file
    const kmzId = randomBytes(16).toString('hex')

    // Extract and save KMZ
    const { filePath, kmlPath, fileSize } = await extractAndSaveKmz(
      fileBuffer,
      kmzId,
      file.name
    )

    // Save to database
    const kmzRepository = getKmzRepository()
    const created = await kmzRepository.create({
      name: parsed.data.name,
      filename: file.name,
      filePath,
      kmlPath,
      fileSize,
      description: parsed.data.description ?? null,
      lineColor: parsed.data.lineColor || '#3388ff',
      status: parsed.data.status || 'AKTIF',
    })

    return NextResponse.json({ id: created.id })
  } catch (error: any) {
    console.error('Error uploading KMZ file:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Failed to upload KMZ file' },
      { status: 500 }
    )
  }
}

