import { type Server as SocketIOServer } from 'socket.io';
import { getOLTRepository, getOnuRepository } from '@/lib/repositories';
import { updateMultipleOnusViaGetWithOids } from './onu-update-snmp-get';
import { type OnuSyncData } from '@/lib/types/onu-sync';
import { type OnuCreateData } from '../repositories/IOnuRepository';

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
            data?: Partial<OnuSyncData>;
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

                // OPTIMIZATION: Single batch query instead of N queries
                // This replaces Promise.all(map findByGponOnu) pattern
                const existingOnus = await onuRepo.findManyByOltIdMinimal(oltId);
                
                // Create Map for O(1) lookup (instead of async query per ONU)
                const onuMap = new Map(
                    existingOnus.map(o => [o.gponOnu, o])
                );

                // Map OIDs using cached data (no queries)
                const onusWithOids = onus.map((onu) => {
                    const existingOnu = onuMap.get(onu.gponOnu);
                    return {
                        gponOnu: onu.gponOnu,
                        statusOid: existingOnu?.statusOid || null,
                        rxOltOid: existingOnu?.rxOltOid || null,
                        rxOnuOid: existingOnu?.rxOnuOid || null,
                        nameOid: existingOnu?.nameOid || null,
                        descOid: existingOnu?.descOid || null,
                        compositeIndex: existingOnu?.compositeIndex || null,
                    };
                });

                // SNMP GET
                const updatedData = await updateMultipleOnusViaGetWithOids(
                    olt.ipAddress,
                    olt.snmpPort || 161,
                    olt.snmpCommunityWrite,
                    olt.snmpVersion || '2c',
                    onusWithOids
                );

                // Update DB - reuse cached data from onuMap
                for (const uData of updatedData) {
                    if (!uData.gponOnu || !uData.status) {
                        updatedOnus.push({ gponOnu: uData.gponOnu!, oltId, updated: false });
                        continue;
                    }

                    try {
                        // Reuse cached data instead of another query
                        const existingOnu = onuMap.get(uData.gponOnu);
                        const upsertData: Partial<OnuSyncData> = {
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

                        await onuRepo.upsert(oltId, uData.gponOnu, upsertData as OnuCreateData);

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
