import CustomerDashboardClient from "./CustomerDashboardClient";
import { requireCustomerPageAuth } from "@/lib/customer-auth";

export default async function CustomerDashboardPage() {
  const session = await requireCustomerPageAuth();

  return (
    <CustomerDashboardClient
      customerId={session.id}
      customerName={session.nama}
    />
  );
}
