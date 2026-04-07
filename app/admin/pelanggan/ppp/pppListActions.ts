export async function deletePppCustomer(id: string) {
  const res = await fetch(`/api/pelanggan-ppp/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error || 'Gagal menghapus pelanggan')
  }
}

export async function updatePppCustomerStatus(id: string, status: string) {
  const res = await fetch(`/api/pelanggan-ppp/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })

  if (!res.ok) {
    const errorData = await res.json()
    throw new Error(errorData.error || 'Gagal mengubah status')
  }
}
