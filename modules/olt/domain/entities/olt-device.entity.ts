export type OltVendor = "ZTE" | "HSGQ" | "HIOSO" | "CDATA";
export type OltStatus = "ACTIVE" | "MAINTENANCE" | "OFFLINE";

export interface OltDevice {
  id: string;
  tenantId: string;
  name: string;
  vendor: OltVendor;
  model: string;
  ipAddress: string;
  snmpCommunity: string | null;
  snmpPort: number;
  telnetPort: number | null;
  telnetUser: string | null;
  telnetPass: string | null;
  telnetEnablePass: string | null;
  defaultSlotFrame: number;
  defaultSlot: number;
  totalPonPorts: number;
  location: string | null;
  status: OltStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface OltDeviceCreateInput {
  tenantId: string;
  name: string;
  vendor: OltVendor;
  model: string;
  ipAddress: string;
  snmpCommunity?: string;
  snmpPort?: number;
  telnetPort?: number;
  telnetUser?: string;
  telnetPass?: string;
  telnetEnablePass?: string;
  defaultSlotFrame?: number;
  defaultSlot?: number;
  totalPonPorts: number;
  location?: string;
}

export interface OltDeviceUpdateInput {
  name?: string;
  model?: string;
  ipAddress?: string;
  snmpCommunity?: string;
  snmpPort?: number;
  telnetPort?: number;
  telnetUser?: string;
  telnetPass?: string;
  telnetEnablePass?: string;
  defaultSlotFrame?: number;
  defaultSlot?: number;
  totalPonPorts?: number;
  location?: string;
  status?: OltStatus;
}

export interface OltDeviceListFilters {
  tenantId: string;
  vendor?: OltVendor;
  status?: OltStatus;
  search?: string;
  page: number;
  limit: number;
}

export interface OltDeviceListResult {
  data: OltDevice[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
