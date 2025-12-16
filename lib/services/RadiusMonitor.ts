
import { type Server as SocketIOServer } from 'socket.io';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/lib/repositories/RadiusRepository';

const POLL_INTERVAL = 30 * 1000; // 30 seconds

export class RadiusMonitor {
    private io: SocketIOServer;
    private interval: NodeJS.Timeout | null = null;
    private repository: RadiusRepository;

    constructor(io: SocketIOServer) {
        this.io = io;
        this.repository = new RadiusRepository(prisma);
    }

    start() {
        if (this.interval) return;

        console.log('[RadiusMonitor] Starting Radius monitoring service...');

        // Initial fetch
        this.broadcastStats();

        // Start periodic fetch
        this.interval = setInterval(() => {
            this.broadcastStats();
        }, POLL_INTERVAL);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            console.log('[RadiusMonitor] Stopped Radius monitoring service');
        }
    }

    private async broadcastStats() {
        try {
            // Concurrent fetching for better performance
            const [stats, recentSessions] = await Promise.all([
                this.repository.getDashboardStats(),
                this.repository.getRecentSessions({ limit: 50, status: 'active' })
            ]);

            // Broadcast stats
            this.io.to('admin:radius').emit('radius:stats', stats);

            // Broadcast recent active sessions
            this.io.to('admin:radius').emit('radius:sessions', recentSessions);

            // Also emit to general admin room for critical alerts if needed
            // e.g. if onlineUsers drops to 0 abruptly

        } catch (error) {
            console.error('[RadiusMonitor] Error fetching/broadcasting stats:', error);
        }
    }
}

// Singleton reference
let monitorInstance: RadiusMonitor | null = null;

export function startRadiusMonitoring(io: SocketIOServer) {
    if (!monitorInstance) {
        monitorInstance = new RadiusMonitor(io);
        monitorInstance.start();
    }
    return monitorInstance;
}

export function stopRadiusMonitoring() {
    if (monitorInstance) {
        monitorInstance.stop();
        monitorInstance = null;
    }
}
