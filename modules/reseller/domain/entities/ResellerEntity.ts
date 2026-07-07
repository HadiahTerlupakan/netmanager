export type ResellerStatusValue = "ACTIVE" | "INACTIVE";

export interface ResellerEntity {
  readonly id: string;
  readonly tenantId: string | null;
  readonly code: string;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly address: string | null;
  readonly status: ResellerStatusValue;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface ResellerOutletEntity {
  readonly id: string;
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly code: string;
  readonly name: string;
  readonly phone: string | null;
  readonly address: string | null;
  readonly status: ResellerStatusValue;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface ResellerPackagePriceEntity {
  readonly id: string;
  readonly tenantId: string | null;
  readonly resellerId: string;
  readonly hargaPaketId: string;
  readonly price: number;
  readonly status: ResellerStatusValue;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}
