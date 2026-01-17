import { prisma } from '@/lib/prisma'
import CategoriesClient from './CategoriesClient'

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  const categories = await prisma.transactionCategory.findMany({
    orderBy: { name: 'asc' }
  })

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Kategori Transaksi (Chart of Accounts)</h1>
      </div>
      
      <CategoriesClient initialData={categories} />
    </div>
  )
}
