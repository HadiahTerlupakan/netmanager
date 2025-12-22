import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { initializeSocketServer } from './lib/websocket/server'
import cron from 'node-cron'
import type { ScheduledTask } from 'node-cron'
import { stopRadiusMonitoring } from './modules/network/services/RadiusMonitor'
import { stopOnuMonitoring } from './modules/network/services/OnuMonitor'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
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
            origin: process.env.NEXTAUTH_URL || `http://${hostname}:${port}`,
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

    // Log connections count periodically in development
    if (dev) {
        setInterval(() => {
            const connectedSockets = io.sockets.sockets.size
            if (connectedSockets > 0) {
                console.log(`[WS] Active connections: ${connectedSockets}`)
            }
        }, 60000) // Log every minute
    }

    server.listen(port, () => {
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
