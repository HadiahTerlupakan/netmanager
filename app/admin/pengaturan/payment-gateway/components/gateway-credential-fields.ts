/**
 * Kolom kredensial yang benar-benar dibaca tiap provider, dengan istilah dari
 * dashboard penyedianya. Form dulu menampilkan "API Secret" untuk semua
 * gateway, padahal misalnya Duitku hanya memakai API Key dan Merchant Code.
 */
export type GatewayCredentialFields = {
  apiKey: string;
  apiSecret?: string;
  clientKey?: string;
  merchantId?: string;
};

const FIELDS: Record<string, GatewayCredentialFields> = {
  DUITKU: { apiKey: "API Key", merchantId: "Merchant Code" },
  TRIPAY: {
    apiKey: "API Key",
    apiSecret: "Private Key",
    merchantId: "Kode Merchant",
  },
  MIDTRANS: { apiKey: "Server Key", clientKey: "Client Key" },
  XENDIT: {
    apiKey: "Secret API Key",
    apiSecret: "Callback Verification Token",
  },
  DANA: {
    apiKey: "Client ID",
    apiSecret: "Client Secret",
    merchantId: "Merchant ID",
  },
  // BRI dan BCA: OAuth memakai Client ID + Client Secret; API Key dipakai
  // sebagai header tambahan BCA.
  BRI: {
    apiKey: "API Key",
    clientKey: "Client ID",
    apiSecret: "Client Secret",
    merchantId: "Merchant ID",
  },
  BCA: {
    apiKey: "API Key",
    clientKey: "Client ID",
    apiSecret: "Client Secret",
    merchantId: "Company Code",
  },
  MOOTA: { apiKey: "API Token", apiSecret: "Secret Token Webhook" },
};

const DEFAULT_FIELDS: GatewayCredentialFields = {
  apiKey: "API Key",
  apiSecret: "API Secret",
};

export function getGatewayCredentialFields(
  providerId: string | null,
): GatewayCredentialFields {
  return (providerId && FIELDS[providerId]) || DEFAULT_FIELDS;
}
