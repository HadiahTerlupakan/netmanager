export async function fetchCustomerInvoices(pelangganId: string) {
  const res = await fetch(`/api/admin/pelanggan/${pelangganId}/invoices`)
  return res.json()
}

export async function cancelCustomerPayment(paymentId: string) {
  const res = await fetch(`/api/admin/payments/${paymentId}/cancel`, { method: 'POST' })
  return res.json()
}
