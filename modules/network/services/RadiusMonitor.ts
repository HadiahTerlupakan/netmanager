
import { type Server as SocketIOServer } from 'socket.io';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '../repositories/RadiusRepository';
import { BaseMonitor } from './BaseMonitor';

const POLL_INTERVAL = 30 * 1000; // 30 seconds

/**
 * RadiusMonitor - Extends BaseMonitor with exponential backoff
 * Broadcasts Radius stats and active sessions to admin:radius room
 */
export class RadiusMonitor extends BaseMonitor {
    private repository: RadiusRepository;

    constructor(io: SocketIOServer) {
        super(io);
        this.repository = new RadiusRepository(prisma);
    }

    protected getMonitorName(): string {
        return 'RadiusMonitor';
    }

    protected getPollInterval(): number {
        return POLL_INTERVAL;
    }

    protected async poll(): Promise<void> {
        // Concurrent fetching for better performance
        const [stats, recentSessions] = await Promise.all([
            this.repository.getDashboardStats(),
            this.repository.getRecentSessions({ limit: 50, status: 'active' })
        ]);

        // Broadcast stats
        this.io.to('admin:radius').emit('radius:stats', stats);

        // Broadcast recent active sessions
        this.io.to('admin:radius').emit('radius:sessions', recentSessions);
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
