/**
 * Custom type definitions untuk midtrans-client
 * Sebagai backup jika @types/midtrans-client tidak complete
 */

declare module 'midtrans-client' {
  export interface MidtransConfig {
    isProduction?: boolean;
    serverKey?: string;
    clientKey?: string;
  }

  export interface TransactionDetails {
    order_id: string;
    gross_amount: number;
  }

  export interface CustomerDetails {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  }

  export interface ItemDetails {
    id: string;
    price: number;
    quantity: number;
    name: string;
  }

  export interface SnapTransaction {
    transaction_details: TransactionDetails;
    customer_details?: CustomerDetails;
    item_details?: ItemDetails[];
    enabled_payments?: string[];
    credit_card?: {
      secure?: boolean;
    };
  }

  export interface SnapResponse {
    token: string;
    redirect_url: string;
  }

  export class Snap {
    constructor(config: MidtransConfig);
    createTransaction(params: SnapTransaction): Promise<SnapResponse>;
    transaction: {
      status(orderId: string): Promise<unknown>;
      cancel(orderId: string): Promise<unknown>;
    };
  }

  export class CoreApi {
    constructor(config: MidtransConfig);
    charge(params: unknown): Promise<unknown>;
    capture(params: unknown): Promise<unknown>;
    cardRegister(params: unknown): Promise<unknown>;
    cardToken(params: unknown): Promise<unknown>;
  }
}
