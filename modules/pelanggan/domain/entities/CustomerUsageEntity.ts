/**
 * Pure usage domain entities for pelanggan module.
 */

export interface CustomerUsageCustomerEntity {
  id: string;
  username: string;
  status: string;
}

export interface CustomerStaticIpEntity {
  value: string;
}

export interface CustomerRadiusTechnicalSessionEntity {
  framedipaddress: string | null;
  nasipaddress: string | null;
}

export interface CustomerRadiusSessionEntity {
  acctstarttime: Date | null;
  acctupdatetime?: Date | null;
  acctstoptime?: Date | null;
  framedipaddress?: string | null;
  nasipaddress?: string | null;
  acctsessionid?: string | null;
}

export interface CustomerUsageAggregateEntity {
  _sum: {
    acctinputoctets: bigint | null;
    acctoutputoctets: bigint | null;
  };
}

export interface CustomerRouterEntity {
  name: string;
}
