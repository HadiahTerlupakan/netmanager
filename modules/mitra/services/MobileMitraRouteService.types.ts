export interface ServiceSuccess<T> {
  success: true;
  data: T;
}

export interface ServiceFailure {
  success: false;
  error: string;
  status: number;
}

export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

export interface MobileMitraSession {
  id: string;
  userId?: string;
  tenantId?: string | null;
  role: string;
}

export interface MobileWithdrawRequestPayload {
  amount: number;
  method: "TRANSFER" | "CASH";
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  notes?: string;
}
