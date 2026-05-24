import { ensurePermission } from "@/lib/rbac";
import { GoodsReturnCreateClient } from "./GoodsReturnCreateClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Buat Retur Vendor - Admin Portal",
};

interface Props {
  searchParams: { grnId?: string };
}

export default async function GoodsReturnCreatePage({ searchParams }: Props) {
  await ensurePermission("goods_return:create");
  return <GoodsReturnCreateClient grnId={searchParams.grnId ?? null} />;
}
