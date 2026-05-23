export type OnuStatus =
  | "UNREGISTERED"
  | "REGISTERED"
  | "ACTIVE"
  | "OFFLINE"
  | "DISABLED"
  | "LOS"
  | "DYING_GASP";

export interface OnuDevice {
  id: string;
  tenantId: string;
  oltId: string;
  pelangganId: string | null;
  serialNumber: string;
  slotFrame: number;
  slot: number;
  ponPort: number;
  onuIndex: number | null;
  vendor: string | null;
  model: string | null;
  softwareVersion: string | null;
  distance: number | null;
  status: OnuStatus;
  rxPower: number | null;
  txPower: number | null;
  oltRxPower: number | null;
  vlanId: number | null;
  bandwidthProfile: string | null;
  description: string | null;
  lastSeen: Date | null;
  registeredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RegisterOnuParams {
  serialNumber: string;
  ponPort: number;
  onuIndex?: number;
  description?: string;
  bandwidthProfile?: string;
  vlanId?: number;
}

export interface RegisteredOnu {
  ponPort: number;
  onuIndex: number;
  serialNumber: string;
}

export interface UnregisteredOnu {
  serialNumber: string;
  ponPort: number;
  vendor?: string;
  model?: string;
  lastSeen: Date;
}

export interface DiscoveredRegisteredOnu {
  serialNumber: string;
  slotFrame: number;
  slot: number;
  ponPort: number;
  onuIndex: number;
  description: string | null;
  vendor: string | null;
  model: string | null;
  softwareVersion: string | null;
  distance: number | null;
  status?: OnuStatus;
}

export interface SetVlanParams {
  ponPort: number;
  onuIndex: number;
  vlanId: number;
  vlanMode: "transparent" | "tag" | "translate";
}

export interface RemoveVlanParams {
  ponPort: number;
  onuIndex: number;
  vlanId: number;
}

export interface OnuStatusInfo {
  ponPort: number;
  onuIndex: number;
  serialNumber: string;
  status: "online" | "offline" | "los" | "dying_gasp" | "unknown";
  uptime?: number;
}

export interface OpticalPower {
  rxPower: number | null;
  txPower: number | null;
  oltRxPower: number | null;
}

export interface OnuTrafficStats {
  rxBytes: number;
  txBytes: number;
  rxUnicastPkts: number;
  txUnicastPkts: number;
  rxNonUnicastPkts: number;
  txNonUnicastPkts: number;
  timestamp: Date;
}

export interface DeregisterOnuParams {
  ponPort: number;
  onuIndex: number;
}
