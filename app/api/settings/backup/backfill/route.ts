import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiErrors } from '@/lib/api-response'
import { hasPermission } from '@/lib/rbac'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'

const execAsync = promisify(exec)

function findTsxCommand(): string {
    const local = path.join(process.cwd(), 'node_modules', '.bin', 'tsx')
    if (fs.existsSync(local)) return `"${local}"`
    return 'npx tsx'
}

export async function POST(_req: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
        return ApiErrors.unauthorized('Session tidak valid')
    }

    // Role check: Only admin with backup_database:delete can run backfill
    const canBackfill = await hasPermission('backup_database:delete', session.user)
    if (!canBackfill) {
        return ApiErrors.forbidden('Anda tidak memiliki permission untuk melakukan sinkronisasi ini')
    }

    const tsxCommand = findTsxCommand()
    const scriptPath = path.join(process.cwd(), 'scripts', 'backfill-tenant.ts')
    
    if (!fs.existsSync(scriptPath)) {
        return ApiErrors.internalError('Script backfill-tenant.ts tidak ditemukan')
    }

    try {
        // We run the CLI script via TSX. This will backfill null tenantId across databases
        const command = `cd ${process.cwd()} && ${tsxCommand} ${scriptPath}`
        
        // Execute the script
        const { stdout, stderr } = await execAsync(command)

        if (stderr && stderr.toLowerCase().includes('error')) {
            console.error('[backup:backfill] Script Error details:', stderr)
            // Even if there is stderr, sometimes scripts use it for warnings.
            // We'll log it, but if it's a fatal error it would have thrown
        }

        console.log('[backup:backfill] Script Output:', stdout)

        return NextResponse.json({
            success: true,
            message: 'Sinkronisasi berhasil dijalankan. Data telah dihubungkan dengan Tenant yang benar.',
            log: stdout
        })
    } catch (error: unknown) {
        const err = error as Error
        console.error('[backup:backfill] Gagal menjalankan sinkronisasi:', err)
        return ApiErrors.internalError(`Gagal menjalankan sinkronisasi: ${err.message || String(err)}`)
    }
}
