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
 * Auto-detect path psql binary
 * Cek Homebrew paths (Mac), lalu fallback ke default PATH
 */
function findPsql(): string {
    const candidates = [
        '/opt/homebrew/opt/postgresql@18/bin/psql',
        '/opt/homebrew/opt/postgresql@17/bin/psql',
        '/opt/homebrew/opt/postgresql@16/bin/psql',
        '/opt/homebrew/bin/psql',
        '/usr/local/bin/psql',
        '/usr/bin/psql',
    ]
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate
    }
    try {
        return execSync('which psql', { encoding: 'utf-8' }).trim()
    } catch {
        return 'psql'
    }
}

/**
 * Mapping nama database ke env variable DATABASE_URL
 */
const DB_ENV_MAP: Record<string, string> = {
    netmanager: 'DATABASE_URL',
    radius: 'RADIUS_DATABASE_URL',
    billing: 'DATABASE_URL_BILLING',
    mitra: 'DATABASE_URL_MITRA',
}

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

type ImportResult = {
    database: string
    status: 'success' | 'skipped' | 'error'
    message: string
}

/**
 * POST /api/settings/backup/import
 * Import semua database dari file .tar.gz hasil export
 * TIDAK menghapus data yang ada — hanya menambah data baru
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
    // Auth check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
        return ApiErrors.unauthorized('Session tidak valid')
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'netmgr-import-'))

    try {
        // Baca file upload dari form-data
        const formData = await req.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            fs.rmSync(tmpDir, { recursive: true, force: true })
            return ApiErrors.badRequest('File backup tidak ditemukan. Pastikan form field bernama "file".')
        }

        // Validasi ekstensi file
        const fileName = file.name
        if (!fileName.endsWith('.tar.gz') && !fileName.endsWith('.tgz')) {
            fs.rmSync(tmpDir, { recursive: true, force: true })
            return ApiErrors.badRequest('Format file tidak valid. Gunakan file .tar.gz hasil export backup.')
        }

        // Simpan file upload ke tmp
        const uploadedFilePath = path.join(tmpDir, 'backup.tar.gz')
        const fileBuffer = Buffer.from(await file.arrayBuffer())
        fs.writeFileSync(uploadedFilePath, fileBuffer)

        // Extract tar.gz ke extractDir
        const extractDir = path.join(tmpDir, 'extracted')
        fs.mkdirSync(extractDir)
        await execAsync(`tar -xzf "${uploadedFilePath}" -C "${extractDir}"`, {
            shell: '/bin/bash',
        })

        // Cari semua file .sql.gz di dalam extracted dir
        const extractedFiles = fs.readdirSync(extractDir).filter((f) => f.endsWith('.sql.gz'))

        if (extractedFiles.length === 0) {
            fs.rmSync(tmpDir, { recursive: true, force: true })
            return ApiErrors.badRequest('File backup tidak berisi data database yang valid.')
        }

        const results: ImportResult[] = []

        // Restore setiap database
        for (const sqlGzFile of extractedFiles) {
            const dbName = sqlGzFile.replace('.sql.gz', '')
            const envVar = DB_ENV_MAP[dbName]

            if (!envVar) {
                results.push({
                    database: dbName,
                    status: 'skipped',
                    message: `Database "${dbName}" tidak dikenal, dilewati.`,
                })
                continue
            }

            const rawUrl = process.env[envVar]
            if (!rawUrl) {
                results.push({
                    database: dbName,
                    status: 'skipped',
                    message: `Env var ${envVar} tidak ditemukan.`,
                })
                continue
            }

            const dbConfig = parseDatabaseUrl(rawUrl)
            if (!dbConfig) {
                results.push({
                    database: dbName,
                    status: 'error',
                    message: `Gagal parse DATABASE_URL untuk ${dbName}.`,
                })
                continue
            }

            const sqlGzPath = path.join(extractDir, sqlGzFile)

            // Decompress .sql.gz → pipe ke psql
            // Menggunakan --set ON_ERROR_STOP=off agar jika ada conflict (data sudah ada),
            // error di-skip dan proses lanjut ke baris berikutnya
            // TIDAK ada DROP TABLE / TRUNCATE, sehingga data lama TETAP AMAN
            // Gunakan set -e -o pipefail agar kegagalan gunzip atau koneksi psql membuat pipeline gagal
            const psqlBin = findPsql()
            const restoreCmd = [
                `set -e -o pipefail;`,
                `PGPASSWORD="${dbConfig.password}"`,
                `gunzip -c "${sqlGzPath}"`,
                `|`,
                `"${psqlBin}"`,
                `-h "${dbConfig.host}"`,
                `-p ${dbConfig.port}`,
                `-U "${dbConfig.user}"`,
                `-d "${dbConfig.database}"`,
                `--set ON_ERROR_STOP=off`,
                `-q`,
            ].join(' ')

            try {
                await execAsync(restoreCmd, { shell: '/bin/bash' })
                results.push({
                    database: dbName,
                    status: 'success',
                    message: `Berhasil di-import.`,
                })
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err)
                console.error(`[backup:import] Error restore ${dbName}:`, errMsg)
                results.push({
                    database: dbName,
                    status: 'error',
                    message: `Error: ${errMsg.slice(0, 200)}`,
                })
            }
        }

        // Cleanup
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        } catch {
            /* ignore */
        }

        const successCount = results.filter((r) => r.status === 'success').length
        const errorCount = results.filter((r) => r.status === 'error').length

        return NextResponse.json({
            success: errorCount === 0,
            message:
                errorCount === 0
                    ? `Import berhasil: ${successCount} database berhasil di-restore.`
                    : `Import selesai dengan ${errorCount} error. ${successCount} database berhasil.`,
            results,
        })
    } catch (err) {
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        } catch {
            /* ignore */
        }
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error('[backup:import] Fatal error:', errMsg)
        return ApiErrors.internalError(`Gagal import backup: ${errMsg}`)
    }
}
