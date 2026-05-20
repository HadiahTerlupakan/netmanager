import type { OltVendor } from "../entities/olt-device.entity";

export type OltErrorCode =
  | "CONNECTION_FAILED"
  | "CONNECTION_LOST"
  | "TIMEOUT"
  | "AUTH_FAILED"
  | "UNSUPPORTED_VENDOR"
  | "ONU_NOT_FOUND"
  | "ONU_ALREADY_REGISTERED"
  | "PON_PORT_FULL"
  | "INVALID_SERIAL_NUMBER"
  | "SNMP_ERROR"
  | "TELNET_ERROR"
  | "COMMAND_REJECTED"
  | "DEVICE_BUSY"
  | "NOT_IMPLEMENTED";

export class OltError extends Error {
  constructor(
    public code: OltErrorCode,
    message: string,
    public vendor?: OltVendor,
    public deviceId?: string,
    public raw?: unknown,
  ) {
    super(message);
    this.name = "OltError";
  }
}

export const OltErrors = {
  connectionFailed: (deviceName: string, ip: string, raw?: unknown) =>
    new OltError(
      "CONNECTION_FAILED",
      `Gagal konek ke ${deviceName} (${ip})`,
      undefined,
      undefined,
      raw,
    ),

  timeout: (deviceName: string, operation: string) =>
    new OltError("TIMEOUT", `Timeout saat ${operation} di ${deviceName}`),

  authFailed: (deviceName: string) =>
    new OltError("AUTH_FAILED", `Autentikasi gagal ke ${deviceName}`),

  onuAlreadyRegistered: (sn: string) =>
    new OltError("ONU_ALREADY_REGISTERED", `ONU ${sn} sudah terdaftar`),

  ponPortFull: (ponPort: number) =>
    new OltError("PON_PORT_FULL", `PON port ${ponPort} sudah penuh`),

  unsupportedVendor: (vendor: string) =>
    new OltError("UNSUPPORTED_VENDOR", `Vendor ${vendor} belum didukung`),

  commandRejected: (reason: string) =>
    new OltError("COMMAND_REJECTED", `Command ditolak: ${reason}`),

  notImplemented: (vendor: string, operation: string) =>
    new OltError(
      "NOT_IMPLEMENTED",
      `${operation} belum diimplementasi untuk vendor ${vendor}`,
    ),

  snmpError: (message: string, raw?: unknown) =>
    new OltError("SNMP_ERROR", message, undefined, undefined, raw),

  telnetError: (message: string, raw?: unknown) =>
    new OltError("TELNET_ERROR", message, undefined, undefined, raw),
};
