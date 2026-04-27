export type PaymentMethodCatalogItem = {
  id: string;
  name: string;
  provider: string;
  type: string;
  code: string;
  group: string;
  details?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
};

const DUITKU_PAYMENT_METHODS: PaymentMethodCatalogItem[] = [
  {
    id: "duitku_bca",
    name: "BCA Virtual Account",
    provider: "DUITKU",
    type: "VA",
    code: "BC",
    group: "Virtual Account",
  },
  {
    id: "duitku_mandiri",
    name: "Mandiri Virtual Account",
    provider: "DUITKU",
    type: "VA",
    code: "M2",
    group: "Virtual Account",
  },
  {
    id: "duitku_bri",
    name: "BRI Virtual Account",
    provider: "DUITKU",
    type: "VA",
    code: "BR",
    group: "Virtual Account",
  },
  {
    id: "duitku_qris",
    name: "QRIS (Gopay, OVO, Dana, LinkAja)",
    provider: "DUITKU",
    type: "QRIS",
    code: "SP",
    group: "E-Wallet & QRIS",
  },
  {
    id: "duitku_alfamart",
    name: "Alfamart / Indomaret",
    provider: "DUITKU",
    type: "RETAIL",
    code: "FT",
    group: "Minimarket",
  },
];

const MOOTA_PAYMENT_METHODS: PaymentMethodCatalogItem[] = [
  {
    id: "moota_transfer",
    name: "Transfer Bank Otomatis",
    provider: "MOOTA",
    type: "AUTO_TRANSFER",
    code: "MOOTA_MANUAL",
    group: "Transfer Bank",
  },
];

/**
 * Get static customer payment methods for an enabled provider.
 */
export function getCustomerPaymentMethodsByProvider(
  provider: string,
): PaymentMethodCatalogItem[] {
  if (provider === "DUITKU") {
    return DUITKU_PAYMENT_METHODS;
  }

  if (provider === "MOOTA") {
    return MOOTA_PAYMENT_METHODS;
  }

  return [];
}
