import 'dotenv/config'

// Flag to indicate we are running in a custom server context (not Next.js App Router)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).IS_CUSTOM_SERVER = true

// Safeguard: Set Default Timezone for the entire process if not set
if (!process.env.TZ) {
    process.env.TZ = 'Asia/Jakarta'
}
console.log(`[API Server] Timezone set to: ${process.env.TZ} (${new Date().toString()})`)

import { serve } from '@hono/node-server'
import { Server as SocketIOServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import { initializeSocketServer } from './lib/websocket/server'
import { stopRadiusMonitoring } from './modules/network/services/RadiusMonitor'
import { startPushRetryProcessor, stopPushRetryProcessor } from './modules/notification/services/PushRetryQueue'
import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { AppError } from './lib/errors'

// Standalone Hono app for custom server (separate from Next.js App Router route)
const honoApp = new Hono().basePath('/api')

honoApp.onError((err, c) => {
  console.error(err)
  if (err instanceof AppError) {
    return c.json(
      { error: err.message, code: err.code, ...((err.details as Record<string, unknown>) ?? {}) },
      err.statusCode as ContentfulStatusCode
    )
  }
  return c.json({ error: err.message || 'Internal Server Error' }, 500)
})

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.API_PORT || process.env.PORT || '3001', 10)

// Keep reference to io for the internal emit endpoint
let ioRef: SocketIOServer | null = null
// Keep reference to MikroTik monitor to stop it later
let mikroTikMonitorRef: { stop: () => void; setSocketServer: (io: SocketIOServer) => void; start: () => void } | null = null

// Initialize Hono Server
const server = serve({
    fetch: async (req: Request, env?: unknown, executionCtx?: unknown) => {
        const url = new URL(req.url)
        
        // Internal endpoint for emitting WebSocket events from API routes
        if (req.method === 'POST' && url.pathname === '/_internal/emit') {
            try {
                const data = await req.json()
                const { event, room, payload, secret } = data

                // Validate secret from environment variable
                if (!process.env.INTERNAL_WS_SECRET || secret !== process.env.INTERNAL_WS_SECRET) {
                    return new Response(JSON.stringify({ error: 'Tidak terautentikasi' }), { 
                        status: 401,
                        headers: { 'Content-Type': 'application/json' }
                    })
                }

                if (ioRef && event && room) {
                    ioRef.to(room).emit(event, payload)
                    console.log(`[WS Internal] Emitted ${event} to ${room}`)
                    return new Response(JSON.stringify({ success: true }), { 
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                } else {
                    return new Response(JSON.stringify({ error: 'Field wajib tidak lengkap atau io tidak siap' }), { 
                        status: 400,
                        headers: { 'Content-Type': 'application/json' }
                    })
                }
            } catch (error) {
                console.error('[WS Internal] Error:', error)
                return new Response(JSON.stringify({ error: 'Kesalahan internal' }), { 
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                })
            }
        }
        
        return honoApp.fetch(req, env as Parameters<typeof honoApp.fetch>[1], executionCtx as Parameters<typeof honoApp.fetch>[2])
    },
    port,
    hostname,
}, (info) => {
    console.log(`\n  ▲ Hono API / Socket Server (${dev ? 'dev' : 'production'})`)
    console.log(`  - Local:        http://${hostname}:${info.port}`)
    console.log(`  - WebSocket:    ws://${hostname}:${info.port}/api/socket\n`)
}) as unknown as import('http').Server

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
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
})

// Set reference for internal emit endpoint
ioRef = io

// Setup Redis adapter for horizontal scaling (multi-worker support)
try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6380'
    const pubClient = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2, retryStrategy: (times) => times > 3 ? null : Math.min(times * 500, 3000) })
    const subClient = pubClient.duplicate()

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
}

// Initialize WebSocket handlers
initializeSocketServer(io)

// Start Push Notification Retry Processor
startPushRetryProcessor()

// Start Radius Monitoring Service
import('./modules/network/services/RadiusMonitor').then(({ startRadiusMonitoring }) => {
    startRadiusMonitoring(io)
}).catch(err => console.error('[Server] Failed to start Radius monitoring:', err))

// Start MikroTik Monitoring Service
import('./modules/network/services/MikroTikMonitor').then(({ mikroTikMonitor }) => {
    mikroTikMonitorRef = mikroTikMonitor
    mikroTikMonitor.setSocketServer(io)
    mikroTikMonitor.start()
}).catch(err => console.error('[Server] Failed to start MikroTik monitoring:', err))

// Start Cron Jobs
import('./lib/cron-registry').then(({ cronRegistry }) => {
    cronRegistry.startAll()
}).catch(err => console.error('[Server] Failed to load Cron Registry:', err))

if (dev) {
    setInterval(() => {
        const connectedSockets = io.sockets.sockets.size
        if (connectedSockets > 0) {
            console.log(`[WS] Active connections: ${connectedSockets}`)
        }
    }, 60000)
}

// Graceful shutdown handler
const gracefulShutdown = (signal: string) => {
    console.log(`[Server] ${signal} received, shutting down gracefully`)

    import('./lib/cron-registry').then(({ cronRegistry }) => {
        cronRegistry.stopAll()
    }).catch(err => console.error('[Server] Failed to stop Cron Registry:', err))

    try {
        stopRadiusMonitoring()
        stopPushRetryProcessor()
        if (mikroTikMonitorRef) mikroTikMonitorRef.stop()
        console.log('[Server] Monitoring services stopped')
    } catch (e) {
        console.error('[Server] Error stopping services:', e)
    }

    if (ioRef) {
        ioRef.close(() => console.log('[WS] Socket.io server closed'))
    }

    server.close(() => {
        console.log('[Server] HTTP server closed')
        process.exit(0)
    })

    setTimeout(() => {
        console.error('[Server] Forced exit after timeout')
        process.exit(1)
    }, 5000)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
