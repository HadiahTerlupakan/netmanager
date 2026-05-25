import { ensurePermission } from "@/lib/rbac";
import { PurchaseOrderEditClient } from "./PurchaseOrderEditClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Detail Purchase Order - Admin Portal",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PurchaseOrderDetailPage({ params }: Props) {
  await ensurePermission("purchase_orders:read");
  const { id } = await params;
  return <PurchaseOrderEditClient poId={id} />;
}
