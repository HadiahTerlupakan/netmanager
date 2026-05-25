import { ensurePermission } from "@/lib/rbac";
import { GoodsReceiptDetailClient } from "./GoodsReceiptDetailClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detail Goods Receipt - Admin Portal",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function GoodsReceiptDetailPage({ params }: Props) {
  await ensurePermission("goods_receipt:read");
  const { id } = await params;
  return <GoodsReceiptDetailClient grnId={id} />;
}
