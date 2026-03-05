import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiErrors } from '@/lib/api-response'
import { exec, execSync } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const execAsync = promisify(exec)

/**
 * Auto-detect path pg_dump binary
 * Cek Homebrew paths (Mac), lalu fallback ke default PATH
 */
function findPgDump(): string {
    const candidates = [
        '/opt/homebrew/opt/postgresql@18/bin/pg_dump',
        '/opt/homebrew/opt/postgresql@17/bin/pg_dump',
        '/opt/homebrew/opt/postgresql@16/bin/pg_dump',
        '/opt/homebrew/bin/pg_dump',
        '/usr/local/bin/pg_dump',
        '/usr/bin/pg_dump',
    ]
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate
    }
    // Fallback: coba dari PATH system
    try {
        return execSync('which pg_dump', { encoding: 'utf-8' }).trim()
    } catch {
        return 'pg_dump' // fallback, akan error nanti jika tidak ada
    }
}

/**
 * Konfigurasi semua database yang akan di-backup
 */
const DATABASES = [
    { name: 'netmanager', envVar: 'DATABASE_URL' },
    { name: 'radius', envVar: 'RADIUS_DATABASE_URL' },
    { name: 'billing', envVar: 'DATABASE_URL_BILLING' },
    { name: 'mitra', envVar: 'DATABASE_URL_MITRA' },
]

/**
 * Parse DATABASE_URL format postgresql://user:pass@host:port/dbname
 */
function parseDatabaseUrl(url: string) {
    try {
        const cleanUrl = url.split('?')[0]
        const parsed = new URL(cleanUrl)
        return {
            host: parsed.hostname,
            port: parsed.port || '5432',
            user: parsed.username,
            password: parsed.password,
            database: parsed.pathname.replace('/', ''),
        }
    } catch {
        return null
    }
}

/**
 * GET /api/settings/backup/export
 * Export semua database sekaligus dalam satu file .tar.gz
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
    // Auth check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
        return ApiErrors.unauthorized('Session tidak valid')
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'netmgr-backup-'))
    const now = new Date()
    const timestamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        '_',
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0'),
    ].join('')
    const tarFileName = `netmanager_backup_${timestamp}.tar.gz`
    const tarFilePath = path.join(tmpDir, tarFileName)

    const dumpFiles: string[] = []
    const errors: string[] = []

    try {
        // Dump setiap database
        for (const db of DATABASES) {
            const rawUrl = process.env[db.envVar]
            if (!rawUrl) {
                errors.push(`${db.name}: env var ${db.envVar} tidak ditemukan`)
                continue
            }

            const dbConfig = parseDatabaseUrl(rawUrl)
            if (!dbConfig) {
                errors.push(`${db.name}: gagal parse DATABASE_URL`)
                continue
            }

            const dumpFilePath = path.join(tmpDir, `${db.name}.sql.gz`)

            // pg_dump → gzip → simpan ke file
            // Gunakan set -e -o pipefail agar kegagalan pg_dump membuat pipeline gagal
            const pgDumpBin = findPgDump()
            const pgDumpCmd = [
                `set -e -o pipefail;`,
                `PGPASSWORD="${dbConfig.password}"`,
                `"${pgDumpBin}"`,
                `-h "${dbConfig.host}"`,
                `-p ${dbConfig.port}`,
                `-U "${dbConfig.user}"`,
                `-d "${dbConfig.database}"`,
                `--no-owner`,
                `--no-acl`,
                `--format=plain`,
                `| gzip > "${dumpFilePath}"`,
            ].join(' ')

            try {
                await execAsync(pgDumpCmd, { shell: '/bin/bash' })
                dumpFiles.push(dumpFilePath)
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err)
                errors.push(`${db.name}: ${errMsg}`)
                console.error(`[backup:export] Gagal dump database ${db.name}:`, errMsg)
            }
        }

        if (dumpFiles.length === 0) {
            fs.rmSync(tmpDir, { recursive: true, force: true })
            return ApiErrors.internalError(`Semua database gagal di-backup: ${errors.join('; ')}`)
        }

        // Buat .tar.gz dari semua file dump
        const fileNames = dumpFiles.map((f) => path.basename(f)).join(' ')
        await execAsync(`tar -czf "${tarFilePath}" -C "${tmpDir}" ${fileNames}`, {
            shell: '/bin/bash',
        })

        // Baca file tar
        const fileBuffer = fs.readFileSync(tarFilePath)

        // Cleanup tmp files
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        } catch {
            // Ignore cleanup errors
        }

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/gzip',
                'Content-Disposition': `attachment; filename="${tarFileName}"`,
                'Content-Length': fileBuffer.length.toString(),
                'X-Backup-Databases': dumpFiles.map((f) => path.basename(f, '.sql.gz')).join(','),
                ...(errors.length > 0 ? { 'X-Backup-Warnings': errors.join('; ') } : {}),
            },
        })
    } catch (err) {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        } catch {
            /* ignore */
        }
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error('[backup:export] Fatal error:', errMsg)
        return ApiErrors.internalError(`Gagal membuat backup: ${errMsg}`)
    }
}
