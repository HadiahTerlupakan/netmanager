import { type Server as SocketIOServer } from 'socket.io';
import { getOLTRepository, getOnuRepository } from '@/lib/repositories';
import { updateMultipleOnusViaGetWithOids } from './onu-update-snmp-get';
import { onuCacheService } from './onu-cache-service';

export class OnuService {
    private io: SocketIOServer | null = null;

    constructor(io?: SocketIOServer) {
        if (io) {
            this.io = io;
        } else if (globalThis.socketIOServer) {
            this.io = globalThis.socketIOServer;
        }
    }

    setSocketServer(io: SocketIOServer) {
        this.io = io;
    }

    async updateOnus(onuList: { gponOnu: string; oltId: string }[]) {
        if (!onuList || onuList.length === 0) return [];

        console.log(`[OnuService] Updating ${onuList.length} ONUs...`);

        // Group ONUs by OLT
        const onusByOlt = new Map<string, Array<{ gponOnu: string }>>();

        for (const onu of onuList) {
            if (!onu.gponOnu || !onu.oltId) continue;
            if (!onusByOlt.has(onu.oltId)) {
                onusByOlt.set(onu.oltId, []);
            }
            onusByOlt.get(onu.oltId)!.push({ gponOnu: onu.gponOnu });
        }

        const updatedOnus: Array<{
            gponOnu: string;
            oltId: string;
            updated: boolean;
            data?: any;
        }> = [];

        const oltRepo = getOLTRepository();
        const onuRepo = getOnuRepository();

        // Process per OLT
        for (const [oltId, onus] of onusByOlt.entries()) {
            try {
                const olt = await oltRepo.findById(oltId);
                if (!olt || !olt.snmpConnected || !olt.snmpCommunityWrite) {
                    onus.forEach(o => updatedOnus.push({ gponOnu: o.gponOnu, oltId, updated: false }));
                    continue;
                }

                // Get OIDs
                const onusWithOids = await Promise.all(
                    onus.map(async (onu) => {
                        const existingOnu = await onuRepo.findByGponOnu(oltId, onu.gponOnu);
                        return {
                            gponOnu: onu.gponOnu,
                            statusOid: existingOnu?.statusOid || null,
                            rxOltOid: existingOnu?.rxOltOid || null,
                            rxOnuOid: existingOnu?.rxOnuOid || null,
                            nameOid: existingOnu?.nameOid || null,
                            descOid: existingOnu?.descOid || null,
                            compositeIndex: existingOnu?.compositeIndex || null,
                        };
                    })
                );

                // SNMP GET
                const updatedData = await updateMultipleOnusViaGetWithOids(
                    olt.ipAddress,
                    olt.snmpPort || 161,
                    olt.snmpCommunityWrite,
                    olt.snmpVersion || '2c',
                    onusWithOids
                );

                // Update DB
                for (const uData of updatedData) {
                    if (!uData.gponOnu || !uData.status) {
                        updatedOnus.push({ gponOnu: uData.gponOnu!, oltId, updated: false });
                        continue;
                    }

                    try {
                        const existingOnu = await onuRepo.findByGponOnu(oltId, uData.gponOnu);
                        const upsertData: any = {
                            oltId,
                            gponOnu: uData.gponOnu,
                            lastSeen: new Date(),
                            status: uData.status !== 'Unknown' ? uData.status : (existingOnu?.status || 'Unknown'),
                            rxOlt: (uData.rxOlt && uData.rxOlt !== 'N/A') ? uData.rxOlt : existingOnu?.rxOlt,
                            rxOnu: (uData.rxOnu && uData.rxOnu !== 'N/A') ? uData.rxOnu : existingOnu?.rxOnu,
                            // Use existing values for other fields if not provided
                            name: uData.name || existingOnu?.name || '',
                            description: uData.description ?? existingOnu?.description ?? null,
                            pppoe: uData.pppoe || existingOnu?.pppoe || null,
                            serialNumber: uData.serialNumber || existingOnu?.serialNumber || null,
                            actualType: uData.actualType || existingOnu?.actualType || null,
                        };

                        await onuRepo.upsert(oltId, uData.gponOnu, upsertData);

                        const result = {
                            gponOnu: uData.gponOnu,
                            oltId,
                            updated: true,
                            data: uData
                        };
                        updatedOnus.push(result);

                        // Emit WebSocket event
                        if (this.io) {
                            this.io.to('admin:onu').emit('onu:updated', result);
                        }

                    } catch (err) {
                        console.error(`[OnuService] Update error ${uData.gponOnu}: `, err);
                        updatedOnus.push({ gponOnu: uData.gponOnu, oltId, updated: false });
                    }
                }

            } catch (err) {
                console.error(`[OnuService] OLT ${oltId} error: `, err);
                onus.forEach(o => updatedOnus.push({ gponOnu: o.gponOnu, oltId, updated: false }));
            }
        }

        return updatedOnus;
    }
}

// Singleton instance
let onuServiceInstance: OnuService | null = null;
export function getOnuService(): OnuService {
    if (!onuServiceInstance) {
        onuServiceInstance = new OnuService();
    }
    return onuServiceInstance;
}
