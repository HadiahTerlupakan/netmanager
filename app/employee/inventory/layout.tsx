import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gudang - NetManager',
  description: 'Kelola pengambilan dan pengembalian barang di gudang NetManager',
  keywords: ['gudang', 'inventory', 'barang', 'pengambilan', 'pengembalian'],
  openGraph: {
    title: 'Gudang - NetManager',
    description: 'Kelola pengambilan dan pengembalian barang di gudang NetManager',
    type: 'website',
  },
}

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}