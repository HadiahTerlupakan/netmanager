import type { ResellerStatusValue } from "../domain/entities/ResellerEntity";

export interface ResellerDTO {
  readonly id: string;
  readonly tenantId: string | null;
  readonly code: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly status: ResellerStatusValue;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ResellerOutletDTO {
  readonly id: string;
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly code: string;
  readonly name: string;
  readonly phone: string | null;
  readonly address: string | null;
  readonly status: ResellerStatusValue;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ResellerPackagePriceDTO {
  readonly id: string;
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly hargaPaketId: string;
  readonly price: number;
  readonly status: ResellerStatusValue;
  readonly startsAt: string;
  readonly endsAt: string | null;
}

export interface ResolvedPackagePriceDTO {
  readonly price: number;
  readonly source: "BASE_PACKAGE" | "RESELLER_OVERRIDE";
  readonly priceId: string | null;
}
