"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePermission } from '@/hooks/use-permission'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { HiPlus, HiPencil, HiTrash } from 'react-icons/hi2'
import Link from 'next/link'
import { type Supplier } from '@prisma/client'
import { useSession } from 'next-auth/react'

export default function SupplierListPage() {
  const router = useRouter()
  const { data: _session } = useSession()
  const { hasPermission, isLoading: isLoadingPermission } = usePermission()
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 10

  const canCreate = hasPermission('supplier:create')
  const canUpdate = hasPermission('supplier:update')
  const canDelete = hasPermission('supplier:delete')

  useEffect(() => {
    fetchSuppliers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search])

  const fetchSuppliers = async () => {
    setIsLoading(true)
    try {
      const skip = (page - 1) * limit
      const query = new URLSearchParams({ skip: skip.toString(), take: limit.toString() })
      if (search) query.set('search', search)

      const res = await fetch(`/api/procurement/suppliers?${query.toString()}`)
      const data = await res.json()
      
      if (data.data) {
        setSuppliers(data.data)
        setTotal(data.total)
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return
    
    try {
      const res = await fetch(`/api/procurement/suppliers/${id}`, { method: 'DELETE' })
      if (res.ok) {
        fetchSuppliers()
      } else {
        alert('Failed to delete')
      }
    } catch (error) {
      console.error(error)
      alert('Error deleting')
    }
  }

  const columns: Column<Supplier>[] = [
    { key: 'code', header: 'Kode', priority: 'primary' },
    { key: 'name', header: 'Nama Supplier', priority: 'primary' },
    { key: 'contact', header: 'Kontak', priority: 'secondary' },
    { key: 'phone', header: 'Telepon', priority: 'secondary' },
    { key: 'email', header: 'Email', priority: 'tertiary' },
  ]

  if (isLoadingPermission) return <div className="p-8">Loading...</div>
  if (!hasPermission('supplier:read')) return <div className="p-8">Unauthorized</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Supplier</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manajemen data supplier</p>
        </div>
        
        {canCreate && (
          <Link
            href="/admin/procurement/suppliers/create"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <HiPlus className="w-5 h-5" />
            <span>Tambah Supplier</span>
          </Link>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
           <input
            type="text"
            placeholder="Cari supplier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
           />
        </div>

        <ResponsiveTable
          data={suppliers}
          columns={columns}
          loading={isLoading}
          keyField="id"
          onRowClick={(row) => canUpdate && router.push(`/admin/procurement/suppliers/${row.id}`)}
          renderActions={(row) => (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
               {canUpdate && (
                 <Link href={`/admin/procurement/suppliers/${row.id}`} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                   <HiPencil className="w-5 h-5" />
                 </Link>
               )}
               {canDelete && (
                 <button onClick={() => handleDelete(row.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                   <HiTrash className="w-5 h-5" />
                 </button>
               )}
            </div>
          )}
        />
        
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
             <div className="text-sm text-gray-500">
               Total {total} data
             </div>
             <div className="flex gap-2">
               <button 
                 disabled={page === 1}
                 onClick={() => setPage(p => p - 1)}
                 className="px-3 py-1 border rounded disabled:opacity-50"
               >
                 Prev
               </button>
               <button
                 disabled={page * limit >= total}
                 onClick={() => setPage(p => p + 1)}
                 className="px-3 py-1 border rounded disabled:opacity-50"
               >
                 Next
               </button>
             </div>
        </div>
      </div>
    </div>
  )
}
