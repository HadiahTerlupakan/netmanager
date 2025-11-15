/**
 * SNMP Trap Receiver Service
 * Menerima notifikasi real-time dari OLT ketika ada event
 * 
 * Events yang di-handle:
 * - ONU Up/Down
 * - Temperature Alert
 * - Power Loss
 * - Authentication Failed
 */

import snmp from 'net-snmp'
import { getOnuRepository } from '@/lib/repositories'
import { logger } from '@/lib/logger'

// SNMP Trap OIDs untuk ZTE OLT
const TRAP_OIDS = {
  // ONU State Change
  onuStateChange: '1.3.6.1.4.1.3902.1012.3.50.12.1.1.1',
  
  // ONU Status
  onuStatus: {
    los: '1.3.6.1.4.1.3902.1012.3.28.2.1.4', // Loss of Signal
    online: '1.3.6.1.4.1.3902.1012.3.28.2.1.4',
    dyingGasp: '1.3.6.1.4.1.3902.1012.3.50.12.1.1.21', // Power loss
  },
  
  // Temperature Alert
  temperatureHigh: '1.3.6.1.4.1.3902.1012.3.50.12.1.1.19',
  
  // Authentication
  authFailed: '1.3.6.1.4.1.3902.1012.3.28.1.1.12',
}

let trapReceiver: any = null
let isRunning = false

/**
 * Start SNMP Trap Receiver
 * @param port - Port untuk menerima SNMP trap (default: 162)
 */
export function startSnmpTrapReceiver(port: number = 162): void {
  if (isRunning) {
    logger.warn('[SNMP-TRAP] Receiver already running')
    return
  }

  try {
    // Create trap listener
    trapReceiver = snmp.createReceiver(
      {
        port,
        disableAuthorization: false, // Set true jika tidak pakai auth
      },
      (error, notification) => {
        if (error) {
          logger.error('[SNMP-TRAP] Error receiving trap:', error)
          return
        }

        handleTrapNotification(notification)
      }
    )

    isRunning = true
    logger.info(`[SNMP-TRAP] Receiver started on port ${port}`)
    logger.info('[SNMP-TRAP] Listening for ONU events from OLTs...')
  } catch (error: any) {
    logger.error('[SNMP-TRAP] Failed to start receiver:', error)
    throw error
  }
}

/**
 * Stop SNMP Trap Receiver
 */
export function stopSnmpTrapReceiver(): void {
  if (trapReceiver) {
    try {
      trapReceiver.close()
      trapReceiver = null
      isRunning = false
      logger.info('[SNMP-TRAP] Receiver stopped')
    } catch (error: any) {
      logger.error('[SNMP-TRAP] Error stopping receiver:', error)
    }
  }
}

/**
 * Check if receiver is running
 */
export function isSnmpTrapReceiverRunning(): boolean {
  return isRunning
}

/**
 * Handle incoming SNMP trap notification
 */
async function handleTrapNotification(notification: any): Promise<void> {
  try {
    const { pdu, rinfo } = notification
    
    logger.info(`[SNMP-TRAP] Received trap from ${rinfo.address}:${rinfo.port}`)
    logger.debug('[SNMP-TRAP] PDU:', {
      type: pdu.type,
      varbinds: pdu.varbinds?.length || 0,
    })

    // Parse trap data
    const trapData = parseTrapData(pdu, rinfo.address)
    
    if (!trapData) {
      logger.warn('[SNMP-TRAP] Unable to parse trap data')
      return
    }

    logger.info('[SNMP-TRAP] Parsed trap:', trapData)

    // Handle based on event type
    await handleTrapEvent(trapData)
  } catch (error: any) {
    logger.error('[SNMP-TRAP] Error handling notification:', error)
  }
}

/**
 * Parse SNMP trap PDU to extract useful data
 */
function parseTrapData(pdu: any, sourceIp: string): TrapData | null {
  try {
    const trapData: TrapData = {
      sourceIp,
      timestamp: new Date(),
      eventType: 'unknown',
      onu: null,
      details: {},
    }

    // Parse varbinds
    if (pdu.varbinds && Array.isArray(pdu.varbinds)) {
      for (const varbind of pdu.varbinds) {
        const oid = varbind.oid
        const value = varbind.value

        logger.debug(`[SNMP-TRAP] Varbind: ${oid} = ${value}`)

        // Detect event type based on OID
        if (oid.includes('1.3.6.1.4.1.3902.1012.3.28.2.1.4')) {
          // ONU Status change
          const statusValue = parseInt(String(value))
          trapData.eventType = getEventTypeFromStatus(statusValue)
          trapData.onu = extractOnuFromOid(oid)
        } else if (oid.includes('1.3.6.1.4.1.3902.1012.3.50.12.1.1.19')) {
          // Temperature
          trapData.eventType = 'temperature_alert'
          trapData.details.temperature = parseFloat(String(value))
        } else if (oid.includes('1.3.6.1.4.1.3902.1012.3.50.12.1.1.21')) {
          // Dying Gasp (Power loss)
          trapData.eventType = 'dying_gasp'
        }

        // Store all varbinds for reference
        trapData.details[oid] = value
      }
    }

    return trapData
  } catch (error: any) {
    logger.error('[SNMP-TRAP] Error parsing trap data:', error)
    return null
  }
}

/**
 * Get event type from ONU status value
 */
function getEventTypeFromStatus(statusValue: number): TrapEventType {
  // Status values: 1=LOS, 3=Online, 4=DyingGasp, 6=OffLine
  switch (statusValue) {
    case 1:
      return 'onu_los'
    case 3:
      return 'onu_online'
    case 4:
      return 'dying_gasp'
    case 6:
      return 'onu_offline'
    default:
      return 'unknown'
  }
}

/**
 * Extract ONU info from OID
 * Format: ...{PON_ID}.{ONU_ID}
 */
function extractOnuFromOid(oid: string): OnuInfo | null {
  try {
    const parts = oid.split('.')
    const onuId = parts[parts.length - 1]
    const ponId = parts[parts.length - 2]
    
    return {
      ponId: parseInt(ponId),
      onuId: parseInt(onuId),
    }
  } catch (error) {
    return null
  }
}

/**
 * Handle trap event - update database, send alert, etc
 */
async function handleTrapEvent(trapData: TrapData): Promise<void> {
  try {
    const onuRepo = getOnuRepository()

    switch (trapData.eventType) {
      case 'onu_los':
        logger.warn(`[SNMP-TRAP] ONU LOS detected from ${trapData.sourceIp}`)
        // TODO: Update ONU status to LOS in database
        // TODO: Send alert notification
        break

      case 'onu_online':
        logger.info(`[SNMP-TRAP] ONU came online from ${trapData.sourceIp}`)
        // TODO: Update ONU status to Online in database
        // TODO: Clear alert if any
        break

      case 'onu_offline':
        logger.warn(`[SNMP-TRAP] ONU went offline from ${trapData.sourceIp}`)
        // TODO: Update ONU status to OffLine in database
        break

      case 'dying_gasp':
        logger.error(`[SNMP-TRAP] Dying Gasp detected from ${trapData.sourceIp}`)
        // TODO: Update ONU status to DyingGasp
        // TODO: Send urgent alert
        break

      case 'temperature_alert':
        logger.warn(`[SNMP-TRAP] Temperature alert from ${trapData.sourceIp}: ${trapData.details.temperature}°C`)
        // TODO: Update temperature in database
        // TODO: Send alert if threshold exceeded
        break

      default:
        logger.debug(`[SNMP-TRAP] Unknown event type: ${trapData.eventType}`)
    }

    // Store trap event to database for history
    // TODO: Create TrapEvent model and save to database
  } catch (error: any) {
    logger.error('[SNMP-TRAP] Error handling trap event:', error)
  }
}

// Types
export type TrapEventType = 
  | 'onu_online' 
  | 'onu_offline' 
  | 'onu_los' 
  | 'dying_gasp' 
  | 'temperature_alert' 
  | 'auth_failed'
  | 'unknown'

export interface OnuInfo {
  ponId: number
  onuId: number
}

export interface TrapData {
  sourceIp: string
  timestamp: Date
  eventType: TrapEventType
  onu: OnuInfo | null
  details: Record<string, any>
}

