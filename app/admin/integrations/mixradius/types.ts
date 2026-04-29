export interface MixRadiusCustomerDetail {
  id: string;
  member_id: string;
  username: string;
  fullname: string;
  email: string;
  phonenumber: string;
  address: string;
  plan_name: string;
  payment_type: string;
  auth_status: string;
  subscription_type: string;
  trx_status: string;
  identity_number: string;
  renewed_on: string;
  expired_on: string;
  note: string;
  bind_mac: string;
  mac_address: string;
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

export interface MixRadiusCustomer {
  id: string;
  member_id: string;
  username: string;
  fullname: string;
  email: string;
  phonenumber: string;
  address: string;
  plan_name: string;
  type: string;
  payment_type: string;
  auth_status: string;
  expired_on: string;
  renewed_on: string;
  created_at: string;
  total: string | number;
  trx_status: string;
  trx_invoice: string;
  owner_name: string;
  online?: boolean;
  active_session_ip?: string;
}

export interface MixRadiusResponse {
  draw: number;
  recordsTotal: number;
  recordsFiltered: number;
  data: MixRadiusCustomer[];
}

export interface MixRadiusGroup {
  id: string;
  name: string;
}

export interface MixRadiusOwner {
  id: string;
  name: string;
}

export interface InvoiceCount {
  paidCount: number;
  totalCount: number;
}

export interface MixRadiusClientProps {
  defaultStatus?: string;
  viewMode?: "default" | "isolir";
}
