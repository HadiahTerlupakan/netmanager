
import { type Server as SocketIOServer } from 'socket.io';
import { RadiusRepository } from '../repositories/RadiusRepository';
import { BaseMonitor } from './BaseMonitor';
import { NetworkRepository } from '../repositories/NetworkRepository';

const POLL_INTERVAL = 30 * 1000;

export class RadiusMonitor extends BaseMonitor {
    private repository: RadiusRepository;
    private networkRepo: NetworkRepository;

    constructor(io: SocketIOServer) {
        super(io);
        this.repository = new RadiusRepository();
        this.networkRepo = new NetworkRepository();
    }

    protected override getMonitorName(): string {
        return 'RadiusMonitor';
    }

    protected override getPollInterval(): number {
        return POLL_INTERVAL;
    }

    protected override async poll(): Promise<void> {
        const tenants = await this.networkRepo.findActiveTenants();

        for (const tenant of tenants) {
            try {
                const [stats, recentSessions] = await Promise.all([
                    this.repository.getDashboardStats(tenant.id),
                    this.repository.getRecentSessions(tenant.id, { limit: 50, status: 'active' })
                ]);

                this.io.to(`admin:radius:${tenant.id}`).emit('radius:stats', stats);
                this.io.to(`admin:radius:${tenant.id}`).emit('radius:sessions', recentSessions);
            } catch (error) {
                console.error(`[RadiusMonitor] Error polling for tenant ${tenant.id}:`, error);
            }
        }
    }
}

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
