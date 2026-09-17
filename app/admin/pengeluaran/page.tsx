import { ensurePermission } from "@/lib/rbac";
import ExpensesClient from "./ExpensesClient";

export const metadata = {
  title: "Pengeluaran",
};

export default async function ExpensesPage() {
  await ensurePermission("expense:read");
  return <ExpensesClient />;
}
