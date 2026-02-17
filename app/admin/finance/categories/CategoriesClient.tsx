'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HiPlus, HiTrash } from 'react-icons/hi2'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { usePermission } from '@/hooks/use-permission'
import { toast } from 'react-hot-toast'
import type { Category } from '@/types'

interface CategoriesClientProps {
  initialData: Category[]
}

interface ModalFormProps {
    name: string
    setName: (val: string) => void
    type: string
    setType: (val: string) => void
    expenseType: string
    setExpenseType: (val: string) => void
    description: string
    setDescription: (val: string) => void
    loading: boolean
    isEdit?: boolean
    onClose: () => void
    onSubmit: () => void
}

const ModalForm = ({
    name,
    setName,
    type,
    setType,
    expenseType,
    setExpenseType,
    description,
    setDescription,
    loading,
    isEdit = false,
    onClose,
    onSubmit
}: ModalFormProps) => (
    <div className="space-y-5">
      <div className="flex flex-col gap-2">
          <label className="font-medium text-sm text-gray-700 dark:text-gray-300">Nama Kategori</label>
          <input 
              type="text" 
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Contoh: Sewa Kantor" 
          />
      </div>

      <div className="flex flex-col gap-2">
          <label className="font-medium text-sm text-gray-700 dark:text-gray-300">Tipe Kategori</label>
          <div className="grid grid-cols-2 gap-4">
              <div 
                  onClick={() => setType('INCOME')}
                  className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 ${
                      type === 'INCOME' 
                          ? 'bg-green-50 border-green-500 text-green-700 dark:bg-green-900/30 dark:border-green-400 dark:text-green-300 shadow-sm' 
                          : 'bg-white border-gray-200 hover:border-green-300 hover:bg-gray-50 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
              >
                  <div className={`p-2 rounded-full ${type === 'INCOME' ? 'bg-green-200 dark:bg-green-800' : 'bg-gray-100 dark:bg-gray-700'}`}>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                      </svg>
                  </div>
                  <span className="font-semibold text-sm">Pemasukan</span>
              </div>

              <div 
                  onClick={() => setType('EXPENSE')}
                  className={`cursor-pointer border rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all duration-200 ${
                      type === 'EXPENSE' 
                          ? 'bg-red-50 border-red-500 text-red-700 dark:bg-red-900/30 dark:border-red-400 dark:text-red-300 shadow-sm' 
                          : 'bg-white border-gray-200 hover:border-red-300 hover:bg-gray-50 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
              >
                  <div className={`p-2 rounded-full ${type === 'EXPENSE' ? 'bg-red-200 dark:bg-red-800' : 'bg-gray-100 dark:bg-gray-700'}`}>
                       <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                      </svg>
                  </div>
                  <span className="font-semibold text-sm">Pengeluaran</span>
              </div>
          </div>
      </div>

      {type === 'EXPENSE' && (
           <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block font-medium text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Klasifikasi Biaya</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                      { id: 'OPERATIONAL', label: 'Operasional', desc: 'Rutin (Gaji, Listrik)' },
                      { id: 'CAPITAL', label: 'Belanja Modal', desc: 'Aset (Laptop, Server)' },
                      { id: 'OTHER', label: 'Lainnya', desc: 'Tidak Terduga' }
                  ].map((opt) => (
                      <div 
                          key={opt.id}
                          onClick={() => setExpenseType(opt.id)}
                          className={`cursor-pointer border rounded-lg p-3 text-center transition-all duration-200 ${
                              expenseType === opt.id
                                  ? 'bg-white shadow-md border-blue-500 text-blue-700 dark:bg-gray-800 dark:border-blue-400 dark:text-blue-300 transform scale-[1.02]'
                                  : 'bg-transparent border-transparent hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400'
                          }`}
                      >
                          <div className="font-semibold text-sm">{opt.label}</div>
                          <div className="text-[10px] opacity-75 mt-0.5">{opt.desc}</div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div className="flex flex-col gap-2">
          <label className="font-medium text-sm text-gray-700 dark:text-gray-300">Keterangan (Opsional)</label>
          <textarea 
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all h-24 resize-none" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tambahkan catatan detail jika diperlukan..."
          ></textarea>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-700 mt-2">
          <button 
              className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors font-medium" 
              onClick={onClose}
          >
              Batal
          </button>
          <button 
              className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" 
              onClick={onSubmit} 
              disabled={loading}
          >
              {loading && <span className="loading loading-spinner loading-sm"></span>}
              {isEdit ? 'Simpan Perubahan' : 'Simpan Kategori'}
          </button>
      </div>
  </div>
)

export default function CategoriesClient({ initialData }: CategoriesClientProps) {
  const router = useRouter()
  const { hasPermission } = usePermission()

  // Permission Checks (Reuse 'expense' permissions as they manage COA)
  const canCreate = hasPermission('expense:create')
  const canUpdate = hasPermission('expense:update')
  const canDelete = hasPermission('expense:delete')

  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(false)

  // Form
  const [name, setName] = useState('')
  const [type, setType] = useState('EXPENSE')
  const [expenseType, setExpenseType] = useState('OPERATIONAL')
  const [description, setDescription] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  // Actions
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Category | null>(null)

  // View State
  const [activeTab, setActiveTab] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL')

  const handleCreate = async () => {
    if (!name) {
        toast.error('Nama kategori wajib diisi')
        return
    }

    setLoading(true)
    try {
      const payload: Record<string, string> = { name, type, description }
      if (type === 'EXPENSE') {
        payload.expenseType = expenseType
      }

      const res = await fetch('/api/finance/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errData = await res.json().catch((): null => null)
        throw new Error(errData?.error || 'Gagal membuat kategori')
      }

      const newItem = await res.json()
      setData([...data, newItem])

      // Reset & Close
      resetForm()
      setModalOpen(false)
      toast.success('Kategori berhasil dibuat')
      router.refresh()
    } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Gagal membuat kategori')
    } finally {
        setLoading(false)
    }
  }

  const handleUpdate = async () => {
      if (!name || !selectedItem) return
      setLoading(true)
      try {
        const payload: Record<string, string> = { name, type, description }
        if (type === 'EXPENSE') payload.expenseType = expenseType

        const res = await fetch(`/api/finance/categories?id=${selectedItem.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })

        if (!res.ok) {
          const errData = await res.json().catch((): null => null)
          throw new Error(errData?.error || 'Gagal mengupdate kategori')
        }

        const updatedItem = await res.json()
        setData(data.map(d => d.id === updatedItem.id ? updatedItem : d))

        setEditModalOpen(false)
        resetForm()
        toast.success('Kategori berhasil diupdate')
        router.refresh()
      } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Gagal mengupdate kategori')
      } finally {
          setLoading(false)
      }
  }

  const handleDelete = async () => {
      if (!selectedItem) return
      setLoading(true)
      try {
          const res = await fetch(`/api/finance/categories?id=${selectedItem.id}`, {
              method: 'DELETE'
          })
          if (!res.ok) {
            const errData = await res.json().catch((): null => null)
            throw new Error(errData?.error || 'Gagal menghapus kategori')
          }

          setData(data.filter(d => d.id !== selectedItem.id))
          setDeleteModalOpen(false)
          setSelectedItem(null)
          toast.success('Kategori berhasil dihapus')
          router.refresh()
      } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Gagal menghapus kategori')
      } finally {
          setLoading(false)
      }
  }

  const openEdit = (item: Category) => {
      setSelectedItem(item)
      setName(item.name)
      setType(item.type)
      setExpenseType(item.expenseType || 'OPERATIONAL')
      setDescription(item.description || '')
      setEditModalOpen(true)
  }

  const openDelete = (item: Category) => {
      setSelectedItem(item)
      setDeleteModalOpen(true)
  }

  const resetForm = () => {
      setName('')
      setDescription('')
      // Keep defaults for type/expenseType or reset them if preferred
      setSelectedItem(null)
  }

  const filteredData = data.filter(item => {
      if (activeTab === 'ALL') return true
      return item.type === activeTab
  })

  return (
    <div className="max-w-7xl mx-auto">
       {/* Page Header */}
       <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Kategori Keuangan</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
               Kelola kategori untuk pemasukan dan pengeluaran (Chart of Accounts).
            </p>
          </div>
          {canCreate && (
              <button
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={() => { resetForm(); setModalOpen(true); }}
              >
                  <HiPlus className="w-5 h-5 mr-2" />
                  Tambah Kategori
              </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                <button
                    onClick={() => setActiveTab('ALL')}
                    className={`${activeTab === 'ALL' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                    Semua
                </button>
                <button
                    onClick={() => setActiveTab('INCOME')}
                    className={`${activeTab === 'INCOME' ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                    Pemasukan
                </button>
                <button
                    onClick={() => setActiveTab('EXPENSE')}
                    className={`${activeTab === 'EXPENSE' ? 'border-red-500 text-red-600 dark:text-red-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                >
                    Pengeluaran
                </button>
            </nav>
        </div>

        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nama Kategori</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipe</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jenis (Expense)</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Keterangan</th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredData.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">Belum ada kategori ditemukan</td></tr>
                    ) : (
                        filteredData.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        item.type === 'INCOME' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                    }`}>
                                        {item.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {item.type === 'EXPENSE' ? (
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                            item.expenseType === 'CAPITAL' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 
                                            item.expenseType === 'OPERATIONAL' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                        }`}>
                                            {item.expenseType}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-400">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{item.description || '-'}</div>
                                </td>
                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                    <div className="flex justify-end gap-2">
                                        {canUpdate && (
                                            <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" title="Edit">
                                                <span className="sr-only">Edit</span>
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button onClick={() => openDelete(item)} className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" title="Hapus">
                                                <span className="sr-only">Hapus</span>
                                                <HiTrash className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>

       {/* Create Modal */}
       <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Tambah Kategori Baru"
            size="lg"
       >
            <ModalForm 
                name={name} setName={setName}
                type={type} setType={setType}
                expenseType={expenseType} setExpenseType={setExpenseType}
                description={description} setDescription={setDescription}
                loading={loading}
                onClose={() => setModalOpen(false)}
                onSubmit={handleCreate}
            />
       </Modal>

       {/* Edit Modal */}
       <Modal
            isOpen={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            title="Edit Kategori"
            size="lg"
       >
            <ModalForm 
                isEdit
                name={name} setName={setName}
                type={type} setType={setType}
                expenseType={expenseType} setExpenseType={setExpenseType}
                description={description} setDescription={setDescription}
                loading={loading}
                onClose={() => setEditModalOpen(false)}
                onSubmit={handleUpdate}
            />
       </Modal>

       {/* Delete Confirmation Modal */}
       <ConfirmDialog
            open={deleteModalOpen}
            onCancel={() => setDeleteModalOpen(false)}
            onConfirm={handleDelete}
            title="Hapus Kategori?"
            description={`Apakah Anda yakin ingin menghapus kategori ${selectedItem?.name}? Tindakan ini tidak dapat dibatalkan.`}
            confirmText={loading ? 'Menghapus...' : 'Hapus Kategori'}
            cancelText="Batal"
       />
    </div>
  )
}
