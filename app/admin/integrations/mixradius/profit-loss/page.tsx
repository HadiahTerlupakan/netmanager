import type { Metadata } from "next";
import { ensureAnyPermission } from "@/lib/rbac";
import ProfitLossClient from "./ProfitLossClient";

export const metadata: Metadata = {
  title: "Laba Rugi MixRadius",
};

export default async function ProfitLossPage() {
  await ensureAnyPermission(["mixradius_profit_loss:read", "mixradius:read"]);
  return <ProfitLossClient />;
}
