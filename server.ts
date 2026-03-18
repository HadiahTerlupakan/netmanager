import 'dotenv/config'

// Flag to indicate we are running in a custom server context (not Next.js App Router)
// This helps prevent AsyncLocalStorage crashes in tenant detection
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_CUSTOM_SERVER = true

// Safeguard: Set Default Timezone for the entire process if not set
// This ensures Date() functions typically use this timezone in Node.js environment
if (!process.env.TZ) {
    process.env.TZ = 'Asia/Jakarta'
}
console.log(`[Server] Timezone set to: ${process.env.TZ} (${new Date().toString()})`)

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import { initializeSocketServer } from './lib/websocket/server'
import { cronRegistry } from './lib/cron-registry'
import { stopRadiusMonitoring } from './modules/network/services/RadiusMonitor'
import { startPushRetryProcessor, stopPushRetryProcessor } from './modules/notification/services/PushRetryQueue'
import { prisma } from './lib/prisma'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
    // Keep reference to io for the internal emit endpoint
    let ioRef: SocketIOServer | null = null
    // Keep reference to MikroTik monitor to stop it later
    let mikroTikMonitorRef: { stop: () => void; setSocketServer: (io: SocketIOServer) => void; start: () => void } | null = null
    const server = createServer(async (req, res) => {
        const parsedUrl = parse(req.url!, true)

        // Custom handler for large APK uploads - bypass Next.js body limit
        if (req.method === 'POST' && parsedUrl.pathname === '/api/admin/app-version') {
            const formidable = await import('formidable')
            const fs = await import('fs')

            // Parse multipart form with higher file size limit (200MB)
            // Use system temp directory for uploads to avoid permission issues in Docker
            const os = await import('os')
            const tmpDir = os.tmpdir()

            const form = formidable.formidable({
                maxFileSize: 1024 * 1024 * 1024, // 1GB per file
                maxTotalFileSize: 1024 * 1024 * 1024, // 1GB total
                uploadDir: tmpDir,
                keepExtensions: true,
                multiples: false
            })

            try {
                const [fields, files] = await form.parse(req)

                // Forward to the actual API handler with parsed data
                const { NextRequest } = await import('next/server')
                const { verifyAuth } = await import('./lib/auth')
                const { getAppVersionService } = await import('./modules/app-version')

                // Get auth from cookies
                const cookieHeader = req.headers.cookie || ''
                const reqHeaders = new Headers()
                reqHeaders.set('cookie', cookieHeader)

                // Create a mock request for auth
                const mockReq = new Request(`http://localhost:${port}${req.url}`, {
                    method: 'GET',
                    headers: reqHeaders
                })
                const nextReq = new NextRequest(mockReq)

                const user = await verifyAuth(nextReq)
                if (!user) {
                    res.writeHead(401, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ error: 'Tidak terautentikasi' }))
                    return
                }

                // Fetch FRESH user data from database to ensure permissions are up to date
                // const prisma = getPrisma() // Removed: using imported prisma instance directly
                const dbUser = await prisma.user.findUnique({
                    where: { id: user.id },
                    include: {
                        role: { include: { permission: true } },
                    }
                })

                if (!dbUser) {
                    res.writeHead(401, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ error: 'User tidak ditemukan' }))
                    return
                }

                // Check permission: SUPER_ADMIN bypass OR 'app_version:create' permission OR accessAdminPanel
                const userRole = dbUser.role?.name || ''
                const hasAdminPanelAccess = dbUser.role?.accessAdminPanel === true
                // 'permission' is singular in Prisma schema but holds an array
                const userPermissions = dbUser.role?.permission?.map((p: { resource: string; action: string }) => `${p.resource}:${p.action}`) || []

                // Allow if:
                // 1. Role is SUPER_ADMIN (case-insensitive)
                // 2. Has explicit 'app_version:create' permission
                // 3. Has admin panel access (for custom admin roles)
                const hasCreatePermission =
                    userRole.toUpperCase() === 'SUPER_ADMIN' ||
                    userPermissions.includes('app_version:create') ||
                    hasAdminPanelAccess

                if (!hasCreatePermission) {
                    console.log(`[Upload] Forbidden access by ${dbUser.email}. Role: ${userRole}, AdminPanelAccess: ${hasAdminPanelAccess}, Permissions count: ${userPermissions.length}`)
                    res.writeHead(403, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ error: 'Akses ditolak: Memerlukan izin app_version:create' }))
                    return
                }

                console.log(`[Upload] Access granted for ${dbUser.email}. Role: ${userRole}, AdminPanelAccess: ${hasAdminPanelAccess}`)

                // Extract form fields
                const version = fields.version?.[0] || undefined
                const buildNumberStr = fields.buildNumber?.[0]
                const versionCodeStr = fields.versionCode?.[0]
                const platform = fields.platform?.[0] || 'android'
                const releaseNotes = fields.releaseNotes?.[0] || undefined
                const isForceUpdate = fields.isForceUpdate?.[0] === 'true'
                const minVersion = fields.minVersion?.[0] || undefined

                const buildNumber = buildNumberStr ? parseInt(buildNumberStr) : undefined
                const versionCode = versionCodeStr ? parseInt(versionCodeStr) : undefined

                // Get APK file
                let apkPath: string | undefined
                let apkFilename: string | undefined
                let apkSize: number | undefined

                const apkFile = files.apk?.[0]
                if (apkFile) {
                    apkPath = apkFile.filepath
                    apkFilename = apkFile.originalFilename || 'app.apk'
                    apkSize = apkFile.size
                }

                // Validation
                if (!apkFile && (!version || !buildNumber || !versionCode)) {

                    res.writeHead(400, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({
                        error: 'Upload APK untuk auto-detect versi, atau isi manual version, buildNumber, dan versionCode'
                    }))
                    return
                }

                const service = getAppVersionService()
                const appVersion = await service.uploadVersion({
                    version,
                    buildNumber,
                    versionCode,
                    platform,
                    releaseNotes,
                    isForceUpdate,
                    minVersion,
                    apkPath, // Pass path instead of buffer
                    apkFilename,
                    apkSize,
                    createdBy: user.id
                })

                // Cleanup temp file after successful upload/copy
                if (apkFile) {
                    try {
                        fs.unlinkSync(apkFile.filepath)
                    } catch (_e) {
                        // Ignore if file already moved or deleted
                    }
                }

                // Log activity
                try {
                    const { logger } = await import('./lib/logger')
                    await logger.logActivity({
                        action: 'CREATE',
                        subject: 'AppVersion',
                        userId: user.id,
                        details: { id: appVersion.id, version: appVersion.version }
                    })
                } catch (e) {
                    console.error('Logging failed', e)
                }

                res.writeHead(201, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({
                    success: true,
                    data: appVersion,
                    message: 'Versi aplikasi berhasil diupload'
                }))
                return
            } catch (error) {
                console.error('[Server] Error uploading app version:', error)

                const err = error as { message?: string; code?: string; name?: string; stack?: string }
                // Safe error object construction
                const errorMessage = err?.message || 'Gagal mengunggah versi aplikasi'
                // Avoid passing entire error object to JSON.stringify as it might cause circular reference
                const errorDetails = {
                    error: errorMessage,
                    // Only include safe properties
                    code: err?.code,
                    name: err?.name,
                    stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined
                }

                try {
                    res.writeHead(500, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify(errorDetails))
                } catch (writeError) {
                    console.error('[Server] Failed to write error response:', writeError)
                    // Fallback that is definitely safe
                    res.writeHead(500, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ error: errorMessage }))
                }
                return
            }
        }

        // Internal endpoint for emitting WebSocket events from API routes
        // This bypasses the globalThis issue in development mode
        if (req.method === 'POST' && parsedUrl.pathname === '/_internal/emit') {
            let body = ''
            req.on('data', chunk => { body += chunk })
            req.on('end', () => {
                try {
                    const data = JSON.parse(body)
                    const { event, room, payload, secret } = data

                    // Validate secret from environment variable
                    if (!process.env.INTERNAL_WS_SECRET || secret !== process.env.INTERNAL_WS_SECRET) {
                        res.writeHead(401, { 'Content-Type': 'application/json' })
                        res.end(JSON.stringify({ error: 'Tidak terautentikasi' }))
                        return
                    }

                    if (ioRef && event && room) {
                        ioRef.to(room).emit(event, payload)
                        console.log(`[WS Internal] Emitted ${event} to ${room}`)
                        res.writeHead(200, { 'Content-Type': 'application/json' })
                        res.end(JSON.stringify({ success: true }))
                    } else {
                        res.writeHead(400, { 'Content-Type': 'application/json' })
                        res.end(JSON.stringify({ error: 'Field wajib tidak lengkap atau io tidak siap' }))
                    }
                } catch (error) {
                    console.error('[WS Internal] Error:', error)
                    res.writeHead(500, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ error: 'Kesalahan internal' }))
                }
            })
        }
        // Helper to determine mime type
        const getMimeType = (filePath: string) => {
            const ext = filePath.split('.').pop()?.toLowerCase()
            switch (ext) {
                case 'png': return 'image/png'
                case 'jpg':
                case 'jpeg': return 'image/jpeg'
                case 'webp': return 'image/webp'
                case 'gif': return 'image/gif'
                case 'pdf': return 'application/pdf'
                default: return 'application/octet-stream'
            }
        }

        // Manual Static File Serving for Uploads (Bypassing Next.js static handling for runtime uploads)
        if (parsedUrl.pathname?.startsWith('/uploads/') && req.method === 'GET') {
            const fs = await import('fs')
            const path = await import('path')

            // Security: Resolve and validate path to prevent path traversal attacks
            const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads')

            // Remove leading slashes to prevent path.resolve treating it as absolute root path
            const cleanPath = (parsedUrl.pathname || '').replace(/^\/+/, '')
            const requestedPath = path.resolve(process.cwd(), 'public', cleanPath)

            // Ensure the resolved path is within the uploads directory
            if (!requestedPath.startsWith(uploadsDir + path.sep) && requestedPath !== uploadsDir) {
                res.writeHead(403, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: 'Akses ditolak' }))
                return
            }

            // Check if file exists (async stat instead of blocking statSync)
            try {
                const stat = await fs.promises.stat(requestedPath)
                if (stat.isFile()) {
                    res.writeHead(200, {
                        'Content-Type': getMimeType(requestedPath),
                        'Content-Length': stat.size
                    })
                    const readStream = fs.createReadStream(requestedPath)
                    readStream.pipe(res)
                    return
                }
            } catch {
                // File not found - fall through to Next.js handler
            }
            // If file not found, let Next.js handle it (maybe 404 or other route)
        }

        handle(req, res, parsedUrl)
    })

    // Initialize Socket.io server
    const allowedOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : [process.env.NEXTAUTH_URL || 'http://localhost:3000']
    const io = new SocketIOServer(server, {
        path: '/api/socket',
        cors: {
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true)
                } else {
                    callback(new Error('CORS: origin not allowed'))
                }
            },
            methods: ['GET', 'POST'],
            credentials: true,
        },
        // Connection options
        pingTimeout: 60000,
        pingInterval: 25000,
        // Transport options
        transports: ['websocket', 'polling'],
        // Allow upgrades from polling to websocket
        allowUpgrades: true,
    })

    // Set reference for internal emit endpoint
    ioRef = io

    // Setup Redis adapter for horizontal scaling (multi-worker support)
    try {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6380'
        const pubClient = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2, retryStrategy: (times) => times > 3 ? null : Math.min(times * 500, 3000) })
        const subClient = pubClient.duplicate()

        // Suppress unhandled error events when Redis is unavailable
        pubClient.on('error', () => { })
        subClient.on('error', () => { })

        Promise.all([pubClient.connect(), subClient.connect()])
            .then(() => {
                io.adapter(createAdapter(pubClient, subClient))
                console.log('[WS] Redis adapter connected for horizontal scaling')
            })
            .catch((error) => {
                console.warn('[WS] Redis adapter connection failed, using in-memory adapter:', error instanceof Error ? error.message : error)
            })
    } catch (error) {
        console.warn('[WS] Redis adapter setup failed, falling back to in-memory adapter:', error instanceof Error ? error.message : error)
        // Socket.IO will continue with its default in-memory adapter
    }

    // Initialize WebSocket handlers
    initializeSocketServer(io)

    // Start Background Services
    startPushRetryProcessor()

    // Start all cron jobs
    cronRegistry.startAll()

    // Start Radius Monitoring Service
    // Dynamic import to avoid issues if module dependencies aren't ready
    import('./modules/network/services/RadiusMonitor').then(({ startRadiusMonitoring }) => {
        startRadiusMonitoring(io)
    }).catch(err => console.error('[Server] Failed to start Radius monitoring:', err))

    // Start MikroTik Monitoring Service
    import('./modules/network/services/MikroTikMonitor').then(({ mikroTikMonitor }) => {
        mikroTikMonitorRef = mikroTikMonitor
        mikroTikMonitor.setSocketServer(io)
        mikroTikMonitor.start()
    }).catch(err => console.error('[Server] Failed to start MikroTik monitoring:', err))


    // Log connections count periodically in development
    if (dev) {
        setInterval(() => {
            const connectedSockets = io.sockets.sockets.size
            if (connectedSockets > 0) {
                console.log(`[WS] Active connections: ${connectedSockets}`)
            }
        }, 60000) // Log every minute
    }

    server.listen(port, '0.0.0.0', () => {
        console.log(``)
        console.log(`  ▲ Next.js ${dev ? 'dev' : 'production'} server`)
        console.log(`  - Local:        http://${hostname}:${port}`)
        console.log(`  - WebSocket:    ws://${hostname}:${port}/api/socket`)
        console.log(``)
    })

    // Graceful shutdown handler
    const gracefulShutdown = (signal: string) => {
        console.log(`[Server] ${signal} received, shutting down gracefully`)

        // 1. Stop Cron Jobs
        cronRegistry.stopAll()

        // 2. Stop Monitoring Services
        try {
            stopRadiusMonitoring()
            stopPushRetryProcessor()
            if (mikroTikMonitorRef) {
                mikroTikMonitorRef.stop()
            }
            console.log('[Server] Monitoring services stopped')
        } catch (e) {
            console.error('[Server] Error stopping services:', e)
        }

        // 3. Close Socket.io
        if (ioRef) {
            ioRef.close(() => {
                console.log('[WS] Socket.io server closed')
            })
        }

        // 4. Close HTTP Server
        server.close(() => {
            console.log('[Server] HTTP server closed')
            process.exit(0)
        })

        // Force exit if hanging
        setTimeout(() => {
            console.error('[Server] Forced exit after timeout')
            process.exit(1)
        }, 5000)
    }

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
    process.on('SIGINT', () => gracefulShutdown('SIGINT'))
})
