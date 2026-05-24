import { ensurePermission } from "@/lib/rbac";
import { GoodsReturnListClient } from "./GoodsReturnListClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Retur Vendor (RTV) - Admin Portal",
};

export default async function GoodsReturnListPage() {
  await ensurePermission("goods_return:read");
  return <GoodsReturnListClient />;
}
