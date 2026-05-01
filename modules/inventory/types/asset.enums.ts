export const AssetStatus = {
  ACTIVE: "ACTIVE",
  INSTALLED: "INSTALLED",
  SOLD: "SOLD",
  DISPOSED: "DISPOSED",
  LOST: "LOST",
  REPAIR: "REPAIR",
} as const;

export type AssetStatus = (typeof AssetStatus)[keyof typeof AssetStatus];

export const PurchaseOrderStatus = {
  DRAFT: "DRAFT",
  ORDERED: "ORDERED",
  PARTIAL: "PARTIAL",
  RECEIVED: "RECEIVED",
  CANCELLED: "CANCELLED",
} as const;

export type PurchaseOrderStatus =
  (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus];

export const KondisiBarang = {
  BARU: "BARU",
  BEKAS: "BEKAS",
  RUSAK: "RUSAK",
} as const;

export type KondisiBarang = (typeof KondisiBarang)[keyof typeof KondisiBarang];
