// Domain Entity: WhatsAppAccount
export interface WhatsAppAccount {
  id: string;
  name: string;
  phone: string;
  provider: WhatsAppProviderId;
  apiKey: string;
  domain?: string | null;
  deviceId?: string | null;
  accountType: WhatsAppAccountType;
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  dailyLimit?: number | null;
  dailyCount: number;
  lastReset: Date;
  createdAt: Date;
  updatedAt: Date;
  tenantId?: string | null;
}

export type WhatsAppProviderId =
  | "FONNTE"
  | "WABLAS"
  | "MPWA"
  | "BAILEYS"
  | "OFFICIAL";
export type WhatsAppAccountType = "CUSTOMER" | "INTERNAL";

export interface WhatsAppAccountCreateInput {
  name: string;
  phone: string;
  provider: WhatsAppProviderId;
  apiKey: string;
  domain?: string;
  deviceId?: string;
  accountType?: WhatsAppAccountType;
  isActive?: boolean;
  isDefault?: boolean;
  priority?: number;
  dailyLimit?: number;
  tenantId?: string;
}

export interface WhatsAppAccountUpdateInput {
  name?: string;
  phone?: string;
  provider?: WhatsAppProviderId;
  apiKey?: string;
  domain?: string;
  deviceId?: string;
  accountType?: WhatsAppAccountType;
  isActive?: boolean;
  isDefault?: boolean;
  priority?: number;
  dailyLimit?: number;
}
