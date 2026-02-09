import { ensurePermission } from '@/lib/rbac'
import { AssetService } from '@/modules/inventory/services/AssetService'
import { AssetDetailView } from '@/components/inventory/assets/AssetDetailView'
import Link from 'next/link'
import { FiArrowLeft } from 'react-icons/fi'
import { notFound } from 'next/navigation'

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await ensurePermission('asset:read')

  const { id } = await params
  const assetService = new AssetService()
  const asset = await assetService.getAsset(id)

  if (!asset) {
    notFound()
  }

  // Need to serialize dates for client component if Nextjs doesn't auto-serialize
  // But standard Server Components usually handle JSON serializable data.
  // Asset contains Date objects. We might need to map them to strings or rely on Next.js 13+ serialization.
  // Usually types like Decimal (from Prisma) need handling.
  // I'll assume standard serialization for now, but if Decimal causes issues, I might need JSON.parse(JSON.stringify(asset)).
  // Prisma Decimal is not serializable to JSON directly sometimes.

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link 
            href="/admin/inventory/assets"
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
        >
            <FiArrowLeft className="w-5 h-5" />
        </Link>
        <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Detail Aset
            </h1>
            <p className="text-sm text-gray-500">
            {asset.kodeAsset}
            </p>
        </div>
      </div>

       {/* Pass asset. Prisma Decimal might fail. I'll stringify it just in case if errors occur, but trying direct first. 
           Actually, Client Components cannot receive Decimal. I must convert.
       */}
      <AssetDetailView asset={JSON.parse(JSON.stringify(asset))} />
    </div>
  )
}
