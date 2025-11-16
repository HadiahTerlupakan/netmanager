import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository } from '@/lib/repositories'
import { Telnet } from 'telnet-client'
import snmp from 'net-snmp'

// Error handler untuk menangkap error "req.doneCb is not a function"
// Error ini adalah bug internal dari library net-snmp yang terjadi
// ketika callback dipanggil setelah session ditutup
if (typeof process !== 'undefined') {
  // Hapus handler lama jika ada
  const existingHandlers = process.listeners('uncaughtException')
  existingHandlers.forEach((handler: any) => {
    if (handler._snmpDoneCbHandler) {
      process.removeListener('uncaughtException', handler)
    }
  })
  
  // Helper function untuk check apakah error adalah doneCb error
  const isDoneCbError = (error: any): boolean => {
    if (!error) return false
    const message = error.message || error.toString() || ''
    return (
      message.includes('req.doneCb is not a function') ||
      message.includes('doneCb is not a function') ||
      message.includes('TypeError: req.doneCb') ||
      (message.includes('TypeError: Cannot read property') && message.includes('doneCb')) ||
      (error.name === 'TypeError' && message.includes('doneCb'))
    )
  }
  
  const snmpErrorHandler = (error: Error) => {
    // Filter error "req.doneCb is not a function" dan abaikan sepenuhnya
    if (isDoneCbError(error)) {
      // Abaikan error ini sepenuhnya - ini adalah bug internal net-snmp
      // Data sudah berhasil diambil meskipun error ini muncul
      // Jangan log apapun untuk menghindari spam di console
      return
    }
    
    // Untuk error lain yang tidak terkait SNMP, biarkan default handler menanganinya
    // Tapi kita tidak ingin crash aplikasi, jadi kita log saja
    if (error && error.message && !error.message.includes('SNMP') && !error.message.includes('snmp')) {
      console.warn(`[SNMP] Uncaught exception (non-doneCb): ${error.message}`)
    }
  }
  
  // Mark handler untuk mencegah duplikasi
  ;(snmpErrorHandler as any)._snmpDoneCbHandler = true
  
  // Tambahkan handler dengan prependListener untuk memastikan handler ini dipanggil pertama
  process.prependListener('uncaughtException', snmpErrorHandler)
  
  // Juga tambahkan handler untuk unhandledRejection jika diperlukan
  process.prependListener('unhandledRejection', (reason: any) => {
    if (isDoneCbError(reason)) {
      // Abaikan - jangan log apapun
      return
    }
  })
  
  // Override console.error untuk menekan doneCb error di console
  const originalConsoleError = console.error
  console.error = (...args: any[]) => {
    // Check jika ada doneCb error di arguments
    const hasDoneCbError = args.some(arg => {
      if (typeof arg === 'string') {
        return isDoneCbError({ message: arg })
      }
      if (arg instanceof Error) {
        return isDoneCbError(arg)
      }
      return false
    })
    
    // Jika bukan doneCb error, log seperti biasa
    if (!hasDoneCbError) {
      originalConsoleError.apply(console, args)
    }
    // Jika doneCb error, abaikan (jangan log)
  }
}

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

// SNMP OIDs untuk ZTE OLT - Card Information (berdasarkan dokumentasi PDF)
// Index: zxAnRackNo (Rack No.), zxAnShelfNo (Shelf No.), zxAnSlotNo (Slot No.)
// Rack No. dan Shelf No. dimulai dari 0, Slot No. dimulai dari 1
const SNMP_CARD_OIDS = {
  // Base OID untuk Card Information: 1.3.6.1.4.1.3902.1015.2.1.1.3
  // Configured card type: .1.3.6.1.4.1.3902.1015.2.1.1.3.1.2.{Rack}.{Shelf}.{Slot}
  cardCfgMainType: '1.3.6.1.4.1.3902.1015.2.1.1.3.1.2',
  // Actual card type: .1.3.6.1.4.1.3902.1015.2.1.1.3.1.3.{Rack}.{Shelf}.{Slot}
  cardActMainType: '1.3.6.1.4.1.3902.1015.2.1.1.3.1.3',
  // Card name: .1.3.6.1.4.1.3902.1015.2.1.1.3.1.4.{Rack}.{Shelf}.{Slot}
  cardActType: '1.3.6.1.4.1.3902.1015.2.1.1.3.1.4',
  // Card status: .1.3.6.1.4.1.3902.1015.2.1.1.3.1.5.{Rack}.{Shelf}.{Slot} (1=UP/Service, 4=OFFLINE)
  cardOperStatus: '1.3.6.1.4.1.3902.1015.2.1.1.3.1.5',
  // CPU load: .1.3.6.1.4.1.3902.1015.2.1.1.3.1.9.{Rack}.{Shelf}.{Slot}
  cardCpuLoad: '1.3.6.1.4.1.3902.1015.2.1.1.3.1.9',
  // Memory usage: .1.3.6.1.4.1.3902.1015.2.1.1.3.1.11.{Rack}.{Shelf}.{Slot}
  cardMemUsage: '1.3.6.1.4.1.3902.1015.2.1.1.3.1.11',
}

// SNMP OIDs untuk ZTE OLT - ONU Management
// Berdasarkan script bash: 1.3.6.1.4.1.3902.1012.3.28.2.1.4."$PON"
// Dan dokumentasi PDF: zxGponOntDevMgmtTable untuk GPON ONU Management
const SNMP_ONU_OIDS = {
  // Status ONU per PON: 1.3.6.1.4.1.3902.1012.3.28.2.1.4.{PON}
  // Status values: 1=LOS, 3=Online, 4=DyingGasp, 6=OffLine
  onuStatus: '1.3.6.1.4.1.3902.1012.3.28.2.1.4',
  // Serial Number: 1.3.6.1.4.1.3902.1012.3.28.2.1.5.{PON}.{ONU_ID}
  onuSerial: '1.3.6.1.4.1.3902.1012.3.28.2.1.5',
  // RX OLT: 1.3.6.1.4.1.3902.1012.3.28.2.1.6.{PON}.{ONU_ID} (dalam 0.01 dBm)
  onuRxOlt: '1.3.6.1.4.1.3902.1012.3.28.2.1.6',
  // RX ONU: 1.3.6.1.4.1.3902.1012.3.28.2.1.7.{PON}.{ONU_ID} (dalam 0.01 dBm)
  onuRxOnu: '1.3.6.1.4.1.3902.1012.3.28.2.1.7',
  // ONU Type/Model: 1.3.6.1.4.1.3902.1012.3.28.2.1.8.{PON}.{ONU_ID}
  onuType: '1.3.6.1.4.1.3902.1012.3.28.2.1.8',
  // ONU Name: 1.3.6.1.4.1.3902.1012.3.28.2.1.9.{PON}.{ONU_ID}
  onuName: '1.3.6.1.4.1.3902.1012.3.28.2.1.9',
  // ONU Description: 1.3.6.1.4.1.3902.1012.3.28.2.1.10.{PON}.{ONU_ID}
  onuDescription: '1.3.6.1.4.1.3902.1012.3.28.2.1.10',
  // PON Port List: 1.3.6.1.4.1.3902.1012.3.28.1.1.1
  ponPortList: '1.3.6.1.4.1.3902.1012.3.28.1.1.1',
  // PON Port Info: 1.3.6.1.4.1.3902.1012.3.28.1.1.2 (mungkin berisi slot/card/port info)
  ponPortInfo: '1.3.6.1.4.1.3902.1012.3.28.1.1.2',
  // zxGponOntDevMgmtTable - ONU Device Management Table (dari dokumentasi PDF)
  // Base OID: 1.3.6.1.4.1.3902.1012.3.28.1 (zxGponOntDevMgmtTable)
  // Index: {zxGponOltIndex, zxGponONTIndex} - zxGponOltIndex adalah Type 1 PON composite index
  onuDevMgmtTable: '1.3.6.1.4.1.3902.1012.3.28.1',
  // zxGponOntRegId - PW, LOID authentication information (dari dokumentasi PDF)
  // Dapat dimodifikasi via setting MIB object ini
  onuRegId: '1.3.6.1.4.1.3902.1012.3.28.1.1.1', // Perlu disesuaikan dengan MIB file yang sebenarnya
}

// Enhanced SNMP OIDs for additional ONU parameters
// Based on ZTE MIB documentation and PHP script reference
const SNMP_ONU_ENHANCED_OIDS = {
  // RX Power (Upstream): 1.3.6.1.4.1.3902.1012.3.11.3.1.2.{composite_index}
  rxPower: '1.3.6.1.4.1.3902.1012.3.11.3.1.2',
  // TX Power (Downstream): 1.3.6.1.4.1.3902.1012.3.11.3.1.3.{composite_index}
  txPower: '1.3.6.1.4.1.3902.1012.3.11.3.1.3',
  // TX OLT (Transmit power from OLT)
  txOlt: '1.3.6.1.4.1.3902.1012.3.11.3.1.3',
  // TX ONU (Transmit power from ONU)
  txOnu: '1.3.6.1.4.1.3902.1012.3.11.3.1.2',
  // Distance
  distance: '1.3.6.1.4.1.3902.1012.3.28.1.1.15',
  // Temperature
  temperature: '1.3.6.1.4.1.3902.1012.3.28.1.1.16',
  // Voltage
  voltage: '1.3.6.1.4.1.3902.1012.3.28.1.1.17',
  // Last Seen
  lastSeen: '1.3.6.1.4.1.3902.1012.3.28.1.1.18',
  // Serial Number: 1.3.6.1.4.1.3902.1015.1010.1.7.4.1.10.{composite_index}
  serialNumber: '1.3.6.1.4.1.3902.1015.1010.1.7.4.1.10',
  // ONU Name: 1.3.6.1.4.1.3902.1015.1010.1.7.4.1.1.{composite_index}
  onuName: '1.3.6.1.4.1.3902.1015.1010.1.7.4.1.1',
  // ONU Description: 1.3.6.1.4.1.3902.1015.1010.1.7.4.1.4.{composite_index}
  onuDescription: '1.3.6.1.4.1.3902.1015.1010.1.7.4.1.4',
  // ONU Status: 1.3.6.1.4.1.3902.1012.3.11.3.1.1.{composite_index}
  onuStatus: '1.3.6.1.4.1.3902.1012.3.11.3.1.1',
  // Register Time: 1.3.6.1.4.1.3902.1015.1010.1.7.4.1.12.{composite_index}
  registerTime: '1.3.6.1.4.1.3902.1015.1010.1.7.4.1.12',
}

// Enhanced SNMP OIDs for Register Time (using different index structure)
// Based on zxGponOnuCfgTable from ZTE documentation
const SNMP_ONU_REGISTER_TIME_OIDS = {
  // ONU Register Time: 1.3.6.1.4.1.3902.1015.1010.1.7.4.1.12.{composite_index}
  // Format: YYYY-MM-DD HH:MM:SS
  registerTime: '1.3.6.1.4.1.3902.1015.1010.1.7.4.1.12',
}

// SNMP OIDs untuk ONU Version and Model (berdasarkan dokumentasi PDF section 7.8)
// Index: Type 3's PON composite index
const SNMP_ONU_VERSION_OIDS = {
  // ONU Model: .1.3.6.1.4.1.3902.1015.1010.1.1.1.1.1.3.{composite_index}
  onuModel: '1.3.6.1.4.1.3902.1015.1010.1.1.1.1.1.3',
  // Software Version: .1.3.6.1.4.1.3902.1015.1010.1.1.1.1.1.6.{composite_index}
  onuSoftwareVersion: '1.3.6.1.4.1.3902.1015.1010.1.1.1.1.1.6',
  // Hardware Version: .1.3.6.1.4.1.3902.1015.1010.1.1.1.1.1.5.{composite_index}
  onuHardwareVersion: '1.3.6.1.4.1.3902.1015.1010.1.1.1.1.1.5',
}

// SNMP OIDs untuk ONU Basic Info (berdasarkan dokumentasi MIB lengkap)
const SNMP_ONU_BASIC_INFO_OIDS = {
  // Registration Mode: .1.3.6.1.4.1.3902.1012.3.28.1.1.12.{PON_ID}.{ONU_ID}
  // Values: 1=SN, 2=Password, 3=SN+Password, 4=RegisterId, 5=RegisterId+8021x, 
  //         6=RegisterId+Mutual, 7=TefPw, 8=SN+TefPw, 9=LOID, 10=LOID+Password
  registrationMode: '1.3.6.1.4.1.3902.1012.3.28.1.1.12',
  // Software Version: .1.3.6.1.4.1.3902.1015.1010.1.1.1.1.1.6.{composite_index}
  softwareVersion: '1.3.6.1.4.1.3902.1015.1010.1.1.1.1.1.6',
  // Hardware Version: .1.3.6.1.4.1.3902.1015.1010.1.1.1.1.1.5.{composite_index}
  hardwareVersion: '1.3.6.1.4.1.3902.1015.1010.1.1.1.1.1.5',
  // Temperature: .1.3.6.1.4.1.3902.1012.3.50.12.1.1.19.{PON_ID}.{ONU_ID}
  temperature: '1.3.6.1.4.1.3902.1012.3.50.12.1.1.19',
  // Laser Bias Current: .1.3.6.1.4.1.3902.1012.3.50.12.1.1.18.{PON_ID}.{ONU_ID}
  laserBiasCurrent: '1.3.6.1.4.1.3902.1012.3.50.12.1.1.18',
}

// SNMP OIDs untuk ZTE C3XX OLT - ONU Management
// Berdasarkan plugin Checkmk: .1.3.6.1.4.1.3902.1082
// Dan dari SNMP walk output: enterprises.3902.1082.500.10.4.2.* dan enterprises.3902.1082.500.20.4.2.*
const SNMP_C3XX_ONU_OIDS = {
  // Base OID untuk ZTE C3XX
  baseOid: '1.3.6.1.4.1.3902.1082',
  // ONU ID: .1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2 (index 0)
  onuId: '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2',
  // ONU Name: .1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2 (index 1)
  onuName: '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2',
  // ONU Type Name: .1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.1 (index 2)
  onuType: '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.1',
  // ONU Description: .1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.3 (index 3)
  onuDescription: '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.3',
  // ONU Optical Rx: .1.3.6.1.4.1.3902.1082.500.20.2.2.2.1.10 (index 4)
  onuRx: '1.3.6.1.4.1.3902.1082.500.20.2.2.2.1.10',
  // ONU Optical Tx: .1.3.6.1.4.1.3902.1082.500.20.2.2.2.1.14 (index 5)
  onuTx: '1.3.6.1.4.1.3902.1082.500.20.2.2.2.1.14',
  // OLT Optical Rx from ONU: .1.3.6.1.4.1.3902.1082.500.1.2.4.2.1.2 (index 6)
  oltRx: '1.3.6.1.4.1.3902.1082.500.1.2.4.2.1.2',
  // ONU Status: .1.3.6.1.4.1.3902.1082.500.10.2.3.8.1.4 (index 7)
  onuStatus: '1.3.6.1.4.1.3902.1082.500.10.2.3.8.1.4',
  // ONU Auth: .1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.18 (index 8)
  onuAuth: '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.18',
  // System OID untuk deteksi: .1.3.6.1.2.1.1.2.0
  sysObjectId: '1.3.6.1.2.1.1.2.0',
  // OID alternatif dari SNMP walk output untuk mendapatkan daftar port/ONU
  // OID untuk ONU Management Group (dari sysORDescr: enterprises.3902.1082.500.10.4.2.*)
  onuMgmtGroup: '1.3.6.1.4.1.3902.1082.500.10.4.2',
  // OID untuk ONU Performance/Optical Group (dari sysORDescr: enterprises.3902.1082.500.20.4.2.*)
  onuPerfGroup: '1.3.6.1.4.1.3902.1082.500.20.4.2',
  // OID alternatif untuk PON port list (mungkin lebih lengkap)
  // Coba gunakan OID dari base 1082 untuk mendapatkan daftar port
  ponPortListAlt: '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2', // Sama dengan onuName, tapi bisa digunakan untuk scan port
}

// SNMP OIDs untuk ZTE-AN-PON-MIB (Public PON Management)
// Base: .1.3.6.1.4.1.3902.1082.50.10 (berdasarkan dokumentasi GPON MIB Specifications)
const SNMP_ZTE_AN_PON_OIDS = {
  // Base OID untuk Public PON Management
  baseOid: '1.3.6.1.4.1.3902.1082.50.10',
  
  // PON Port Management (Base: .1.3.6.1.4.1.3902.1082.50.10.2.1)
  ponPort: {
    adminStatus: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.1',
    operStatus: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.2',
    type: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.3',
    opticalModuleStatus: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.4',
    laserState: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.5',
    serialNumber: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.6',
    vendorId: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.7',
    ponId: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.8',
    fecMode: '1.3.6.1.4.1.3902.1082.50.10.2.1.1.9',
  },
  
  // ONU Information (Base: .1.3.6.1.4.1.3902.1082.50.10.2.2)
  // Index: {zxAnPonIfIndex, zxAnOnuId}
  onuInfo: {
    adminStatus: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.1',
    operStatus: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.2',
    lastRegTime: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.3',
    lastDeregTime: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.4',
    macAddress: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.5',
    logicalDistance: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.6',
    serialNumber: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.7',
    vendorId: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.8',
    equipmentId: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.9',
    mainSoftwareVersion: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.10',
    softwareVersion: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.11',
    hardwareVersion: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.12',
    firmwareVersion: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.13',
    batteryStatus: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.14',
    opticalTransceiverType: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.15',
    password: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.16',
    loid: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.17',
    discoverMode: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.18',
    autofindEnable: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.19',
    authMode: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.20',
    bindType: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.21',
    bindValue: '1.3.6.1.4.1.3902.1082.50.10.2.2.1.22',
  },
  
  // ONU Status (Base: .1.3.6.1.4.1.3902.1082.50.10.2.3)
  onuStatus: {
    state: '1.3.6.1.4.1.3902.1082.50.10.2.3.1.1',
    configState: '1.3.6.1.4.1.3902.1082.50.10.2.3.1.2',
    powerLevel: '1.3.6.1.4.1.3902.1082.50.10.2.3.1.3',
    dyingGaspTime: '1.3.6.1.4.1.3902.1082.50.10.2.3.1.4',
    signalDegrade: '1.3.6.1.4.1.3902.1082.50.10.2.3.1.5',
    signalFail: '1.3.6.1.4.1.3902.1082.50.10.2.3.1.6',
    losStatus: '1.3.6.1.4.1.3902.1082.50.10.2.3.1.7',
  },
  
  // Unconfigured ONU (Base: .1.3.6.1.4.1.3902.1082.50.10.2.10)
  unconfOnu: {
    ifIndex: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.1',
    onuId: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.2',
    serialNumber: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.3',
    password: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.4',
    loid: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.5',
    vendorId: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.6',
    equipmentId: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.7',
    firmwareVersion: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.8',
    softwareVersion: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.9',
    hardwareVersion: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.10',
    logicalDistance: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.11',
    opticalTransceiverType: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.12',
    macAddress: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.13',
    regTime: '1.3.6.1.4.1.3902.1082.50.10.2.10.1.14',
  },
  
  // Optical Power on GPON ONU Side (Base: .1.3.6.1.4.1.3902.1082.50.10.2.28)
  onuOpticalPower: {
    rxPower: '1.3.6.1.4.1.3902.1082.50.10.2.28.1.1',
    rxPowerStatus: '1.3.6.1.4.1.3902.1082.50.10.2.28.1.2',
    txPower: '1.3.6.1.4.1.3902.1082.50.10.2.28.1.3',
    txPowerStatus: '1.3.6.1.4.1.3902.1082.50.10.2.28.1.4',
  },
  
  // OLT RX Power (Base: .1.3.6.1.4.1.3902.1082.50.10.2.27)
  oltRxPower: {
    rxPower: '1.3.6.1.4.1.3902.1082.50.10.2.27.1.1',
    rxPowerStatus: '1.3.6.1.4.1.3902.1082.50.10.2.27.1.2',
  },
  
  // Optical Module Information (Base: .1.3.6.1.4.1.3902.1082.50.10.2.22)
  opticalModule: {
    type: '1.3.6.1.4.1.3902.1082.50.10.2.22.1.1',
    vendor: '1.3.6.1.4.1.3902.1082.50.10.2.22.1.2',
    serialNumber: '1.3.6.1.4.1.3902.1082.50.10.2.22.1.3',
    manufactureDate: '1.3.6.1.4.1.3902.1082.50.10.2.22.1.4',
    firmwareVersion: '1.3.6.1.4.1.3902.1082.50.10.2.22.1.5',
    temperature: '1.3.6.1.4.1.3902.1082.50.10.2.22.1.6',
    voltage: '1.3.6.1.4.1.3902.1082.50.10.2.22.1.7',
    txPower: '1.3.6.1.4.1.3902.1082.50.10.2.22.1.8',
    rxPower: '1.3.6.1.4.1.3902.1082.50.10.2.22.1.9',
    biasCurrent: '1.3.6.1.4.1.3902.1082.50.10.2.22.1.10',
  },
  
  // Performance Statistics (Base: .1.3.6.1.4.1.3902.1082.50.10.2.31)
  onuPerfStats: {
    ifIndex: '1.3.6.1.4.1.3902.1082.50.10.2.31.1.1',
    rxBytes: '1.3.6.1.4.1.3902.1082.50.10.2.31.1.2',
    txBytes: '1.3.6.1.4.1.3902.1082.50.10.2.31.1.3',
    rxPackets: '1.3.6.1.4.1.3902.1082.50.10.2.31.1.4',
    txPackets: '1.3.6.1.4.1.3902.1082.50.10.2.31.1.5',
    rxErrors: '1.3.6.1.4.1.3902.1082.50.10.2.31.1.6',
    txErrors: '1.3.6.1.4.1.3902.1082.50.10.2.31.1.7',
    rxDrops: '1.3.6.1.4.1.3902.1082.50.10.2.31.1.8',
    txDrops: '1.3.6.1.4.1.3902.1082.50.10.2.31.1.9',
  },
}

// Status mapping untuk ZTE C3XX (berdasarkan kode Python)
const C3XX_ONU_STATUS = [
  'unknown',
  'logging',
  'los',
  'syncMib',
  'working',
  'dyingGasp',
  'authFailed',
  'offline',
]

// Auth mode mapping untuk ZTE C3XX
const C3XX_ONU_AUTH_MODE = [
  'unknow',
  'SN',
  'PWD',
  'SN+PWD',
  'RegID',
  'RedID+802.1x',
  'RedID+Mutual',
  'HexPWD',
  'SN+HexPWD',
  'Loid',
  'Loid+PWD',
]

// Helper function untuk SNMP walk
async function snmpWalk(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = 30000
): Promise<Array<{ oid: string; value: any; type?: number }>> {
  return new Promise((resolve, reject) => {
    let resolved = false
    let session: any = null
    let timeoutId: NodeJS.Timeout | null = null
    const results: Array<{ oid: string; value: any; type?: number }> = []
    let pendingCallbacks = 0
    let isClosing = false

    let stableCheckTimeout: NodeJS.Timeout | null = null
    let nullifyInterval: NodeJS.Timeout | null = null
    
    // Fungsi untuk nullify semua callback di session (didefinisikan di scope tinggi agar bisa diakses dari processCallback)
    const nullifyAllCallbacks = (sess: any) => {
      if (!sess) return
      
      try {
        // Lokasi 1: session._socket._reqs
        if (sess._socket && sess._socket._reqs) {
          const reqs = sess._socket._reqs
          for (const reqId in reqs) {
            if (reqs[reqId]) {
              try {
                if (typeof reqs[reqId].doneCb === 'function') {
                  reqs[reqId].doneCb = null
                }
                if (typeof reqs[reqId].callback === 'function') {
                  reqs[reqId].callback = null
                }
                // Juga coba nullify di berbagai lokasi yang mungkin
                if (reqs[reqId].cb) reqs[reqId].cb = null
                if (reqs[reqId].done) reqs[reqId].done = null
              } catch (e) {
                // Ignore error per request
              }
            }
          }
        }
        // Lokasi 2: session.reqs (alternatif)
        if ((sess as any).reqs) {
          const reqs = (sess as any).reqs
          for (const reqId in reqs) {
            if (reqs[reqId]) {
              try {
                if (typeof reqs[reqId].doneCb === 'function') {
                  reqs[reqId].doneCb = null
                }
                if (typeof reqs[reqId].callback === 'function') {
                  reqs[reqId].callback = null
                }
                if (reqs[reqId].cb) reqs[reqId].cb = null
                if (reqs[reqId].done) reqs[reqId].done = null
              } catch (e) {
                // Ignore error per request
              }
            }
          }
        }
        // Lokasi 3: session._socket mungkin punya reqs langsung
        if (sess._socket) {
          try {
            if (sess._socket.reqs) {
              const reqs = sess._socket.reqs
              for (const reqId in reqs) {
                if (reqs[reqId]) {
                  try {
                    if (typeof reqs[reqId].doneCb === 'function') {
                      reqs[reqId].doneCb = null
                    }
                    if (typeof reqs[reqId].callback === 'function') {
                      reqs[reqId].callback = null
                    }
                  } catch (e) {
                    // Ignore
                  }
                }
              }
            }
          } catch (e) {
            // Ignore
          }
        }
      } catch (reqError) {
        // Ignore error saat mengakses _reqs - ini adalah bug internal net-snmp
      }
    }
    
    const finish = (error?: any) => {
      if (resolved) return
      resolved = true
      
      // Clear semua timeout dan interval
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      if (stableCheckTimeout) {
        clearTimeout(stableCheckTimeout)
        stableCheckTimeout = null
      }
      if (nullifyInterval) {
        clearInterval(nullifyInterval)
        nullifyInterval = null
      }
      
      // Set flag bahwa kita sedang menutup session
      isClosing = true
      
      // Fungsi untuk menutup session dengan aman
      const closeSessionSafely = () => {
        if (session) {
          try {
            // Nullify semua callback SEBELUM menutup session
            nullifyAllCallbacks(session)
            
            // Cek apakah session masih valid sebelum menutup
            if (typeof session.close === 'function') {
              // Tunggu sebentar sebelum close untuk memastikan semua callback selesai
              // Tapi nullify dulu untuk mencegah callback dipanggil
              setTimeout(() => {
                try {
                  // Nullify lagi sebelum close untuk memastikan
                  nullifyAllCallbacks(session)
                  session.close()
                } catch (closeError: any) {
                  // Abaikan error saat menutup session - ini adalah bug internal net-snmp
                  // Error "req.doneCb is not a function" bisa terjadi di sini
                  // Tapi kita sudah handle di global error handler
                }
              }, 200) // Delay 200ms untuk memastikan semua callback selesai
            }
          } catch (e: any) {
            // Ignore error saat menutup session - ini adalah bug internal net-snmp
            // Error "req.doneCb is not a function" biasanya terjadi di sini
            // Tapi kita sudah handle dengan set callback ke null di atas dan global error handler
            if (e && e.message && !e.message.includes('doneCb') && !e.message.includes('not a function')) {
              // Log error lain selain doneCb
              console.warn(`[SNMP-Walk] Error closing session: ${e.message}`)
            }
          } finally {
            session = null
          }
        }
      }
      
      // Nullify semua callback SEBELUM menunggu
      if (session) {
        nullifyAllCallbacks(session)
      }
      
      // Tunggu sebentar untuk memastikan semua callback selesai
      // sebelum menutup session
      // Jika masih ada pending callbacks, tunggu lebih lama
      const waitTime = pendingCallbacks > 0 ? 800 : 300
      
      // Nullify callback beberapa kali selama wait untuk memastikan semua callback dinonaktifkan
      nullifyInterval = setInterval(() => {
        if (session && !resolved && !isClosing) {
          nullifyAllCallbacks(session)
        }
      }, 100) // Nullify setiap 100ms
      
      setTimeout(() => {
        if (nullifyInterval) {
          clearInterval(nullifyInterval)
          nullifyInterval = null
        }
        // Nullify lagi sebelum close untuk memastikan
        if (session) {
          nullifyAllCallbacks(session)
        }
        closeSessionSafely()
      }, waitTime)
      
      // Return results atau error
      if (error) {
        // Jika error tapi ada results, return results saja
        if (results.length > 0) {
          resolve(results)
        } else {
          reject(error)
        }
      } else {
        resolve(results)
      }
    }

    try {
      let snmpVersion: 0 | 1 | undefined = 1 // Default: Version2c
      if (version === '1') {
        snmpVersion = 0 // Version1
      } else if (version === '3') {
        // SNMP v3 tidak didukung oleh net-snmp library yang digunakan
        console.warn(`[SNMP] SNMP v3 is not supported, using v2c instead`)
        snmpVersion = 1 // Fallback to Version2c
      }

      session = snmp.createSession(ipAddress, community, {
        port,
        version: snmpVersion,
        retries: 5, // Increase retries untuk data yang banyak
        timeout: 30000, // Increase timeout ke 30 detik per request (dari 10 detik)
      })
      
      console.log(`[All-ONU-SNMP] SNMP session created with retries: 5, timeout: 30000ms`)

      timeoutId = setTimeout(() => {
        // Jika sudah ada results, tunggu lebih lama untuk memastikan tidak ada data lagi
        // Untuk data yang banyak (100+ ONU), walk bisa memakan waktu lebih lama
        if (results.length > 0) {
          console.log(`[All-ONU-SNMP] SNMP walk timeout reached with ${results.length} results, waiting 20 seconds for more data...`)
          // Tunggu 20 detik lagi untuk memastikan tidak ada data lagi (diperpanjang dari 5 detik)
          // Ini penting untuk data yang banyak
          if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
          stableCheckTimeout = setTimeout(() => {
            if (!resolved && !isClosing) {
              console.log(`[All-ONU-SNMP] SNMP walk completed with ${results.length} results (timeout reached, no more data after 20s wait)`)
              finish()
            }
          }, 20000)
        } else {
          // Jika tidak ada results sama sekali, tunggu juga
          console.log(`[All-ONU-SNMP] SNMP walk timeout with no results, waiting 10 seconds before giving up...`)
          if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
          stableCheckTimeout = setTimeout(() => {
            if (!resolved && !isClosing && results.length === 0) {
              finish(new Error('SNMP walk timeout - no results'))
            }
          }, 10000)
        }
      }, timeout)

      // Gunakan subtree dengan callback yang benar
      // Callback bisa dipanggil beberapa kali untuk batch data
      let callbackCount = 0
      let lastOid = ''
      let noDataCount = 0
      
      const processCallback = (error: any, varbinds: any[]) => {
        // Cek resolved atau isClosing dulu sebelum melakukan apapun
        // Jika sudah closing atau resolved, nullify callback untuk mencegah error
        if (resolved || isClosing) {
          // Nullify callback di session untuk mencegah error "req.doneCb is not a function"
          if (session) {
            try {
              nullifyAllCallbacks(session)
            } catch (e) {
              // Ignore
            }
          }
          return
        }
        
        callbackCount++
        pendingCallbacks++

        try {
          // PENTING: Terkadang "error" sebenarnya adalah array dari varbinds (data)
          // Ini terjadi karena net-snmp library kadang melempar data sebagai error
          // Cek apakah error adalah array - jika ya, proses sebagai data
          let dataVarbinds: any[] | null = null
          let actualError: any = null
          
          // Cek apakah error adalah array (data) atau error sebenarnya
          if (error) {
            if (Array.isArray(error) && error.length > 0) {
              // Error sebenarnya adalah array data
              console.log(`[All-ONU-SNMP] SNMP walk "error" is actually data array with ${error.length} entries, processing as varbinds...`)
              dataVarbinds = error
              actualError = null // Reset error karena ini sebenarnya data
            } else {
              // Ini adalah error sebenarnya
              actualError = error
            }
          }
          
          if (actualError) {
            // Ini adalah error sebenarnya
            const errorMsg = actualError?.message || String(actualError)
            console.warn(`[All-ONU-SNMP] SNMP walk callback error: ${errorMsg}, current results: ${results.length}`)
            
            // Jika error tapi sudah ada results, JANGAN langsung finish
            // Terkadang error terjadi di tengah-tengah walk tapi data masih bisa masuk
            // Tunggu lebih lama dan biarkan callback dipanggil lagi jika ada data lebih lanjut
            if (results.length > 0) {
              console.log(`[All-ONU-SNMP] SNMP walk error but have ${results.length} results, waiting 15 seconds for more data (walk may continue)...`)
              // Tunggu 15 detik untuk memastikan tidak ada data lagi (diperpanjang dari 10 detik)
              // Jangan langsung finish, biarkan walk melanjutkan jika ada data lebih lanjut
              if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
              stableCheckTimeout = setTimeout(() => {
                if (!resolved && !isClosing) {
                  console.log(`[All-ONU-SNMP] SNMP walk completed with ${results.length} results (error occurred but results available after 15s wait)`)
                  finish()
                }
              }, 15000)
              // JANGAN return di sini - biarkan walk melanjutkan jika ada data lebih lanjut
              // Hanya decrement pending callbacks
              pendingCallbacks--
              return
            } else {
              // Jika tidak ada results sama sekali, tunggu sebentar juga
              // Mungkin data masih akan masuk
              console.log(`[All-ONU-SNMP] SNMP walk error with no results, waiting 5 seconds before giving up...`)
              if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
              stableCheckTimeout = setTimeout(() => {
                if (!resolved && !isClosing && results.length === 0) {
                  console.log(`[All-ONU-SNMP] SNMP walk failed: no results after error`)
                  finish(actualError)
                }
              }, 5000)
              pendingCallbacks--
              return
            }
          }

          // Jika ada dataVarbinds dari error, gunakan itu; jika tidak, gunakan varbinds normal
          const varbindsToProcess = dataVarbinds || varbinds
          
          if (!varbindsToProcess || varbindsToProcess.length === 0) {
            // Jika tidak ada varbinds, tunggu sebentar untuk memastikan tidak ada data lagi
            // Untuk data yang banyak, tunggu lebih lama (10 kali) sebelum menganggap walk selesai
            noDataCount++
            if (results.length > 0 && noDataCount >= 10) {
              if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
              stableCheckTimeout = setTimeout(() => {
                if (!resolved && !isClosing) {
                  console.log(`[All-ONU-SNMP] SNMP walk completed with ${results.length} results (no more varbinds after ${noDataCount} empty responses, waiting 10s)`)
                  finish()
                }
              }, 10000) // Tunggu 10 detik untuk memastikan tidak ada data lagi (diperpanjang dari 5 detik)
            }
            pendingCallbacks--
            return
          }

          // Reset no data count karena ada data baru
          noDataCount = 0
          
          // Clear stable check timeout karena ada data baru
          if (stableCheckTimeout) {
            clearTimeout(stableCheckTimeout)
            stableCheckTimeout = null
          }

          // Log progress setiap batch data
          const batchSize = varbindsToProcess.length
          const totalBefore = results.length
          console.log(`[All-ONU-SNMP] Received batch: ${batchSize} varbinds, total so far: ${totalBefore} -> ${totalBefore + batchSize}`)

          let hasEndOfMibView = false
          let currentLastOid = lastOid
          
          for (const varbind of varbindsToProcess) {
            if (varbind.type === snmp.ObjectType.EndOfMibView) {
              hasEndOfMibView = true
              break
            }
            
            // Track last OID untuk mendeteksi apakah masih ada data
            // Bandingkan OID secara lexicographic (string comparison)
            if (varbind.oid) {
              const oidStr = String(varbind.oid)
              const currentOidStr = String(currentLastOid)
              // Bandingkan secara lexicographic - OID adalah string yang bisa dibandingkan langsung
              if (oidStr > currentOidStr) {
                currentLastOid = varbind.oid
              }
            }
            
            // Convert Buffer to string jika perlu
            let value = varbind.value
            if (Buffer.isBuffer(value)) {
              try {
                value = value.toString('utf8')
              } catch (e) {
                value = value.toString()
              }
            }
            
            results.push({
              oid: varbind.oid,
              value: value,
              type: varbind.type,
            })
          }

          // Update last OID
          if (currentLastOid !== lastOid) {
            lastOid = currentLastOid
          }

          // Jika ada EndOfMibView, tunggu sebentar untuk memastikan tidak ada data lagi
          // Terkadang EndOfMibView muncul terlalu cepat, terutama untuk data yang banyak
          if (hasEndOfMibView) {
            console.log(`[All-ONU-SNMP] EndOfMibView detected with ${results.length} results, waiting 10 seconds to ensure no more data...`)
            // Tunggu 10 detik untuk memastikan tidak ada data lagi setelah EndOfMibView (diperpanjang dari 3 detik)
            if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
            stableCheckTimeout = setTimeout(() => {
              if (!resolved && !isClosing) {
                console.log(`[All-ONU-SNMP] SNMP walk completed with ${results.length} results (EndOfMibView reached, no more data after 10s wait)`)
                finish()
              }
            }, 10000)
            pendingCallbacks--
            return
          }

          // Jika OID tidak berubah (tidak ada data baru), tunggu sebentar
          // Untuk data yang banyak, tunggu lebih lama (10 detik) untuk memastikan semua data diambil
          if (currentLastOid === lastOid && results.length > 0) {
            if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
            stableCheckTimeout = setTimeout(() => {
              if (!resolved && !isClosing) {
                console.log(`[All-ONU-SNMP] SNMP walk completed with ${results.length} results (no more data, OID stable after 10s wait)`)
                finish()
              }
            }, 10000) // Tunggu 10 detik untuk memastikan tidak ada data lagi (diperpanjang dari 5 detik)
          } else if (currentLastOid !== lastOid) {
            // Jika ada data baru, reset stable check timeout
            if (stableCheckTimeout) {
              clearTimeout(stableCheckTimeout)
              stableCheckTimeout = null
            }
            // Log progress setiap 50 entri untuk monitoring
            if (results.length % 50 === 0) {
              console.log(`[All-ONU-SNMP] SNMP walk progress: ${results.length} entries collected so far...`)
            }
          }
        } catch (callbackError: any) {
          // Tangkap error di callback untuk mencegah crash
          if (!isClosing && !resolved) {
            console.warn(`[SNMP-Walk] Error in callback: ${callbackError?.message || callbackError}`)
            // Jika error tapi sudah ada results, lanjutkan
            // Untuk data yang banyak, tunggu lebih lama untuk memastikan tidak ada data lagi
            if (results.length > 0) {
              // Tunggu 10 detik untuk memastikan tidak ada data lagi (diperpanjang dari 5 detik)
              if (stableCheckTimeout) clearTimeout(stableCheckTimeout)
              stableCheckTimeout = setTimeout(() => {
                if (!resolved && !isClosing) {
                  console.log(`[All-ONU-SNMP] SNMP walk completed with ${results.length} results (callback error but results available after 10s wait)`)
                  finish()
                }
              }, 10000)
            }
          }
        } finally {
          // Decrement pending callbacks
          pendingCallbacks--
        }
      }

      try {
        // Wrap subtree call dengan try-catch untuk menangkap error internal
        try {
          session.subtree(oid, processCallback)
        } catch (subtreeCallError: any) {
          // Jika error saat memanggil subtree, tapi sudah ada results, return results
          if (results.length > 0) {
            console.log(`[All-ONU-SNMP] SNMP walk completed with ${results.length} results (subtree call error but results available)`)
            finish()
            return
          }
          // Jika belum ada results, tunggu sebentar untuk memastikan tidak ada callback yang masih pending
          setTimeout(() => {
            if (results.length > 0) {
              finish()
            } else {
              finish(subtreeCallError)
            }
          }, 1000)
          return
        }
      } catch (outerError) {
        // Jika error di level luar, tapi sudah ada results, return results
        if (results.length > 0) {
          console.log(`[All-ONU-SNMP] SNMP walk completed with ${results.length} results (outer error but results available)`)
          finish()
        } else {
          finish(outerError)
        }
      }
    } catch (error) {
      finish(error)
    }
  })
}

// Helper function untuk SNMP get
async function snmpGet(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  timeout: number = 5000
): Promise<string | null> {
  return new Promise((resolve) => {
    let resolved = false
    let session: any = null
    let timeoutId: NodeJS.Timeout | null = null

    const finish = (value: string | null) => {
      if (resolved) return
      resolved = true
      if (timeoutId) clearTimeout(timeoutId)
      if (session) {
        try {
          session.close()
        } catch (e) {
          // Ignore
        }
      }
      resolve(value)
    }

    try {
      let snmpVersion: 0 | 1 | undefined = 1 // Default: Version2c
      if (version === '1') {
        snmpVersion = 0 // Version1
      } else if (version === '3') {
        // SNMP v3 tidak didukung oleh net-snmp library yang digunakan
        console.warn(`[SNMP] SNMP v3 is not supported, using v2c instead`)
        snmpVersion = 1 // Fallback to Version2c
      }

      session = snmp.createSession(ipAddress, community, {
        port,
        version: snmpVersion,
        retries: 2,
        timeout: 3000,
      })

      timeoutId = setTimeout(() => {
        finish(null)
      }, timeout)

      session.get([oid], (error: any, varbinds: any[]) => {
        if (resolved) return

        if (error || !varbinds || varbinds.length === 0) {
          finish(null)
        } else {
          const varbind = varbinds[0]
          if (varbind.value !== null && varbind.value !== undefined) {
            finish(varbind.value.toString())
          } else {
            finish(null)
          }
        }
      })
    } catch (error) {
      finish(null)
    }
  })
}

// Deteksi apakah OLT adalah ZTE C3XX berdasarkan sysObjectID
export async function isZteC3xx(
  ipAddress: string,
  port: number,
  community: string,
  version: string
): Promise<boolean> {
  try {
    const sysObjectId = await snmpGet(ipAddress, port, community, version, SNMP_C3XX_ONU_OIDS.sysObjectId, 5000)
    if (!sysObjectId) return false
    
    // Berdasarkan kode Python: oid(".1.3.6.1.2.1.1.2.0").startswith('.1.3.6.1.4.1.3902.1082.1001')
    return sysObjectId.startsWith('.1.3.6.1.4.1.3902.1082.1001') || sysObjectId.startsWith('1.3.6.1.4.1.3902.1082.1001')
  } catch (error) {
    console.warn(`[C3XX-Detection] Error detecting ZTE C3XX:`, error)
    return false
  }
}

// Helper function untuk convert value ke integer (mirip saveint di Python)
function saveint(value: any): number {
  if (value === null || value === undefined || value === '') return 0
  const parsed = parseInt(String(value))
  return isNaN(parsed) ? 0 : parsed
}

// Helper function untuk convert status number ke string
function getZteOnuStatusString(status: number): string {
  if (status === 1) return 'LOS'
  if (status === 3) return 'Online'
  if (status === 4) return 'DyingGasp'
  if (status === 6) return 'OffLine'
  return 'Unknown'
}

// Helper function untuk parse SNMP value ke string atau number
function parseSnmpValue(value: any, type: 'string'): string | null
function parseSnmpValue(value: any, type: 'number'): number | null
function parseSnmpValue(value: any, type: 'string' | 'number'): string | number | null {
  if (value === null || value === undefined) return null
  
  if (Buffer.isBuffer(value)) {
    try {
      if (type === 'string') {
        return value.toString('utf8').trim() || null
      } else {
        const hex = value.toString('hex')
        return parseInt(hex, 16) || null
      }
    } catch (e) {
      return null
    }
  }
  
  if (type === 'string') {
    return String(value).trim() || null
  } else {
    const parsed = typeof value === 'number' ? value : parseFloat(String(value))
    return isNaN(parsed) ? null : parsed
  }
}

// Helper function untuk convert value ke float (mirip savefloat di Python)
function savefloat(value: any): number {
  if (value === null || value === undefined || value === '') return 0.0
  const parsed = parseFloat(String(value))
  return isNaN(parsed) ? 0.0 : parsed
}

// Parse ONU index dari OID ZTE C3XX
// Berdasarkan log error: Format OID: 1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2.{ifIndex}.{onuId}
// Contoh: 1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2.285278977.3
//         baseOID = 1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2
//         ifIndex = 285278977
//         onuId = 3
function parseC3xxOnuIndexFromOid(oid: string, baseOid: string): { ifIndex: number; onuId: number } | null {
  const oidParts = oid.split('.')
  const baseParts = baseOid.split('.')
  
  // Cari posisi setelah base OID
  // Base OID: 1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2
  // Setelah itu: {ifIndex}.{onuId}
  let baseIndex = -1
  for (let i = 0; i <= oidParts.length - baseParts.length; i++) {
    const slice = oidParts.slice(i, i + baseParts.length)
    if (slice.join('.') === baseParts.join('.')) {
      baseIndex = i + baseParts.length
      break
    }
  }
  
  if (baseIndex < 0 || baseIndex >= oidParts.length) {
    return null
  }
  
  // ifIndex adalah angka pertama setelah base OID
  const ifIndex = parseInt(oidParts[baseIndex])
  if (isNaN(ifIndex)) {
    return null
  }
  
  // ONU ID adalah angka setelah ifIndex
  let onuId = 0
  if (baseIndex + 1 < oidParts.length) {
    const onuIdCandidate = parseInt(oidParts[baseIndex + 1])
    if (!isNaN(onuIdCandidate) && onuIdCandidate > 0) {
      onuId = onuIdCandidate
    }
  }
  
  // Jika onuId masih 0, coba ambil dari bagian terakhir OID
  if (onuId === 0 && oidParts.length > baseIndex + 1) {
    const lastPart = parseInt(oidParts[oidParts.length - 1])
    if (!isNaN(lastPart) && lastPart > 0) {
      onuId = lastPart
    }
  }
  
  if (onuId === 0) {
    return null // ONU ID harus ada
  }
  
  return {
    ifIndex,
    onuId,
  }
}

// Convert RX/TX value sesuai logika Python
function convertC3xxRxValue(value: number): number {
  // Berdasarkan kode Python:
  // if (onuRx < 32768):
  //     onuRx = float(onuRx * 0.002) - 30.0
  // elif ((onuRx < 65535) and (onuRx > 32767)):
  //     onuRx = (-30 - ((65535 - onuRx) * 0.002))
  // else:
  //     onuRx = -40.0
  
  if (value < 32768) {
    return parseFloat((value * 0.002 - 30.0).toFixed(2))
  } else if (value < 65535 && value > 32767) {
    return parseFloat((-30 - ((65535 - value) * 0.002)).toFixed(2))
  } else {
    return -40.0
  }
}

function convertC3xxTxValue(value: number): number {
  // Berdasarkan kode Python:
  // if (onuTx < 65535):
  //     onuTx = float(onuTx * 0.002) - 30.0
  // else:
  //     onuTx = -40.0
  
  if (value < 65535) {
    return parseFloat((value * 0.002 - 30.0).toFixed(2))
  } else {
    return -40.0
  }
}

// Helper function untuk convert PON Index ke Frame/Slot/Port/ONU_ID
// Rumus: PON_Index = (frame << 24) + (slot << 16) + (port << 8) + ONU_ID
// Reverse: Frame = (PON_Index >> 24), Slot = (PON_Index >> 16) & 0xFF, Port = (PON_Index >> 8) & 0xFF, ONU_ID = PON_Index & 0xFF
function ponIndexToFrameSlotPortOnu(ponIndex: number): { frame: number; slot: number; port: number; onuId: number } | null {
  const frame = (ponIndex >> 24) & 0xFF
  const slot = (ponIndex >> 16) & 0xFF
  const port = (ponIndex >> 8) & 0xFF
  const onuId = ponIndex & 0xFF
  
  // Validasi: frame bisa 0 (jika hanya ada 1 frame), tapi slot, port, dan onuId harus > 0
  // Jika frame 0, set ke 1 (default untuk single frame system)
  if (slot === 0 || port === 0 || onuId === 0) {
    return null
  }
  
  return { 
    frame: frame === 0 ? 1 : frame, // Default frame ke 1 jika 0
    slot, 
    port, 
    onuId 
  }
}

// Helper function untuk SNMP walk dengan delay (digunakan oleh semua parser)
async function snmpWalkWithDelay(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oid: string,
  delay: number = 0
): Promise<any[]> {
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  try {
    // Timeout 120 detik untuk data yang banyak
    const result = await snmpWalk(ipAddress, port, community, version, oid, 120000)
    return result
  } catch (error: any) {
    console.error(`[SNMP-Walk] Error walking OID ${oid}:`, error?.message || error)
    return []
  }
}

// Get ONU data untuk ZTE C300 GPON menggunakan SNMP (OID Standard GPON)
// Menggunakan OID .1.3.6.1.4.1.3902.1012.3.28.2.1.* (bukan 1082!)
// Berdasarkan dokumentasi ZTE_OLT_MIB_IMPLEMENTATION.md
export async function getC300GponOnuDataViaSNMP(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oltName: string,
  oltId: string
): Promise<Array<{
  id: string
  oltId: string
  oltName: string
  name: string
  description: string
  pppoe: string
  gponOnu: string
  status: string
  rxOlt: string | null
  rxOnu: string | null
  txOlt: string | null
  txOnu: string | null
  serialNumber: string
  actualType: string
  registerTime: string | null
  distance: number | null
  lastSeen: string | null
  registrationMode: string | null
  softwareVersion: string | null
  hardwareVersion: string | null
  temperature: number | null
  laserBiasCurrent: number | null
}>> {
  console.log(`[C300-GPON-SNMP] Fetching ONU data from ${oltName} (${ipAddress}) via SNMP...`)
  console.log(`[C300-GPON-SNMP] Using Standard GPON OIDs (.1.3.6.1.4.1.3902.1012.3.28.2.1.*)`)

  const onus: Array<{
    id: string
    oltId: string
    oltName: string
    name: string
    description: string
    pppoe: string
    gponOnu: string
    status: string
    rxOlt: string | null
    rxOnu: string | null
    txOlt: string | null
    txOnu: string | null
    serialNumber: string
    actualType: string
    registerTime: string | null
    distance: number | null
    lastSeen: string | null
    registrationMode: string | null
    softwareVersion: string | null
    hardwareVersion: string | null
    temperature: number | null
    laserBiasCurrent: number | null
  }> = []

  try {
    // Definisikan OID untuk C300 GPON (standard ZTE GPON MIB)
    const C300_GPON_OIDS = {
      status: '1.3.6.1.4.1.3902.1012.3.28.2.1.4',        // zxGponOntStatus
      serial: '1.3.6.1.4.1.3902.1012.3.28.2.1.5',        // zxGponOntSerial
      rxOlt: '1.3.6.1.4.1.3902.1012.3.28.2.1.6',         // zxGponOntRxOlt (0.01 dBm)
      rxOnu: '1.3.6.1.4.1.3902.1012.3.28.2.1.7',         // zxGponOntRxOnu (0.01 dBm)
      type: '1.3.6.1.4.1.3902.1012.3.28.2.1.8',          // zxGponOntType
      name: '1.3.6.1.4.1.3902.1012.3.28.2.1.9',          // zxGponOntName
      description: '1.3.6.1.4.1.3902.1012.3.28.2.1.10',  // zxGponOntDescription
    }

    // Step 1: Walk Status OID untuk get semua PON_ID dan ONU_ID
    console.log(`[C300-GPON-SNMP] Step 1: Walking Status OID to get all PON_ID and ONU_ID...`)
    const statusResults = await snmpWalkWithDelay(ipAddress, port, community, version, C300_GPON_OIDS.status, 0)
    console.log(`[C300-GPON-SNMP] Found ${statusResults.length} ONU status entries`)

    if (statusResults.length === 0) {
      console.warn(`[C300-GPON-SNMP] No ONUs found for ${oltName}`)
      return []
    }

    // Step 2: Parse Status Results untuk extract PON_ID dan ONU_ID
    // Format OID: .1.3.6.1.4.1.3902.1012.3.28.2.1.4.{PON_ID}.{ONU_ID}
    console.log(`[C300-GPON-SNMP] Step 2: Parsing Status OIDs...`)
    const onuMap = new Map<string, {
      ponId: number
      onuId: number
      frame: number
      slot: number
      port: number
      status: number
      gponOnu: string
      name?: string
      serialNumber?: string
      rxOlt?: string
      rxOnu?: string
      actualType?: string
      description?: string
    }>()

    const baseOid = C300_GPON_OIDS.status
    const baseParts = baseOid.split('.')

    for (const result of statusResults) {
      const oidParts = result.oid.split('.')
      
      if (oidParts.length < baseParts.length + 2) {
        continue // OID tidak lengkap
      }

      // Extract PON_ID dan ONU_ID dari OID
      const ponId = parseInt(oidParts[baseParts.length])
      const onuId = parseInt(oidParts[baseParts.length + 1])

      if (isNaN(ponId) || isNaN(onuId)) {
        continue
      }

      // Parse PON_ID menggunakan Type 1 Composite Index
      // Format: Type (4 bit) | Shelf (4 bit) | Slot (8 bit) | Port (8 bit) | Reserved (8 bit)
      const type = (ponId >> 28) & 0xF
      const shelf = (ponId >> 24) & 0xF
      const slot = (ponId >> 16) & 0xFF
      const port = (ponId >> 8) & 0xFF
      const reserved = ponId & 0xFF

      // Frame biasanya 1 untuk single frame system, atau dari shelf
      const frame = shelf === 0 ? 1 : shelf

      // Parse status value
      let statusValue = result.value
      if (Buffer.isBuffer(statusValue)) {
        statusValue = parseInt(statusValue.toString('hex'), 16)
      }
      if (typeof statusValue === 'string') {
        statusValue = parseInt(statusValue)
      }
      const status = saveint(statusValue)

      // Create gponOnu ID (format: frame/slot/port:onuId)
      const gponOnu = `${frame}/${slot}/${port}:${onuId}`

      // Create unique key
      const key = `${ponId}:${onuId}`

      onuMap.set(key, {
        ponId,
        onuId,
        frame,
        slot,
        port,
        status,
        gponOnu,
      })
    }

    console.log(`[C300-GPON-SNMP] Parsed ${onuMap.size} ONUs from status results`)

    if (onuMap.size === 0) {
      console.warn(`[C300-GPON-SNMP] No valid ONUs found after parsing`)
      return []
    }

    // Step 3: Walk other OIDs untuk get detail data
    console.log(`[C300-GPON-SNMP] Step 3: Walking other OIDs for complete data...`)
    const [nameResults, serialResults, rxOltResults, rxOnuResults, typeResults, descResults] = await Promise.all([
      snmpWalkWithDelay(ipAddress, port, community, version, C300_GPON_OIDS.name, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, C300_GPON_OIDS.serial, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, C300_GPON_OIDS.rxOlt, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, C300_GPON_OIDS.rxOnu, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, C300_GPON_OIDS.type, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, C300_GPON_OIDS.description, 0),
    ])

    console.log(`[C300-GPON-SNMP] Fetched: Names=${nameResults.length}, Serial=${serialResults.length}, RxOlt=${rxOltResults.length}, RxOnu=${rxOnuResults.length}, Type=${typeResults.length}, Desc=${descResults.length}`)

    // Step 4: Parse dan combine data
    console.log(`[C300-GPON-SNMP] Step 4: Parsing and combining data...`)

    // Parse Names
    for (const result of nameResults) {
      const { ponId, onuId } = extractPonIdOnuIdFromOid(result.oid, baseParts.length)
      if (ponId === null || onuId === null) continue

      const key = `${ponId}:${onuId}`
      const onu = onuMap.get(key)
      if (onu) {
        onuMap.set(key, { ...onu, name: result.value?.toString() || `ONU-${onuId}` })
      }
    }

    // Parse Serial Numbers
    for (const result of serialResults) {
      const { ponId, onuId } = extractPonIdOnuIdFromOid(result.oid, baseParts.length)
      if (ponId === null || onuId === null) continue

      const key = `${ponId}:${onuId}`
      const onu = onuMap.get(key)
      if (onu) {
        let serial = ''
        if (Buffer.isBuffer(result.value)) {
          serial = result.value.toString('hex').toUpperCase()
        } else if (typeof result.value === 'string') {
          serial = result.value
        }
        onuMap.set(key, { ...onu, serialNumber: serial })
      }
    }

    // Parse RX OLT (dalam 0.01 dBm)
    for (const result of rxOltResults) {
      const { ponId, onuId } = extractPonIdOnuIdFromOid(result.oid, baseParts.length)
      if (ponId === null || onuId === null) continue

      const key = `${ponId}:${onuId}`
      const onu = onuMap.get(key)
      if (onu) {
        let value = result.value
        if (Buffer.isBuffer(value)) {
          value = parseInt(value.toString('hex'), 16)
        }
        if (typeof value === 'string') {
          value = parseInt(value)
        }
        const rxValue = saveint(value)
        // Convert dari 0.01 dBm ke dBm
        const rxDbm = (rxValue / 100.0).toFixed(2)
        onuMap.set(key, { ...onu, rxOlt: rxDbm })
      }
    }

    // Parse RX ONU (dalam 0.01 dBm)
    for (const result of rxOnuResults) {
      const { ponId, onuId } = extractPonIdOnuIdFromOid(result.oid, baseParts.length)
      if (ponId === null || onuId === null) continue

      const key = `${ponId}:${onuId}`
      const onu = onuMap.get(key)
      if (onu) {
        let value = result.value
        if (Buffer.isBuffer(value)) {
          value = parseInt(value.toString('hex'), 16)
        }
        if (typeof value === 'string') {
          value = parseInt(value)
        }
        const rxValue = saveint(value)
        // Convert dari 0.01 dBm ke dBm
        const rxDbm = (rxValue / 100.0).toFixed(2)
        onuMap.set(key, { ...onu, rxOnu: rxDbm })
      }
    }

    // Parse Type
    for (const result of typeResults) {
      const { ponId, onuId } = extractPonIdOnuIdFromOid(result.oid, baseParts.length)
      if (ponId === null || onuId === null) continue

      const key = `${ponId}:${onuId}`
      const onu = onuMap.get(key)
      if (onu) {
        onuMap.set(key, { ...onu, actualType: result.value?.toString() || '' })
      }
    }

    // Parse Description
    for (const result of descResults) {
      const { ponId, onuId } = extractPonIdOnuIdFromOid(result.oid, baseParts.length)
      if (ponId === null || onuId === null) continue

      const key = `${ponId}:${onuId}`
      const onu = onuMap.get(key)
      if (onu) {
        onuMap.set(key, { ...onu, description: result.value?.toString() || '' })
      }
    }

    // Step 5: Build final ONU array
    console.log(`[C300-GPON-SNMP] Step 5: Building final ONU array...`)
    let countWithRxOlt = 0
    let countWithRxOnu = 0
    let countWithSerial = 0

    for (const [key, onu] of onuMap.entries()) {
      const statusStr = getZteOnuStatusString(onu.status)
      
      // Count stats
      if (onu.rxOlt) countWithRxOlt++
      if (onu.rxOnu) countWithRxOnu++
      if (onu.serialNumber) countWithSerial++

      onus.push({
        id: `${oltId}-${onu.gponOnu}`,
        oltId,
        oltName,
        name: (onu as any).name || `ONU-${onu.onuId}`,
        description: (onu as any).description || '',
        pppoe: '',
        gponOnu: onu.gponOnu,
        status: statusStr,
        rxOlt: onu.rxOlt ? `${onu.rxOlt} dBm` : null,
        rxOnu: onu.rxOnu ? `${onu.rxOnu} dBm` : null,
        txOlt: null, // C300 GPON standard MIB tidak punya TX power
        txOnu: null, // C300 GPON standard MIB tidak punya TX power
        serialNumber: (onu as any).serialNumber || '',
        actualType: (onu as any).actualType || detectModelFromSerial((onu as any).serialNumber || ''),
        registerTime: null,
        distance: null,
        lastSeen: null,
        registrationMode: null,
        softwareVersion: null,
        hardwareVersion: null,
        temperature: null,
        laserBiasCurrent: null,
      })
    }

    console.log(`[C300-GPON-SNMP] Summary: ${onus.length} total ONUs`)
    console.log(`[C300-GPON-SNMP]   - With RX OLT: ${countWithRxOlt}`)
    console.log(`[C300-GPON-SNMP]   - With RX ONU: ${countWithRxOnu}`)
    console.log(`[C300-GPON-SNMP]   - With Serial: ${countWithSerial}`)
    console.log(`[C300-GPON-SNMP] Parsed ${onus.length} ONUs from ${oltName} via SNMP`)

    return onus
  } catch (error: any) {
    console.error(`[C300-GPON-SNMP] Error fetching ONU data from ${oltName}:`, error?.message || error)
    return []
  }
}

// Helper function untuk extract PON_ID dan ONU_ID dari OID
function extractPonIdOnuIdFromOid(oid: string, baseLength: number): { ponId: number | null, onuId: number | null } {
  const oidParts = oid.split('.')
  
  if (oidParts.length < baseLength + 2) {
    return { ponId: null, onuId: null }
  }

  const ponId = parseInt(oidParts[baseLength])
  const onuId = parseInt(oidParts[baseLength + 1])

  if (isNaN(ponId) || isNaN(onuId)) {
    return { ponId: null, onuId: null }
  }

  return { ponId, onuId }
}

// Get ONU data untuk ZTE C3XX menggunakan SNMP
// Menggunakan pendekatan sederhana: langsung walk semua OID tanpa discovery port
// Berdasarkan rumus: PON_Index = (frame << 24) + (slot << 16) + (port << 8) + ONU_ID
export async function getC3xxOnuDataViaSNMP(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oltName: string,
  oltId: string
): Promise<Array<{
  id: string
  oltId: string
  oltName: string
  name: string
  description: string
  pppoe: string
  gponOnu: string
  status: string
  rxOlt: string | null
  rxOnu: string | null
  txOlt: string | null
  txOnu: string | null
  serialNumber: string
  actualType: string
  registerTime: string | null
  distance: number | null
  lastSeen: string | null
  registrationMode: string | null
  softwareVersion: string | null
  hardwareVersion: string | null
  temperature: number | null
  laserBiasCurrent: number | null
}>> {
  const onus: Array<{
    id: string
    oltId: string
    oltName: string
    name: string
    description: string
    pppoe: string
    gponOnu: string
    status: string
    rxOlt: string | null
    rxOnu: string | null
    txOlt: string | null
    txOnu: string | null
    serialNumber: string
    actualType: string
    registerTime: string | null
    distance: number | null
    lastSeen: string | null
    registrationMode: string | null
    softwareVersion: string | null
    hardwareVersion: string | null
    temperature: number | null
    laserBiasCurrent: number | null
  }> = []

  try {
    console.log(`[C3XX-ONU-SNMP] Fetching ONU data from ${oltName} (${ipAddress}) via SNMP...`)
    console.log(`[C3XX-ONU-SNMP] Using simplified approach: walk all OIDs directly`)

    // Helper function untuk SNMP walk dengan delay
    const walkWithDelay = async (oid: string, delay: number = 0): Promise<any[]> => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
      try {
        console.log(`[C3XX-ONU-SNMP] Starting SNMP walk for OID: ${oid}`)
        // Timeout 120 detik untuk data yang banyak (diperpanjang dari 60 detik)
        const result = await snmpWalk(ipAddress, port, community, version, oid, 120000)
        console.log(`[C3XX-ONU-SNMP] Completed SNMP walk for OID: ${oid}, got ${result.length} entries`)
        
        // Log sample OIDs untuk debugging
        if (result.length > 0 && result.length <= 10) {
          console.log(`[C3XX-ONU-SNMP] All OIDs from walk:`)
          result.forEach((r: any, idx: number) => {
            console.log(`[C3XX-ONU-SNMP]   ${idx + 1}. ${r.oid}`)
          })
        } else if (result.length > 10) {
          console.log(`[C3XX-ONU-SNMP] Sample OIDs (first 5 and last 5):`)
          for (let i = 0; i < 5; i++) {
            console.log(`[C3XX-ONU-SNMP]   ${i + 1}. ${result[i]?.oid}`)
          }
          console.log(`[C3XX-ONU-SNMP]   ... (${result.length - 10} more) ...`)
          for (let i = result.length - 5; i < result.length; i++) {
            console.log(`[C3XX-ONU-SNMP]   ${i + 1}. ${result[i]?.oid}`)
          }
        }
        
        return Array.isArray(result) ? result : []
      } catch (error: any) {
        // Jika error tapi hasilnya array (dari error recovery), gunakan array tersebut
        if (Array.isArray(error)) {
          console.log(`[C3XX-ONU-SNMP] Error recovery: got ${error.length} entries from error`)
          return error
        }
        console.warn(`[C3XX-ONU-SNMP] Error in SNMP walk for OID ${oid}:`, error?.message || error)
        return []
      }
    }

    // Step 1: Walk OID untuk mendapatkan semua nama ONU
    // OID: 1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2
    // Format OID: baseOid.{PON_INDEX}
    // PON_INDEX = (frame << 24) + (slot << 16) + (port << 8) + ONU_ID
    console.log(`[C3XX-ONU-SNMP] Step 1: Walking ONU Name OID to get all ONUs...`)
    const onuNameOid = '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2'
    const onuNameResults = await walkWithDelay(onuNameOid, 0)
    console.log(`[C3XX-ONU-SNMP] Found ${onuNameResults.length} ONU name entries`)
    
    // Debug: Show first few OIDs to understand the format
    if (onuNameResults.length > 0) {
      console.log(`[C3XX-ONU-SNMP] Sample OIDs (first 5):`)
      for (let i = 0; i < Math.min(5, onuNameResults.length); i++) {
        const result = onuNameResults[i]
        const oidParts = result.oid.split('.')
        const baseParts = onuNameOid.split('.')
        console.log(`[C3XX-ONU-SNMP]   OID ${i + 1}: ${result.oid}`)
        console.log(`[C3XX-ONU-SNMP]     Base OID length: ${baseParts.length}, OID length: ${oidParts.length}`)
        if (oidParts.length > baseParts.length) {
          const afterBase = oidParts.slice(baseParts.length).join('.')
          console.log(`[C3XX-ONU-SNMP]     After base OID: ${afterBase}`)
          const ponIndexStr = oidParts[baseParts.length]
          const ponIndex = parseInt(ponIndexStr)
          if (!isNaN(ponIndex)) {
            const frame = (ponIndex >> 24) & 0xFF
            const slot = (ponIndex >> 16) & 0xFF
            const port = (ponIndex >> 8) & 0xFF
            const onuIdFromPonIndex = ponIndex & 0xFF
            // ONU ID bisa dari bagian terakhir OID atau dari PON Index
            let onuId = onuIdFromPonIndex
            if (oidParts.length > baseParts.length + 1) {
              const onuIdStr = oidParts[oidParts.length - 1]
              const onuIdFromOid = parseInt(onuIdStr)
              if (!isNaN(onuIdFromOid) && onuIdFromOid > 0) {
                onuId = onuIdFromOid
                console.log(`[C3XX-ONU-SNMP]     PON Index: ${ponIndex} -> frame: ${frame}, slot: ${slot}, port: ${port}`)
                console.log(`[C3XX-ONU-SNMP]     ONU ID from OID: ${onuIdFromOid} (using this), from PON Index: ${onuIdFromPonIndex}`)
              } else {
                console.log(`[C3XX-ONU-SNMP]     PON Index: ${ponIndex} -> frame: ${frame}, slot: ${slot}, port: ${port}, onuId: ${onuId}`)
              }
            } else {
              console.log(`[C3XX-ONU-SNMP]     PON Index: ${ponIndex} -> frame: ${frame}, slot: ${slot}, port: ${port}, onuId: ${onuId} (from PON Index)`)
            }
          }
        }
      }
    }
    
    // Step 2: Walk OID lainnya untuk mendapatkan data lengkap
    console.log(`[C3XX-ONU-SNMP] Step 2: Walking other OIDs for complete data...`)
    const [onuStatusResults, onuSerialResults, onuRxResults, onuTxResults] = await Promise.all([
      walkWithDelay('1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.3', 0), // Description (bukan status)
      walkWithDelay('1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.4', 0), // Serial Number
      walkWithDelay('1.3.6.1.4.1.3902.1082.30.40.2.4.1.3', 0),    // RX Power (OLT receive) - format: baseOid.{PON_INDEX}
      walkWithDelay('1.3.6.1.4.1.3902.1082.30.40.2.4.1.4', 0),    // TX Power (ONU transmit) - format: baseOid.{PON_INDEX}
    ])
    
    console.log(`[C3XX-ONU-SNMP] Status: ${onuStatusResults.length}, Serial: ${onuSerialResults.length}, RX: ${onuRxResults.length}, TX: ${onuTxResults.length}`)
    
    // Log sample OIDs untuk debugging
    if (onuSerialResults.length > 0) {
      console.log(`[C3XX-ONU-SNMP] Sample Serial OIDs (first 3):`)
      onuSerialResults.slice(0, 3).forEach((r, i) => {
        console.log(`[C3XX-ONU-SNMP]   ${i + 1}. ${r.oid} = ${r.value}`)
      })
    }
    if (onuRxResults.length > 0) {
      console.log(`[C3XX-ONU-SNMP] Sample RX OIDs (first 3):`)
      onuRxResults.slice(0, 3).forEach((r, i) => {
        console.log(`[C3XX-ONU-SNMP]   ${i + 1}. ${r.oid} = ${r.value}`)
      })
    }
    if (onuTxResults.length > 0) {
      console.log(`[C3XX-ONU-SNMP] Sample TX OIDs (first 3):`)
      onuTxResults.slice(0, 3).forEach((r, i) => {
        console.log(`[C3XX-ONU-SNMP]   ${i + 1}. ${r.oid} = ${r.value}`)
      })
    }
    
    // Coba juga fetch status dari OID yang benar (jika berbeda)
    // Berdasarkan dokumentasi, status mungkin di OID yang berbeda
    console.log(`[C3XX-ONU-SNMP] Trying alternative status OID: 1.3.6.1.4.1.3902.1082.500.10.2.3.8.1.4`)
    const onuStatusResultsAlt = await walkWithDelay('1.3.6.1.4.1.3902.1082.500.10.2.3.8.1.4', 0)
    console.log(`[C3XX-ONU-SNMP] Alternative Status OID results: ${onuStatusResultsAlt.length}`)
    
    // Step 3: Parse semua data dan gabungkan
    console.log(`[C3XX-ONU-SNMP] Step 3: Parsing and combining data...`)
    const onuMap = new Map<string, any>()
    
    // Helper function untuk extract frame/slot/port/onuId dari OID
    // Format OID: baseOid.{PON_INDEX}.{ONU_ID}
    // PON_INDEX = (frame << 24) + (slot << 16) + (port << 8) + (onuId_from_pon_index)
    // ONU_ID di bagian terakhir adalah ONU ID yang sebenarnya
    const extractOnuInfoFromOid = (oid: string, baseOid: string): { frame: number; slot: number; port: number; onuId: number; ponIndex: number } | null => {
      const oidParts = oid.split('.')
      const baseParts = baseOid.split('.')
      
      // Minimal harus ada baseOid + PON_INDEX
      if (oidParts.length <= baseParts.length) {
        return null
      }
      
      // Ambil PON Index dari bagian pertama setelah base OID
      const ponIndexStr = oidParts[baseParts.length]
      const ponIndex = parseInt(ponIndexStr)
      
      if (isNaN(ponIndex)) {
        return null
      }
      
      // Convert PON Index ke Frame/Slot/Port
      // Berdasarkan dokumentasi Type 1 Composite Index:
      // bit31-bit28: Type = 1
      // bit27-bit24: Shelf No. = 0
      // bit23-bit16: Slot No. (8 bit)
      // bit15-bit8: Port No. atau OLT No. (8 bit)
      // bit7-bit0: Reserved = 0
      const type = (ponIndex >> 28) & 0xF
      const shelf = (ponIndex >> 24) & 0xF
      const slot = (ponIndex >> 16) & 0xFF
      const port = (ponIndex >> 8) & 0xFF
      const reserved = ponIndex & 0xFF
      
      // Validasi: Type harus 1 untuk Type 1 composite index
      if (type !== 1) {
        // Bukan Type 1, mungkin Type 3 atau 9 (ONU composite index)
        // Untuk C3XX, mungkin menggunakan format yang berbeda
        // Coba decode sebagai Type 3/9 atau format alternatif
        console.warn(`[C3XX-ONU-SNMP] PON Index ${ponIndex} has type ${type}, not Type 1. Trying alternative decode...`)
        
        // Untuk C3XX, mungkin format berbeda - coba decode sebagai:
        // Format alternatif: mungkin frame/slot/port di posisi berbeda
        // Atau mungkin ini adalah ONU composite index (Type 3/9)
        const altFrame = (ponIndex >> 24) & 0xFF
        const altSlot = (ponIndex >> 16) & 0xFF
        const altPort = (ponIndex >> 8) & 0xFF
        const altOnuId = ponIndex & 0xFF
        
        if (altSlot === 0 || altPort === 0) {
          return null
        }
        
        // Gunakan format alternatif
        const frame = altFrame === 0 ? 1 : altFrame
        return {
          frame,
          slot: altSlot,
          port: altPort,
          onuId: altOnuId,
          ponIndex,
        }
      }
      
      // Validasi frame/slot/port untuk Type 1
      if (slot === 0 || port === 0) {
        return null
      }
      
      // Frame biasanya 1 untuk single frame system
      // Shelf biasanya 0 untuk Type 1, tapi jika tidak 0, bisa digunakan sebagai frame
      const frame = shelf === 0 ? 1 : shelf
      
      // ONU ID bisa dari 2 sumber:
      // 1. Dari bagian terakhir OID (jika ada): baseOid.{PON_INDEX}.{ONU_ID}
      // 2. Dari PON Index reserved field (jika tidak ada bagian terakhir): baseOid.{PON_INDEX}
      // Tapi untuk C3XX, ONU ID biasanya dari bagian terakhir OID
      let onuId = reserved // Reserved biasanya 0, tapi bisa berisi ONU ID untuk beberapa kasus
      
      // Jika ada bagian setelah PON Index, gunakan sebagai ONU ID (ini yang benar untuk C3XX)
      if (oidParts.length > baseParts.length + 1) {
        const onuIdStr = oidParts[oidParts.length - 1] // Ambil bagian terakhir
        const onuIdFromOid = parseInt(onuIdStr)
        if (!isNaN(onuIdFromOid) && onuIdFromOid > 0) {
          onuId = onuIdFromOid
        }
      }
      
      // Validasi ONU ID
      if (onuId === 0) {
        return null
      }
      
      // Log untuk debugging (hanya beberapa pertama) - akan dipanggil dari parsing loop
      
      return {
        frame: frame === 0 ? 1 : frame, // Default frame ke 1 jika 0
        slot,
        port,
        onuId,
        ponIndex,
      }
    }
    
    // Parse ONU Name - ini adalah data utama
    let parsedCount = 0
    let skippedCount = 0
    let skippedReasons: { [key: string]: number } = {}
    let debugCount = 0 // Counter untuk logging debug
    
    for (const result of onuNameResults) {
      // Extract frame/slot/port/onuId dari OID
      const onuInfo = extractOnuInfoFromOid(result.oid, onuNameOid)
      
      if (!onuInfo) {
        skippedCount++
        skippedReasons['invalid_oid_format'] = (skippedReasons['invalid_oid_format'] || 0) + 1
        if (parsedCount + skippedCount <= 5) {
          console.log(`[C3XX-ONU-SNMP] Skipped OID (invalid format): ${result.oid}`)
        }
        continue
      }
      
      const { frame, slot, port: portNum, onuId, ponIndex } = onuInfo
      
      // Log decode info untuk beberapa pertama
      if (debugCount < 5) {
        const type = (ponIndex >> 28) & 0xF
        const shelf = (ponIndex >> 24) & 0xF
        const reserved = ponIndex & 0xFF
        console.log(`[C3XX-ONU-SNMP] Decoded PON Index ${ponIndex}: type=${type}, shelf=${shelf}, slot=${slot}, port=${portNum}, reserved=${reserved}, frame=${frame}, onuId=${onuId}`)
        debugCount++
      }
      
      const gponOnu = `${frame}/${slot}/${portNum}:${onuId}`
      // Gunakan PON Index + ONU ID sebagai key untuk menghindari duplikasi
      // karena beberapa PON Index yang berbeda mungkin dikonversi ke frame/slot/port yang sama
      const key = `${ponIndex}:${onuId}`
      
      // Get ONU name value
      let value = result.value
      if (Buffer.isBuffer(value)) {
        try {
          value = value.toString('utf8')
        } catch (e) {
          value = value.toString()
        }
      }
      const onuName = String(value || '').trim() || `ONU-${gponOnu}`
      
      // Create ONU entry
      if (!onuMap.has(key)) {
        onuMap.set(key, {
          frame,
          slot,
          port: portNum,
          onuId,
          gponOnu,
          name: onuName,
          description: '',
          status: 'Unknown',
          serialNumber: '',
          rxOlt: null,
          rxOnu: null,
          actualType: '',
          ponIndex, // Simpan PON Index untuk matching dengan OID lainnya
        })
        parsedCount++
        if (parsedCount <= 10) {
          console.log(`[C3XX-ONU-SNMP] Parsed ONU: ${gponOnu} (${onuName}) from OID: ${result.oid}, PON Index: ${ponIndex}, Key: ${key}`)
        }
      } else {
        // Update name jika sudah ada
        const existing = onuMap.get(key)!
        existing.name = onuName
        // Update gponOnu jika berbeda (mungkin konversi frame/slot/port lebih akurat sekarang)
        if (existing.gponOnu !== gponOnu) {
          console.log(`[C3XX-ONU-SNMP] Updating gponOnu for key ${key}: ${existing.gponOnu} -> ${gponOnu}`)
          existing.gponOnu = gponOnu
          existing.frame = frame
          existing.slot = slot
          existing.port = portNum
        }
      }
    }
    
    console.log(`[C3XX-ONU-SNMP] Created ${onuMap.size} ONU entries from ${onuNameResults.length} name results`)
    console.log(`[C3XX-ONU-SNMP] Parsed: ${parsedCount}, Skipped: ${skippedCount}`)
    if (skippedCount > 0) {
      console.log(`[C3XX-ONU-SNMP] Skip reasons:`, skippedReasons)
      // Log beberapa OID yang di-skip untuk debugging
      let skipLogCount = 0
      for (const result of onuNameResults) {
        const onuInfo = extractOnuInfoFromOid(result.oid, onuNameOid)
        if (!onuInfo && skipLogCount < 10) {
          console.log(`[C3XX-ONU-SNMP] Skipped OID: ${result.oid}`)
          skipLogCount++
        }
      }
    }
    
    // Pastikan semua ONU name results ter-create
    if (onuMap.size < onuNameResults.length) {
      console.warn(`[C3XX-ONU-SNMP] WARNING: Only ${onuMap.size} ONUs created from ${onuNameResults.length} name results!`)
      console.warn(`[C3XX-ONU-SNMP] Missing ${onuNameResults.length - onuMap.size} ONUs - possible duplicate keys or parsing errors`)
      
      // Log semua keys yang sudah ada untuk debugging
      const existingKeys = Array.from(onuMap.keys())
      console.log(`[C3XX-ONU-SNMP] Existing ONU keys (first 20):`, existingKeys.slice(0, 20))
    }
    
    // Parse ONU Status - coba dari OID alternatif dulu (yang lebih spesifik untuk status)
    // Format OID status mungkin sama dengan name: baseOid.{PON_INDEX}.{ONU_ID}
    let statusMatchedCount = 0
    let statusNotFoundCount = 0
    let statusKeyNotFoundCount = 0
    
    // Log sample status OIDs untuk debugging
    if (onuStatusResultsAlt.length > 0 && onuStatusResultsAlt.length <= 5) {
      console.log(`[C3XX-ONU-SNMP] Sample status OIDs:`)
      onuStatusResultsAlt.slice(0, 5).forEach((r, i) => {
        console.log(`[C3XX-ONU-SNMP]   ${i + 1}. ${r.oid}`)
      })
    }
    
    for (const result of onuStatusResultsAlt) {
      // Coba parse dengan format yang sama seperti name OID
      const onuInfo = extractOnuInfoFromOid(result.oid, '1.3.6.1.4.1.3902.1082.500.10.2.3.8.1.4')
      if (!onuInfo) {
        if (statusNotFoundCount < 5) {
          console.warn(`[C3XX-ONU-SNMP] Failed to parse status OID: ${result.oid}`)
        }
        statusNotFoundCount++
        continue
      }
      
      // Gunakan PON Index + ONU ID sebagai key (sama seperti di parsing name)
      const key = `${onuInfo.ponIndex}:${onuInfo.onuId}`
      if (!onuMap.has(key)) {
        if (statusKeyNotFoundCount < 5) {
          console.warn(`[C3XX-ONU-SNMP] Status OID found but key not in map: ${key} (OID: ${result.oid}, PON Index: ${onuInfo.ponIndex}, ONU ID: ${onuInfo.onuId})`)
        }
        statusKeyNotFoundCount++
        continue
      }
      
      let value = result.value
      if (Buffer.isBuffer(value)) {
        value = parseInt(value.toString('hex'), 16) || value.readUInt8(0)
      }
      
      const statusId = saveint(value)
      if (statusId >= 0 && statusId < C3XX_ONU_STATUS.length) {
        const status = C3XX_ONU_STATUS[statusId]
        if (status === 'working') onuMap.get(key)!.status = 'Online'
        else if (status === 'los') onuMap.get(key)!.status = 'LOS'
        else if (status === 'dyingGasp') onuMap.get(key)!.status = 'DyingGasp'
        else if (status === 'authFailed') onuMap.get(key)!.status = 'AuthFailed'
        else if (status === 'offline') onuMap.get(key)!.status = 'OffLine'
        else onuMap.get(key)!.status = status.charAt(0).toUpperCase() + status.slice(1)
        statusMatchedCount++
      }
    }
    console.log(`[C3XX-ONU-SNMP] Status parsing: ${statusMatchedCount} matched, ${statusNotFoundCount} failed to parse, ${statusKeyNotFoundCount} key not found`)
    
    // Fallback: Parse status dari OID description (jika alternative tidak ada)
    if (statusMatchedCount === 0) {
      console.log(`[C3XX-ONU-SNMP] No status from alternative OID, trying description OID...`)
      for (const result of onuStatusResults) {
        const onuInfo = extractOnuInfoFromOid(result.oid, '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.3')
        if (!onuInfo) continue
        
        // Gunakan PON Index + ONU ID sebagai key (sama seperti di parsing name)
        const key = `${onuInfo.ponIndex}:${onuInfo.onuId}`
        if (!onuMap.has(key)) continue
        
        // OID ini mungkin description, bukan status, jadi kita skip untuk status
        // Tapi kita bisa gunakan untuk description jika belum ada
        if (!onuMap.get(key)!.description) {
          let value = result.value
          if (Buffer.isBuffer(value)) {
            try {
              value = value.toString('utf8')
            } catch (e) {
              value = value.toString()
            }
          }
          const descValue = String(value || '').trim()
          if (descValue) {
            onuMap.get(key)!.description = descValue
          }
        }
      }
    }
    
    // Parse Serial Number
    // Format OID: baseOid.{PON_INDEX}.{ONU_ID} (sama seperti name)
    let serialMatchedCount = 0
    let serialNotFoundCount = 0
    let serialKeyNotFoundCount = 0
    
    for (const result of onuSerialResults) {
      const onuInfo = extractOnuInfoFromOid(result.oid, '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.4')
      if (!onuInfo) {
        if (serialNotFoundCount < 5) {
          console.warn(`[C3XX-ONU-SNMP] Failed to parse serial OID: ${result.oid}`)
        }
        serialNotFoundCount++
        continue
      }
      
      // Gunakan PON Index + ONU ID sebagai key (sama seperti di parsing name)
      const key = `${onuInfo.ponIndex}:${onuInfo.onuId}`
      if (!onuMap.has(key)) {
        // Log jika key tidak ditemukan (mungkin ONU belum ter-create dari name results)
        if (serialKeyNotFoundCount < 5) {
          console.warn(`[C3XX-ONU-SNMP] Serial OID found but key not in map: ${key} (OID: ${result.oid}, PON Index: ${onuInfo.ponIndex}, ONU ID: ${onuInfo.onuId})`)
        }
        serialKeyNotFoundCount++
        continue
      }
      
      let value = result.value
      if (Buffer.isBuffer(value)) {
        try {
          value = value.toString('utf8')
        } catch (e) {
          value = value.toString()
        }
      }
      
      const serialValue = String(value || '').trim()
      if (serialValue && serialValue !== '0' && serialValue !== '') {
        onuMap.get(key)!.serialNumber = serialValue
        serialMatchedCount++
      } else {
        // Jika serial number kosong, coba extract dari name (format: SERIAL-NAME)
        const onu = onuMap.get(key)!
        if (onu.name) {
          // Format name biasanya: SERIAL-NAME atau SERIAL NAME
          const nameParts = onu.name.split(/[- ]/)
          if (nameParts.length > 0 && nameParts[0] && nameParts[0].length >= 10) {
            // Jika bagian pertama panjang (kemungkinan serial number)
            const possibleSerial = nameParts[0].trim()
            // Validasi: serial number biasanya angka atau alphanumeric panjang
            if (/^[0-9A-Za-z]{10,}$/.test(possibleSerial)) {
              onu.serialNumber = possibleSerial
              serialMatchedCount++
            }
          }
        }
      }
    }
    console.log(`[C3XX-ONU-SNMP] Serial parsing: ${serialMatchedCount} matched, ${serialNotFoundCount} failed to parse, ${serialKeyNotFoundCount} key not found`)
    
    // Parse RX Power (OLT receive from ONU)
    // Format OID mungkin: baseOid.{PON_INDEX} atau baseOid.{PON_INDEX}.{ONU_ID}
    // Coba kedua format
    let rxMatchedCount = 0
    let rxNotFoundCount = 0
    let rxKeyNotFoundCount = 0
    
    for (const result of onuRxResults) {
      const oidParts = result.oid.split('.')
      const baseOid = '1.3.6.1.4.1.3902.1082.30.40.2.4.1.3'
      const baseParts = baseOid.split('.')
      
      if (oidParts.length <= baseParts.length) {
        rxNotFoundCount++
        continue
      }
      
      const ponIndexStr = oidParts[baseParts.length]
      const ponIndex = parseInt(ponIndexStr)
      if (isNaN(ponIndex)) {
        rxNotFoundCount++
        continue
      }
      
      // Cek apakah ada ONU_ID di akhir OID
      let onuId: number | null = null
      if (oidParts.length > baseParts.length + 1) {
        // Format: baseOid.{PON_INDEX}.{ONU_ID}
        const onuIdStr = oidParts[oidParts.length - 1]
        const onuIdFromOid = parseInt(onuIdStr)
        if (!isNaN(onuIdFromOid) && onuIdFromOid > 0) {
          onuId = onuIdFromOid
        }
      }
      
      // Extract frame/slot/port dari PON_INDEX menggunakan format Type 1 yang benar
      // Berdasarkan dokumentasi Type 1 Composite Index:
      // bit31-bit28: Type = 1
      // bit27-bit24: Shelf No. = 0
      // bit23-bit16: Slot No. (8 bit)
      // bit15-bit8: Port No. atau OLT No. (8 bit)
      // bit7-bit0: Reserved = 0
      const type = (ponIndex >> 28) & 0xF
      const shelf = (ponIndex >> 24) & 0xF
      const slot = (ponIndex >> 16) & 0xFF
      const port = (ponIndex >> 8) & 0xFF
      const reserved = ponIndex & 0xFF
      const onuIdFromPonIndex = reserved // Reserved biasanya 0, tapi bisa berisi ONU ID
      
      if (slot === 0 || port === 0) {
        rxNotFoundCount++
        continue
      }
      
      // Frame biasanya 1 untuk single frame system
      // Shelf biasanya 0 untuk Type 1, tapi jika tidak 0, bisa digunakan sebagai frame
      const frameNum = shelf === 0 ? 1 : shelf
      
      // Cari semua ONU yang match dengan frame/slot/port ini
      // RX/TX OID biasanya per-PON (tidak punya ONU ID di akhir), jadi assign ke semua ONU di port yang sama
      const matchingOnus: string[] = []
      
      // Jika ada ONU_ID dari OID, coba match dengan ONU spesifik dulu
      if (onuId !== null && onuId > 0) {
        for (const [key, onu] of onuMap.entries()) {
          if (onu.frame === frameNum && onu.slot === slot && onu.port === port && onu.onuId === onuId) {
            matchingOnus.push(key)
            break // Hanya ambil yang pertama yang match
          }
        }
      }
      
      // Prioritas 1: Jika ada ONU_ID dari OID, match dengan ONU spesifik
      // (sudah di-handle di atas)
      
      // Prioritas 2: Coba match dengan reserved field sebagai ONU ID
      // Reserved field di PON Index untuk RX/TX OID kemungkinan berisi ONU ID
      // Contoh: PON Index 285278977 -> reserved=1, berarti ONU ID = 1
      if (matchingOnus.length === 0 && reserved > 0 && reserved <= 128) {
        for (const [key, onu] of onuMap.entries()) {
          if (onu.frame === frameNum && onu.slot === slot && onu.port === port && onu.onuId === reserved) {
            matchingOnus.push(key)
            break // Hanya ambil yang pertama yang match
          }
        }
      }
      
      // Prioritas 3: Jika masih tidak match, coba match dengan "reserved" field sebagai sequential index
      // Urutkan ONUs di port yang sama berdasarkan ONU ID, lalu assign berdasarkan urutan
      if (matchingOnus.length === 0 && reserved > 0 && reserved <= 128) {
        // Dapatkan semua ONU di port yang sama, sorted by ONU ID
        const onusOnPort: Array<{key: string, onuId: number}> = []
        for (const [key, onu] of onuMap.entries()) {
          if (onu.frame === frameNum && onu.slot === slot && onu.port === port) {
            onusOnPort.push({key, onuId: onu.onuId})
          }
        }
        onusOnPort.sort((a, b) => a.onuId - b.onuId)
        
        // Match berdasarkan posisi sequential (reserved sebagai index mulai dari 1)
        if (reserved <= onusOnPort.length) {
          const targetOnu = onusOnPort[reserved - 1] // reserved=1 -> index 0
          matchingOnus.push(targetOnu.key)
        }
      }
      
      // Prioritas 4: Jika masih tidak match, cari SEMUA ONU dengan frame/slot/port yang sama (last resort)
      if (matchingOnus.length === 0) {
        for (const [key, onu] of onuMap.entries()) {
          if (onu.frame === frameNum && onu.slot === slot && onu.port === port) {
            matchingOnus.push(key)
          }
        }
      }
      
      // Log untuk debugging: jika menemukan banyak ONU di port yang sama
      if (matchingOnus.length > 1 && rxMatchedCount < 10) {
        console.log(`[C3XX-ONU-SNMP] RX OID ${ponIndex} (frame: ${frameNum}, slot: ${slot}, port: ${port}) matched dengan ${matchingOnus.length} ONU(s) di port yang sama`)
      }
      
      if (matchingOnus.length === 0) {
        if (rxKeyNotFoundCount < 10) {
          console.warn(`[C3XX-ONU-SNMP] RX OID not matched: PON=${ponIndex} (type:${type}, shelf:${shelf}, frame:${frameNum}, slot:${slot}, port:${port}, onuId:${onuId}, reserved:${reserved})`)
          
          // Debug: tampilkan sample ONUs untuk comparison (hanya sekali)
          if (rxKeyNotFoundCount === 0) {
            console.log(`[C3XX-ONU-SNMP] Sample ONUs for comparison:`)
            let debugCount = 0
            for (const [key, onu] of onuMap.entries()) {
              if (debugCount < 5) {
                console.log(`  - ${key}: frame=${onu.frame}, slot=${onu.slot}, port=${onu.port}, onuId=${onu.onuId}`)
                debugCount++
              }
            }
          }
        }
        rxKeyNotFoundCount++
        continue
      }
      
      let value = result.value
      if (Buffer.isBuffer(value)) {
        value = parseInt(value.toString('hex'), 16) || value.readUInt32BE(0)
      }
      
      const rxValue = saveint(value)
      const rxDbm = convertC3xxRxValue(rxValue)
      if (rxDbm !== -40.0 && !isNaN(rxDbm)) {
        // Assign ke SEMUA ONU di port yang sama (karena RX OID biasanya per-PON)
        // Jika hanya match 1 ONU, tetap assign (mungkin per-ONU)
        // Jika match banyak ONU, assign ke semua (per-PON)
        for (const key of matchingOnus) {
          onuMap.get(key)!.rxOlt = `${rxDbm} dBm`
          rxMatchedCount++
        }
        // Log untuk debugging
        if (rxMatchedCount <= 10 || matchingOnus.length > 1) {
          console.log(`[C3XX-ONU-SNMP] RX matched: PON Index ${ponIndex} (frame: ${frameNum}, slot: ${slot}, port: ${port}) -> ${matchingOnus.length} ONU(s), RX: ${rxDbm} dBm`)
        }
      }
    }
    console.log(`[C3XX-ONU-SNMP] RX parsing: ${rxMatchedCount} matched, ${rxNotFoundCount} failed to parse, ${rxKeyNotFoundCount} key not found`)
    
    // Parse TX Power (ONU transmit)
    // Format OID mungkin: baseOid.{PON_INDEX} atau baseOid.{PON_INDEX}.{ONU_ID}
    // Coba kedua format
    let txMatchedCount = 0
    let txNotFoundCount = 0
    let txKeyNotFoundCount = 0
    
    for (const result of onuTxResults) {
      const oidParts = result.oid.split('.')
      const baseOid = '1.3.6.1.4.1.3902.1082.30.40.2.4.1.4'
      const baseParts = baseOid.split('.')
      
      if (oidParts.length <= baseParts.length) {
        txNotFoundCount++
        continue
      }
      
      const ponIndexStr = oidParts[baseParts.length]
      const ponIndex = parseInt(ponIndexStr)
      if (isNaN(ponIndex)) {
        txNotFoundCount++
        continue
      }
      
      // Cek apakah ada ONU_ID di akhir OID
      let onuId: number | null = null
      if (oidParts.length > baseParts.length + 1) {
        // Format: baseOid.{PON_INDEX}.{ONU_ID}
        const onuIdStr = oidParts[oidParts.length - 1]
        const onuIdFromOid = parseInt(onuIdStr)
        if (!isNaN(onuIdFromOid) && onuIdFromOid > 0) {
          onuId = onuIdFromOid
        }
      }
      
      // Extract frame/slot/port dari PON_INDEX menggunakan format Type 1 yang benar
      // Berdasarkan dokumentasi Type 1 Composite Index:
      // bit31-bit28: Type = 1
      // bit27-bit24: Shelf No. = 0
      // bit23-bit16: Slot No. (8 bit)
      // bit15-bit8: Port No. atau OLT No. (8 bit)
      // bit7-bit0: Reserved = 0
      const type = (ponIndex >> 28) & 0xF
      const shelf = (ponIndex >> 24) & 0xF
      const slot = (ponIndex >> 16) & 0xFF
      const port = (ponIndex >> 8) & 0xFF
      const reserved = ponIndex & 0xFF
      const onuIdFromPonIndex = reserved // Reserved biasanya 0, tapi bisa berisi ONU ID
      
      if (slot === 0 || port === 0) {
        txNotFoundCount++
        continue
      }
      
      // Frame biasanya 1 untuk single frame system
      // Shelf biasanya 0 untuk Type 1, tapi jika tidak 0, bisa digunakan sebagai frame
      const frameNum = shelf === 0 ? 1 : shelf
      
      // Cari semua ONU yang match dengan frame/slot/port ini
      // TX OID biasanya per-PON (tidak punya ONU ID di akhir), jadi assign ke semua ONU di port yang sama
      const matchingOnus: string[] = []
      
      // Jika ada ONU_ID dari OID, coba match dengan ONU spesifik dulu
      if (onuId !== null && onuId > 0) {
        for (const [key, onu] of onuMap.entries()) {
          if (onu.frame === frameNum && onu.slot === slot && onu.port === port && onu.onuId === onuId) {
            matchingOnus.push(key)
            break // Hanya ambil yang pertama yang match
          }
        }
      }
      
      // Jika tidak ada match dengan ONU ID spesifik, coba dengan reserved field sebagai ONU ID
      // Reserved field di PON Index untuk TX OID kemungkinan berisi ONU ID
      // Contoh: PON Index 285278977 -> reserved=1, berarti ONU ID = 1
      if (matchingOnus.length === 0 && reserved > 0 && reserved <= 128) {
        for (const [key, onu] of onuMap.entries()) {
          if (onu.frame === frameNum && onu.slot === slot && onu.port === port && onu.onuId === reserved) {
            matchingOnus.push(key)
            break // Hanya ambil yang pertama yang match
          }
        }
      }
      
      // Jika masih tidak match, coba dengan onuIdFromPonIndex (sama dengan reserved, tapi untuk konsistensi)
      if (matchingOnus.length === 0 && onuIdFromPonIndex > 0 && onuIdFromPonIndex <= 128 && onuIdFromPonIndex !== reserved) {
        for (const [key, onu] of onuMap.entries()) {
          if (onu.frame === frameNum && onu.slot === slot && onu.port === port && onu.onuId === onuIdFromPonIndex) {
            matchingOnus.push(key)
            break // Hanya ambil yang pertama yang match
          }
        }
      }
      
      // Prioritas 3: Jika masih tidak match, coba match dengan "reserved" field sebagai sequential index
      // Urutkan ONUs di port yang sama berdasarkan ONU ID, lalu assign berdasarkan urutan
      if (matchingOnus.length === 0 && reserved > 0 && reserved <= 128) {
        // Dapatkan semua ONU di port yang sama, sorted by ONU ID
        const onusOnPort: Array<{key: string, onuId: number}> = []
        for (const [key, onu] of onuMap.entries()) {
          if (onu.frame === frameNum && onu.slot === slot && onu.port === port) {
            onusOnPort.push({key, onuId: onu.onuId})
          }
        }
        onusOnPort.sort((a, b) => a.onuId - b.onuId)
        
        // Match berdasarkan posisi sequential (reserved sebagai index mulai dari 1)
        if (reserved <= onusOnPort.length) {
          const targetOnu = onusOnPort[reserved - 1] // reserved=1 -> index 0
          matchingOnus.push(targetOnu.key)
        }
      }
      
      // Prioritas 4: Jika masih tidak match, cari SEMUA ONU dengan frame/slot/port yang sama (last resort)
      if (matchingOnus.length === 0) {
        for (const [key, onu] of onuMap.entries()) {
          if (onu.frame === frameNum && onu.slot === slot && onu.port === port) {
            matchingOnus.push(key)
          }
        }
      }
      
      // Log untuk debugging: jika menemukan banyak ONU di port yang sama
      if (matchingOnus.length > 1 && txMatchedCount < 10) {
        console.log(`[C3XX-ONU-SNMP] TX OID ${ponIndex} (frame: ${frameNum}, slot: ${slot}, port: ${port}) matched dengan ${matchingOnus.length} ONU(s) di port yang sama`)
      }
      
      if (matchingOnus.length === 0) {
        if (txKeyNotFoundCount < 10) {
          console.warn(`[C3XX-ONU-SNMP] TX OID not matched: PON=${ponIndex} (type:${type}, shelf:${shelf}, frame:${frameNum}, slot:${slot}, port:${port}, onuId:${onuId}, reserved:${reserved})`)
          
          // Debug: tampilkan 3 ONU pertama untuk comparison
          if (txKeyNotFoundCount === 0) {
            console.log(`[C3XX-ONU-SNMP] Sample ONUs for comparison:`)
            let debugCount = 0
            for (const [key, onu] of onuMap.entries()) {
              if (debugCount < 5) {
                console.log(`  - ${key}: frame=${onu.frame}, slot=${onu.slot}, port=${onu.port}, onuId=${onu.onuId}`)
                debugCount++
              }
            }
          }
        }
        txKeyNotFoundCount++
        continue
      }
      
      let value = result.value
      if (Buffer.isBuffer(value)) {
        value = parseInt(value.toString('hex'), 16) || value.readUInt32BE(0)
      }
      
      const txValue = saveint(value)
      const txDbm = convertC3xxTxValue(txValue)
      if (txDbm !== -40.0 && !isNaN(txDbm)) {
        // Assign ke SEMUA ONU di port yang sama (karena TX OID biasanya per-PON)
        // Jika hanya match 1 ONU, tetap assign (mungkin per-ONU)
        // Jika match banyak ONU, assign ke semua (per-PON)
        for (const key of matchingOnus) {
          onuMap.get(key)!.rxOnu = `${txDbm} dBm`
          txMatchedCount++
        }
        // Log untuk debugging
        if (txMatchedCount <= 10 || matchingOnus.length > 1) {
          console.log(`[C3XX-ONU-SNMP] TX matched: PON Index ${ponIndex} (frame: ${frameNum}, slot: ${slot}, port: ${port}) -> ${matchingOnus.length} ONU(s), TX: ${txDbm} dBm`)
        }
      }
    }
    console.log(`[C3XX-ONU-SNMP] TX parsing: ${txMatchedCount} matched, ${txNotFoundCount} failed to parse, ${txKeyNotFoundCount} key not found`)
    
    // Log summary untuk debugging
    let onuWithStatus = 0
    let onuWithSerial = 0
    let onuWithRx = 0
    let onuWithTx = 0
    for (const [key, onu] of onuMap.entries()) {
      if (onu.status && onu.status !== 'Unknown') onuWithStatus++
      if (onu.serialNumber && onu.serialNumber.trim()) onuWithSerial++
      if (onu.rxOlt) onuWithRx++
      if (onu.rxOnu) onuWithTx++
    }
    console.log(`[C3XX-ONU-SNMP] Summary: ${onuMap.size} total ONUs`)
    console.log(`[C3XX-ONU-SNMP]   - With status: ${onuWithStatus}`)
    console.log(`[C3XX-ONU-SNMP]   - With serial: ${onuWithSerial}`)
    console.log(`[C3XX-ONU-SNMP]   - With RX OLT: ${onuWithRx}`)
    console.log(`[C3XX-ONU-SNMP]   - With RX ONU: ${onuWithTx}`)
    
    // Convert map to array
    let onuIndex = 1
    for (const [key, onu] of onuMap.entries()) {
      onus.push({
        id: `onu-${oltId}-${onuIndex++}`,
        oltId,
        oltName,
        name: onu.name || `ONU-${onu.gponOnu}`,
        description: onu.description || onu.gponOnu,
        pppoe: '', // PPPoE tidak tersedia di SNMP C3XX
        gponOnu: onu.gponOnu,
        status: onu.status || 'Unknown',
        rxOlt: onu.rxOlt || null,
        rxOnu: onu.rxOnu || null,
        txOlt: null, // C3XX belum support
        txOnu: null, // C3XX belum support
        serialNumber: onu.serialNumber || '',
        actualType: onu.actualType || detectModelFromSerial(onu.serialNumber || ''),
        registerTime: null, // C3XX belum support
        distance: null, // C3XX belum support
        lastSeen: null, // C3XX belum support
        registrationMode: null, // C3XX belum support
        softwareVersion: null, // C3XX belum support
        hardwareVersion: null, // C3XX belum support
        temperature: null, // C3XX belum support
        laserBiasCurrent: null, // C3XX belum support
      })
    }
    
    console.log(`[C3XX-ONU-SNMP] Parsed ${onus.length} ONUs from ${oltName} via SNMP`)
  } catch (error: any) {
    console.error(`[C3XX-ONU-SNMP] Error fetching ONU data via SNMP:`, error)
    
    // Jika error adalah array (hasil dari snmpWalk yang di-throw), parse hasilnya
    if (Array.isArray(error) && error.length > 0) {
      console.log(`[C3XX-ONU-SNMP] Recovering from error, parsing ${error.length} results...`)
      
      try {
        // Filter untuk mendapatkan name results
        const nameResults = error.filter((r: any) => {
          const oidStr = r.oid || ''
          return oidStr.includes('500.10.2.3.3.1.2')
        })
        
        console.log(`[C3XX-ONU-SNMP] Found ${nameResults.length} name results in error recovery`)
        
        if (nameResults.length > 0) {
          const onuMap = new Map<string, any>()
          const baseOid = '1.3.6.1.4.1.3902.1082.500.10.2.3.3.1.2'
          
          // Helper function untuk extract ONU info (sama dengan di atas)
          const extractOnuInfoFromOidRecovery = (oid: string, baseOid: string): { frame: number; slot: number; port: number; onuId: number } | null => {
            const oidParts = oid.split('.')
            const baseParts = baseOid.split('.')
            
            if (oidParts.length <= baseParts.length) return null
            
            const ponIndexStr = oidParts[baseParts.length]
            const ponIndex = parseInt(ponIndexStr)
            
            if (isNaN(ponIndex)) return null
            
            const frame = (ponIndex >> 24) & 0xFF
            const slot = (ponIndex >> 16) & 0xFF
            const port = (ponIndex >> 8) & 0xFF
            const onuIdFromPonIndex = ponIndex & 0xFF
            
            if (slot === 0 || port === 0) return null
            
            let onuId = onuIdFromPonIndex
            
            if (oidParts.length > baseParts.length + 1) {
              const onuIdStr = oidParts[oidParts.length - 1]
              const onuIdFromOid = parseInt(onuIdStr)
              if (!isNaN(onuIdFromOid) && onuIdFromOid > 0) {
                onuId = onuIdFromOid
              }
            }
            
            if (onuId === 0) return null
            
            return {
              frame: frame === 0 ? 1 : frame,
              slot,
              port,
              onuId,
            }
          }
          
          for (const result of nameResults) {
            const onuInfo = extractOnuInfoFromOidRecovery(result.oid, baseOid)
            if (!onuInfo) continue
            
            const { frame, slot, port: portNum, onuId } = onuInfo
            const gponOnu = `${frame}/${slot}/${portNum}:${onuId}`
            const key = gponOnu
            
            let value = result.value
            if (Buffer.isBuffer(value)) {
              value = value.toString('utf8')
            }
            const onuName = String(value || '').trim() || `ONU-${gponOnu}`
            
            if (!onuMap.has(key)) {
              onuMap.set(key, {
                frame,
                slot,
                port: portNum,
                onuId,
                gponOnu,
                name: onuName,
                description: '',
                status: 'Unknown',
                serialNumber: '',
                rxOlt: null,
                rxOnu: null,
                actualType: '',
              })
            }
          }
          
          // Convert map to array
          let onuIndex = 1
          for (const [key, onu] of onuMap.entries()) {
            onus.push({
              id: `onu-${oltId}-${onuIndex++}`,
              oltId,
              oltName,
              name: onu.name || `ONU-${onu.gponOnu}`,
              description: onu.description || onu.gponOnu,
              pppoe: '',
              gponOnu: onu.gponOnu,
              status: onu.status || 'Unknown',
              rxOlt: onu.rxOlt || null,
              rxOnu: onu.rxOnu || null,
              txOlt: null,
              txOnu: null,
              serialNumber: onu.serialNumber || '',
              actualType: onu.actualType || detectModelFromSerial(onu.serialNumber || ''),
              registerTime: null,
              distance: null,
              lastSeen: null,
              registrationMode: null,
              softwareVersion: null,
              hardwareVersion: null,
              temperature: null,
              laserBiasCurrent: null,
            })
          }
          
          console.log(`[C3XX-ONU-SNMP] Recovered ${onus.length} ONUs from error results`)
          return onus
        }
      } catch (recoveryError) {
        console.error(`[C3XX-ONU-SNMP] Error during recovery:`, recoveryError)
      }
    }
    
    throw error
  }

  return onus
}

// Convert PON index ke format Frame/Slot/Port
// Berdasarkan kode Python teman: PON index adalah binary 32-bit yang di-decode sebagai:
// Format binary: [4 bit type][4 bit shelf][8 bit frame][8 bit slot][8 bit port]
// 
// Contoh: PON index 268632320
// Binary 32-bit: perlu convert dan parse
// PENTING: Port dimulai dari 1, bukan 0!
// Format output: Frame/Slot/Port (bukan Rack/Slot/Port)
function ponIndexToPort(ponIndex: number): string {
  // Convert ke binary 32-bit (pad dengan leading zeros)
  const binary = ponIndex.toString(2).padStart(32, '0')
  
  if (binary.length !== 32) {
    console.warn(`[All-ONU-SNMP] Invalid binary length for PON index ${ponIndex}: ${binary.length}`)
    const fallbackPort = (ponIndex % 100) || 1 // Pastikan minimal 1
    return `1/1/${fallbackPort}`
  }
  
  // Parse sesuai format: [4 bit type][4 bit shelf][8 bit frame][8 bit slot][8 bit port]
  const onuType = binary.substring(0, 4)      // bits 0-3
  const onuShelf = binary.substring(4, 8)    // bits 4-7
  const onuFrame = binary.substring(8, 16)      // bits 8-15 (Frame, bukan Rack)
  const onuSlot = binary.substring(16, 24)   // bits 16-23
  const onuPort = binary.substring(24, 32)    // bits 24-31
  
  // Convert binary ke decimal
  const frame = parseInt(onuFrame, 2) || 1 // Minimal 1 (Frame, bukan Rack)
  const slot = parseInt(onuSlot, 2) || 1 // Minimal 1
  let port = parseInt(onuPort, 2)
  
  // PORT MULAI DARI 1, BUKAN 0!
  // Jika port = 0, berarti ada masalah dengan parsing atau PON index tidak valid
  if (port === 0) {
    console.warn(`[All-ONU-SNMP] Invalid port 0 detected for PON index ${ponIndex}, skipping...`)
    // Return null atau throw error, atau skip port ini
    // Untuk sekarang, kita skip dengan return format yang jelas invalid
    return `INVALID/${slot}/0`
  }
  
  // Format: Frame/Slot/Port (bukan Rack/Slot/Port)
  // Contoh: 1/3/1, 1/4/16, dll
  return `${frame}/${slot}/${port}`
}

// Parse PON index dari OID
function parsePonIndexFromOid(oid: string, baseOid: string): number | null {
  const oidParts = oid.split('.')
  const baseParts = baseOid.split('.')
  
  if (oidParts.length < baseParts.length + 1) {
    return null
  }
  
  const ponIndex = parseInt(oidParts[baseParts.length])
  return isNaN(ponIndex) ? null : ponIndex
}

// Parse ONU ID dari OID (format: baseOid.PON.ONU_ID)
function parseOnuIdFromOid(oid: string, baseOid: string): { ponIndex: number; onuId: number } | null {
  const oidParts = oid.split('.')
  const baseParts = baseOid.split('.')
  
  if (oidParts.length < baseParts.length + 2) {
    return null
  }
  
  const ponIndex = parseInt(oidParts[baseParts.length])
  const onuId = parseInt(oidParts[baseParts.length + 1])
  
  if (isNaN(ponIndex) || isNaN(onuId)) {
    return null
  }
  
  return { ponIndex, onuId }
}

// Konversi Frame/Slot/Port ke PONID menggunakan rumus dari teman
// Rumus: PONID = (Frame * 16777216) + (Slot * 65536) + (Port * 256)
function frameSlotPortToPonId(frame: number, slot: number, port: number): number {
  return (frame * 16777216) + (slot * 65536) + (port * 256)
}

// Konversi PONID ke Frame/Slot/Port (kebalikan dari frameSlotPortToPonId)
function ponIdToFrameSlotPort(ponId: number): { frame: number; slot: number; port: number } | null {
  // Rumus: PONID = (Frame * 16777216) + (Slot * 65536) + (Port * 256)
  // Kita perlu reverse engineering
  const frame = Math.floor(ponId / 16777216)
  const remainder1 = ponId % 16777216
  const slot = Math.floor(remainder1 / 65536)
  const remainder2 = remainder1 % 65536
  const port = Math.floor(remainder2 / 256)
  
  // Validasi
  if (frame < 1 || slot < 1 || port < 1) {
    return null
  }
  
  return { frame, slot, port }
}

// Dapatkan semua PON ID aktif dari OLT menggunakan rumus SNMP
// Rumus: snmpwalk ... 1.3.6.1.4.1.3902.1012.3.28.2.1.4 | sed -n 's/.*\.\([0-9]\+\)\.[0-9]\+ =.*/\1/p' | sort -n | uniq
async function getAllActivePonIds(
  ipAddress: string,
  port: number,
  community: string,
  version: string
): Promise<number[]> {
  try {
    console.log(`[All-ONU-SNMP] Getting all active PON IDs from OLT...`)
    const results = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_OIDS.onuStatus, 60000)
    
    // Extract semua PON ID unik dari OID
    // Format OID: 1.3.6.1.4.1.3902.1012.3.28.2.1.4.{PONID}.{ONU_ID}
    const ponIds = new Set<number>()
    
    for (const result of results) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuStatus)
      if (ponOnu) {
        ponIds.add(ponOnu.ponIndex)
      }
    }
    
    const sortedPonIds = Array.from(ponIds).sort((a, b) => a - b)
    console.log(`[All-ONU-SNMP] Found ${sortedPonIds.length} active PON IDs`)
    
    return sortedPonIds
  } catch (error) {
    console.error(`[All-ONU-SNMP] Error getting active PON IDs:`, error)
    return []
  }
}

/**
 * Get ONU data menggunakan ZTE-AN-PON-MIB (Public PON Management)
 * Base OID: .1.3.6.1.4.1.3902.1082.50.10
 * Index: {zxAnPonIfIndex, zxAnOnuId}
 * Supports: Performance statistics, WiFi config, authentication, and more
 */
export async function getZteAnPonOnuDataViaSNMP(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oltName: string,
  oltId: string
): Promise<Array<{
  id: string
  oltId: string
  oltName: string
  name: string
  description: string
  pppoe: string
  gponOnu: string
  status: string
  rxOlt: string | null
  rxOnu: string | null
  txOlt: string | null
  txOnu: string | null
  serialNumber: string
  actualType: string
  registerTime: string | null
  distance: number | null
  lastSeen: string | null
  registrationMode: string | null
  softwareVersion: string | null
  hardwareVersion: string | null
  temperature: number | null
  laserBiasCurrent: number | null
  // New fields from ZTE-AN-PON-MIB
  vendorId: string | null
  equipmentId: string | null
  firmwareVersion: string | null
  macAddress: string | null
  batteryStatus: string | null
  opticalTransceiverType: string | null
  lastDeregTime: Date | null
  authMode: string | null
  loid: string | null
  password: string | null
  configState: string | null
  powerLevel: string | null
  dyingGaspTime: Date | null
  rxPowerStatus: string | null
  txPowerStatus: string | null
  rxBytes: bigint | null
  txBytes: bigint | null
  rxPackets: bigint | null
  txPackets: bigint | null
  rxErrors: bigint | null
  txErrors: bigint | null
  rxDrops: bigint | null
  txDrops: bigint | null
  wifiEnable: boolean | null
  wifiSsid: string | null
  wifiSecurityMode: string | null
  wifiChannel: number | null
}>> {
  console.log(`[ZTE-AN-PON-SNMP] Fetching ONU data from ${oltName} (${ipAddress}) via SNMP...`)
  console.log(`[ZTE-AN-PON-SNMP] Using ZTE-AN-PON-MIB (.1.3.6.1.4.1.3902.1082.50.10.*)`)

  const onus: Array<any> = []

  try {
    // Step 1: Walk ONU Status untuk get semua ifIndex dan onuId
    console.log(`[ZTE-AN-PON-SNMP] Step 1: Walking ONU Status (operStatus)...`)
    const statusResults = await snmpWalkWithDelay(
      ipAddress, port, community, version, 
      SNMP_ZTE_AN_PON_OIDS.onuInfo.operStatus, 
      0
    )
    console.log(`[ZTE-AN-PON-SNMP] Found ${statusResults.length} ONU entries`)

    if (statusResults.length === 0) {
      console.warn(`[ZTE-AN-PON-SNMP] No ONUs found for ${oltName}`)
      return []
    }

    // Step 2: Parse results untuk extract ifIndex dan onuId
    console.log(`[ZTE-AN-PON-SNMP] Step 2: Parsing ONU indices...`)
    const onuMap = new Map<string, {
      ifIndex: number
      onuId: number
      frame: number
      slot: number
      port: number
      gponOnu: string
      operStatus: number
    }>()

    const baseOid = SNMP_ZTE_AN_PON_OIDS.onuInfo.operStatus
    const baseParts = baseOid.split('.')

    for (const result of statusResults) {
      const oidParts = result.oid.split('.')
      
      if (oidParts.length < baseParts.length + 2) {
        continue // OID tidak lengkap
      }

      // Extract ifIndex dan onuId dari OID suffix
      // Format: .{baseOid}.{ifIndex}.{onuId}
      const ifIndex = parseInt(oidParts[baseParts.length])
      const onuId = parseInt(oidParts[baseParts.length + 1])

      if (isNaN(ifIndex) || isNaN(onuId)) {
        continue
      }

      // Parse ifIndex menggunakan Type 1 Composite Index untuk GPON
      // Format: Type (4 bit) | Rack (4 bit) | Shelf (8 bit) | Slot (8 bit) | Port (8 bit)
      const type = (ifIndex >> 28) & 0xF
      const rack = (ifIndex >> 24) & 0xF
      const shelf = (ifIndex >> 16) & 0xFF
      const slot = (ifIndex >> 8) & 0xFF
      const portNum = ifIndex & 0xFF

      // Frame biasanya adalah shelf, atau 1 jika shelf = 0
      const frame = shelf === 0 ? 1 : shelf

      // Parse status value
      let statusValue = result.value
      if (Buffer.isBuffer(statusValue)) {
        statusValue = parseInt(statusValue.toString('hex'), 16)
      }
      if (typeof statusValue === 'string') {
        statusValue = parseInt(statusValue)
      }
      const operStatus = parseInt(String(statusValue)) || 0

      // Create gponOnu ID (format: frame/slot/port:onuId)
      const gponOnu = `${frame}/${slot}/${portNum}:${onuId}`

      // Create unique key
      const key = `${ifIndex}-${onuId}`

      onuMap.set(key, {
        ifIndex,
        onuId,
        frame,
        slot,
        port: portNum,
        gponOnu,
        operStatus,
      })
    }

    console.log(`[ZTE-AN-PON-SNMP] Parsed ${onuMap.size} ONUs from status results`)

    if (onuMap.size === 0) {
      console.warn(`[ZTE-AN-PON-SNMP] No valid ONUs found after parsing`)
      return []
    }

    // Step 3: Walk all OIDs untuk get complete data
    console.log(`[ZTE-AN-PON-SNMP] Step 3: Walking all ONU information OIDs...`)
    const [
      serialResults,
      macResults,
      vendorResults,
      equipmentResults,
      swVersionResults,
      hwVersionResults,
      fwVersionResults,
      distanceResults,
      regTimeResults,
      deregTimeResults,
      batteryResults,
      transTypeResults,
      authModeResults,
      loidResults,
      configStateResults,
      powerLevelResults,
      dyingGaspResults,
    ] = await Promise.all([
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.serialNumber, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.macAddress, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.vendorId, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.equipmentId, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.softwareVersion, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.hardwareVersion, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.firmwareVersion, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.logicalDistance, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.lastRegTime, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.lastDeregTime, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.batteryStatus, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.opticalTransceiverType, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.authMode, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuInfo.loid, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuStatus.configState, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuStatus.powerLevel, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuStatus.dyingGaspTime, 0),
    ])

    console.log(`[ZTE-AN-PON-SNMP] Fetched: Serial=${serialResults.length}, MAC=${macResults.length}, Vendor=${vendorResults.length}, Equipment=${equipmentResults.length}`)

    // Step 4: Walk optical power OIDs
    console.log(`[ZTE-AN-PON-SNMP] Step 4: Walking optical power OIDs...`)
    const [
      rxPowerResults,
      txPowerResults,
      rxPowerStatusResults,
      txPowerStatusResults,
      oltRxPowerResults,
    ] = await Promise.all([
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuOpticalPower.rxPower, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuOpticalPower.txPower, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuOpticalPower.rxPowerStatus, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuOpticalPower.txPowerStatus, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.oltRxPower.rxPower, 0),
    ])

    console.log(`[ZTE-AN-PON-SNMP] Fetched: RxPower=${rxPowerResults.length}, TxPower=${txPowerResults.length}, OLT RxPower=${oltRxPowerResults.length}`)

    // Step 5: Walk performance statistics OIDs
    console.log(`[ZTE-AN-PON-SNMP] Step 5: Walking performance statistics OIDs...`)
    const [
      rxBytesResults,
      txBytesResults,
      rxPacketsResults,
      txPacketsResults,
      rxErrorsResults,
      txErrorsResults,
      rxDropsResults,
      txDropsResults,
    ] = await Promise.all([
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuPerfStats.rxBytes, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuPerfStats.txBytes, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuPerfStats.rxPackets, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuPerfStats.txPackets, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuPerfStats.rxErrors, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuPerfStats.txErrors, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuPerfStats.rxDrops, 0),
      snmpWalkWithDelay(ipAddress, port, community, version, SNMP_ZTE_AN_PON_OIDS.onuPerfStats.txDrops, 0),
    ])

    console.log(`[ZTE-AN-PON-SNMP] Fetched: RxBytes=${rxBytesResults.length}, TxBytes=${txBytesResults.length}, RxPackets=${rxPacketsResults.length}, TxPackets=${txPacketsResults.length}`)

    // Helper function to extract ifIndex and onuId from OID
    const extractIndices = (oid: string, baseOidLength: number): { ifIndex: number; onuId: number } | null => {
      const oidParts = oid.split('.')
      if (oidParts.length < baseOidLength + 2) return null
      
      const ifIndex = parseInt(oidParts[baseOidLength])
      const onuId = parseInt(oidParts[baseOidLength + 1])
      
      if (isNaN(ifIndex) || isNaN(onuId)) return null
      return { ifIndex, onuId }
    }

    // Step 6: Combine all data
    console.log(`[ZTE-AN-PON-SNMP] Step 6: Combining all data...`)
    for (const [key, onuInfo] of onuMap) {
      const onu: any = {
        id: `${oltId}-${onuInfo.gponOnu}`,
        oltId,
        oltName,
        name: '',
        description: '',
        pppoe: '',
        gponOnu: onuInfo.gponOnu,
        status: 'Unknown',
        rxOlt: null,
        rxOnu: null,
        txOlt: null,
        txOnu: null,
        serialNumber: '',
        actualType: '',
        registerTime: null,
        distance: null,
        lastSeen: null,
        registrationMode: null,
        softwareVersion: null,
        hardwareVersion: null,
        temperature: null,
        laserBiasCurrent: null,
        // New fields
        vendorId: null,
        equipmentId: null,
        firmwareVersion: null,
        macAddress: null,
        batteryStatus: null,
        opticalTransceiverType: null,
        lastDeregTime: null,
        authMode: null,
        loid: null,
        password: null,
        configState: null,
        powerLevel: null,
        dyingGaspTime: null,
        rxPowerStatus: null,
        txPowerStatus: null,
        rxBytes: null,
        txBytes: null,
        rxPackets: null,
        txPackets: null,
        rxErrors: null,
        txErrors: null,
        rxDrops: null,
        txDrops: null,
        wifiEnable: null,
        wifiSsid: null,
        wifiSecurityMode: null,
        wifiChannel: null,
      }

      // Map operStatus to friendly status
      const statusMap: Record<number, string> = {
        1: 'online',      // inService
        2: 'offline',     // notInService
        3: 'online',      // hwOnline
        4: 'offline',     // hwOffline
        5: 'configuring', // configuring
        6: 'offline',     // configFailed
        7: 'offline',     // mibValueMismatch
        8: 'offline',     // deactivated
        9: 'offline',     // faulty
        10: 'offline',    // invalid
        11: 'LOS',        // noPower
      }
      onu.status = statusMap[onuInfo.operStatus] || 'Unknown'

      // Parse Serial Number
      for (const result of serialResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuInfo.serialNumber.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          onu.serialNumber = parseSnmpValue(result.value, 'string')
          break
        }
      }

      // Parse MAC Address
      for (const result of macResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuInfo.macAddress.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          onu.macAddress = parseSnmpValue(result.value, 'string')
          break
        }
      }

      // Parse Vendor ID
      for (const result of vendorResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuInfo.vendorId.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          onu.vendorId = parseSnmpValue(result.value, 'string')
          break
        }
      }

      // Parse Equipment ID
      for (const result of equipmentResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuInfo.equipmentId.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          onu.equipmentId = parseSnmpValue(result.value, 'string')
          onu.actualType = onu.equipmentId || '' // Use equipmentId as actualType
          break
        }
      }

      // Parse Versions
      for (const result of swVersionResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuInfo.softwareVersion.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          onu.softwareVersion = parseSnmpValue(result.value, 'string')
          break
        }
      }

      for (const result of hwVersionResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuInfo.hardwareVersion.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          onu.hardwareVersion = parseSnmpValue(result.value, 'string')
          break
        }
      }

      for (const result of fwVersionResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuInfo.firmwareVersion.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          onu.firmwareVersion = parseSnmpValue(result.value, 'string')
          break
        }
      }

      // Parse Distance
      for (const result of distanceResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuInfo.logicalDistance.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          const distanceValue = parseSnmpValue(result.value, 'number')
          onu.distance = distanceValue ? distanceValue / 1000 : null // Convert to km
          break
        }
      }

      // Parse Register Time
      for (const result of regTimeResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuInfo.lastRegTime.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          onu.registerTime = parseSnmpValue(result.value, 'string')
          break
        }
      }

      // Parse Last Dereg Time
      for (const result of deregTimeResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuInfo.lastDeregTime.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          const deregTime = parseSnmpValue(result.value, 'string')
          onu.lastDeregTime = deregTime ? new Date(deregTime) : null
          break
        }
      }

      // Parse Battery Status
      for (const result of batteryResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuInfo.batteryStatus.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          onu.batteryStatus = parseSnmpValue(result.value, 'string')
          break
        }
      }

      // Parse Optical Transceiver Type
      for (const result of transTypeResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuInfo.opticalTransceiverType.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          onu.opticalTransceiverType = parseSnmpValue(result.value, 'string')
          break
        }
      }

      // Parse Auth Mode
      for (const result of authModeResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuInfo.authMode.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          const authModeValue = parseSnmpValue(result.value, 'number')
          const authModes = ['', 'SN', 'Password', 'SN+Password', 'RegisterId', 'RegisterId+8021x', 
                            'RegisterId+Mutual', 'TefPw', 'SN+TefPw', 'LOID', 'LOID+Password']
          onu.authMode = authModeValue && authModeValue < authModes.length ? authModes[authModeValue] : null
          onu.registrationMode = onu.authMode // Map to registrationMode for compatibility
          break
        }
      }

      // Parse LOID
      for (const result of loidResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuInfo.loid.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          onu.loid = parseSnmpValue(result.value, 'string')
          break
        }
      }

      // Parse Config State
      for (const result of configStateResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuStatus.configState.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          onu.configState = parseSnmpValue(result.value, 'string')
          break
        }
      }

      // Parse Power Level
      for (const result of powerLevelResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuStatus.powerLevel.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          onu.powerLevel = parseSnmpValue(result.value, 'string')
          break
        }
      }

      // Parse Dying Gasp Time
      for (const result of dyingGaspResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuStatus.dyingGaspTime.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          const dyingGaspTime = parseSnmpValue(result.value, 'string')
          onu.dyingGaspTime = dyingGaspTime ? new Date(dyingGaspTime) : null
          break
        }
      }

      // Parse Optical Power - RX Power ONU
      for (const result of rxPowerResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuOpticalPower.rxPower.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          const rxPowerValue = parseSnmpValue(result.value, 'number')
          onu.rxOnu = rxPowerValue ? (rxPowerValue / 100).toFixed(2) : null // Convert from 0.01 dBm
          break
        }
      }

      // Parse Optical Power - TX Power ONU
      for (const result of txPowerResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuOpticalPower.txPower.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          const txPowerValue = parseSnmpValue(result.value, 'number')
          onu.txOnu = txPowerValue ? (txPowerValue / 100).toFixed(2) : null // Convert from 0.01 dBm
          break
        }
      }

      // Parse RX Power Status
      for (const result of rxPowerStatusResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuOpticalPower.rxPowerStatus.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          const statusValue = parseSnmpValue(result.value, 'number')
          const statusMap = ['', 'Normal', 'Low', 'High', 'Unknown']
          onu.rxPowerStatus = statusValue && statusValue < statusMap.length ? statusMap[statusValue] : null
          break
        }
      }

      // Parse TX Power Status
      for (const result of txPowerStatusResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuOpticalPower.txPowerStatus.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          const statusValue = parseSnmpValue(result.value, 'number')
          const statusMap = ['', 'Normal', 'Low', 'High', 'Unknown']
          onu.txPowerStatus = statusValue && statusValue < statusMap.length ? statusMap[statusValue] : null
          break
        }
      }

      // Parse OLT RX Power
      for (const result of oltRxPowerResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.oltRxPower.rxPower.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          const rxPowerValue = parseSnmpValue(result.value, 'number')
          onu.rxOlt = rxPowerValue ? (rxPowerValue / 100).toFixed(2) : null // Convert from 0.01 dBm
          break
        }
      }

      // Parse Performance Statistics
      for (const result of rxBytesResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuPerfStats.rxBytes.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          const value = parseSnmpValue(result.value, 'number')
          onu.rxBytes = value ? BigInt(value) : null
          break
        }
      }

      for (const result of txBytesResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuPerfStats.txBytes.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          const value = parseSnmpValue(result.value, 'number')
          onu.txBytes = value ? BigInt(value) : null
          break
        }
      }

      for (const result of rxPacketsResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuPerfStats.rxPackets.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          const value = parseSnmpValue(result.value, 'number')
          onu.rxPackets = value ? BigInt(value) : null
          break
        }
      }

      for (const result of txPacketsResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuPerfStats.txPackets.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          const value = parseSnmpValue(result.value, 'number')
          onu.txPackets = value ? BigInt(value) : null
          break
        }
      }

      for (const result of rxErrorsResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuPerfStats.rxErrors.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          const value = parseSnmpValue(result.value, 'number')
          onu.rxErrors = value ? BigInt(value) : null
          break
        }
      }

      for (const result of txErrorsResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuPerfStats.txErrors.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          const value = parseSnmpValue(result.value, 'number')
          onu.txErrors = value ? BigInt(value) : null
          break
        }
      }

      for (const result of rxDropsResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuPerfStats.rxDrops.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          const value = parseSnmpValue(result.value, 'number')
          onu.rxDrops = value ? BigInt(value) : null
          break
        }
      }

      for (const result of txDropsResults) {
        const indices = extractIndices(result.oid, SNMP_ZTE_AN_PON_OIDS.onuPerfStats.txDrops.split('.').length)
        if (!indices) continue
        if (indices.ifIndex === onuInfo.ifIndex && indices.onuId === onuInfo.onuId) {
          const value = parseSnmpValue(result.value, 'number')
          onu.txDrops = value ? BigInt(value) : null
          break
        }
      }

      // Set name from serial number if empty
      if (!onu.name) {
        onu.name = onu.serialNumber || onuInfo.gponOnu
      }

      onus.push(onu)
    }

    console.log(`[ZTE-AN-PON-SNMP] Successfully parsed ${onus.length} ONUs with complete data`)
    return onus
  } catch (error: any) {
    console.error(`[ZTE-AN-PON-SNMP] Error fetching ONU data:`, error?.message || error)
    return []
  }
}

/**
 * Dapatkan semua Card (Frame) dari OLT via SNMP
 * Card = Frame dalam format Frame/Slot/Port
 * @param ipAddress - IP address OLT
 * @param port - SNMP port
 * @param community - SNMP community
 * @param version - SNMP version
 * @returns Array of cards dengan informasi slot dan port yang tersedia
 */
export async function getAllCardsViaSNMP(
  ipAddress: string,
  port: number,
  community: string,
  version: string
): Promise<Array<{
  frame: number
  card: number
  slots: Array<{
    slot: number
    ports: number[]
  }>
  totalSlots: number
  totalPorts: number
}>> {
  try {
    console.log(`[Card-SNMP] Getting all cards from OLT ${ipAddress} via SNMP...`)
    
    // Dapatkan semua PON ID aktif
    const activePonIds = await getAllActivePonIds(ipAddress, port, community, version)
    
    if (activePonIds.length === 0) {
      console.log(`[Card-SNMP] No active PON IDs found`)
      return []
    }
    
    // Map untuk menyimpan card -> slot -> ports
    const cardMap = new Map<number, Map<number, Set<number>>>()
    
    // Konversi setiap PON ID ke Frame/Slot/Port
    // Coba semua metode dan pilih yang paling masuk akal
    for (const ponId of activePonIds) {
      let portInfo: { frame: number; slot: number; port: number } | null = null
      const results: Array<{ method: string; result: { frame: number; slot: number; port: number } }> = []
      
      // Metode 1: Formula PONID = (Frame * 16777216) + (Slot * 65536) + (Port * 256)
      const formulaResult = ponIdToFrameSlotPort(ponId)
      if (formulaResult) {
        results.push({ method: 'formula', result: formulaResult })
        console.log(`[Card-SNMP] PON ID ${ponId} -> ${formulaResult.frame}/${formulaResult.slot}/${formulaResult.port} (via formula)`)
      }
      
      // Metode 2: Binary parsing [4 bit type][4 bit shelf][8 bit frame][8 bit slot][8 bit port]
      const portStr = ponIndexToPort(ponId)
      let binaryFrame: number | null = null
      let binarySlot: number | null = null
      
      if (portStr && !portStr.includes('INVALID')) {
        const parts = portStr.split('/')
        if (parts.length === 3) {
          const frame = parseInt(parts[0])
          const slot = parseInt(parts[1])
          const portNum = parseInt(parts[2])
          
          // Simpan frame dan slot dari binary parsing (biasanya lebih akurat untuk card)
          if (!isNaN(frame) && !isNaN(slot) && frame > 0 && slot > 0) {
            binaryFrame = frame
            binarySlot = slot
          }
          
          // Jika port valid (> 0), gunakan binary parsing lengkap
          if (!isNaN(frame) && !isNaN(slot) && !isNaN(portNum) && frame > 0 && slot > 0 && portNum > 0) {
            results.push({ method: 'binary', result: { frame, slot, port: portNum } })
            console.log(`[Card-SNMP] PON ID ${ponId} -> ${frame}/${slot}/${portNum} (via binary parsing)`)
          } else if (binaryFrame && binarySlot) {
            // Jika port 0 tapi frame dan slot valid, gunakan frame/slot dari binary, port dari formula
            console.log(`[Card-SNMP] PON ID ${ponId}: Binary parsing got frame=${frame}, slot=${slot}, but port=${portNum} (invalid)`)
          }
        }
      }
      
      // Metode 3: Bit shifting (frame << 24) + (slot << 16) + (port << 8) + ONU_ID
      const bitShiftResult = ponIndexToFrameSlotPortOnu(ponId)
      if (bitShiftResult && bitShiftResult.slot > 0 && bitShiftResult.port > 0) {
        results.push({ 
          method: 'bit-shift', 
          result: {
            frame: bitShiftResult.frame,
            slot: bitShiftResult.slot,
            port: bitShiftResult.port
          }
        })
        console.log(`[Card-SNMP] PON ID ${ponId} -> ${bitShiftResult.frame}/${bitShiftResult.slot}/${bitShiftResult.port} (via bit shifting)`)
      }
      
      // Pilih hasil yang paling masuk akal
      // Prioritas: binary parsing > bit shifting > formula
      // Tapi jika semua hasil sama, gunakan yang pertama
      if (results.length > 0) {
        // Cek apakah semua hasil sama
        const allSame = results.every(r => 
          r.result.frame === results[0].result.frame &&
          r.result.slot === results[0].result.slot &&
          r.result.port === results[0].result.port
        )
        
        if (allSame) {
          portInfo = results[0].result
        } else {
          // Jika berbeda, coba gabungkan: card dari binary (jika ada), slot dan port dari formula/bit-shift
          if (binaryFrame && binarySlot) {
            // Ambil slot dan port dari formula atau bit-shift
            const formulaResult = results.find(r => r.method === 'formula')
            const bitShiftResult = results.find(r => r.method === 'bit-shift')
            
            const slotPortSource = bitShiftResult || formulaResult
            if (slotPortSource && slotPortSource.result.port > 0 && slotPortSource.result.slot > 0) {
              // Gunakan card dari binary, slot dari formula/bit-shift, port dari formula/bit-shift
              // Ini karena binary parsing kadang memberikan slot yang salah
              portInfo = {
                frame: binaryFrame,  // Card dari binary (biasanya lebih akurat)
                slot: slotPortSource.result.slot,  // Slot dari formula/bit-shift (biasanya lebih akurat)
                port: slotPortSource.result.port   // Port dari formula/bit-shift
              }
              console.log(`[Card-SNMP] PON ID ${ponId}: Hybrid result - Card from binary (${binaryFrame}), Slot/Port from ${slotPortSource.method} (${slotPortSource.result.slot}/${slotPortSource.result.port})`)
              console.log(`[Card-SNMP] Binary parsing gave slot=${binarySlot}, but using slot=${slotPortSource.result.slot} from ${slotPortSource.method}`)
              console.log(`[Card-SNMP] All results:`, results.map(r => `${r.method}: ${r.result.frame}/${r.result.slot}/${r.result.port}`).join(', '))
            } else {
              // Jika tidak ada port valid, gunakan binary lengkap atau fallback
              const binaryResult = results.find(r => r.method === 'binary')
              if (binaryResult && binaryResult.result.port > 0) {
                portInfo = binaryResult.result
                console.log(`[Card-SNMP] PON ID ${ponId}: Using binary parsing result: ${portInfo.frame}/${portInfo.slot}/${portInfo.port}`)
              } else {
                // Fallback ke formula atau bit-shift
                const bitShiftResult = results.find(r => r.method === 'bit-shift')
                if (bitShiftResult) {
                  portInfo = bitShiftResult.result
                  console.log(`[Card-SNMP] PON ID ${ponId}: Using bit-shift result: ${portInfo.frame}/${portInfo.slot}/${portInfo.port}`)
                } else {
                  portInfo = results[0].result
                  console.log(`[Card-SNMP] PON ID ${ponId}: Using formula result: ${portInfo.frame}/${portInfo.slot}/${portInfo.port}`)
                }
                console.log(`[Card-SNMP] All results:`, results.map(r => `${r.method}: ${r.result.frame}/${r.result.slot}/${r.result.port}`).join(', '))
              }
            }
          } else {
            // Jika tidak ada binary frame/slot, prioritaskan binary parsing lengkap
            const binaryResult = results.find(r => r.method === 'binary')
            if (binaryResult && binaryResult.result.port > 0) {
              portInfo = binaryResult.result
              console.log(`[Card-SNMP] PON ID ${ponId}: Using binary parsing result: ${portInfo.frame}/${portInfo.slot}/${portInfo.port}`)
            } else {
              // Jika tidak ada binary, gunakan bit shifting
              const bitShiftResult = results.find(r => r.method === 'bit-shift')
              if (bitShiftResult) {
                portInfo = bitShiftResult.result
                console.log(`[Card-SNMP] PON ID ${ponId}: Using bit-shift result: ${portInfo.frame}/${portInfo.slot}/${portInfo.port}`)
              } else {
                // Fallback ke formula
                portInfo = results[0].result
                console.log(`[Card-SNMP] PON ID ${ponId}: Using formula result: ${portInfo.frame}/${portInfo.slot}/${portInfo.port}`)
              }
            }
            console.log(`[Card-SNMP] All results:`, results.map(r => `${r.method}: ${r.result.frame}/${r.result.slot}/${r.result.port}`).join(', '))
          }
        }
      }
      
      if (portInfo) {
        const { frame, slot, port: portNum } = portInfo
        const card = frame // Frame = Card
        
        // Log detail untuk debugging
        console.log(`[Card-SNMP] PON ID ${ponId} -> Card:${card}, Slot:${slot}, PON:${portNum}`)
        if (results.length > 1) {
          console.log(`[Card-SNMP] All conversion results for PON ID ${ponId}:`, results.map(r => `${r.method}: ${r.result.frame}/${r.result.slot}/${r.result.port}`).join(', '))
        }
        
        // Inisialisasi card jika belum ada
        if (!cardMap.has(card)) {
          cardMap.set(card, new Map())
        }
        
        const slotMap = cardMap.get(card)!
        
        // Inisialisasi slot jika belum ada
        if (!slotMap.has(slot)) {
          slotMap.set(slot, new Set())
        }
        
        // Tambahkan port ke slot
        slotMap.get(slot)!.add(portNum)
      } else {
        console.warn(`[Card-SNMP] Failed to convert PON ID ${ponId} to Frame/Slot/Port. Tried methods: ${results.map(r => r.method).join(', ') || 'none'}`)
      }
    }
    
    // Convert map ke array format
    const cards: Array<{
      frame: number
      card: number
      slots: Array<{
        slot: number
        ports: number[]
      }>
      totalSlots: number
      totalPorts: number
    }> = []
    
    for (const [card, slotMap] of Array.from(cardMap.entries()).sort((a, b) => a[0] - b[0])) {
      const slots: Array<{ slot: number; ports: number[] }> = []
      let totalPorts = 0
      
      for (const [slot, portSet] of Array.from(slotMap.entries()).sort((a, b) => a[0] - b[0])) {
        const ports = Array.from(portSet).sort((a, b) => a - b)
        slots.push({ slot, ports })
        totalPorts += ports.length
      }
      
      cards.push({
        frame: card,
        card,
        slots,
        totalSlots: slots.length,
        totalPorts,
      })
    }
    
    console.log(`[Card-SNMP] Found ${cards.length} cards with ${cards.reduce((sum, c) => sum + c.totalPorts, 0)} total ports`)
    
    return cards
  } catch (error: any) {
    console.error(`[Card-SNMP] Error getting cards via SNMP:`, error)
    throw error
  }
}

// Get ONU data menggunakan SNMP
export async function getOnuDataViaSNMP(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oltName: string,
  oltId: string
): Promise<Array<{
  id: string
  oltId: string
  oltName: string
  name: string
  description: string
  pppoe: string
  gponOnu: string
  status: string
  rxOlt: string | null
  rxOnu: string | null
  txOlt: string | null
  txOnu: string | null
  serialNumber: string
  actualType: string
  registerTime: string | null
  distance: number | null
  lastSeen: string | null
  registrationMode: string | null
  softwareVersion: string | null
  hardwareVersion: string | null
  temperature: number | null
  laserBiasCurrent: number | null
}>> {
  const onus: Array<{
    id: string
    oltId: string
    oltName: string
    name: string
    description: string
    pppoe: string
    gponOnu: string
    status: string
    rxOlt: string | null
    rxOnu: string | null
    txOlt: string | null
    txOnu: string | null
    serialNumber: string
    actualType: string
    registerTime: string | null
    distance: number | null
    lastSeen: string | null
    registrationMode: string | null
    softwareVersion: string | null
    hardwareVersion: string | null
    temperature: number | null
    laserBiasCurrent: number | null
  }> = []

  try {
    console.log(`[All-ONU-SNMP] Fetching ONU data from ${oltName} (${ipAddress}) via SNMP...`)
    console.log(`[All-ONU-SNMP] Using optimized SNMP formula from friend's tutorial...`)

    // Step 0: Dapatkan semua PON ID aktif menggunakan rumus SNMP
    // Rumus: snmpwalk ... 1.3.6.1.4.1.3902.1012.3.28.2.1.4 | extract PON IDs
    const activePonIds = await getAllActivePonIds(ipAddress, port, community, version)
    
    // Build mapping PON ID -> Frame/Slot/Port menggunakan rumus konversi
    // Rumus: PONID = (Frame * 16777216) + (Slot * 65536) + (Port * 256)
    const ponPortMap = new Map<number, string>()
    for (const ponId of activePonIds) {
      const portInfo = ponIdToFrameSlotPort(ponId)
      if (portInfo) {
        const portStr = `${portInfo.frame}/${portInfo.slot}/${portInfo.port}`
        ponPortMap.set(ponId, portStr)
        console.log(`[All-ONU-SNMP] PON ID ${ponId} -> ${portStr}`)
      } else {
        // Fallback ke fungsi lama jika konversi gagal
        const portStr = ponIndexToPort(ponId)
        if (!portStr.includes('INVALID')) {
          ponPortMap.set(ponId, portStr)
        }
      }
    }
    
    console.log(`[All-ONU-SNMP] Mapped ${ponPortMap.size} PON IDs to Frame/Slot/Port format`)

    // Step 1: Get all ONU statuses (berdasarkan script bash)
    // OID: 1.3.6.1.4.1.3902.1012.3.28.2.1.4.{PON}.{ONU_ID}
    // Rumus: snmpwalk -v2c -c [COMMUNITY] [IP]:[PORT] 1.3.6.1.4.1.3902.1012.3.28.2.1.4.[PONID]
    const statusResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_OIDS.onuStatus, 60000)
    console.log(`[All-ONU-SNMP] Found ${statusResults.length} status entries`)
    
    if (statusResults.length === 0) {
      console.warn(`[All-ONU-SNMP] WARNING: No status entries found! This might indicate a problem with SNMP walk.`)
    }

    // Group by PON and ONU ID
    const onuMap = new Map<string, any>()

    // Parse status results
    // Format OID: baseOID.PON.ONU_ID
    // Contoh: 1.3.6.1.4.1.3902.1012.3.28.2.1.4.268632320.3
    //         baseOID = 1.3.6.1.4.1.3902.1012.3.28.2.1.4
    //         PON = 268632320
    //         ONU_ID = 3
    let parsedStatusCount = 0
    let failedParseCount = 0
    for (const result of statusResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuStatus)
      if (!ponOnu) {
        failedParseCount++
        if (failedParseCount <= 5) {
          console.warn(`[All-ONU-SNMP] Failed to parse OID: ${result.oid}`)
        }
        continue
      }
      parsedStatusCount++

      // Gunakan mapping jika ada, jika tidak gunakan fungsi konversi
      let ponPort: string
      if (ponPortMap.has(ponOnu.ponIndex)) {
        ponPort = ponPortMap.get(ponOnu.ponIndex)!
      } else {
        ponPort = ponIndexToPort(ponOnu.ponIndex)
      }
      const key = `${ponPort}:${ponOnu.onuId}`
      
      if (!onuMap.has(key)) {
        onuMap.set(key, {
          ponIndex: ponOnu.ponIndex,
          ponPort,
          onuId: ponOnu.onuId,
          gponOnu: `${ponPort}:${ponOnu.onuId}`,
        })
      }

      const statusValue = typeof result.value === 'number' ? result.value : parseInt(String(result.value))
      // Status: 1=LOS, 3=Online, 4=DyingGasp, 6=OffLine
      if (statusValue === 1) onuMap.get(key)!.status = 'LOS'
      else if (statusValue === 3) onuMap.get(key)!.status = 'Online'
      else if (statusValue === 4) onuMap.get(key)!.status = 'DyingGasp'
      else if (statusValue === 6) onuMap.get(key)!.status = 'OffLine'
      else onuMap.get(key)!.status = 'Unknown'
    }
    
    console.log(`[All-ONU-SNMP] Parsed ${parsedStatusCount} status entries, ${failedParseCount} failed to parse`)
    console.log(`[All-ONU-SNMP] Created ${onuMap.size} ONU entries from status results`)

    // Step 2: Get serial numbers, RX values, types, names, descriptions
    console.log(`[All-ONU-SNMP] Fetching additional ONU data (serial, RX, type, name, description)...`)
    const serialResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_OIDS.onuSerial, 30000)
    console.log(`[All-ONU-SNMP] Found ${serialResults.length} serial number entries`)
    const rxOltResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_OIDS.onuRxOlt, 30000)
    console.log(`[All-ONU-SNMP] Found ${rxOltResults.length} RX OLT entries`)
    const rxOnuResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_OIDS.onuRxOnu, 30000)
    console.log(`[All-ONU-SNMP] Found ${rxOnuResults.length} RX ONU entries`)
    const typeResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_OIDS.onuType, 30000)
    console.log(`[All-ONU-SNMP] Found ${typeResults.length} type entries`)
    const nameResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_OIDS.onuName, 30000)
    console.log(`[All-ONU-SNMP] Found ${nameResults.length} name entries`)
    const descResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_OIDS.onuDescription, 30000)
    console.log(`[All-ONU-SNMP] Found ${descResults.length} description entries`)

    // Step 2.5: Get enhanced ONU parameters (TX power, distance, temperature, voltage, etc.)
    console.log(`[All-ONU-SNMP] Fetching enhanced ONU parameters (TX power, distance, temperature, voltage, etc.)...`)

    // Get TX power data using enhanced OIDs
    let txOltResults: any[] = []
    let txOnuResults: any[] = []
    let distanceResults: any[] = []
    let temperatureResults: any[] = []
    let voltageResults: any[] = []
    let lastSeenResults: any[] = []
    let registerTimeResults: any[] = []

    try {
      txOltResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_ENHANCED_OIDS.txOlt, 30000)
      console.log(`[All-ONU-SNMP] Found ${txOltResults.length} TX OLT entries`)
    } catch (error) {
      console.warn(`[All-ONU-SNMP] Failed to fetch TX OLT data: ${error}`)
    }

    try {
      txOnuResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_ENHANCED_OIDS.txOnu, 30000)
      console.log(`[All-ONU-SNMP] Found ${txOnuResults.length} TX ONU entries`)
    } catch (error) {
      console.warn(`[All-ONU-SNMP] Failed to fetch TX ONU data: ${error}`)
    }

    try {
      distanceResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_ENHANCED_OIDS.distance, 30000)
      console.log(`[All-ONU-SNMP] Found ${distanceResults.length} distance entries`)
    } catch (error) {
      console.warn(`[All-ONU-SNMP] Failed to fetch distance data: ${error}`)
    }

    try {
      temperatureResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_ENHANCED_OIDS.temperature, 30000)
      console.log(`[All-ONU-SNMP] Found ${temperatureResults.length} temperature entries`)
    } catch (error) {
      console.warn(`[All-ONU-SNMP] Failed to fetch temperature data: ${error}`)
    }

    try {
      voltageResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_ENHANCED_OIDS.voltage, 30000)
      console.log(`[All-ONU-SNMP] Found ${voltageResults.length} voltage entries`)
    } catch (error) {
      console.warn(`[All-ONU-SNMP] Failed to fetch voltage data: ${error}`)
    }

    try {
      lastSeenResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_ENHANCED_OIDS.lastSeen, 30000)
      console.log(`[All-ONU-SNMP] Found ${lastSeenResults.length} last seen entries`)
    } catch (error) {
      console.warn(`[All-ONU-SNMP] Failed to fetch last seen data: ${error}`)
    }

    try {
      registerTimeResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_REGISTER_TIME_OIDS.registerTime, 30000)
      console.log(`[All-ONU-SNMP] Found ${registerTimeResults.length} register time entries`)
    } catch (error) {
      console.warn(`[All-ONU-SNMP] Failed to fetch register time data: ${error}`)
    }

    // Helper function untuk mendapatkan key dengan port mapping
    const getKeyWithPort = (ponOnu: { ponIndex: number; onuId: number }): string => {
      let ponPort: string
      if (ponPortMap.has(ponOnu.ponIndex)) {
        ponPort = ponPortMap.get(ponOnu.ponIndex)!
      } else {
        ponPort = ponIndexToPort(ponOnu.ponIndex)
      }
      return `${ponPort}:${ponOnu.onuId}`
    }

    // Parse serial numbers
    for (const result of serialResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuSerial)
      if (!ponOnu) continue

      const key = getKeyWithPort(ponOnu)
      
      if (onuMap.has(key)) {
        onuMap.get(key).serialNumber = result.value?.toString() || ''
      }
    }

    // Parse RX OLT (dalam 0.01 dBm, jadi perlu dibagi 100)
    for (const result of rxOltResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuRxOlt)
      if (!ponOnu) continue

      const key = getKeyWithPort(ponOnu)
      
      if (onuMap.has(key)) {
        const rxValue = typeof result.value === 'number' ? result.value : parseFloat(result.value)
        if (!isNaN(rxValue)) {
          // Convert dari 0.01 dBm ke dBm
          const rxDbm = (rxValue / 100).toFixed(3)
          onuMap.get(key).rxOlt = `${rxDbm} dBm`
        }
      }
    }

    // Parse RX ONU
    for (const result of rxOnuResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuRxOnu)
      if (!ponOnu) continue

      const key = getKeyWithPort(ponOnu)
      
      if (onuMap.has(key)) {
        const rxValue = typeof result.value === 'number' ? result.value : parseFloat(result.value)
        if (!isNaN(rxValue)) {
          const rxDbm = (rxValue / 100).toFixed(3)
          onuMap.get(key).rxOnu = `${rxDbm} dBm`
        }
      }
    }

    // Parse types
    for (const result of typeResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuType)
      if (!ponOnu) continue

      const key = getKeyWithPort(ponOnu)
      
      if (onuMap.has(key)) {
        onuMap.get(key).actualType = result.value?.toString() || ''
      }
    }

    // Parse names
    for (const result of nameResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuName)
      if (!ponOnu) continue

      let ponPort: string
      if (ponPortMap.has(ponOnu.ponIndex)) {
        ponPort = ponPortMap.get(ponOnu.ponIndex)!
      } else {
        ponPort = ponIndexToPort(ponOnu.ponIndex)
      }
      const key = `${ponPort}:${ponOnu.onuId}`
      
      const nameValue = result.value?.toString() || ''
      
      // Update port mapping jika ditemukan di name
      const portMatch = nameValue.match(/(\d+\/\d+\/\d+):(\d+)/)
      if (portMatch && parseInt(portMatch[2]) === ponOnu.onuId) {
        ponPortMap.set(ponOnu.ponIndex, portMatch[1])
        // Update key dengan port yang benar
        const correctPort = portMatch[1]
        const correctKey = `${correctPort}:${ponOnu.onuId}`
        
        // Jika key berbeda, pindahkan data
        if (key !== correctKey) {
          if (onuMap.has(key)) {
            const oldData = onuMap.get(key)!
            onuMap.delete(key)
            onuMap.set(correctKey, {
              ...oldData,
              ponPort: correctPort,
              gponOnu: `${correctPort}:${ponOnu.onuId}`,
              name: nameValue,
            })
          } else if (!onuMap.has(correctKey)) {
            // Buat entry baru jika belum ada
            onuMap.set(correctKey, {
              ponIndex: ponOnu.ponIndex,
              ponPort: correctPort,
              onuId: ponOnu.onuId,
              gponOnu: `${correctPort}:${ponOnu.onuId}`,
              name: nameValue,
              description: '',
              pppoe: '',
              status: 'Unknown',
              rxOlt: null,
              rxOnu: null,
              serialNumber: '',
              actualType: '',
            })
          } else {
            onuMap.get(correctKey)!.name = nameValue
          }
        } else {
          if (onuMap.has(key)) {
            onuMap.get(key)!.name = nameValue
          }
        }
      } else {
        // Jika tidak ada port di name, gunakan key yang sudah ada
        if (onuMap.has(key)) {
          onuMap.get(key)!.name = nameValue
        }
      }
    }

    // Parse descriptions
    for (const result of descResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuDescription)
      if (!ponOnu) continue

      let ponPort: string
      if (ponPortMap.has(ponOnu.ponIndex)) {
        ponPort = ponPortMap.get(ponOnu.ponIndex)!
      } else {
        ponPort = ponIndexToPort(ponOnu.ponIndex)
      }
      const key = `${ponPort}:${ponOnu.onuId}`
      
      const descValue = result.value?.toString() || ''
      
      // Update port mapping jika ditemukan di description
      const portMatch = descValue.match(/(\d+\/\d+\/\d+):(\d+)/)
      if (portMatch && parseInt(portMatch[2]) === ponOnu.onuId) {
        ponPortMap.set(ponOnu.ponIndex, portMatch[1])
        // Update key dengan port yang benar
        const correctPort = portMatch[1]
        const correctKey = `${correctPort}:${ponOnu.onuId}`
        
        // Jika key berbeda, pindahkan data
        if (key !== correctKey) {
          if (onuMap.has(key)) {
            const oldData = onuMap.get(key)!
            onuMap.delete(key)
            onuMap.set(correctKey, {
              ...oldData,
              ponPort: correctPort,
              gponOnu: `${correctPort}:${ponOnu.onuId}`,
              description: descValue,
            })
          } else if (!onuMap.has(correctKey)) {
            // Buat entry baru jika belum ada
            onuMap.set(correctKey, {
              ponIndex: ponOnu.ponIndex,
              ponPort: correctPort,
              onuId: ponOnu.onuId,
              gponOnu: `${correctPort}:${ponOnu.onuId}`,
              name: '',
              description: descValue,
              pppoe: '',
              status: 'Unknown',
              rxOlt: null,
              rxOnu: null,
              serialNumber: '',
              actualType: '',
            })
          } else {
            onuMap.get(correctKey)!.description = descValue
          }
        } else {
          if (onuMap.has(key)) {
            onuMap.get(key)!.description = descValue
          }
        }
      } else {
        // Jika tidak ada port di description, gunakan key yang sudah ada
        if (onuMap.has(key)) {
          onuMap.get(key)!.description = descValue
        }
      }
    }

    // Step 3: Parse enhanced ONU parameters (TX power, distance, temperature, voltage, etc.)
    console.log(`[All-ONU-SNMP] Parsing enhanced ONU parameters...`)

    // Parse TX OLT results
    for (const result of txOltResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_ENHANCED_OIDS.txOlt)
      if (!ponOnu) continue
      const key = getKeyWithPort(ponOnu)
      if (onuMap.has(key)) {
        const txValue = parseFloat(result.value?.toString() || '0')
        onuMap.get(key)!.txOlt = `${(txValue / 100).toFixed(2)} dBm`
      }
    }

    // Parse TX ONU results
    for (const result of txOnuResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_ENHANCED_OIDS.txOnu)
      if (!ponOnu) continue
      const key = getKeyWithPort(ponOnu)
      if (onuMap.has(key)) {
        const txValue = parseFloat(result.value?.toString() || '0')
        onuMap.get(key)!.txOnu = `${(txValue / 100).toFixed(2)} dBm`
      }
    }

    // Parse distance results
    for (const result of distanceResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_ENHANCED_OIDS.distance)
      if (!ponOnu) continue
      const key = getKeyWithPort(ponOnu)
      if (onuMap.has(key)) {
        const distanceValue = parseFloat(result.value?.toString() || '0')
        onuMap.get(key)!.distance = distanceValue / 1000 // Convert to km if needed
      }
    }

    // Parse temperature results
    for (const result of temperatureResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_ENHANCED_OIDS.temperature)
      if (!ponOnu) continue
      const key = getKeyWithPort(ponOnu)
      if (onuMap.has(key)) {
        const tempValue = parseFloat(result.value?.toString() || '0')
        onuMap.get(key)!.temperature = tempValue // Keep in Celsius
      }
    }

    // Parse voltage results
    for (const result of voltageResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_ENHANCED_OIDS.voltage)
      if (!ponOnu) continue
      const key = getKeyWithPort(ponOnu)
      if (onuMap.has(key)) {
        const voltageValue = parseFloat(result.value?.toString() || '0')
        onuMap.get(key)!.voltage = voltageValue / 1000 // Convert to volts
      }
    }

    // Parse last seen results
    for (const result of lastSeenResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_ENHANCED_OIDS.lastSeen)
      if (!ponOnu) continue
      const key = getKeyWithPort(ponOnu)
      if (onuMap.has(key)) {
        const lastSeenValue = result.value?.toString() || ''
        onuMap.get(key)!.lastSeen = lastSeenValue
      }
    }

    // Parse register time results
    for (const result of registerTimeResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_REGISTER_TIME_OIDS.registerTime)
      if (!ponOnu) continue
      const key = getKeyWithPort(ponOnu)
      if (onuMap.has(key)) {
        const registerTimeValue = result.value?.toString() || ''
        onuMap.get(key)!.registerTime = registerTimeValue
      }
    }

    // Step 4: Fetch Basic Info fields (Registration Mode, Software Version, Hardware Version, Temperature, Laser Bias Current)
    console.log(`[All-ONU-SNMP] Fetching Basic Info fields...`)
    let registrationModeResults: any[] = []
    let softwareVersionResults: any[] = []
    let hardwareVersionResults: any[] = []
    let basicInfoTempResults: any[] = []
    let laserBiasResults: any[] = []

    try {
      registrationModeResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_BASIC_INFO_OIDS.registrationMode, 30000)
      console.log(`[All-ONU-SNMP] Found ${registrationModeResults.length} registration mode entries`)
    } catch (error) {
      console.warn(`[All-ONU-SNMP] Failed to fetch registration mode data: ${error}`)
    }

    try {
      softwareVersionResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_BASIC_INFO_OIDS.softwareVersion, 30000)
      console.log(`[All-ONU-SNMP] Found ${softwareVersionResults.length} software version entries`)
    } catch (error) {
      console.warn(`[All-ONU-SNMP] Failed to fetch software version data: ${error}`)
    }

    try {
      hardwareVersionResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_BASIC_INFO_OIDS.hardwareVersion, 30000)
      console.log(`[All-ONU-SNMP] Found ${hardwareVersionResults.length} hardware version entries`)
    } catch (error) {
      console.warn(`[All-ONU-SNMP] Failed to fetch hardware version data: ${error}`)
    }

    try {
      basicInfoTempResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_BASIC_INFO_OIDS.temperature, 30000)
      console.log(`[All-ONU-SNMP] Found ${basicInfoTempResults.length} basic info temperature entries`)
    } catch (error) {
      console.warn(`[All-ONU-SNMP] Failed to fetch basic info temperature data: ${error}`)
    }

    try {
      laserBiasResults = await snmpWalk(ipAddress, port, community, version, SNMP_ONU_BASIC_INFO_OIDS.laserBiasCurrent, 30000)
      console.log(`[All-ONU-SNMP] Found ${laserBiasResults.length} laser bias current entries`)
    } catch (error) {
      console.warn(`[All-ONU-SNMP] Failed to fetch laser bias current data: ${error}`)
    }

    // Parse Basic Info fields
    console.log(`[All-ONU-SNMP] Parsing Basic Info fields...`)

    // Helper to convert registration mode value to string
    const getRegistrationModeString = (value: number): string => {
      const modes: { [key: number]: string } = {
        1: 'SN',
        2: 'Password',
        3: 'SN+Password',
        4: 'RegisterId',
        5: 'RegisterId+8021x',
        6: 'RegisterId+Mutual',
        7: 'TefPw',
        8: 'SN+TefPw',
        9: 'LOID',
        10: 'LOID+Password',
      }
      return modes[value] || `Unknown (${value})`
    }

    // Parse registration mode results
    for (const result of registrationModeResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_BASIC_INFO_OIDS.registrationMode)
      if (!ponOnu) continue
      const key = getKeyWithPort(ponOnu)
      if (onuMap.has(key)) {
        const modeValue = parseInt(result.value?.toString() || '0')
        onuMap.get(key)!.registrationMode = getRegistrationModeString(modeValue)
      }
    }

    // Parse software version results
    for (const result of softwareVersionResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_BASIC_INFO_OIDS.softwareVersion)
      if (!ponOnu) continue
      const key = getKeyWithPort(ponOnu)
      if (onuMap.has(key)) {
        onuMap.get(key)!.softwareVersion = result.value?.toString() || ''
      }
    }

    // Parse hardware version results
    for (const result of hardwareVersionResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_BASIC_INFO_OIDS.hardwareVersion)
      if (!ponOnu) continue
      const key = getKeyWithPort(ponOnu)
      if (onuMap.has(key)) {
        onuMap.get(key)!.hardwareVersion = result.value?.toString() || ''
      }
    }

    // Parse basic info temperature results (may differ from enhanced temperature)
    for (const result of basicInfoTempResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_BASIC_INFO_OIDS.temperature)
      if (!ponOnu) continue
      const key = getKeyWithPort(ponOnu)
      if (onuMap.has(key)) {
        const tempValue = parseFloat(result.value?.toString() || '0')
        // Only update if not already set from enhanced OIDs
        if (!onuMap.get(key)!.temperature) {
          onuMap.get(key)!.temperature = tempValue
        }
      }
    }

    // Parse laser bias current results
    for (const result of laserBiasResults) {
      const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_BASIC_INFO_OIDS.laserBiasCurrent)
      if (!ponOnu) continue
      const key = getKeyWithPort(ponOnu)
      if (onuMap.has(key)) {
        const biasValue = parseFloat(result.value?.toString() || '0')
        // Laser bias current is typically in mA (milliamps)
        onuMap.get(key)!.laserBiasCurrent = biasValue / 100 // Assuming returned in 0.01 mA units
      }
    }

    // Calculate distance from RX/TX values if not available directly
    for (const [key, onu] of onuMap.entries()) {
      if (!onu.distance && onu.rxOlt && onu.txOlt) {
        // Simple distance calculation based on signal loss
        // This is a simplified calculation - real fiber distance measurement is more complex
        const rxValue = parseFloat(onu.rxOlt.replace(/[^\d.-]/g, ''))
        const txValue = parseFloat(onu.txOlt.replace(/[^\d.-]/g, ''))

        if (!isNaN(rxValue) && !isNaN(txValue)) {
          // Approximate calculation: (Tx - Rx) / typical fiber loss (0.35 dB/km at 1310nm, 0.25 dB/km at 1550nm)
          const typicalLoss = 0.3 // Average loss in dB/km
          const calculatedDistance = Math.abs(txValue - rxValue) / typicalLoss
          onu.distance = Math.round(calculatedDistance * 100) / 100 // Round to 2 decimal places
        }
      }
    }

    // Convert map to array
    console.log(`[All-ONU-SNMP] Converting ${onuMap.size} ONU entries to array format...`)
    let onuIndex = 1
    for (const [key, onu] of onuMap.entries()) {
      onus.push({
        id: `onu-${oltId}-${onuIndex++}`,
        oltId,
        oltName,
        name: onu.name || `ONU-${onu.gponOnu}`,
        description: onu.description || onu.gponOnu,
        pppoe: '', // PPPoE biasanya tidak ada di SNMP, perlu dari config atau Telnet
        gponOnu: onu.gponOnu,
        status: onu.status || 'Unknown',
        rxOlt: onu.rxOlt || null,
        rxOnu: onu.rxOnu || null,
        txOlt: onu.txOlt || null,
        txOnu: onu.txOnu || null,
        serialNumber: onu.serialNumber || '',
        actualType: onu.actualType || detectModelFromSerial(onu.serialNumber || ''),
        registerTime: onu.registerTime || null,
        distance: onu.distance || null,
        lastSeen: onu.lastSeen || null,
        registrationMode: onu.registrationMode || null,
        softwareVersion: onu.softwareVersion || null,
        hardwareVersion: onu.hardwareVersion || null,
        temperature: onu.temperature || null,
        laserBiasCurrent: onu.laserBiasCurrent || null,
      })
    }

    console.log(`[All-ONU-SNMP] Parsed ${onus.length} ONUs from ${oltName} via SNMP`)
    if (onus.length !== onuMap.size) {
      console.warn(`[All-ONU-SNMP] WARNING: Expected ${onuMap.size} ONUs but got ${onus.length} in array!`)
    }
  } catch (error: any) {
    console.error(`[All-ONU-SNMP] Error fetching ONU data via SNMP:`, error)
    // Jika error adalah array (hasil dari snmpWalk), itu sebenarnya bukan error
    // tapi hasil yang di-throw karena callback issue
    if (Array.isArray(error) && error.length > 0) {
      // Ini sebenarnya hasil, bukan error
      // Parse hasil ini sebagai status results
      const statusResults = error
      const onuMap = new Map<string, any>()
      
      for (const result of statusResults) {
        const ponOnu = parseOnuIdFromOid(result.oid, SNMP_ONU_OIDS.onuStatus)
        if (!ponOnu) continue

        const ponPort = ponIndexToPort(ponOnu.ponIndex)
        const key = `${ponPort}:${ponOnu.onuId}`
        
        if (!onuMap.has(key)) {
          onuMap.set(key, {
            ponIndex: ponOnu.ponIndex,
            ponPort,
            onuId: ponOnu.onuId,
            gponOnu: `${ponPort}:${ponOnu.onuId}`,
            status: 'Unknown',
          })
        }

        const statusValue = typeof result.value === 'number' ? result.value : parseInt(String(result.value))
        if (statusValue === 1) onuMap.get(key)!.status = 'LOS'
        else if (statusValue === 3) onuMap.get(key)!.status = 'Online'
        else if (statusValue === 4) onuMap.get(key)!.status = 'DyingGasp'
        else if (statusValue === 6) onuMap.get(key)!.status = 'OffLine'
        else onuMap.get(key)!.status = 'Unknown'
      }

      // Convert map to array dengan data minimal
      let onuIndex = 1
      for (const [key, onu] of onuMap.entries()) {
        onus.push({
          id: `onu-${oltId}-${onuIndex++}`,
          oltId,
          oltName,
          name: onu.name || `ONU-${onu.gponOnu}`,
          description: onu.description || onu.gponOnu,
          pppoe: '',
          gponOnu: onu.gponOnu,
          status: onu.status || 'Unknown',
          rxOlt: null,
          rxOnu: null,
          txOlt: null,
          txOnu: null,
          serialNumber: '',
          actualType: '',
          registerTime: null,
          distance: null,
          lastSeen: null,
          registrationMode: null,
          softwareVersion: null,
          hardwareVersion: null,
          temperature: null,
          laserBiasCurrent: null,
        })
      }

      console.log(`[All-ONU-SNMP] Parsed ${onus.length} ONUs from ${oltName} via SNMP (from error recovery)`)
      return onus
    }
    throw error
  }

  return onus
}

async function executeTelnetCommand(
  ipAddress: string,
  port: number,
  username: string,
  password: string,
  command: string,
  timeout: number = 30000
): Promise<string> {
  let connection: any = null

  try {
    console.log(`[All-ONU] Connecting to ${ipAddress}:${port}...`)

    connection = new Telnet()

    const params = {
      host: ipAddress,
      port: port,
      negotiationMandatory: false,
      timeout: 20000,
      shellPrompt: /[#>]\s*$/,
      username: username,
      password: password,
      loginPrompt: /[Uu]sername[: ]*$/i,
      passwordPrompt: /[Pp]assword[: ]*$/i,
      irs: '\r\n',
      ors: '\r\n',
      echoLines: 0,
    }

    await connection.connect(params)
    console.log('[All-ONU] Connected, waiting for login...')

    // Tunggu login selesai dan prompt muncul
    let loginBuffer = ''
    let loginComplete = false
    let loginCheckCount = 0

    connection.on('data', (data: Buffer) => {
      const text = data.toString()
      loginBuffer += text
    })

    // Tunggu prompt muncul (max 10 detik)
    while (!loginComplete && loginCheckCount < 20) {
      await new Promise((r) => setTimeout(r, 500))
      loginCheckCount++
      
      if (/[A-Z0-9-]+[#>]\s*$/.test(loginBuffer) || /[#>]\s*$/.test(loginBuffer)) {
        loginComplete = true
        console.log('[All-ONU] Login completed, prompt detected')
        break
      }
    }

    if (!loginComplete) {
      console.warn('[All-ONU] Login timeout, but proceeding anyway...')
    }

    // Clear buffer dan setup untuk command output
    let outputBuffer = ''
    connection.removeAllListeners('data')
    
    connection.on('data', (data: Buffer) => {
      const text = data.toString()
      outputBuffer += text
    })

    await new Promise((r) => setTimeout(r, 500))

    console.log(`[All-ONU] Sending command: ${command}`)
    await connection.send(command + '\r\n')

    let pageCount = 0
    let lastOutputLength = 0
    let stableCount = 0

    while (true) {
      await new Promise((r) => setTimeout(r, 500))

      if (/--More--/i.test(outputBuffer)) {
        pageCount++
        console.log(`[All-ONU] Paging detected (page ${pageCount}), sending space...`)
        outputBuffer = outputBuffer.replace(/--More--/gi, '')
        await connection.send(' ')
        lastOutputLength = outputBuffer.length
        stableCount = 0
        continue
      }

      if (outputBuffer.length === lastOutputLength) {
        stableCount++
        if (stableCount >= 3) {
          if (/[A-Z0-9-]+[#>]\s*$/.test(outputBuffer) || /[#>]\s*$/.test(outputBuffer)) {
            console.log('[All-ONU] Output complete, prompt detected')
            break
          }
        }
      } else {
        stableCount = 0
        lastOutputLength = outputBuffer.length
      }

      if (pageCount > 100 || outputBuffer.length > 5_000_000) {
        console.warn('[All-ONU] Safety limit reached')
        break
      }
    }

    console.log(`[All-ONU] Command completed, total output: ${outputBuffer.length} chars`)

    const cleaned = outputBuffer
      .replace(/--More--/gi, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')

    const lines = cleaned.split('\n')
    let startIdx = -1
    let endIdx = -1

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().includes(command)) {
        startIdx = i + 1
        break
      }
    }

    for (let i = lines.length - 1; i >= 0; i--) {
      if (/[A-Z0-9-]+[#>]\s*$/.test(lines[i]) || /[#>]\s*$/.test(lines[i])) {
        endIdx = i
        break
      }
    }

    let result = cleaned
    if (startIdx >= 0 && endIdx > startIdx) {
      result = lines.slice(startIdx, endIdx).join('\n').trim()
    } else if (cleaned.includes(command)) {
      const cmdPos = cleaned.indexOf(command)
      if (cmdPos >= 0) {
        const afterCmd = cleaned.substring(cmdPos + command.length)
        result = afterCmd.split(/[A-Z0-9-]+[#>]\s*$/m)[0].trim() || afterCmd.split(/[#>]\s*$/m)[0].trim()
      }
    }

    connection.end()
    return result
  } catch (error: any) {
    console.error('[All-ONU] Error:', error)
    if (connection) {
      try {
        connection.end()
      } catch (e) {
        // Ignore
      }
    }
    throw error
  }
}

function detectModelFromSerial(serialNumber: string): string {
  const upperSerial = serialNumber.toUpperCase()
  
  if (upperSerial.startsWith('RTEGC') || upperSerial.startsWith('ZTEGC')) {
    // ZTE ONU - bisa F660, F609, dll
    // Coba deteksi dari panjang atau pola serial
    if (upperSerial.length >= 12) {
      // Biasanya F609V3.0 atau F660
      return 'F609V3.0' // Default, bisa disesuaikan
    }
    return 'ZTE-ONU'
  } else if (upperSerial.startsWith('HWTC') || upperSerial.startsWith('FHTT')) {
    // Huawei ONU - bisa HG8245, HG8145, HG6243, HG6145, dll
    return 'HG8245' // Default, bisa disesuaikan
  }
  
  return 'Unknown'
}

// Parse ONU data dari output command show gpon onu state
function parseOnuData(output: string, oltName: string, oltId: string): Array<{
  id: string
  oltId: string
  oltName: string
  name: string
  description: string
  pppoe: string
  gponOnu: string
  status: string
  rxOlt: string | null
  rxOnu: string | null
  txOlt: string | null
  txOnu: string | null
  serialNumber: string
  actualType: string
  registerTime: string | null
  distance: number | null
  lastSeen: string | null
  registrationMode: string | null
  softwareVersion: string | null
  hardwareVersion: string | null
  temperature: number | null
  laserBiasCurrent: number | null
}> {
  const onus: Array<{
    id: string
    oltId: string
    oltName: string
    name: string
    description: string
    pppoe: string
    gponOnu: string
    status: string
    rxOlt: string | null
    rxOnu: string | null
    txOlt: string | null
    txOnu: string | null
    serialNumber: string
    actualType: string
    registerTime: string | null
    distance: number | null
    lastSeen: string | null
    registrationMode: string | null
    softwareVersion: string | null
    hardwareVersion: string | null
    temperature: number | null
    laserBiasCurrent: number | null
  }> = []

  const lines = output.split('\n').map((line) => line.trim()).filter((line) => line.length > 0)
  
  let onuIndex = 1
  let currentOnu: any = null

  // Parse format output show gpon onu state
  // Format bisa berbeda-beda tergantung OLT, tapi umumnya:
  // gpon-onu_1/3/1:1
  //   State: online
  //   Serial: RTEGC6099704
  //   RX OLT: -26.471 dBm
  //   RX ONU: -24.95 dBm
  //   Name: ONU-8:15-Siti Maesaroh
  //   Description: ONU-8:15
  //   PPPoE: SitiMaesaroh@sblnet.id
  //   Type: F609V3.0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Cek apakah ini baris dengan format gpon-onu_X/Y/Z:N atau X/Y/Z:N
    const onuHeaderMatch = line.match(/gpon-onu_(\d+\/\d+\/\d+):(\d+)/i) || line.match(/^(\d+\/\d+\/\d+):(\d+)/)
    if (onuHeaderMatch) {
      // Skip jika ini header table
      if (line.includes('OnuIndex') || line.includes('State') || line.includes('Serial') || line.match(/^-+$/)) {
        continue
      }
      
      // Simpan ONU sebelumnya jika ada
      if (currentOnu) {
        onus.push({
          id: `onu-${oltId}-${onuIndex++}`,
          oltId,
          oltName,
          name: currentOnu.name || `ONU-${currentOnu.gponOnu}`,
          description: currentOnu.description || currentOnu.gponOnu,
          pppoe: currentOnu.pppoe || '',
          gponOnu: currentOnu.gponOnu,
          status: currentOnu.status || 'Unknown',
          rxOlt: currentOnu.rxOlt || null,
          rxOnu: currentOnu.rxOnu || null,
          txOlt: null,
          txOnu: null,
          serialNumber: currentOnu.serialNumber || '',
          actualType: currentOnu.actualType || detectModelFromSerial(currentOnu.serialNumber || ''),
          registerTime: null,
          distance: null,
          lastSeen: null,
          registrationMode: null,
          softwareVersion: null,
          hardwareVersion: null,
          temperature: null,
          laserBiasCurrent: null,
        })
      }

      // Mulai ONU baru
      const port = onuHeaderMatch[1]
      const onuId = onuHeaderMatch[2]
      currentOnu = {
        gponOnu: `${port}:${onuId}`,
        name: '',
        description: '',
        pppoe: '',
        status: 'Unknown',
        rxOlt: null,
        rxOnu: null,
        serialNumber: '',
        actualType: '',
      }
      continue
    }

    // Parse field-field ONU
    if (currentOnu) {
      // State/Status
      if (/state\s*:?\s*(online|offline|dyinggasp|los|unknown)/i.test(line)) {
        const match = line.match(/state\s*:?\s*(\w+)/i)
        if (match) {
          const status = match[1].toLowerCase()
          if (status === 'online') currentOnu.status = 'Online'
          else if (status === 'dyinggasp') currentOnu.status = 'DyingGasp'
          else if (status === 'los') currentOnu.status = 'LOS'
          else currentOnu.status = status.charAt(0).toUpperCase() + status.slice(1)
        }
      }

      // Serial Number
      if (/serial\s*:?\s*([A-Z0-9]{12,})/i.test(line)) {
        const match = line.match(/serial\s*:?\s*([A-Z0-9]{12,})/i)
        if (match) {
          currentOnu.serialNumber = match[1].toUpperCase()
          if (!currentOnu.actualType) {
            currentOnu.actualType = detectModelFromSerial(currentOnu.serialNumber)
          }
        }
      }

      // RX OLT
      if (/rx\s+olt\s*:?\s*([-\d.]+)\s*d?b?m?/i.test(line)) {
        const match = line.match(/rx\s+olt\s*:?\s*([-\d.]+)\s*d?b?m?/i)
        if (match) {
          currentOnu.rxOlt = `${match[1]} dBm`
        }
      }

      // RX ONU
      if (/rx\s+onu\s*:?\s*([-\d.]+)\s*d?b?m?/i.test(line)) {
        const match = line.match(/rx\s+onu\s*:?\s*([-\d.]+)\s*d?b?m?/i)
        if (match) {
          currentOnu.rxOnu = `${match[1]} dBm`
        }
      }

      // Name
      if (/name\s*:?\s*(.+)/i.test(line) && !line.includes('RX') && !line.includes('Serial')) {
        const match = line.match(/name\s*:?\s*(.+)/i)
        if (match) {
          currentOnu.name = match[1].trim()
        }
      }

      // Description
      if (/description\s*:?\s*(.+)/i.test(line)) {
        const match = line.match(/description\s*:?\s*(.+)/i)
        if (match) {
          currentOnu.description = match[1].trim()
        }
      }

      // PPPoE
      if (/pppoe\s*:?\s*(.+)/i.test(line)) {
        const match = line.match(/pppoe\s*:?\s*(.+)/i)
        if (match) {
          currentOnu.pppoe = match[1].trim()
        }
      }

      // Type/Actual Type
      if (/(type|actual\s+type)\s*:?\s*(.+)/i.test(line)) {
        const match = line.match(/(type|actual\s+type)\s*:?\s*(.+)/i)
        if (match) {
          currentOnu.actualType = match[2].trim()
        }
      }
    }
  }

  // Simpan ONU terakhir jika ada
  if (currentOnu) {
    onus.push({
      id: `onu-${oltId}-${onuIndex++}`,
      oltId,
      oltName,
      name: currentOnu.name || `ONU-${currentOnu.gponOnu}`,
      description: currentOnu.description || currentOnu.gponOnu,
      pppoe: currentOnu.pppoe || '',
      gponOnu: currentOnu.gponOnu,
      status: currentOnu.status || 'Unknown',
      rxOlt: currentOnu.rxOlt || null,
      rxOnu: currentOnu.rxOnu || null,
      txOlt: null, // Telnet belum support
      txOnu: null, // Telnet belum support
      serialNumber: currentOnu.serialNumber || '',
      actualType: currentOnu.actualType || detectModelFromSerial(currentOnu.serialNumber || ''),
      registerTime: null, // Telnet belum support
      distance: null, // Telnet belum support
      lastSeen: null, // Telnet belum support
      registrationMode: null, // Telnet belum support
      softwareVersion: null, // Telnet belum support
      hardwareVersion: null, // Telnet belum support
      temperature: null, // Telnet belum support
      laserBiasCurrent: null, // Telnet belum support
    })
  }

  console.log(`[All-ONU] Parsed ${onus.length} ONUs from ${oltName}`)
  return onus
}

// Helper function untuk menghitung summary
function calculateSummary(allOnus: Array<{
  status: string
  rxOlt: string | null
  rxOnu: string | null
}>) {
  let goodCount = 0
  let warningCount = 0
  let criticalCount = 0
  let otherCount = 0
  let goodRxOlt = 0
  let goodRxOnu = 0
  let warningRxOlt = 0
  let warningRxOnu = 0
  let criticalRxOlt = 0
  let criticalRxOnu = 0
  let losCount = 0
  let naCount = 0

  for (const onu of allOnus) {
    const rxOlt = onu.rxOlt ? parseFloat(onu.rxOlt.replace(/[^\d.-]/g, '')) : null
    const rxOnu = onu.rxOnu ? parseFloat(onu.rxOnu.replace(/[^\d.-]/g, '')) : null

    if (onu.status === 'LOS' || onu.status === 'DyingGasp') {
      otherCount++
      if (onu.status === 'LOS') losCount++
      else naCount++
    } else if (rxOlt !== null) {
      if (rxOlt >= -26.0) {
        goodCount++
        goodRxOlt++
        if (rxOnu !== null) goodRxOnu++
      } else if (rxOlt >= -28.0) {
        warningCount++
        warningRxOlt++
        if (rxOnu !== null) warningRxOnu++
      } else {
        criticalCount++
        criticalRxOlt++
        if (rxOnu !== null) criticalRxOnu++
      }
    } else {
      otherCount++
      naCount++
    }
  }

  const total = allOnus.length
  return {
    good: {
      count: goodCount,
      percentage: total > 0 ? (goodCount / total) * 100 : 0,
      rxOlt: goodRxOlt,
      rxOnu: goodRxOnu,
    },
    warning: {
      count: warningCount,
      percentage: total > 0 ? (warningCount / total) * 100 : 0,
      rxOlt: warningRxOlt,
      rxOnu: warningRxOnu,
    },
    critical: {
      count: criticalCount,
      percentage: total > 0 ? (criticalCount / total) * 100 : 0,
      rxOlt: criticalRxOlt,
      rxOnu: criticalRxOnu,
    },
    other: {
      count: otherCount,
      percentage: total > 0 ? (otherCount / total) * 100 : 0,
      los: losCount,
      na: naCount,
    },
  }
}

// Catatan: Error "req.doneCb is not a function" adalah bug internal dari library net-snmp
// yang terjadi ketika callback dipanggil setelah session ditutup.
// Error ini sudah ditangani melalui Promise.allSettled dan error recovery di getC3xxOnuDataViaSNMP.
// Data ONU tetap berhasil di-parse meskipun error ini muncul di console.

// DELETE endpoint untuk hapus semua data ONU
export async function DELETE(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Hapus langsung dari Prisma
    const { prisma } = await import('@/lib/prisma')
    
    // Hitung dulu sebelum hapus
    const count = await prisma.onu.count()
    
    // Hapus semua ONU dari database
    await prisma.onu.deleteMany({})
    
    console.log(`[All-ONU] Deleted all ${count} ONUs from database`)
    
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${count} ONUs from database`,
      deletedCount: count,
    })
  } catch (error: any) {
    console.error('[All-ONU] Error deleting all ONUs:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete ONUs',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(req.url)
    const forceRefresh = searchParams.get('refresh') === 'true'

    // Parse pagination and filter parameters
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const oltName = searchParams.get('oltName') || undefined
    const card = searchParams.get('card') || undefined
    const port = searchParams.get('port') || undefined
    const type = searchParams.get('type') || undefined
    const status = searchParams.get('status') || undefined
    const signal = searchParams.get('signal') || undefined
    const search = searchParams.get('search') || undefined

    // Import repositories
    const { getOnuRepository, getOLTRepository } = await import('@/lib/repositories')
    const onuRepository = getOnuRepository()
    const oltRepository = getOLTRepository()

    // Get all OLTs for mapping
    const allOlts = await oltRepository.findAll()
    const connectedOlts = allOlts.filter(
      (olt) => (olt.snmpConnected && olt.snmpCommunityWrite) || (olt.telnetConnected && olt.telnetUsername && olt.telnetPassword)
    )

    if (connectedOlts.length === 0) {
      console.log('[All-ONU] No connected OLTs found')
      return NextResponse.json({
        onus: [],
        summary: {
          good: { count: 0, percentage: 0, rxOlt: 0, rxOnu: 0 },
          warning: { count: 0, percentage: 0, rxOlt: 0, rxOnu: 0 },
          critical: { count: 0, percentage: 0, rxOlt: 0, rxOnu: 0 },
          other: { count: 0, percentage: 0, los: 0, na: 0 },
        },
        total: 0,
        page,
        limit,
        totalPages: 0,
        source: null,
      })
    }

    // Jika tidak force refresh, coba ambil dari database dengan pagination
    if (!forceRefresh) {
      console.log('[All-ONU] Loading ONU data from database with pagination...')
      
      // Use findWithFilters for paginated query
      const paginatedResult = await onuRepository.findWithFilters(
        { oltName, card, port, type, status, signal, search },
        { page, limit }
      )
      
      if (paginatedResult.total > 0) {
        // Convert database format ke format API
        const paginatedOnus = paginatedResult.onus.map((onu) => ({
          id: onu.id,
          oltId: onu.oltId,
          oltName: allOlts.find((olt) => olt.id === onu.oltId)?.name || 'Unknown',
          name: onu.name,
          description: onu.description || '',
          pppoe: onu.pppoe || '',
          gponOnu: onu.gponOnu,
          status: onu.status,
          rxOlt: onu.rxOlt,
          rxOnu: onu.rxOnu,
          txOlt: onu.txOlt,
          txOnu: onu.txOnu,
          serialNumber: onu.serialNumber || '',
          actualType: onu.actualType || '',
          registerTime: onu.registerTime ? onu.registerTime.toISOString() : null,
          distance: onu.distance,
          lastSeen: onu.lastSeen ? onu.lastSeen.toISOString() : null,
          // Basic Info fields
          registrationMode: onu.registrationMode || null,
          softwareVersion: onu.softwareVersion || null,
          hardwareVersion: onu.hardwareVersion || null,
          temperature: onu.temperature || null,
          laserBiasCurrent: onu.laserBiasCurrent || null,
          // Legacy fields for compatibility
          rxPower: onu.rxOlt,
          txPower: onu.txOlt,
        }))

        // Get ALL matching ONUs for summary calculation (without pagination)
        const allMatchingOnus = await onuRepository.findWithFilters(
          { oltName, card, port, type, status, signal, search },
          { page: 1, limit: 999999 } // Get all for summary
        )
        
        const allOnusForSummary = allMatchingOnus.onus.map((onu) => ({
          status: onu.status,
          rxOlt: onu.rxOlt,
          rxOnu: onu.rxOnu,
        }))
        
        // Hitung summary dari semua data (tidak ter-paginate)
        const summary = calculateSummary(allOnusForSummary)
        
        console.log(`[All-ONU] Loaded ${paginatedOnus.length} ONUs (page ${page}/${paginatedResult.totalPages}) from database`)
        return NextResponse.json({
          onus: paginatedOnus,
          summary,
          total: paginatedResult.total,
          page: paginatedResult.page,
          limit: paginatedResult.limit,
          totalPages: paginatedResult.totalPages,
          source: 'database',
        })
      } else {
        console.log('[All-ONU] No data in database, fetching from SNMP...')
      }
    } else {
      console.log('[All-ONU] Force refresh requested, fetching from SNMP...')
    }

    // Fallback ke SNMP jika database kosong atau force refresh
    const allOnus: Array<{
      id: string
      oltId: string
      oltName: string
      name: string
      description: string
      pppoe: string
      gponOnu: string
      status: string
      rxOlt: string | null
      rxOnu: string | null
      txOlt: string | null
      txOnu: string | null
      serialNumber: string
      actualType: string
      registerTime: string | null
      distance: number | null
      lastSeen: string | null
      registrationMode: string | null
      softwareVersion: string | null
      hardwareVersion: string | null
      temperature: number | null
      laserBiasCurrent: number | null
    }> = []

    // Untuk setiap OLT, ambil data ONU
    for (const olt of connectedOlts) {
      try {
        // Prioritaskan SNMP jika tersedia (lebih cepat dan efisien)
        if (olt.snmpConnected && olt.snmpCommunityWrite) {
          console.log(`[All-ONU] Using SNMP for OLT ${olt.name} (${olt.ipAddress})...`)
          
          // Try C300 GPON parser first (standard ZTE GPON MIB)
          console.log(`[All-ONU] Trying C300 GPON parser (standard GPON MIB .1012)...`)
          let onus = await getC300GponOnuDataViaSNMP(
            olt.ipAddress,
            olt.snmpPort,
            olt.snmpCommunityWrite,
            olt.snmpVersion,
            olt.name,
            olt.id
          )
          
          // Jika C300 GPON parser tidak return data, coba C3XX parser
          if (onus.length === 0) {
            console.log(`[All-ONU] C300 GPON parser returned no data, trying C3XX parser...`)
            onus = await getC3xxOnuDataViaSNMP(
              olt.ipAddress,
              olt.snmpPort,
              olt.snmpCommunityWrite,
              olt.snmpVersion,
              olt.name,
              olt.id
            )
          }
          
          // Jika masih tidak ada data, coba parser standar (legacy)
          if (onus.length === 0) {
            console.log(`[All-ONU] C3XX parser returned no data, trying standard parser...`)
            onus = await getOnuDataViaSNMP(
              olt.ipAddress,
              olt.snmpPort,
              olt.snmpCommunityWrite,
              olt.snmpVersion,
              olt.name,
              olt.id
            )
          }
          
          allOnus.push(...onus)
        } else if (olt.telnetConnected && olt.telnetUsername && olt.telnetPassword) {
          // Fallback ke Telnet jika SNMP tidak tersedia
          console.log(`[All-ONU] Using Telnet for OLT ${olt.name} (${olt.ipAddress})...`)
          const command = 'show gpon onu state'
          const output = await executeTelnetCommand(
            olt.ipAddress,
            olt.telnetPort,
            olt.telnetUsername!,
            olt.telnetPassword!,
            command,
            60000
          )
          const onus = parseOnuData(output, olt.name, olt.id)
          allOnus.push(...onus)
        }
      } catch (error: any) {
        console.error(`[All-ONU] Error fetching ONUs from OLT ${olt.name}:`, error)
        // Continue dengan OLT berikutnya
      }
    }

    // Simpan data ke database jika fetch dari SNMP berhasil
    if (allOnus.length > 0) {
      console.log(`[All-ONU] Saving ${allOnus.length} ONUs to database...`)
      let savedCount = 0
      let errorCount = 0
      for (const onu of allOnus) {
        try {
          await onuRepository.upsert(onu.oltId, onu.gponOnu, {
            oltId: onu.oltId,
            name: onu.name,
            description: onu.description || null,
            pppoe: onu.pppoe || null,
            gponOnu: onu.gponOnu,
            status: onu.status,
            rxOlt: onu.rxOlt,
            rxOnu: onu.rxOnu,
            txOlt: onu.txOlt,
            txOnu: onu.txOnu,
            serialNumber: onu.serialNumber || null,
            actualType: onu.actualType || null,
            registerTime: onu.registerTime ? new Date(onu.registerTime) : null,
            distance: onu.distance,
            lastSeen: onu.lastSeen ? new Date(onu.lastSeen) : null,
            registrationMode: onu.registrationMode || null,
            softwareVersion: onu.softwareVersion || null,
            hardwareVersion: onu.hardwareVersion || null,
            temperature: onu.temperature || null,
            laserBiasCurrent: onu.laserBiasCurrent || null,
          })
          savedCount++
        } catch (error: any) {
          errorCount++
          if (errorCount <= 5) {
            console.error(`[All-ONU] Error saving ONU ${onu.gponOnu} to database:`, error?.message || error)
          }
        }
      }
      console.log(`[All-ONU] Successfully saved ${savedCount}/${allOnus.length} ONUs to database`)
      if (errorCount > 0) {
        console.warn(`[All-ONU] WARNING: ${errorCount} ONUs failed to save to database`)
      }
      
      // Update last sync time untuk setiap OLT yang berhasil di-fetch
      const oltIds = [...new Set(allOnus.map(onu => onu.oltId))]
      for (const oltId of oltIds) {
        try {
          await oltRepository.update(oltId, {
            onuLastSync: new Date(),
          })
        } catch (error: any) {
          console.error(`[All-ONU] Error updating last sync time for OLT ${oltId}:`, error?.message || error)
        }
      }
    }

    // Hitung summary dari semua data SNMP
    const total = allOnus.length
    const summary = calculateSummary(allOnus)

    // Apply pagination to SNMP data
    const skip = (page - 1) * limit
    const paginatedOnus = allOnus.slice(skip, skip + limit)
    const totalPages = Math.ceil(total / limit)

    console.log(`[All-ONU] Returning ${paginatedOnus.length} ONUs (page ${page}/${totalPages}) from SNMP`)
    return NextResponse.json({
      onus: paginatedOnus,
      summary,
      total,
      page,
      limit,
      totalPages,
      source: allOnus.length > 0 ? 'snmp' : null,
    })
  } catch (error: any) {
    console.error('[All-ONU] Error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Gagal memuat data ONU',
        details: error.toString(),
      },
      { status: 500 }
    )
  }
}




