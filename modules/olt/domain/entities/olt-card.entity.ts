export type OltCardStatus = "ACTIVE" | "MAINTENANCE" | "OFFLINE";

export interface OltCard {
  id: string;
  tenantId: string;
  oltId: string;
  slotFrame: number;
  slot: number;
  cardType: string | null;
  ponCount: number;
  status: OltCardStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface OltCardListItem extends OltCard {
  onuCount: number;
}

export interface OltCardUpsertInput {
  tenantId: string;
  oltId: string;
  slotFrame: number;
  slot: number;
  cardType?: string | null;
  ponCount: number;
  status?: OltCardStatus;
}

export interface OltCardUpdateInput {
  cardType?: string | null;
  ponCount?: number;
  status?: OltCardStatus;
}

export interface DiscoveredCard {
  slotFrame: number;
  slot: number;
  cardType: string | null;
  ponCount: number;
  status: OltCardStatus;
}

export type OltCardErrorCode =
  | "OLT_NOT_FOUND"
  | "CARD_NOT_FOUND"
  | "INVALID_CONFIG"
  | "SNMP_TIMEOUT"
  | "ADAPTER_ERROR"
  | "UNSUPPORTED_VENDOR";

export interface OltCardError {
  code: OltCardErrorCode;
  message: string;
}
