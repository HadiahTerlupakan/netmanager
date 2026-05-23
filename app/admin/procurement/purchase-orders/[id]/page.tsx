import { ensurePermission } from "@/lib/rbac";
import { PurchaseOrderEditClient } from "./PurchaseOrderEditClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detail Purchase Order - Admin Portal",
};

interface Props {
  params: { id: string };
}

export default async function PurchaseOrderDetailPage({ params }: Props) {
  await ensurePermission("purchase_orders:read");
  return <PurchaseOrderEditClient poId={params.id} />;
}
