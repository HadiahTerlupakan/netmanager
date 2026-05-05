/** Payment provider type value object */
export const ProviderType = {
  XENDIT: "XENDIT",
  MIDTRANS: "MIDTRANS",
  DUITKU: "DUITKU",
  BRI: "BRI",
  BCA: "BCA",
  TRIPAY: "TRIPAY",
  DANA: "DANA",
  MOOTA: "MOOTA",
} as const;

export type ProviderType = (typeof ProviderType)[keyof typeof ProviderType];

export function isValidProviderType(type: string): type is ProviderType {
  return Object.values(ProviderType).includes(type as ProviderType);
}

export const PROVIDER_SIGNATURE_HEADERS: Record<ProviderType, string> = {
  XENDIT: "x-callback-token",
  MIDTRANS: "",
  TRIPAY: "x-callback-signature",
  DUITKU: "",
  BRI: "x-signature",
  BCA: "x-bca-signature",
  DANA: "x-dana-signature",
  MOOTA: "signature",
};

export const SIGNATURE_REQUIRED: Record<ProviderType, boolean> = {
  XENDIT: true,
  MIDTRANS: true,
  TRIPAY: true,
  DUITKU: false,
  BRI: true,
  BCA: true,
  DANA: true,
  MOOTA: true,
};
