'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  HiOutlinePlus,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineMagnifyingGlass,
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineCurrencyDollar,
  HiOutlineCalendar,
  HiOutlineBuildingOffice,
  HiOutlineTag
} from 'react-icons/hi2'
import toast from 'react-hot-toast'
import { ResponsiveTable } from '@/components/ui/ResponsiveTable'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils'

interface Expense {
  id: string
  date: string
  amount: string
  category: string
  description?: string
  siteId?: string
  mixRadiusGroupId?: string
  site?: {
      id: string
      name: string
  }
  mixRadiusGroup?: {
      id: string
      name: string
  }
  user?: {
      name: string
  }
}

interface SiteOption {
    id: string
    name: string
    siteId?: string // Linked physical site ID
}

export default function ExpensesClient() {
  const [data, setData] = useState<Expense[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}-01`
  })
  const [endDate, setEndDate] = useState(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  const [selectedSite, setSelectedSite] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')

  // Options
  const [sites, setSites] = useState<SiteOption[]>([])

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Expense | null>(null)
  const [formData, setFormData] = useState({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      category: 'OPEX',
      description: '',
      siteId: '',
      mixRadiusGroupId: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch Sites for Dropdown (MixRadius Groups)
  useEffect(() => {
      const fetchSites = async () => {
          try {
              const res = await fetch('/api/integrations/mixradius/groups')
              const json = await res.json()
              if (json.success && Array.isArray(json.data)) {
                   // Map groups to options. ID = Group ID. We also store siteId if available.
                   // No deduplication needed on ID since Group IDs are unique.
                   setSites(json.data.map((g: any) => ({
                       id: g.id,
                       name: g.name,
                       siteId: g.siteId
                   })))
              }
          } catch (e) {
              console.error('Failed to fetch sites', e)
          }
      }
      fetchSites()
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        startDate,
        endDate
      })

      if (selectedSite) params.append('siteId', selectedSite)
      if (selectedCategory) params.append('category', selectedCategory)

      const response = await fetch(`/api/finance/expenses?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch expenses')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      toast.error('Gagal mengambil data pengeluaran')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, selectedSite, selectedCategory])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter data client-side for search (description)
  const filteredData = data.filter(item => {
      if (!debouncedSearch) return true
      const lowerSearch = debouncedSearch.toLowerCase()
      return (
          (item.description && item.description.toLowerCase().includes(lowerSearch)) ||
          (item.amount.toString().includes(lowerSearch))
      )
  })

  // Calculate Summary based on filtered data
  const totalAmount = filteredData.reduce((sum, item) => sum + Number(item.amount), 0)
  const totalCapex = filteredData.filter(i => i.category === 'CAPEX').reduce((sum, item) => sum + Number(item.amount), 0)
  const totalOpex = filteredData.filter(i => i.category === 'OPEX').reduce((sum, item) => sum + Number(item.amount), 0)

  const handleOpenModal = (item?: Expense) => {
      if (item) {
          setEditingItem(item)
          // Determine dropdown value: use mixRadiusGroupId if available, else try to find matching siteId
          // But our dropdown options are Groups (mixRadiusGroupId).
          // If item has mixRadiusGroupId, use it.
          // If item only has siteId (legacy), we might not find it in dropdown unless a group matches that siteId.
          // For now, prefer mixRadiusGroupId.
          setFormData({
              date: new Date(item.date).toISOString().split('T')[0],
              amount: item.amount.toString(),
              category: item.category,
              description: item.description || '',
              siteId: item.siteId || '',
              mixRadiusGroupId: item.mixRadiusGroupId || ''
          })
      } else {
          setEditingItem(null)
          setFormData({
              date: new Date().toISOString().split('T')[0],
              amount: '',
              category: 'OPEX',
              description: '',
              siteId: '',
              mixRadiusGroupId: ''
          })
      }
      setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      setIsSubmitting(true)

      try {
          const url = editingItem
              ? `/api/finance/expenses/${editingItem.id}`
              : '/api/finance/expenses'

          const method = editingItem ? 'PUT' : 'POST'

          // Find the selected group to get the linked physical siteId
          let finalSiteId = formData.siteId
          // If user selected a group (mixRadiusGroupId stored in formData.mixRadiusGroupId in dropdown?),
          // Wait, the dropdown `value={formData.siteId}` needs to change.
          // We should bind the dropdown to `mixRadiusGroupId` (the Option ID).
          // Then look up the Option to get the real `siteId`.

          const selectedOption = sites.find(s => s.id === formData.mixRadiusGroupId)
          if (selectedOption && selectedOption.siteId) {
              finalSiteId = selectedOption.siteId
          }

          const payload = {
              ...formData,
              siteId: finalSiteId // Ensure we send the physical site ID if available
          }

          const res = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          })

          if (!res.ok) throw new Error('Gagal menyimpan data')

          toast.success(editingItem ? 'Data diperbarui' : 'Data ditambahkan')
          setIsModalOpen(false)
          fetchData()
      } catch (err) {
          toast.error('Terjadi kesalahan saat menyimpan')
          console.error(err)
      } finally {
          setIsSubmitting(false)
      }
  }

  const handleDelete = async (id: string) => {
      if (!confirm('Apakah anda yakin ingin menghapus data ini?')) return

      try {
          const res = await fetch(`/api/finance/expenses/${id}`, {
              method: 'DELETE'
          })

          if (!res.ok) throw new Error('Gagal menghapus')

          toast.success('Data dihapus')
          fetchData()
      } catch (err) {
          toast.error('Gagal menghapus data')
      }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlineCurrencyDollar className="w-7 h-7 text-red-500" />
            Pengeluaran Site (CAPEX/OPEX)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manajemen pengeluaran operasional dan modal per site
          </p>
        </div>

        <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
            <HiOutlinePlus className="w-5 h-5" />
            Tambah Pengeluaran
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 p-4 opacity-10">
                  <HiOutlineCurrencyDollar className="w-16 h-16 text-red-500" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">TOTAL PENGELUARAN</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {formatCurrency(totalAmount)}
              </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 p-4 opacity-10">
                  <HiOutlineTag className="w-16 h-16 text-orange-500" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">TOTAL OPEX (Operasional)</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                  {formatCurrency(totalOpex)}
              </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 p-4 opacity-10">
                  <HiOutlineBuildingOffice className="w-16 h-16 text-purple-500" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">TOTAL CAPEX (Modal)</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                  {formatCurrency(totalCapex)}
              </p>
          </div>
      </div>

      {/* Filters & Toolbar */}
      <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex flex-wrap gap-3 items-center w-full xl:w-auto">
                {/* Date Range */}
                <div className="flex items-center gap-2 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-900/50">
                    <HiOutlineCalendar className="w-4 h-4 text-gray-500" />
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-transparent border-none text-sm text-gray-900 dark:text-white focus:ring-0 p-0 w-[110px]"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-transparent border-none text-sm text-gray-900 dark:text-white focus:ring-0 p-0 w-[110px]"
                    />
                </div>

                {/* Category Filter */}
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
                >
                    <option value="">Semua Kategori</option>
                    <option value="CAPEX">CAPEX</option>
                    <option value="OPEX">OPEX</option>
                </select>

                {/* Site Filter */}
                <select
                    value={selectedSite}
                    onChange={(e) => setSelectedSite(e.target.value)}
                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
                >
                    <option value="">Semua Site</option>
                    {sites.map(site => (
                        <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                </select>
            </div>

            {/* Search */}
            <div className="relative w-full xl:w-72">
                <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="text"
                    placeholder="Cari deskripsi atau nominal..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <ResponsiveTable
            data={filteredData}
            loading={loading}
            emptyMessage={
                <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                    <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-full mb-3">
                        <HiOutlineCurrencyDollar className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-lg font-medium">Tidak ada data pengeluaran</p>
                    <p className="text-sm mt-1">Sesuaikan filter atau tambahkan pengeluaran baru</p>
                </div>
            }
            columns={[
                {
                    key: 'date',
                    header: 'Tanggal',
                    render: (item) => (
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-gray-600 dark:text-gray-400">
                                {new Date(item.date).toLocaleDateString('id-ID', {
                                    day: '2-digit', month: 'short', year: 'numeric'
                                })}
                            </span>
                        </div>
                    )
                },
                {
                    key: 'amount',
                    header: 'Jumlah',
                    render: (item) => (
                        <span className="font-bold text-red-600 dark:text-red-400 font-mono">
                            {formatCurrency(Number(item.amount))}
                        </span>
                    )
                },
                {
                    key: 'category',
                    header: 'Kategori',
                    render: (item) => (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            item.category === 'CAPEX'
                                ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800'
                                : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'
                        }`}>
                            {item.category}
                        </span>
                    )
                },
                {
                    key: 'description',
                    header: 'Keterangan',
                    render: (item) => (
                        <span className="text-gray-700 dark:text-gray-300 line-clamp-2" title={item.description}>
                            {item.description || '-'}
                        </span>
                    )
                },
                {
                    key: 'site',
                    header: 'Site / Group',
                    render: (item) => {
                        const name = item.mixRadiusGroup?.name || item.site?.name
                        return name ? (
                            <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                                <HiOutlineBuildingOffice className="w-4 h-4 text-gray-400" />
                                {name}
                            </div>
                        ) : (
                            <span className="text-gray-400 italic text-sm">Umum (Pusat)</span>
                        )
                    }
                },
                {
                    key: 'user',
                    header: 'Petugas',
                    priority: 'secondary',
                    render: (item) => item.user?.name || '-'
                },
                {
                    key: 'actions',
                    header: '',
                    render: (item) => (
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => handleOpenModal(item)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                title="Edit"
                            >
                                <HiOutlinePencilSquare className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => handleDelete(item.id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title="Hapus"
                            >
                                <HiOutlineTrash className="w-5 h-5" />
                            </button>
                        </div>
                    )
                }
            ]}
          />
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
        size="lg"
      >
          <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Tanggal <span className="text-red-500">*</span>
                      </label>
                      <input
                          type="date"
                          required
                          value={formData.date}
                          onChange={e => setFormData({...formData, date: e.target.value})}
                          className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      />
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Kategori <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => setFormData({...formData, category: 'OPEX'})}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border text-sm font-medium transition-all ${
                                formData.category === 'OPEX'
                                    ? 'bg-orange-50 border-orange-500 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300'
                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            <span>OPEX</span>
                            <span className="text-[10px] font-normal opacity-75">Operasional</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({...formData, category: 'CAPEX'})}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border text-sm font-medium transition-all ${
                                formData.category === 'CAPEX'
                                    ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            <span>CAPEX</span>
                            <span className="text-[10px] font-normal opacity-75">Modal / Aset</span>
                        </button>
                      </div>
                  </div>
              </div>

              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Jumlah (Rp) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">Rp</span>
                      </div>
                      <input
                          type="number"
                          required
                          min="0"
                          value={formData.amount}
                          onChange={e => setFormData({...formData, amount: e.target.value})}
                          className="w-full pl-10 rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-medium transition-shadow"
                          placeholder="0"
                      />
                  </div>
              </div>

              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Site / Lokasi (Group)
                  </label>
                  <select
                      value={formData.mixRadiusGroupId}
                      onChange={e => setFormData({...formData, mixRadiusGroupId: e.target.value})}
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  >
                      <option value="">-- Umum / Kantor Pusat --</option>
                      {sites.map(site => (
                          <option key={site.id} value={site.id}>{site.name}</option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Pilih group site untuk pengeluaran ini</p>
              </div>

              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Keterangan
                  </label>
                  <textarea
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      rows={3}
                      placeholder="Contoh: Pembelian kabel FO 2 roll, Bayar listrik, dll..."
                  />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
                  >
                      Batal
                  </button>
                  <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all hover:shadow-md flex items-center gap-2"
                  >
                      {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
                  </button>
              </div>
          </form>
      </Modal>
    </div>
  )
}
