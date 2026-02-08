'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  HiOutlinePlus,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineMagnifyingGlass,
  HiOutlineCurrencyDollar,
  HiOutlineCalendar,
  HiOutlineBuildingOffice,
  HiOutlineTag,
  HiOutlineDocumentArrowDown,
  HiOutlineClipboardDocumentList
} from 'react-icons/hi2'
import toast from 'react-hot-toast'
import { ResponsiveTable } from '@/components/ui/ResponsiveTable'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils'
import { usePermission } from '@/hooks/use-permission'
import RABList, { type RABProject } from './RABList'
import RABForm from './RABForm'

interface Expense {
  id: string
  date: string
  amount: string
  category: string
  expenseCategoryId?: string
  expenseCategory?: {
    id: string
    name: string
    type: string
  }
  depreciation?: string
  usefulLife?: number
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

interface CategoryOption {
    id: string
    name: string
    type: string
}

export default function ExpensesClient() {
  const { hasPermission } = usePermission()

  // Permission checks (support both specific mixradius permission AND generic expense permission)
  const canCreate = hasPermission('mixradius_expenses:create') || hasPermission('expense:create')
  const canUpdate = hasPermission('mixradius_expenses:update') || hasPermission('expense:update')
  const canDelete = hasPermission('mixradius_expenses:delete') || hasPermission('expense:delete')

  const [data, setData] = useState<Expense[]>([])
  const [loading, setLoading] = useState(false)
  const [_error, setError] = useState<string | null>(null)

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
  const [selectedSubCategory, setSelectedSubCategory] = useState('')

  // Options
  const [sites, setSites] = useState<SiteOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [filterCategories, setFilterCategories] = useState<CategoryOption[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Expense | null>(null)
  const [formData, setFormData] = useState({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      depreciation: '',
      usefulLife: 0,
      category: 'OPEX',
      expenseCategoryId: '',
      description: '',
      siteId: '',
      mixRadiusGroupId: ''
  })

  // New Category State
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [isManagingCategories, setIsManagingCategories] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)

  // RAB State
  const [activeTab, setActiveTab] = useState<'daily' | 'rab'>('daily')
  const [isRABModalOpen, setIsRABModalOpen] = useState(false)
  const [editingRAB, setEditingRAB] = useState<RABProject | null>(null)
  const [rabRefreshKey, setRabRefreshKey] = useState(0)

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
                   setSites(json.data.map((g: { id: string; name: string; siteId?: string }) => ({
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

  // Fetch Filter Categories when type changes
  useEffect(() => {
      const fetchFilterCategories = async () => {
          if (!selectedCategory) {
              setFilterCategories([])
              setSelectedSubCategory('')
              return
          }

          try {
              const res = await fetch(`/api/finance/expense-categories?type=${selectedCategory}`)
              const json = await res.json()
              if (Array.isArray(json)) {
                  setFilterCategories(json)
              }
          } catch (e) {
              console.error('Failed to fetch filter categories', e)
          }
      }

      fetchFilterCategories()
  }, [selectedCategory])

  // Fetch Categories for Modal
  const fetchCategories = useCallback(async () => {
      setIsLoadingCategories(true)
      try {
          const res = await fetch(`/api/finance/expense-categories?type=${formData.category}`)
          const json = await res.json()
          if (Array.isArray(json)) {
              setCategories(json)
          }
      } catch (e) {
          console.error('Failed to fetch categories', e)
      } finally {
          setIsLoadingCategories(false)
      }
  }, [formData.category])

  useEffect(() => {
      if (isModalOpen) {
          fetchCategories()
      }
  }, [fetchCategories, isModalOpen])

  const handleAddCategory = async () => {
      if (!newCategoryName.trim()) return

      try {
          const res = await fetch('/api/finance/expense-categories', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  name: newCategoryName,
                  type: formData.category
              })
          })

          if (!res.ok) throw new Error('Failed to create category')

          const newCategory = await res.json()
          setCategories(prev => [...prev, newCategory].sort((a, b) => a.name.localeCompare(b.name)))
          setFormData(prev => ({ ...prev, expenseCategoryId: newCategory.id }))
          setIsAddingCategory(false)
          setNewCategoryName('')
          toast.success('Kategori baru ditambahkan')
      } catch (_e) {
          toast.error('Gagal membuat kategori')
      }
  }

  const handleDeleteCategory = async (id: string) => {
      if (!confirm('Hapus kategori ini?')) return

      try {
          const res = await fetch(`/api/finance/expense-categories/${id}`, {
              method: 'DELETE'
          })

          if (!res.ok) {
              const data = await res.json()
              throw new Error(data.error || 'Gagal menghapus')
          }

          setCategories(prev => prev.filter(c => c.id !== id))

          // If deleted category was selected, reset selection
          if (formData.expenseCategoryId === id) {
              setFormData(prev => ({ ...prev, expenseCategoryId: '' }))
          }

          toast.success('Kategori dihapus')
      } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Gagal menghapus kategori')
      }
  }

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
      if (selectedSubCategory) params.append('expenseCategoryId', selectedSubCategory)

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
  }, [startDate, endDate, selectedSite, selectedCategory, selectedSubCategory])

  useEffect(() => {
    fetchData()
  }, [fetchData])

      // Calculate depreciation automatically if usefulLife changes or amount changes
      useEffect(() => {
        if (formData.category === 'CAPEX' && formData.amount && formData.usefulLife > 0) {
            const amount = Number(formData.amount)
            const life = Number(formData.usefulLife)
            if (!isNaN(amount) && !isNaN(life) && life > 0) {
                const depreciation = Math.round(amount / life).toString()
                setFormData(prev => ({ ...prev, depreciation }))
            }
        }
      }, [formData.amount, formData.usefulLife, formData.category])

      const filteredData = data.filter(item => {
      if (!debouncedSearch) return true
      const lowerSearch = debouncedSearch.toLowerCase()
      return (
          (item.description && item.description.toLowerCase().includes(lowerSearch)) ||
          (item.amount.toString().includes(lowerSearch)) ||
          (item.expenseCategory && item.expenseCategory.name.toLowerCase().includes(lowerSearch))
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
              depreciation: item.depreciation || '',
              usefulLife: item.usefulLife || 0,
              category: item.category,
              expenseCategoryId: item.expenseCategoryId || '',
              description: item.description || '',
              siteId: item.siteId || '',
              mixRadiusGroupId: item.mixRadiusGroupId || ''
          })
      } else {
          setEditingItem(null)
          setFormData({
              date: new Date().toISOString().split('T')[0],
              amount: '',
              depreciation: '',
              usefulLife: 0,
              category: 'OPEX',
              expenseCategoryId: '',
              description: '',
              siteId: '',
              mixRadiusGroupId: ''
          })
      }
      setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      
      // Validasi tambahan
      if (parseFloat(formData.amount) <= 0) {
          toast.error('Nominal harus lebih besar dari 0')
          return
      }

      if (formData.category === 'CAPEX' && (!formData.usefulLife || formData.usefulLife < 1)) {
          toast.error('Masa manfaat CAPEX minimal 1 bulan')
          return
      }

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

          // Clean up payload based on category
          const payload = {
              ...formData,
              // If OPEX, reset CAPEX specific fields to 0/null
              usefulLife: formData.category === 'OPEX' ? 0 : formData.usefulLife,
              depreciation: formData.category === 'OPEX' ? '0' : formData.depreciation,
              siteId: finalSiteId // Ensure we send the physical site ID if available
          }

          const res = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          })

          if (!res.ok) throw new Error('Gagal menyimpan data')

          toast.success(editingItem ? '✅ Data berhasil diperbarui' : '✅ Pengeluaran berhasil ditambahkan')
          setIsModalOpen(false)
          fetchData()
      } catch (_err) {
          toast.error('Terjadi kesalahan saat menyimpan')
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
      } catch (_err) {
          toast.error('Gagal menghapus data')
      }
  }

  const handleExport = () => {
      if (filteredData.length === 0) {
          toast.error('Tidak ada data untuk diekspor')
          return
      }

      // Header CSV
      const headers = ['Tanggal', 'Jumlah', 'Tipe', 'Kategori', 'Keterangan', 'Site/Group', 'Petugas']

      // Rows
      const rows = filteredData.map(item => [
          new Date(item.date).toLocaleDateString('id-ID'),
          item.amount.toString(),
          item.category,
          item.expenseCategory?.name || '-',
          `"${(item.description || '').replace(/"/g, '""')}"`, // Escape quotes
          `"${(item.mixRadiusGroup?.name || item.site?.name || 'Umum').replace(/"/g, '""')}"`,
          item.user?.name || '-'
      ])

      // Combine
      const csvContent = [
          headers.join(','),
          ...rows.map(row => row.join(','))
      ].join('\n')

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `laporan-pengeluaran-${startDate}-to-${endDate}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
  }

  // RAB Handlers
  const handleOpenRABModal = () => {
      setEditingRAB(null)
      setIsRABModalOpen(true)
  }

  const handleEditRAB = (project: RABProject) => {
      setEditingRAB(project)
      setIsRABModalOpen(true)
  }

  const handleRABSaved = () => {
      setRabRefreshKey(prev => prev + 1)
      setIsRABModalOpen(false)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlineCurrencyDollar className="w-7 h-7 text-red-500" />
            Keuangan & Pengeluaran
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manajemen biaya operasional, modal, dan rencana anggaran
          </p>
        </div>

        <div className="flex gap-2">
            {activeTab === 'daily' && (
                <button
                    onClick={handleExport}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                >
                    <HiOutlineDocumentArrowDown className="w-5 h-5" />
                    <span className="hidden sm:inline">Export CSV</span>
                </button>
            )}
            {canCreate && (
                <button
                    onClick={() => activeTab === 'daily' ? handleOpenModal() : handleOpenRABModal()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <HiOutlinePlus className="w-5 h-5" />
                    <span className="hidden sm:inline">
                        {activeTab === 'daily' ? 'Tambah Pengeluaran' : 'Buat RAB Baru'}
                    </span>
                    <span className="sm:hidden">Tambah</span>
                </button>
            )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                  onClick={() => setActiveTab('daily')}
                  className={`
                      whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                      ${activeTab === 'daily'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }
                  `}
              >
                  <HiOutlineCurrencyDollar className="w-5 h-5" />
                  Pengeluaran Harian
              </button>
              <button
                  onClick={() => setActiveTab('rab')}
                  className={`
                      whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                      ${activeTab === 'rab'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }
                  `}
              >
                  <HiOutlineClipboardDocumentList className="w-5 h-5" />
                  RAB (Proyek)
              </button>
          </nav>
      </div>

      {activeTab === 'daily' ? (
        <>
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
                    onChange={(e) => {
                        setSelectedCategory(e.target.value)
                        setSelectedSubCategory('') // Reset sub category when type changes
                    }}
                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
                >
                    <option value="">Semua Tipe</option>
                    <option value="CAPEX">CAPEX</option>
                    <option value="OPEX">OPEX</option>
                </select>

                {/* Sub Category Filter - Only show if Type is selected */}
                {selectedCategory && (
                    <select
                        value={selectedSubCategory}
                        onChange={(e) => setSelectedSubCategory(e.target.value)}
                        className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px] animate-in fade-in slide-in-from-left-2 duration-200"
                    >
                        <option value="">Semua Kategori</option>
                        {filterCategories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>
                )}

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
          <ResponsiveTable keyField="id"
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
                    header: 'Tipe',
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
                    key: 'expenseCategory',
                    header: 'Kategori',
                    render: (item) => (
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {item.expenseCategory ? item.expenseCategory.name : '-'}
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
                ...((canUpdate || canDelete) ? [{
                    key: 'actions',
                    header: '',
                    render: (item: Expense) => (
                        <div className="flex justify-end gap-2">
                            {canUpdate && (
                                <button
                                    onClick={() => handleOpenModal(item)}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <HiOutlinePencilSquare className="w-5 h-5" />
                                </button>
                            )}
                            {canDelete && (
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                    title="Hapus"
                                >
                                    <HiOutlineTrash className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    )
                }] : [])
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
          <form onSubmit={handleSubmit} className="space-y-6">
              {/* 1. Amount - Prominent */}
              <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 text-center">
                      Nominal Pengeluaran
                  </label>
                  <div className="relative max-w-xs mx-auto">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="text-gray-400 text-2xl font-bold">Rp</span>
                      </div>
                      <input
                          type="text"
                          inputMode="numeric"
                          required
                          autoFocus
                          value={formData.amount ? formData.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                          onChange={e => {
                              // Hanya ambil angka
                              const rawValue = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '')
                              setFormData({...formData, amount: rawValue})
                          }}
                          className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-0 focus:border-blue-500 text-3xl font-bold text-center transition-all shadow-sm placeholder:text-gray-300 dark:placeholder:text-gray-600 hover:border-gray-500 dark:hover:border-gray-400"
                          placeholder="0"
                      />
                  </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>

              {/* 2. Category Selection - Cards */}
              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Jenis Pengeluaran (Tipe)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                      <button
                          type="button"
                          onClick={() => setFormData({...formData, category: 'OPEX', expenseCategoryId: ''})}
                          className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 group ${
                              formData.category === 'OPEX'
                                  ? 'bg-orange-50/50 border-orange-500 shadow-md ring-1 ring-orange-200 dark:bg-orange-900/20 dark:border-orange-500 dark:ring-orange-800'
                                  : 'bg-white border-gray-400 hover:border-orange-400 hover:bg-orange-50/30 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-750'
                          }`}
                      >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${
                              formData.category === 'OPEX' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500 group-hover:bg-orange-100 group-hover:text-orange-600'
                          }`}>
                              <HiOutlineTag className="w-6 h-6" />
                          </div>
                          <div className="font-bold text-gray-900 dark:text-white">OPEX</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Operasional (Gaji, Listrik, ATK)</div>
                          {formData.category === 'OPEX' && (
                              <div className="absolute top-3 right-3 w-3 h-3 bg-orange-500 rounded-full ring-2 ring-white dark:ring-gray-900"></div>
                          )}
                      </button>

                      <button
                          type="button"
                          onClick={() => setFormData({...formData, category: 'CAPEX', expenseCategoryId: ''})}
                          className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 group ${
                              formData.category === 'CAPEX'
                                  ? 'bg-purple-50/50 border-purple-500 shadow-md ring-1 ring-purple-200 dark:bg-purple-900/20 dark:border-purple-500 dark:ring-purple-800'
                                  : 'bg-white border-gray-400 hover:border-purple-400 hover:bg-purple-50/30 dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-750'
                          }`}
                      >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${
                              formData.category === 'CAPEX' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500 group-hover:bg-purple-100 group-hover:text-purple-600'
                          }`}>
                              <HiOutlineBuildingOffice className="w-6 h-6" />
                          </div>
                          <div className="font-bold text-gray-900 dark:text-white">CAPEX</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Modal (Aset, Perangkat, Infrastruktur)</div>
                          {formData.category === 'CAPEX' && (
                              <div className="absolute top-3 right-3 w-3 h-3 bg-purple-500 rounded-full ring-2 ring-white dark:ring-gray-900"></div>
                          )}
                      </button>
                  </div>
              </div>

              {/* 2.5 Sub Category Selection */}
              <div>
                  <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Kategori {formData.category}
                      </label>
                      {!isAddingCategory && !isManagingCategories && categories.length > 0 && canCreate && (
                          <button
                              type="button"
                              onClick={() => setIsManagingCategories(true)}
                              className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                              <HiOutlinePencilSquare className="w-3 h-3" />
                              Kelola
                          </button>
                      )}
                  </div>

                  {isManagingCategories ? (
                      <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Hapus kategori yang tidak digunakan:</p>
                          <div className="flex flex-wrap gap-2 mb-3 max-h-32 overflow-y-auto custom-scrollbar">
                              {categories.map(cat => (
                                  <div key={cat.id} className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 rounded-full text-sm shadow-sm group">
                                      <span className="text-gray-700 dark:text-gray-300">{cat.name}</span>
                                      {canDelete && (
                                          <button
                                              type="button"
                                              onClick={() => handleDeleteCategory(cat.id)}
                                              className="text-gray-400 hover:text-red-500 transition-colors p-0.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30"
                                              title="Hapus Kategori"
                                          >
                                              <HiOutlineTrash className="w-3.5 h-3.5" />
                                          </button>
                                      )}
                                  </div>
                              ))}
                              {categories.length === 0 && <span className="text-sm text-gray-400 italic">Tidak ada kategori</span>}
                          </div>
                          <button
                              type="button"
                              onClick={() => setIsManagingCategories(false)}
                              className="w-full py-1.5 text-xs font-medium bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-gray-700 dark:text-gray-300"
                          >
                              Selesai Mengelola
                          </button>
                      </div>
                  ) : !isAddingCategory ? (
                      <div className="flex gap-2">
                          <select
                              value={formData.expenseCategoryId}
                              onChange={(e) => setFormData({...formData, expenseCategoryId: e.target.value})}
                              disabled={isLoadingCategories}
                              className="flex-1 rounded-lg border border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow disabled:opacity-50 hover:border-gray-500 dark:hover:border-gray-400"
                          >
                              <option value="">-- Pilih Kategori --</option>
                              {categories.map(cat => (
                                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                          </select>
                          {canCreate && (
                              <button
                                  type="button"
                                  onClick={() => {
                                      setIsAddingCategory(true)
                                      setNewCategoryName('')
                                  }}
                                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors whitespace-nowrap text-sm font-medium border border-gray-300 dark:border-gray-600"
                              >
                                  + Baru
                              </button>
                          )}
                      </div>
                  ) : (
                      <div className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                          <input
                              type="text"
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              placeholder="Nama kategori baru..."
                              autoFocus
                              className="flex-1 rounded-lg border-blue-300 ring-2 ring-blue-100 dark:border-blue-700 dark:ring-blue-900/30 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                      e.preventDefault()
                                      handleAddCategory()
                                  }
                              }}
                          />
                          <button
                              type="button"
                              onClick={handleAddCategory}
                              disabled={!newCategoryName.trim()}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                          >
                              Simpan
                          </button>
                          <button
                              type="button"
                              onClick={() => setIsAddingCategory(false)}
                              className="px-3 py-2 bg-white border border-gray-300 dark:bg-gray-800 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                              Batal
                          </button>
                      </div>
                  )}
              </div>

              {/* 3. CAPEX Details - Animated/Conditional */}
              {formData.category === 'CAPEX' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="bg-purple-50 dark:bg-purple-900/20 p-5 rounded-2xl border border-purple-100 dark:border-purple-800/50 space-y-4">
                          <h3 className="text-xs font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wide flex items-center gap-2 mb-2">
                              <HiOutlineCurrencyDollar className="w-4 h-4" />
                              Estimasi Penyusutan Aset
                          </h3>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-xs font-medium text-purple-700 dark:text-purple-300 mb-1.5">
                                      Masa Manfaat (Bulan)
                                  </label>
                                  <input
                                      type="number"
                                      min="1"
                                      value={formData.usefulLife || ''}
                                      onChange={e => setFormData({...formData, usefulLife: parseInt(e.target.value) || 0})}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      className="w-full rounded-lg border border-purple-300 dark:border-purple-600 bg-white dark:bg-purple-900/20 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-shadow"
                                      placeholder="Contoh: 12"
                                  />
                                  <div className="flex gap-2 mt-2">
                                      {[12, 24, 36, 48, 60].map((months) => (
                                          <button
                                              key={months}
                                              type="button"
                                              onClick={() => setFormData({ ...formData, usefulLife: months })}
                                              className={`px-2 py-1 text-[10px] rounded-md border transition-colors ${
                                                  formData.usefulLife === months
                                                      ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/40 dark:border-purple-500 dark:text-purple-300'
                                                      : 'bg-white border-purple-100 text-purple-600 hover:bg-purple-50 dark:bg-transparent dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-900/20'
                                              }`}
                                          >
                                              {months / 12} Thn
                                          </button>
                                      ))}
                                  </div>
                              </div>

                              <div>
                                  <label className="block text-xs font-medium text-purple-700 dark:text-purple-300 mb-1.5">
                                      Penyusutan per Bulan
                                  </label>
                                  <div className="relative">
                                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                          <span className="text-purple-500 font-bold text-xs">Rp</span>
                                      </div>
                                      <input
                                          type="text"
                                          readOnly
                                          value={formData.depreciation ? formatCurrency(Number(formData.depreciation)) : '0'}
                                          className="w-full pl-8 rounded-lg border-purple-200 dark:border-purple-700/50 bg-purple-100/50 dark:bg-purple-900/40 text-purple-900 dark:text-purple-100 font-bold cursor-not-allowed"
                                      />
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              )}

              {/* 4. Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Tanggal Transaksi
                      </label>
                      <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <HiOutlineCalendar className="text-gray-400 w-5 h-5" />
                          </div>
                          <input
                              type="date"
                              required
                              value={formData.date}
                              onChange={e => setFormData({...formData, date: e.target.value})}
                              className="w-full pl-10 rounded-lg border border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow hover:border-gray-500 dark:hover:border-gray-400"
                          />
                      </div>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Lokasi / Site (Group)
                      </label>
                      <select
                          value={formData.mixRadiusGroupId}
                          onChange={e => setFormData({...formData, mixRadiusGroupId: e.target.value})}
                          className="w-full rounded-lg border border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow hover:border-gray-500 dark:hover:border-gray-400"
                      >
                          <option value="">-- Umum / Kantor Pusat --</option>
                          {sites.map(site => (
                              <option key={site.id} value={site.id}>{site.name}</option>
                          ))}
                      </select>
                  </div>
              </div>

              {/* 5. Description */}
              <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Keterangan / Catatan
                  </label>
                  <textarea
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      maxLength={500}
                      className="w-full rounded-lg border border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow hover:border-gray-500 dark:hover:border-gray-400"
                      rows={3}
                      placeholder="Contoh: Pembelian kabel FO 2 roll, Bayar listrik, dll..."
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                      {formData.description.length}/500 karakter
                  </p>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-700">
                  <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-xl dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 transition-colors"
                  >
                      Batal
                  </button>
                  <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 transition-all hover:shadow-blue-500/50 hover:-translate-y-0.5 flex items-center gap-2"
                  >
                      {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
                  </button>
              </div>
          </form>
      </Modal>
      </>
      ) : (
          /* RAB View */
          <div className="space-y-6">
              <RABList
                  refreshKey={rabRefreshKey}
                  onEdit={handleEditRAB}
              />

              <RABForm
                  isOpen={isRABModalOpen}
                  onClose={() => setIsRABModalOpen(false)}
                  onSaved={handleRABSaved}
                  initialData={editingRAB}
                  sites={sites} // Pass existing sites/groups data
              />
          </div>
      )}
    </div>
  )
}
