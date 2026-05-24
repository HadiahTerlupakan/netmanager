import { ensurePermission } from "@/lib/rbac";
import { GoodsReturnDetailClient } from "./GoodsReturnDetailClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detail Retur Vendor - Admin Portal",
};

interface Props {
  params: { id: string };
}

export default async function GoodsReturnDetailPage({ params }: Props) {
  await ensurePermission("goods_return:read");
  return <GoodsReturnDetailClient rtvId={params.id} />;
}
