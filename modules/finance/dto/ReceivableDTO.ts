import type { Invoice } from "@/types";

export interface ReceivablePaymentViewModel {
  id: string;
  amount: number;
  [key: string]: unknown;
}

export interface ReceivableViewModel extends Invoice {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  payment: ReceivablePaymentViewModel[];
}
