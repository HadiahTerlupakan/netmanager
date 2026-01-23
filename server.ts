import 'dotenv/config'

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
import { initializeSocketServer } from './lib/websocket/server'
import cron from 'node-cron'
import type { ScheduledTask } from 'node-cron'
import { stopRadiusMonitoring } from './modules/network/services/RadiusMonitor'
import { stopOnuMonitoring } from './modules/network/services/OnuMonitor'
import { prisma } from './lib/prisma'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
    // Keep reference to io for the internal emit endpoint
    let ioRef: SocketIOServer | null = null
    // Keep reference to billing cron task to stop it later
    let billingCronTask: ScheduledTask | null = null
    // Keep reference to MikroTik monitor to stop it later
    let mikroTikMonitorRef: any = null

    const server = createServer(async (req, res) => {
        const parsedUrl = parse(req.url!, true)

        // Custom handler for large APK uploads - bypass Next.js body limit
        if (req.method === 'POST' && parsedUrl.pathname === '/api/admin/app-version') {
            const formidable = await import('formidable')
            const fs = await import('fs')
            const path = await import('path')
            
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
                    res.end(JSON.stringify({ error: 'Unauthorized' }))
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
                    res.end(JSON.stringify({ error: 'User not found' }))
                    return
                }

                // Check permission: SUPER_ADMIN bypass OR 'app_version:create' permission OR accessAdminPanel
                const userRole = dbUser.role?.name || ''
                const hasAdminPanelAccess = dbUser.role?.accessAdminPanel === true
                // 'permission' is singular in Prisma schema but holds an array
                const userPermissions = dbUser.role?.permission?.map((p: any) => `${p.resource}:${p.action}`) || []
                
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
                    res.end(JSON.stringify({ error: 'Forbidden: Missing app_version:create permission' }))
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
                    } catch (e) {
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
            } catch (error: any) {
                console.error('[Server] Error uploading app version:', error)
                
                // Safe error object construction
                const errorMessage = error?.message || 'Failed to upload app version'
                // Avoid passing entire error object to JSON.stringify as it might cause circular reference
                const errorDetails = {
                    error: errorMessage,
                    // Only include safe properties
                    code: error?.code, 
                    name: error?.name,
                    stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
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

                    // Simple secret check (in production, use proper authentication)
                    if (secret !== process.env.INTERNAL_WS_SECRET && secret !== 'netmanager-ws-internal-2024') {
                        res.writeHead(401, { 'Content-Type': 'application/json' })
                        res.end(JSON.stringify({ error: 'Unauthorized' }))
                        return
                    }

                    if (ioRef && event && room) {
                        ioRef.to(room).emit(event, payload)
                        console.log(`[WS Internal] Emitted ${event} to ${room}`)
                        res.writeHead(200, { 'Content-Type': 'application/json' })
                        res.end(JSON.stringify({ success: true }))
                    } else {
                        res.writeHead(400, { 'Content-Type': 'application/json' })
                        res.end(JSON.stringify({ error: 'Missing required fields or io not ready' }))
                    }
                } catch (error) {
                    console.error('[WS Internal] Error:', error)
                    res.writeHead(500, { 'Content-Type': 'application/json' })
                    res.end(JSON.stringify({ error: 'Internal error' }))
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

            // Construct absolute path to the file in public/uploads
            const safePath = parsedUrl.pathname || ''
            const filePath = path.join(process.cwd(), 'public', safePath)

            // Check if file exists
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                const stat = fs.statSync(filePath)
                res.writeHead(200, {
                    'Content-Type': getMimeType(filePath),
                    'Content-Length': stat.size
                })
                const readStream = fs.createReadStream(filePath)
                readStream.pipe(res)
                return
            }
            // If file not found, let Next.js handle it (maybe 404 or other route)
        }

        handle(req, res, parsedUrl)
    })

    // Initialize Socket.io server
    const io = new SocketIOServer(server, {
        path: '/api/socket',
        cors: {
            origin: "*", // Allow all origins for mobile app testing
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

    // Initialize WebSocket handlers
    initializeSocketServer(io)

    // Start Radius Monitoring Service
    // Dynamic import to avoid issues if module dependencies aren't ready
    import('./modules/network/services/RadiusMonitor').then(({ startRadiusMonitoring }) => {
        startRadiusMonitoring(io)
    }).catch(err => console.error('[Server] Failed to start Radius monitoring:', err))

    // Start ONU Monitoring Service
    import('./modules/network/services/OnuMonitor').then(({ startOnuMonitoring }) => {
        startOnuMonitoring(io)
    }).catch(err => console.error('[Server] Failed to start ONU monitoring:', err))

    // Inject IO into OnuService for API-triggered updates
    import('./modules/network/services/OnuService').then(({ getOnuService }) => {
        getOnuService().setSocketServer(io)
    })

    // Start MikroTik Monitoring Service
    import('./modules/network/services/MikroTikMonitor').then(({ mikroTikMonitor }) => {
        mikroTikMonitorRef = mikroTikMonitor
        mikroTikMonitor.setSocketServer(io)
        mikroTikMonitor.start()
    }).catch(err => console.error('[Server] Failed to start MikroTik monitoring:', err))

    // Inject IO into OltSyncService
    import('./modules/network/services/OltSyncService').then(({ getOltSyncService }) => {
        getOltSyncService().setSocketServer(io)
    })

    // Start Automatic Billing Service (Daily at 01:00 AM)
    import('./modules/finance/services/AutomaticBillingService').then(({ AutomaticBillingService }) => {
        billingCronTask = cron.schedule('0 1 * * *', () => {
            console.log('[Cron] Running daily billing check')
            AutomaticBillingService.generateDailyInvoices()
        })
        console.log('[Server] Automatic billing cron scheduled')
    }).catch(err => console.error('[Server] Failed to start Automatic Billing Service:', err))

    // Start Automatic Isolation Service (Daily at 00:00 AM)
    import('./modules/finance/services/AutomaticIsolationService').then(({ AutomaticIsolationService }) => {
        cron.schedule('0 0 * * *', () => {
            console.log('[Cron] Running daily isolation check')
            AutomaticIsolationService.runDailyCheck()
        })
        console.log('[Server] Automatic isolation cron scheduled (00:00)')
    }).catch(err => console.error('[Server] Failed to start Automatic Isolation Service:', err))

    // Start Auto Checkout Service (Daily at 23:59)
    import('./modules/attendance/services/AutoCheckoutService').then(({ AutoCheckoutService }) => {
        cron.schedule('59 23 * * *', () => {
            console.log('[Cron] Running daily auto-checkout')
            AutoCheckoutService.runAutoCheckout()
        })
            console.log('[Server] Auto checkout cron scheduled (23:59)')
    }).catch(err => console.error('[Server] Failed to start Auto Checkout Service:', err))

    // Start Monthly Asset Depreciation Service (Monthly on 1st at 02:00 AM)
    import('./modules/inventory/services/AssetService').then(({ AssetService }) => {
        cron.schedule('0 2 1 * *', async () => {
             console.log('[Cron] Running monthly asset depreciation')
             try {
                // Fetch System Admin for context
                let systemUser = await prisma.user.findFirst({
                    where: { role: { name: 'SUPER_ADMIN' } }
                }) || await prisma.user.findFirst()

                if (systemUser) {
                    const assetService = new AssetService()
                    const results = await assetService.runMonthlyDepreciationCycle(systemUser.id)
                    console.log(`[Cron] Depreciation complete. Processed ${results.length} assets.`)
                } else {
                    console.error('[Cron] Failed to run depreciation: No system user found')
                }
             } catch (err) {
                 console.error('[Cron] Depreciation cycle failed:', err)
             }
        })
        console.log('[Server] Asset depreciation cron scheduled (Monthly 1st 02:00)')
    }).catch(err => console.error('[Server] Failed to start Asset Service:', err))


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
        if (billingCronTask) {
            billingCronTask.stop()
            console.log('[Cron] Billing task stopped')
        }

        // 2. Stop Monitoring Services
        try {
            stopRadiusMonitoring()
            stopOnuMonitoring()
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
