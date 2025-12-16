// Custom Next.js Server with Socket.io Integration
// This file runs Next.js with WebSocket support

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { initializeSocketServer } from './lib/websocket/server'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true)
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

    // Initialize WebSocket handlers
    initializeSocketServer(io)

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

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('[Server] SIGTERM received, shutting down gracefully')
        io.close(() => {
            console.log('[WS] Socket.io server closed')
        })
        server.close(() => {
            console.log('[Server] HTTP server closed')
            process.exit(0)
        })
    })

    process.on('SIGINT', () => {
        console.log('[Server] SIGINT received, shutting down gracefully')
        io.close(() => {
            console.log('[WS] Socket.io server closed')
        })
        server.close(() => {
            console.log('[Server] HTTP server closed')
            process.exit(0)
        })
    })
})
