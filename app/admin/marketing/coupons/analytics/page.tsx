import { ensurePermission } from "@/lib/rbac";
import { CouponAnalyticsClient } from "./CouponAnalyticsClient";

export const metadata = {
  title: "Coupons Analytics",
  description: "Analytics performa kupon",
};

export default async function Page() {
  await ensurePermission("coupon:read");
  return <CouponAnalyticsClient />;
}
