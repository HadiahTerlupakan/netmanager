/**
 * ONU Data Parsers
 * Helper functions untuk parsing dan konversi data ONU dari SNMP
 */

/**
 * Validasi name ONU
 */
export function isValidName(str: string | undefined): boolean {
  if (!str) return false
  const trimmed = str.trim()
  if (trimmed.length === 0) return false
  const timestampPattern = /^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}:\d{2})?$/
  if (timestampPattern.test(trimmed)) return false
  if (trimmed.length < 3) return false
  return true
}

/**
 * Deteksi timestamp
 */
export function isTimestamp(str: string): boolean {
  if (!str) return false
  const trimmed = str.trim()
  const timestampPattern = /^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}:\d{2})?$/
  return timestampPattern.test(trimmed)
}

/**
 * Konversi hex string (spasi-separated) ke ASCII string
 * Format: "32 35 38 31 36 37" -> "258167"
 */
export function convertHexStringToAscii(hexString: string): string | null {
  if (!hexString) return null
  
  try {
    const hexBytes = hexString.trim().split(/\s+/).filter(b => b.length > 0)
    if (hexBytes.length === 0) return null
    
    let asciiStr = ''
    for (const hexByte of hexBytes) {
      const decimal = parseInt(hexByte, 16)
      if (!isNaN(decimal) && decimal >= 0 && decimal <= 255) {
        asciiStr += String.fromCharCode(decimal)
      } else {
        return null
      }
    }
    
    return asciiStr
  } catch (error) {
    console.warn(`[ONU-Parser] Error converting hex string to ASCII: ${error}`)
    return null
  }
}

/**
 * Konversi Hex-STRING ke Serial Number
 * Format: "48 57 54 43 09 C8 53 9E" -> "HWTC09C8539E"
 */
export function convertHexToSerialNumber(hexString: string): string | null {
  if (!hexString) return null
  
  let cleanHex = hexString.trim()
  if (cleanHex.toLowerCase().includes('hex-string:')) {
    cleanHex = cleanHex.split(':').slice(1).join(':').trim()
  }
  
  const hexBytes = cleanHex.split(/\s+/).filter(b => b.length > 0)
  if (hexBytes.length < 8) {
    return null
  }
  
  try {
    const first4Bytes = hexBytes.slice(0, 4)
    let asciiPart = ''
    for (const hexByte of first4Bytes) {
      const decimal = parseInt(hexByte, 16)
      if (decimal >= 32 && decimal <= 126) {
        asciiPart += String.fromCharCode(decimal)
      } else {
        return null
      }
    }
    
    const last4Bytes = hexBytes.slice(4, 8)
    const hexPart = last4Bytes.map(b => b.toUpperCase()).join('')
    
    return asciiPart + hexPart
  } catch (error) {
    console.warn(`[ONU-Parser] Error converting hex to serial: ${error}`)
    return null
  }
}

/**
 * Parse status value dari SNMP
 */
export function parseStatus(statusValueNew: string | undefined, statusValue: string | undefined): string {
  let statusStr = 'Unknown'
  
  if (statusValueNew) {
    const statusNum = parseInt(statusValueNew, 10)
    if (!isNaN(statusNum)) {
      if (statusNum === 1) statusStr = 'LOS'
      else if (statusNum === 3) statusStr = 'Online'
      else if (statusNum === 4) statusStr = 'DyingGasp'
      else if (statusNum === 6) statusStr = 'OffLine'
    }
  }
  
  if (statusStr === 'Unknown' && statusValue) {
    const statusNum = parseInt(statusValue, 10)
    if (!isNaN(statusNum)) {
      if (statusNum === 1) statusStr = 'LOS'
      else if (statusNum === 3) statusStr = 'Online'
      else if (statusNum === 4) statusStr = 'DyingGasp'
      else if (statusNum === 6) statusStr = 'OffLine'
    }
  }
  
  return statusStr
}

/**
 * Parse RX OLT value
 */
export function parseRxOlt(rxOltNewValue: string | undefined, rxValue: string | undefined): string | null {
  let rxOltStr: string | null = null
  
  if (rxOltNewValue) {
    const rxOltNum = parseInt(rxOltNewValue, 10)
    if (!isNaN(rxOltNum)) {
      if (rxOltNum <= -80000) {
        rxOltStr = "N/A"
      } else if (rxOltNum === 0 || rxOltNum === 65535) {
        rxOltStr = "N/A"
      } else {
        rxOltStr = `${(rxOltNum / 1000).toFixed(3)} dBm`
      }
    }
  }
  
  if (!rxOltStr && rxValue) {
    const rxNum = parseFloat(rxValue)
    if (!isNaN(rxNum)) {
      if (Math.abs(rxNum) > 1000) {
        rxOltStr = `${(rxNum / 100).toFixed(2)} dBm`
      } else if (rxNum === 0 || Math.abs(rxNum) > 100) {
        rxOltStr = "N/A"
      } else {
        rxOltStr = `${rxNum.toFixed(2)} dBm`
      }
    }
  }
  
  return rxOltStr || "N/A"
}

/**
 * Parse RX ONU value
 */
export function parseRxOnu(rxOnuNewValue: string | undefined, txValue: string | undefined): string | null {
  let rxOnuStr: string | null = null
  
  if (rxOnuNewValue) {
    const rxOnuNum = parseInt(rxOnuNewValue, 10)
    if (!isNaN(rxOnuNum)) {
      if (rxOnuNum === 0 || rxOnuNum === 65535) {
        rxOnuStr = "N/A"
      } else {
        const dbmValue = -30 + (rxOnuNum * 0.002)
        rxOnuStr = `${dbmValue.toFixed(3)} dBm`
      }
    }
  }
  
  if (!rxOnuStr && txValue) {
    const txNum = parseFloat(txValue)
    if (!isNaN(txNum)) {
      if (Math.abs(txNum) > 1000) {
        rxOnuStr = `${(txNum / 100).toFixed(2)} dBm`
      } else {
        rxOnuStr = `${txNum.toFixed(2)} dBm`
      }
    }
  }
  
  return rxOnuStr || "N/A"
}

/**
 * Parse TX OLT value
 */
export function parseTxOlt(txValue: string | undefined): string | null {
  if (!txValue) return "N/A"
  
  const txNum = parseFloat(txValue)
  if (!isNaN(txNum)) {
    if (Math.abs(txNum) > 1000) {
      return `${(txNum / 100).toFixed(2)} dBm`
    } else if (txNum === 0 || Math.abs(txNum) > 100) {
      return "N/A"
    } else {
      return `${txNum.toFixed(2)} dBm`
    }
  }
  
  return "N/A"
}

/**
 * Parse TX ONU value
 */
export function parseTxOnu(txOnuNewValue: string | undefined): string | null {
  if (!txOnuNewValue) return "N/A"
  
  const txOnuNum = parseInt(txOnuNewValue, 10)
  if (!isNaN(txOnuNum)) {
    if (txOnuNum === 0 || txOnuNum === 65535) {
      return "N/A"
    } else {
      const dbmValue = -30 + (txOnuNum * 0.002)
      return `${dbmValue.toFixed(3)} dBm`
    }
  }
  
  return "N/A"
}

/**
 * Parse Register Time
 */
export function parseRegisterTime(regValue: string | undefined): Date | null {
  if (!regValue) return null
  
  try {
    const regNum = parseInt(regValue, 10)
    if (!isNaN(regNum) && regNum > 0 && regNum > 1000000000) {
      return new Date(regNum * 1000)
    }
  } catch (_e) {
    // Ignore
  }
  
  return null
}

/**
 * Parse timestamp dari string
 */
export function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null
  
  try {
    const num = parseInt(value, 10)
    if (!isNaN(num) && num > 0 && num > 1000000000) {
      return new Date(num * 1000)
    }
  } catch (_e) {
    // Ignore
  }
  
  return null
}

/**
 * Parse BigInt dari string
 */
export function parseBigInt(value: string | null | undefined): bigint | null {
  if (!value) return null
  try {
    const num = BigInt(value)
    return num > 0n ? num : null
  } catch {
    return null
  }
}

/**
 * Parse name dengan konversi hex jika perlu
 */
export function parseName(nameValue: string | undefined, idx: string): string {
  let finalName = nameValue
  
  if (finalName) {
    finalName = finalName.trim()
    if (/^[0-9A-Fa-f]{1,2}(\s+[0-9A-Fa-f]{1,2})+$/.test(finalName)) {
      const converted = convertHexStringToAscii(finalName)
      if (converted) {
        finalName = converted
      }
    }
  }
  
  if (!finalName || !isValidName(finalName)) {
    const indexParts = idx.split('.')
    const onuId = indexParts.length >= 2 ? indexParts[1] : idx
    finalName = `ONU-${onuId}`
  }
  
  return finalName
}

/**
 * Parse description dengan konversi hex jika perlu
 */
export function parseDescription(descValue: string | undefined, idx: string): string | null {
  let finalDesc = descValue || null
  
  if (finalDesc) {
    finalDesc = finalDesc.trim()
    if (/^[0-9A-Fa-f]{1,2}(\s+[0-9A-Fa-f]{1,2})+$/.test(finalDesc)) {
      const converted = convertHexStringToAscii(finalDesc)
      if (converted) {
        finalDesc = converted
      }
    }
    if (finalDesc.length === 0) {
      finalDesc = null
    }
  }
  
  if (!finalDesc) {
    finalDesc = `Index: ${idx}`
  }
  
  return finalDesc
}

/**
 * Parse serial number dengan konversi hex jika perlu
 */
export function parseSerialNumber(snValue: string | undefined): string | null {
  let finalSerial = snValue || null
  
  if (finalSerial) {
    finalSerial = finalSerial.trim()
    if (finalSerial.includes('Hex-STRING:') || /^[0-9A-Fa-f\s]+$/.test(finalSerial)) {
      const converted = convertHexToSerialNumber(finalSerial)
      if (converted && converted.length > 0) {
        finalSerial = converted
      } else {
        finalSerial = finalSerial.replace(/Hex-STRING:\s*/i, '').trim()
        if (finalSerial.length === 0 || isTimestamp(finalSerial)) {
          finalSerial = null
        }
      }
    } else if (isTimestamp(finalSerial)) {
      finalSerial = null
    } else if (finalSerial.length === 0) {
      finalSerial = null
    }
  }
  
  return finalSerial
}

/**
 * Parse actual type dengan konversi hex jika perlu
 */
export function parseActualType(actualTypeValue: string | undefined): string | null {
  let finalActualType = actualTypeValue || null
  
  if (finalActualType) {
    finalActualType = finalActualType.trim()
    if (/^[0-9A-Fa-f]{1,2}(\s+[0-9A-Fa-f]{1,2})+$/.test(finalActualType)) {
      const converted = convertHexStringToAscii(finalActualType)
      if (converted && converted.length > 0) {
        finalActualType = converted
      } else {
        finalActualType = finalActualType.replace(/\s+/g, '').trim()
        if (finalActualType.length === 0) {
          finalActualType = null
        }
      }
    } else if (finalActualType.length === 0) {
      finalActualType = null
    }
  }
  
  return finalActualType
}

/**
 * Parse PPPoE dengan konversi hex jika perlu
 */
export function parsePppoe(pppoeValue: string | undefined): string | null {
  if (!pppoeValue) return null
  
  let finalPppoe: string | null = null
  pppoeValue = pppoeValue.trim()
  
  if (/^[0-9A-Fa-f]{1,2}(\s+[0-9A-Fa-f]{1,2})+$/.test(pppoeValue)) {
    const converted = convertHexStringToAscii(pppoeValue)
    if (converted) {
      finalPppoe = converted
    }
  } else {
    finalPppoe = pppoeValue
  }
  
  if (finalPppoe && finalPppoe.length === 0) {
    finalPppoe = null
  }
  
  return finalPppoe
}

/**
 * Parse MAC Address
 */
export function parseMacAddress(macAddress: string | null | undefined): string | null {
  if (!macAddress) return null
  
  macAddress = macAddress.trim()
  
  if (/^[0-9A-Fa-f\s]+$/.test(macAddress) && macAddress.includes(' ')) {
    const converted = convertHexStringToAscii(macAddress)
    if (converted) macAddress = converted
  }
  
  if (macAddress && macAddress.length === 12 && /^[0-9A-Fa-f]+$/.test(macAddress)) {
    macAddress = macAddress.match(/.{2}/g)?.join(':').toUpperCase() || macAddress
  }
  
  if (macAddress && macAddress.length === 0) macAddress = null
  
  return macAddress
}

