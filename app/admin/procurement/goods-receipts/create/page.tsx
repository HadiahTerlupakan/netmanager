import { ensurePermission } from "@/lib/rbac";
import { GoodsReceiptCreateClient } from "./GoodsReceiptCreateClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Buat Goods Receipt - Admin Portal",
};

interface Props {
  searchParams: { poId?: string };
}

export default async function GoodsReceiptCreatePage({ searchParams }: Props) {
  await ensurePermission("goods_receipt:create");
  return <GoodsReceiptCreateClient poId={searchParams.poId ?? null} />;
}
