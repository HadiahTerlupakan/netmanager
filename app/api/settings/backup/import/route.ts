import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiErrors } from '@/lib/api-response'
import { importBackupArchive } from '@/modules/settings'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return ApiErrors.unauthorized('Session tidak valid')
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return ApiErrors.badRequest('File backup tidak ditemukan. Pastikan form field bernama "file".')
    }

    const result = await importBackupArchive({
      fileBuffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
      tenantId: session.user.tenantId,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes('Format file tidak valid') || message.includes('tidak berisi data database yang valid')) {
      return ApiErrors.badRequest(message)
    }

    return ApiErrors.internalError(`Gagal import backup: ${message}`)
  }
}
