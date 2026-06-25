export interface MixRadiusCredentials {
  username: string;
  password: string;
  baseUrl: string;
}

export class MixRadiusConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MixRadiusConfigError";
  }
}

export interface MixRadiusCustomer {
  id: string;
  type: string;
  member_id: string;
  servicetype: string;
  nasporttype: string;
  server_name: string | null;
  method: string;
  username: string;
  password: string;
  fullname: string;
  email: string;
  phonenumber: string;
  address: string;
  created_at: string;
  plan_name: string;
  total: string | number;
  renewed_on: string;
  expired_on: string;
  remote_address: string;
  note: string | null;
  trx_invoice: string;
  trx_status: string;
  payment_type: string;
  auth_status: string;
  bind_mac: string;
  mac_address: string | null;
  owner_name: string;
  online?: boolean;
  active_session_ip?: string;
}

export interface MixRadiusCustomerResponse {
  draw: number;
  recordsTotal: number;
  recordsFiltered: number;
  data: MixRadiusCustomer[];
}

export interface MixRadiusInvoice {
  id: string;
  invoice_number: string;
  plan_name: string;
  amount: string;
  activation_date: string;
  deadline_date: string;
  owner: string;
  status: string;
}

export interface MixRadiusCustomerDetail {
  id: string;
  member_id: string;
  username: string;
  password: string;
  fullname: string;
  email: string;
  phonenumber: string;
  address: string;
  remote_address: string;
  plan_name: string;
  payment_type: string;
  subscription_type: string;
  trx_status: string;
  identity_number: string;
  created_at: string;
  renewed_on: string;
  expired_on: string;
  auth_status: string;
  note: string;
  bind_mac: string;
  mac_address: string;
  total: string;
  latitude: string;
  longitude: string;
  odp_name?: string;
  owner_name?: string;
  service_type?: string;
  ip_type?: string;
  portal_password?: string;
  expired_action?: string;
  uptime?: string;
  quota_usage?: string;
  online?: boolean;
  invoices?: MixRadiusInvoice[];
}

export interface MixRadiusIncomePeriodRecord {
  id: string;
  invoice: string;
  customer_id: string;
  member_id: string;
  username: string;
  fullname: string;
  email: string;
  address: string;
  phonenumber: string;
  plan_name: string;
  price: string;
  seller_fee: string;
  tax: string;
  total: string;
  payment_method: string;
  payment_type: string;
  trx_status: string;
  invoice_date: string;
  renewed_on: string;
  expired_on: string;
  method: string;
  type: string;
  nasporttype: string;
  server_name: string | null;
  owner_name: string;
}

export interface MixRadiusIncomeSummary {
  profit: string;
  feeSeller: string;
  totalPlusPpn: string;
  totalTransactions: string;
}

export interface MixRadiusIncomePeriodResponse {
  draw: number;
  recordsTotal: number;
  recordsFiltered: number;
  data: MixRadiusIncomePeriodRecord[];
  summary?: MixRadiusIncomeSummary;
  availableOwners?: string[];
}

export interface FetchCustomersParams {
  start?: number;
  length?: number;
  search?: string;
  searchType?: string;
  authStatus?: string;
  ownerName?: string;
  groupId?: string;
  onlineStatus?: "online" | "offline";
  siteId?: string;
  siteIds?: string[];
  sortBy?: string;
  sortDir?: "asc" | "desc";
  forceRefresh?: boolean;
  startDate?: string;
  endDate?: string;
  serviceType?: string;
  paymentMethod?: string;
  ownerId?: string;
}

export interface MixRadiusODP {
  id: string;
  name: string;
  area: string;
  latitude: number;
  longitude: number;
  ownerName: string;
  customerCount?: number;
}

export interface MixRadiusODPCustomer {
  id: string;
  memberId: string;
  fullname: string;
  address: string;
  planName: string;
  ownerName: string;
  odpId: string;
  odpName: string;
  latitude: number;
  longitude: number;
}

export interface MixRadiusTopologyData {
  odps: MixRadiusODP[];
  customers: MixRadiusODPCustomer[];
}

export interface MixRadiusOwner {
  id: string;
  name: string;
}
