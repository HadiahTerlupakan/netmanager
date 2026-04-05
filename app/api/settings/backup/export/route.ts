import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiErrors } from '@/lib/api-response'
import { createBackupArchive } from '@/modules/settings'

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return ApiErrors.unauthorized('Session tidak valid')
  }

  try {
    const result = await createBackupArchive()

    return new NextResponse(new Uint8Array(result.fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
        'Content-Length': result.fileBuffer.length.toString(),
        'X-Backup-Databases': result.databases.join(','),
        ...(result.warnings.length > 0 ? { 'X-Backup-Warnings': result.warnings.join('; ') } : {}),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return ApiErrors.internalError(`Gagal membuat backup: ${message}`)
  }
}
