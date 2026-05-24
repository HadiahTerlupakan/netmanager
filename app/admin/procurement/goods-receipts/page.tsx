import { ensurePermission } from "@/lib/rbac";
import { GoodsReceiptListClient } from "./GoodsReceiptListClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Goods Receipt - Admin Portal",
};

export default async function GoodsReceiptListPage() {
  await ensurePermission("goods_receipt:read");
  return <GoodsReceiptListClient />;
}
