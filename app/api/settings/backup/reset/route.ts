import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiErrors } from '@/lib/api-response'
import { hasPermission } from '@/lib/rbac'
import { shouldRunSeedAfterReset } from './reset-operations'
import type { ResetResult } from './reset-operations'
import { exec, execSync } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'

const execAsync = promisify(exec)
const RESET_CONFIRMATION_TEXT = 'RESET DATABASE'

const DB_ENV_MAP: Record<string, string> = {
    netmanager: 'DATABASE_URL',
    radius: 'RADIUS_DATABASE_URL',
    billing: 'DATABASE_URL_BILLING',
    mitra: 'DATABASE_URL_MITRA',
}

type DbConfig = {
    host: string
    port: string
    user: string
    password: string
    database: string
}

function parseDatabaseUrl(url: string): DbConfig | null {
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

function findTsxCommand(): string {
    const local = path.join(process.cwd(), 'node_modules', '.bin', 'tsx')
    if (fs.existsSync(local)) return `"${local}"`
    return 'npx tsx'
}

function getPrismaConfigFlag(dbName: string): string {
    const configMap: Record<string, string | null> = {
        netmanager: null,
        radius: 'prisma.radius.config.ts',
        billing: 'prisma.billing.config.ts',
        mitra: 'prisma.mitra.config.ts',
    }

    const config = configMap[dbName]
    return config ? ` --config=${config}` : ''
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
        return ApiErrors.unauthorized('Session tidak valid')
    }

    const canReset = await hasPermission('backup_database:delete', session.user)
    if (!canReset) {
        return ApiErrors.forbidden('Anda tidak memiliki permission untuk reset database')
    }

    const body = (await req.json().catch((): null => null)) as { confirmationText?: string } | null
    if (!body?.confirmationText || body.confirmationText !== RESET_CONFIRMATION_TEXT) {
        return ApiErrors.badRequest(`Konfirmasi tidak valid. Harus tepat: ${RESET_CONFIRMATION_TEXT}`)
    }

    const psqlBin = findPsql()
    const prismaBin = findPrismaBin()
    const tsxCommand = findTsxCommand()
    const results: ResetResult[] = []

    for (const [dbName, envVar] of Object.entries(DB_ENV_MAP)) {
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
                message: 'Gagal parse DATABASE_URL.',
            })
            continue
        }

        const pgPrefix = `export PGPASSWORD="${dbConfig.password}"; export PGHOST="${dbConfig.host}"; export PGPORT="${dbConfig.port}"; export PGUSER="${dbConfig.user}";`
        const configFlag = getPrismaConfigFlag(dbName)

        try {
            await execAsync(
                `${pgPrefix} "${psqlBin}" -d "${dbConfig.database}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" -q`,
                { shell: '/bin/sh', maxBuffer: 1024 * 1024 * 10 }
            )

            await execAsync(
                `cd "${process.cwd()}" && "${prismaBin}" db push --accept-data-loss${configFlag}`,
                {
                    shell: '/bin/sh',
                    maxBuffer: 1024 * 1024 * 30,
                    env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
                }
            )

            results.push({
                database: dbName,
                status: 'success',
                message: 'Database berhasil di-reset dan schema sudah dibuat ulang.',
            })
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)
            console.error(`[backup:reset] Error reset ${dbName}:`, errMsg.substring(0, 500))
            results.push({
                database: dbName,
                status: 'error',
                message: `Gagal reset: ${errMsg.substring(0, 200)}`,
            })
        }
    }

    if (shouldRunSeedAfterReset(results)) {
        try {
            await execAsync(`cd "${process.cwd()}" && ${tsxCommand} prisma/seed.ts`, {
                shell: '/bin/sh',
                maxBuffer: 1024 * 1024 * 30,
                env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
            })

            results.push({
                database: 'seed',
                status: 'success',
                message: 'Seed berhasil dijalankan ulang. Login default tersedia kembali.',
            })
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)
            console.error('[backup:reset] Error running seed:', errMsg.substring(0, 500))
            results.push({
                database: 'seed',
                status: 'error',
                message: `Reset selesai, tetapi seed gagal: ${errMsg.substring(0, 200)}`,
            })
        }
    }

    const successCount = results.filter((r) => r.status === 'success').length
    const errorCount = results.filter((r) => r.status === 'error').length

    return NextResponse.json({
        success: errorCount === 0,
        message:
            errorCount === 0
                ? `Reset selesai: ${successCount} langkah berhasil (termasuk seed jika tersedia). Anda bisa login ulang.`
                : `Reset selesai dengan ${errorCount} error. ${successCount} langkah berhasil.`,
        results,
    })
}
