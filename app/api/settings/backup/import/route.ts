import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiErrors } from '@/lib/api-response'
import {
    ensurePrismaMigrationHistory,
    getBackupPrismaConfig,
} from '@/app/api/settings/backup/prisma-migration-history'
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

function findPrismaBin(): string {
    const local = path.join(process.cwd(), 'node_modules', '.bin', 'prisma')
    if (fs.existsSync(local)) return local
    return 'npx prisma'
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
 *
 * Strategi: FULL RESTORE (mendukung format lama COPY dan baru INSERT)
 *   1. DROP SCHEMA public CASCADE
 *   2. CREATE SCHEMA public
 *   3. Pipe gunzip -> psql (import dump)
 *   4. Untuk DB netmanager: prisma db push --accept-data-loss (sync kolom baru)
 *
 * PERHATIAN: Ini akan menggantikan SELURUH data dengan isi file backup.
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
        await execAsync(`tar -xzf "${uploadedFilePath}" -C "${extractDir}"`, { shell: '/bin/sh' })

        // Cari semua file .sql.gz di dalam extracted dir
        const extractedFiles = fs.readdirSync(extractDir).filter((f) => f.endsWith('.sql.gz'))

        if (extractedFiles.length === 0) {
            fs.rmSync(tmpDir, { recursive: true, force: true })
            return ApiErrors.badRequest('File backup tidak berisi data database yang valid.')
        }

        const results: ImportResult[] = []
        const psqlBin = findPsql()

        // Restore setiap database
        for (const sqlGzFile of extractedFiles) {
            const dbName = sqlGzFile.replace('.sql.gz', '')
            const envVar = DB_ENV_MAP[dbName]

            if (!envVar) {
                results.push({ database: dbName, status: 'skipped', message: `Database "${dbName}" tidak dikenal, dilewati.` })
                continue
            }

            const rawUrl = process.env[envVar]
            if (!rawUrl) {
                results.push({ database: dbName, status: 'skipped', message: `Env var ${envVar} tidak ditemukan.` })
                continue
            }

            const dbConfig = parseDatabaseUrl(rawUrl)
            if (!dbConfig) {
                results.push({ database: dbName, status: 'error', message: `Gagal parse DATABASE_URL untuk ${dbName}.` })
                continue
            }

            const sqlGzPath = path.join(extractDir, sqlGzFile)
            const pgPrefix = `export PGPASSWORD="${dbConfig.password}"; export PGHOST="${dbConfig.host}"; export PGPORT="${dbConfig.port}"; export PGUSER="${dbConfig.user}";`

            try {
                // LANGKAH 1: Reset schema (drop + create bersih)
                // Ini kunci utama agar format COPY maupun INSERT bisa masuk tanpa konflik
                await execAsync(
                    `${pgPrefix} "${psqlBin}" -d "${dbConfig.database}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" -q`,
                    { shell: '/bin/sh', maxBuffer: 1024 * 1024 * 10 }
                )

                // LANGKAH 2: Import dump (mendukung COPY dan INSERT)
                await execAsync(
                    `${pgPrefix} gunzip -c "${sqlGzPath}" | "${psqlBin}" -d "${dbConfig.database}"`,
                    { shell: '/bin/sh', maxBuffer: 1024 * 1024 * 10 }
                )

                // LANGKAH 3: Jalankan prisma db push untuk sync schema
                // agar kolom baru yang ada di schema.prisma (tapi belum ada di dump) ikut terbuat
                const prismaBin = findPrismaBin()
                const prismaConfig = getBackupPrismaConfig(dbName)

                if (prismaConfig) {
                    const configFlag = prismaConfig.config ? ` --config=${prismaConfig.config}` : ''

                    try {
                        await execAsync(
                            `cd "${process.cwd()}" && "${prismaBin}" db push --accept-data-loss${configFlag}`,
                            {
                                shell: '/bin/sh',
                                maxBuffer: 1024 * 1024 * 30,
                                env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
                            }
                        )
                        await ensurePrismaMigrationHistory({
                            dbName,
                            database: dbConfig.database,
                            pgPrefix,
                            psqlBin,
                            prismaBin,
                            projectRoot: process.cwd(),
                            env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
                            runCommand: async (command, options) =>
                                execAsync(command, {
                                    ...options,
                                    shell: '/bin/sh',
                                    maxBuffer: 1024 * 1024 * 30,
                                }),
                        })
                    } catch (pushErr) {
                        console.warn(`[backup:import] prisma db push warning for ${dbName}:`, String(pushErr).substring(0, 300))
                    }
                }

                results.push({
                    database: dbName,
                    status: 'success',
                    message: 'Berhasil di-restore. Data diganti dengan isi backup.',
                })

                // LANGKAH 4: Backfill tenantId untuk data lama (Legacy Backup)
                // Ini memastikan data dari backup versi lama (tanpa tenantId) muncul di UI
                if (session.user.tenantId) {
                    try {
                        const targetTenantId = session.user.tenantId
                        console.log(`[backup:import] Starting auto-backfill for ${dbName} to tenant ${targetTenantId}`)
                        
                        // Gunakan perintah SQL langsung untuk kecepatan dan keandalan (bypass prisma isolation)
                        const getTablesCmd = `${pgPrefix} "${psqlBin}" -d "${dbConfig.database}" -t -A -c "SELECT table_name FROM information_schema.columns WHERE column_name = 'tenantId' AND table_schema = 'public'"`
                        const tablesResult = await execAsync(getTablesCmd, { shell: '/bin/sh' })
                        const tables = tablesResult.stdout.trim().split('\n').filter(Boolean)

                        for (const table of tables) {
                            const backfillCmd = `${pgPrefix} "${psqlBin}" -d "${dbConfig.database}" -c "UPDATE \\"${table}\\" SET \\"tenantId\\" = '${targetTenantId}' WHERE \\"tenantId\\" IS NULL;"`
                            await execAsync(backfillCmd, { shell: '/bin/sh' })
                        }
                        console.log(`[backup:import] Auto-backfill finished for ${dbName}. Affected ${tables.length} tables.`)
                    } catch (backfillErr) {
                        console.warn(`[backup:import] Auto-backfill warning for ${dbName}:`, String(backfillErr).substring(0, 300))
                    }
                }
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err)
                console.error(`[backup:import] Error restore ${dbName}:`, errMsg.substring(0, 500))
                results.push({
                    database: dbName,
                    status: 'error',
                    message: `Gagal restore: ${errMsg.substring(0, 200)}`,
                })
            }
        }

        // Cleanup
        try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }

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
        try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error('[backup:import] Fatal error:', errMsg)
        return ApiErrors.internalError(`Gagal import backup: ${errMsg}`)
    }
}
