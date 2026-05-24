import { ensurePermission } from "@/lib/rbac";
import { GoodsReceiptDetailClient } from "./GoodsReceiptDetailClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detail Goods Receipt - Admin Portal",
};

interface Props {
  params: { id: string };
}

export default async function GoodsReceiptDetailPage({ params }: Props) {
  await ensurePermission("goods_receipt:read");
  return <GoodsReceiptDetailClient grnId={params.id} />;
}
