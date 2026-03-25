
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

    protected override getMonitorName(): string {
        return 'RadiusMonitor';
    }

    protected override getPollInterval(): number {
        return POLL_INTERVAL;
    }

    protected override async poll(): Promise<void> {
        // RadiusMonitor typically needs a tenant context. 
        // For background monitoring, we might need to iterate over active tenants
        // or this specific instance might be for a particular tenant.
        // For now, we'll fetch all tenants and poll for each if this is a global monitor.
        
        const tenants = await prisma.tenant.findMany({
            where: { isActive: true },
            select: { id: true }
        });

        for (const tenant of tenants) {
            try {
                // Concurrent fetching for better performance
                const [stats, recentSessions] = await Promise.all([
                    this.repository.getDashboardStats(tenant.id),
                    this.repository.getRecentSessions(tenant.id, { limit: 50, status: 'active' })
                ]);

                // Broadcast stats per tenant room
                this.io.to(`admin:radius:${tenant.id}`).emit('radius:stats', stats);

                // Broadcast recent active sessions per tenant room
                this.io.to(`admin:radius:${tenant.id}`).emit('radius:sessions', recentSessions);
            } catch (error) {
                console.error(`[RadiusMonitor] Error polling for tenant ${tenant.id}:`, error);
            }
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
