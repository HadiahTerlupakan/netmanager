
import { type Server as SocketIOServer, type Socket } from 'socket.io';
import { getOnuService } from './OnuService';

interface MonitoredOnu {
    gponOnu: string;
    oltId: string;
}

const POLL_INTERVAL = 30 * 1000; // 30 seconds

export class OnuMonitor {
    private io: SocketIOServer;
    private interval: ReturnType<typeof setTimeout> | null = null;
    // Map socketId -> Set of MonitoredOnu unique strings "oltId:gponOnu"
    private trackingMap: Map<string, Set<string>> = new Map();
    // Cache helper to parse strings back to objects
    private monitoredData: Map<string, MonitoredOnu> = new Map();

    constructor(io: SocketIOServer) {
        this.io = io;
    }

    start() {
        if (this.interval) return;

        console.log('[OnuMonitor] Starting ONU view-based monitoring...');

        this.interval = setInterval(() => {
            this.processMonitoringQueue();
        }, POLL_INTERVAL);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    registerClient(socket: Socket) {
        // Listen for monitoring requests
        socket.on('monitor_onus', (items: MonitoredOnu[]) => {
            this.updateClientInterest(socket.id, items);
        });

        socket.on('disconnect', () => {
            this.removeClient(socket.id);
        });
    }

    private updateClientInterest(socketId: string, items: MonitoredOnu[]) {
        const keySet = new Set<string>();

        items.forEach(item => {
            if (item.gponOnu && item.oltId) {
                const key = `${item.oltId}|${item.gponOnu}`;
                keySet.add(key);
                if (!this.monitoredData.has(key)) {
                    this.monitoredData.set(key, item);
                }
            }
        });

        this.trackingMap.set(socketId, keySet);

        // Optional: Trigger immediate update if new items are added?
        // For now, wait for next tick to avoid spamming OLTs if user scrolls fast.
    }

    private removeClient(socketId: string) {
        this.trackingMap.delete(socketId);
        this.timeoutCleanup();
    }

    private timeoutCleanup() {
        // Remove monitoredData entries that are no longer tracked by anyone
        // Gather all active keys
        const allActiveKeys = new Set<string>();
        for (const keys of this.trackingMap.values()) {
            for (const key of keys) {
                allActiveKeys.add(key);
            }
        }

        // Cleanup cache
        for (const key of this.monitoredData.keys()) {
            if (!allActiveKeys.has(key)) {
                this.monitoredData.delete(key);
            }
        }
    }

    private async processMonitoringQueue() {
        if (this.monitoredData.size === 0) return;

        console.log(`[OnuMonitor] Polling ${this.monitoredData.size} active ONUs...`);

        const targets = Array.from(this.monitoredData.values());

        // Use OnuService to update. It handles OLT grouping and broadcasting.
        // Broadcasts go to 'admin:onu' room usually, or we can make it checking.
        // Since OnuService.updateOnus emits 'onu:updated' to 'admin:onu', 
        // all clients in that room will see updates, which is fine (shared transparency).
        try {
            await getOnuService().updateOnus(targets);
        } catch (err) {
            console.error('[OnuMonitor] Error in poll cycle:', err);
        }
    }
}

let monitorInstance: OnuMonitor | null = null;

export function startOnuMonitoring(io: SocketIOServer) {
    if (!monitorInstance) {
        monitorInstance = new OnuMonitor(io);
        monitorInstance.start();

        // Global listener for new connections to register handlers
        // Note: server.ts already handles connection event, but we need to hook into it.
        // Easier way: server.ts imports this and calls registerClient on connection?
        // OR we add a listener here if we have `io`.
        io.on('connection', (socket) => {
            monitorInstance?.registerClient(socket);
        });
    }
    return monitorInstance;
}

export function stopOnuMonitoring() {
    if (monitorInstance) {
        monitorInstance.stop();
        monitorInstance = null;
    }
}
