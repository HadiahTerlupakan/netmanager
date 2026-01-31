
import { Server } from 'socket.io'
import { OLTRepository, OnuRepository } from '../repositories'
import { syncOnuDataByOltId } from '@/modules/network'
import snmp from 'net-snmp'
import '@/lib/utils/event-emitter-config'

// SNMP OIDs untuk ZTE-C300 dan umum
const SNMP_OIDS = {
    sysDescr: '1.3.6.1.2.1.1.1.0', // System description (version info)
    sysUpTime: '1.3.6.1.2.1.1.3.0', // System uptime
    sysName: '1.3.6.1.2.1.1.5.0', // System name
    temperature: '1.3.6.1.4.1.3902.1015.2.1.3.2.0', // ZTE C300-B temperature (dari Zabbix template)
    connectedDevices: '1.3.6.1.2.1.2.1.0', // Number of interfaces (proxy untuk connected devices)
}

export class OltSyncService {
    private static instance: OltSyncService
    private io: Server | null = null

    private constructor() { }

    public static getInstance(): OltSyncService {
        if (!OltSyncService.instance) {
            OltSyncService.instance = new OltSyncService()
        }
        return OltSyncService.instance
    }

    public setSocketServer(io: Server) {
        this.io = io
    }

    private async getSNMPValue(
        ipAddress: string,
        port: number,
        community: string,
        version: string,
        oid: string
    ): Promise<string | null> {
        return new Promise((resolve) => {
            let resolved = false
            let session: { close: () => void; get: (oids: string[], callback: (error: Error | null, varbinds: Array<{ value: unknown }>) => void) => void; setMaxListeners?: (n: number) => void } | null = null
            let timeoutId: ReturnType<typeof setTimeout> | null = null

            const finish = (value: string | null) => {
                if (resolved) return
                resolved = true
                if (timeoutId) clearTimeout(timeoutId)
                if (session) {
                    try {
                        session.close()
                    } catch (_e) {
                        // Ignore close errors
                    }
                }
                resolve(value)
            }

            try {
                let snmpVersion: 0 | 1 | undefined = 1 // Default: Version2c
                if (version === '1') {
                    snmpVersion = 0 // Version1
                } else if (version === '3') {
                    console.warn(`[SNMP] SNMP v3 is not supported, using v2c instead`)
                    snmpVersion = 1 // Fallback to Version2c
                }

                session = snmp.createSession(ipAddress, community, {
                    port,
                    version: snmpVersion,
                    retries: 2,
                    timeout: 5000,
                }) as unknown as { close: () => void; get: (oids: string[], callback: (error: Error | null, varbinds: Array<{ value: unknown }>) => void) => void; setMaxListeners?: (n: number) => void }

                if (session && session.setMaxListeners) {
                    session.setMaxListeners(20)
                }

                session.get([oid], (error: Error | null, varbinds: Array<{ value: unknown }>) => {
                    if (resolved) return

                    if (error || !varbinds || varbinds.length === 0) {
                        finish(null)
                    } else {
                        const varbind = varbinds[0]
                        if (varbind && varbind.value !== null && varbind.value !== undefined) {
                            finish(varbind.value.toString())
                        } else {
                            finish(null)
                        }
                    }
                })

                timeoutId = setTimeout(() => {
                    finish(null)
                }, 10000)
            } catch (_error) {
                finish(null)
            }
        })
    }

    private formatUptime(centiseconds: number | null): string | null {
        if (!centiseconds) return null

        const seconds = Math.floor(centiseconds / 100)
        const days = Math.floor(seconds / 86400)
        const hours = Math.floor((seconds % 86400) / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const secs = seconds % 60

        if (days > 0) {
            return `${days} days ${hours} hours ${minutes} minutes`
        } else if (hours > 0) {
            return `${hours} hours ${minutes} minutes`
        } else if (minutes > 0) {
            return `${minutes} minutes ${secs} seconds`
        } else {
            return `${secs} seconds`
        }
    }

    public async startSync(oltId: string) {
        console.log(`[OltSyncService] Starting sync for OLT ${oltId}...`)
        const oltRepository = new OLTRepository()

        // Helper to emit progress
        const emitProgress = (progress: number, message?: string) => {
            if (this.io) {
                this.io.emit('olt:sync:progress', {
                    oltId,
                    progress: progress.toString(),
                    message
                })
            }
        }

        try {
            const olt = await oltRepository.findById(oltId)

            if (!olt) {
                console.error(`[OltSyncService] OLT ${oltId} not found`)
                await oltRepository.update(oltId, { syncStatus: '0' })
                emitProgress(0, 'OLT not found')
                return
            }

            if (!olt.snmpConnected) {
                console.error(`[OltSyncService] OLT ${olt.name} SNMP not connected`)
                await oltRepository.update(oltId, { syncStatus: '0' })
                emitProgress(0, 'SNMP not connected')
                return
            }

            // Initial progress update
            await oltRepository.update(oltId, { syncStatus: '1' })
            emitProgress(1, 'Starting sync...')

            // Get data dari SNMP
            const [version, uptimeStr, model, devicesStr, tempStr] = await Promise.all([
                this.getSNMPValue(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_OIDS.sysDescr),
                this.getSNMPValue(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_OIDS.sysUpTime),
                this.getSNMPValue(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_OIDS.sysName),
                this.getSNMPValue(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_OIDS.connectedDevices),
                this.getSNMPValue(olt.ipAddress, olt.snmpPort, olt.snmpCommunityWrite, olt.snmpVersion, SNMP_OIDS.temperature),
            ])

            // Parse data
            const uptime = uptimeStr ? this.formatUptime(parseInt(uptimeStr)) : null
            const temperature = tempStr ? parseInt(tempStr) : null
            const connectedDevices = devicesStr ? parseInt(devicesStr) : null

            // Start progress 10%
            const startProgress = '10'

            const updateData: Record<string, unknown> = {
                syncStatus: startProgress,
                syncDate: new Date(),
            }

            if (version) updateData.version = version.substring(0, 200)
            if (uptime) updateData.uptime = uptime
            if (temperature !== null && !isNaN(temperature)) updateData.temperature = temperature
            if (connectedDevices !== null && !isNaN(connectedDevices) && connectedDevices >= 0) {
                updateData.connectedDevices = connectedDevices
            }
            if (model) updateData.model = model

            await oltRepository.update(oltId, updateData)
            emitProgress(10, 'OLT basic data synced')

            console.log(`[OltSyncService] OLT data synced, progress: 10%`)

            // Sync ONUs
            if (olt.type?.toLowerCase().includes('c300') && olt.snmpConnected && olt.snmpCommunityWrite) {
                console.log(`[OltSyncService] Starting ONU sync for OLT ${olt.name}...`)

                const onProgress = async (percentage: number) => {
                    let totalProgress: number
                    if (percentage >= 100) {
                        totalProgress = 100
                    } else {
                        // Range: 10% (OLT) sampai 99% (sebelum final)
                        // Formula: 10 + (percentage / 95) * 89 = 10% sampai 99%
                        totalProgress = Math.min(99, 10 + Math.floor((percentage / 95) * 89))
                    }

                    await oltRepository.update(oltId, {
                        syncStatus: totalProgress.toString(),
                    })
                    emitProgress(totalProgress, `Syncing ONUs: ${percentage}%`)
                }

                const onuCount = await syncOnuDataByOltId(oltId, onProgress)

                // Final verification
                const onuRepo = new OnuRepository()
                const finalOnuCount = await onuRepo.countByOltId(oltId)

                await new Promise(resolve => setTimeout(resolve, 500))

                if (finalOnuCount > 0 && finalOnuCount >= onuCount * 0.95) {
                    const currentOlt = await oltRepository.findById(oltId)
                    const currentProgress = currentOlt?.syncStatus ? parseInt(currentOlt.syncStatus, 10) : 0

                    if (currentProgress < 100) {
                        await oltRepository.update(oltId, { syncStatus: '100' })
                        emitProgress(100, 'Sync completed')
                    }
                } else {
                    await oltRepository.update(oltId, { syncStatus: '99' })
                    emitProgress(99, 'Sync incomplete (verification failed)')
                }

            } else {
                await oltRepository.update(oltId, { syncStatus: '100' })
                emitProgress(100, 'Sync completed (No ONUs to sync)')
            }

            // Final event emit for reload
            if (this.io) {
                this.io.emit('olt:updated', { id: oltId })
            }

            console.log(`[OltSyncService] Background sync completed for OLT ${olt.name}`)

        } catch (error: unknown) {
            console.error(`[OltSyncService] Error:`, error)
            try {
                await oltRepository.update(oltId, { syncStatus: '0' })
                const message = error instanceof Error ? error.message : String(error)
                emitProgress(0, `Error: ${message}`)
            } catch (_e) {
                console.error(`[OltSyncService] Failed to update error status`)
            }
        }
    }
}

// Singleton helper
export const getOltSyncService = () => OltSyncService.getInstance()
