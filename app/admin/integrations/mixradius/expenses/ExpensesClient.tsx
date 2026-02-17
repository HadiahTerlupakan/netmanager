'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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
  HiOutlineClipboardDocumentList,
  HiOutlineArrowRight,
  HiOutlineArrowLeft,
  HiOutlineCheckCircle,
  HiOutlineInformationCircle,
  // HiOutlineBanknotes,
  HiOutlineDocumentText,
  HiOutlinePhoto
} from 'react-icons/hi2'
import toast from 'react-hot-toast'
import { ResponsiveTable } from '@/components/ui/ResponsiveTable'
// import { Modal } from '@/components/ui/Modal'
import { Combobox } from '@/components/ui/Combobox'
import { formatCurrency } from '@/lib/utils'
import { usePermission } from '@/hooks/use-permission'
import RABList, { type RABProject } from './RABList'
import RABForm from './RABForm'
import CategoryList from './CategoryList'

interface Expense {
  id: string
  date: string
  amount: string
  category: string // CAPEX/OPEX
  expenseCategoryId?: string
  expenseCategory?: {
    id: string
    name: string
    type: string
  }
  categoryId?: string // COA Category
  transactionCategory?: {
    id: string
    name: string
  }
  accountId?: string // Financial Account
  financialAccount?: {
    id: string
    name: string
    balance: number
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
  console.log("DEBUG: Menggunakan ExpensesClient dari MixRadius (Wizard Stepper)");

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
  // const [coaCategories, setCoaCategories] = useState<CategoryOption[]>([]) // Deprecated
  // const [accounts, setAccounts] = useState<AccountOption[]>([]) // Deprecated
  const [filterCategories, setFilterCategories] = useState<CategoryOption[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(false)

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [editingItem, setEditingItem] = useState<Expense | null>(null)
  const [formData, setFormData] = useState({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      depreciation: '',
      usefulLife: 0,
      category: 'OPEX',
      expenseCategoryId: '',
      categoryId: '', // COA Category ID
      accountId: '', // Source Account ID
      description: '',
      siteId: '',
      mixRadiusGroupId: ''
  })

  // New Category State
  // const [isAddingCategory, setIsAddingCategory] = useState(false)
  // const [isManagingCategories, setIsManagingCategories] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)

  // RAB State
  const [activeTab, setActiveTab] = useState<'daily' | 'rab' | 'coa'>('daily')
  const [isRABModalOpen, setIsRABModalOpen] = useState(false)
  const [editingRAB, setEditingRAB] = useState<RABProject | null>(null)
  const [rabRefreshKey, setRabRefreshKey] = useState(0)

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Selected Options for Summary
  const selectedCategoryDetail = useMemo(() => categories.find(c => c.id === formData.expenseCategoryId), [categories, formData.expenseCategoryId])
  // const selectedAccount = useMemo(() => accounts.find(a => a.id === formData.accountId), [accounts, formData.accountId])

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

  // Fetch Metadata (None needed initially for now, categories fetched on demand)
  useEffect(() => {
      // Cleanup unused fetches
  }, []);

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

  const _handleAddCategory = async () => {
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

          if (!res.ok) {
              const errData = await res.json().catch(() => ({}))
              throw new Error(errData.error || 'Gagal membuat kategori baru')
          }

          const newCategory = await res.json()
          setCategories(prev => [...prev, newCategory].sort((a, b) => a.name.localeCompare(b.name)))
          setFormData(prev => ({ ...prev, expenseCategoryId: newCategory.id }))
          // setIsAddingCategory(false)
          setNewCategoryName('')
          toast.success('Kategori baru ditambahkan')
      } catch (_e) {
          toast.error('Gagal membuat kategori')
      }
  }

  const _handleDeleteCategory = async (id: string) => {
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
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || 'Gagal mengambil data pengeluaran')
      }

      const result = await response.json()
      setData(result)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Gagal mengambil data pengeluaran'
      setError(errorMsg)
      toast.error(errorMsg)
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
      setStep(1)
      if (item) {
          setEditingItem(item)
          setFormData({
              date: new Date(item.date).toISOString().split('T')[0],
              amount: item.amount.toString(),
              depreciation: item.depreciation || '',
              usefulLife: item.usefulLife || 0,
              category: item.category,
              expenseCategoryId: item.expenseCategoryId || '',
              categoryId: item.categoryId || '',
              accountId: item.accountId || '',
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
              categoryId: '',
              accountId: '',
              description: '',
              siteId: '',
              mixRadiusGroupId: ''
          })
      }
      setIsModalOpen(true)
  }

  const nextStep = () => {
    if (step === 1) {
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            toast.error('Nominal pengeluaran harus lebih besar dari 0')
            return
        }
        if (!formData.date) {
            toast.error('Tanggal transaksi wajib diisi')
            return
        }
    } else if (step === 2) {
        if (!formData.expenseCategoryId) {
            toast.error('Kategori Pengeluaran wajib dipilih')
            return
        }
        if (formData.category === 'CAPEX' && (!formData.usefulLife || formData.usefulLife < 1)) {
            toast.error('Masa manfaat CAPEX minimal 1 bulan')
            return
        }
    }
    setStep(step + 1)
  }

  const prevStep = () => setStep(step - 1)

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
          const selectedOption = sites.find(s => s.id === formData.mixRadiusGroupId)
          if (selectedOption && selectedOption.siteId) {
              finalSiteId = selectedOption.siteId
          }

          // Clean up payload based on category
          const payload = {
              ...formData,
              amount: Number(formData.amount),
              usefulLife: formData.category === 'OPEX' ? 0 : formData.usefulLife,
              depreciation: formData.category === 'OPEX' ? '0' : formData.depreciation,
              siteId: finalSiteId
          }

          const res = await fetch(url, {
              method,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          })

          if (!res.ok) {
              const errData = await res.json().catch(() => ({}))
              throw new Error(errData.error || 'Gagal menyimpan data pengeluaran')
          }

          toast.success(editingItem ? 'Data berhasil diperbarui' : 'Pengeluaran berhasil ditambahkan')
          setIsModalOpen(false)
          fetchData()
      } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Gagal menyimpan data pengeluaran')
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

          if (!res.ok) {
              const errData = await res.json().catch(() => ({}))
              throw new Error(errData.error || 'Gagal menghapus data')
          }

          toast.success('Data dihapus')
          fetchData()
      } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Gagal menghapus data pengeluaran')
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
            Manajemen biaya operasional, modal, dan rencana anggaran (MixRadius)
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
            {canCreate && activeTab !== 'coa' && (
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
              <button
                  onClick={() => setActiveTab('coa')}
                  className={`
                      whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                      ${activeTab === 'coa'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      }
                  `}
              >
                  <HiOutlineTag className="w-5 h-5" />
                  COA
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
                            {item.expenseCategory?.name || '-'}
                        </span>
                    )
                },
                // Removed COA & Account Columns
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

      {/* Wizard Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-[#1e293b] rounded-[2.5rem] w-full max-w-xl shadow-2xl border border-gray-100 dark:border-gray-800 relative">
                {/* Stepper Indicator */}
                <div className="bg-gray-50 dark:bg-[#161e2e] p-8 pb-4 rounded-t-[2.5rem]">
                    <div className="flex items-center justify-between max-w-xs mx-auto relative">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -translate-y-1/2 -z-0"></div>
                        {[1, 2, 3].map((s) => (
                            <div
                                key={s}
                                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-500 ${
                                    step >= s 
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/40 scale-110" 
                                        : "bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-400"
                                }`}
                            >
                                {step > s ? <HiOutlineCheckCircle className="w-6 h-6" /> : s}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] font-black uppercase tracking-widest text-gray-400 px-4">
                        <span className={step === 1 ? "text-blue-600 dark:text-blue-400" : ""}>Detail</span>
                        <span className={step === 2 ? "text-blue-600 dark:text-blue-400" : ""}>Klasifikasi</span>
                        <span className={step === 3 ? "text-blue-600 dark:text-blue-400" : ""}>Konfirmasi</span>
                    </div>
                </div>

                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Step 1: Detail Pengeluaran */}
                        {step === 1 && (
                            <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
                                <div className="flex items-center gap-3 mb-2">
                                    <HiOutlineInformationCircle className="text-blue-500 w-5 h-5" />
                                    <h2 className="text-xl font-black text-gray-900 dark:text-white">Detail Pengeluaran</h2>
                                </div>
                                
                                <div className="space-y-4">
                                    {/* Nominal */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 text-center">Nominal</label>
                                        <div className="relative max-w-xs mx-auto">
                                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                                <span className="text-gray-400 text-xl font-bold">Rp</span>
                                            </div>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                required
                                                autoFocus
                                                value={formData.amount ? formData.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                                onChange={e => {
                                                    const rawValue = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '')
                                                    setFormData({...formData, amount: rawValue})
                                                }}
                                                className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 text-2xl font-bold text-center transition-all shadow-sm"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tanggal</label>
                                            <div className="relative">
                                                <HiOutlineCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                                <input 
                                                    type="date" 
                                                    required
                                                    value={formData.date}
                                                    onChange={e => setFormData({...formData, date: e.target.value})}
                                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all" 
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Site (MixRadius)</label>
                                            <select
                                                value={formData.mixRadiusGroupId}
                                                onChange={e => setFormData({...formData, mixRadiusGroupId: e.target.value})}
                                                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all"
                                            >
                                                <option value="">-- Umum / Kantor Pusat --</option>
                                                {sites.map(site => (
                                                    <option key={site.id} value={site.id}>{site.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Keterangan</label>
                                        <div className="relative">
                                            <HiOutlineDocumentText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                                            <textarea 
                                                value={formData.description}
                                                onChange={e => setFormData({...formData, description: e.target.value})}
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all" 
                                                rows={3} 
                                                placeholder="Misal: Pembayaran Token Listrik Gudang..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Klasifikasi Akun */}
                        {step === 2 && (
                            <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
                                <div className="flex items-center gap-3 mb-2">
                                    <HiOutlineTag className="text-blue-500 w-5 h-5" />
                                    <h2 className="text-xl font-black text-gray-900 dark:text-white">Klasifikasi & Tipe</h2>
                                </div>

                                {/* Tipe: OPEX/CAPEX Cards */}
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({...formData, category: 'OPEX', expenseCategoryId: ''})}
                                        className={`relative p-3 rounded-xl border-2 text-left transition-all group ${
                                            formData.category === 'OPEX'
                                                ? 'bg-orange-50/50 border-orange-500 shadow-sm dark:bg-orange-900/20 dark:border-orange-500'
                                                : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                                        }`}
                                    >
                                        <div className="font-bold text-gray-900 dark:text-white text-sm">OPEX</div>
                                        <div className="text-[10px] text-gray-500 dark:text-gray-400">Operasional</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({...formData, category: 'CAPEX', expenseCategoryId: ''})}
                                        className={`relative p-3 rounded-xl border-2 text-left transition-all group ${
                                            formData.category === 'CAPEX'
                                                ? 'bg-purple-50/50 border-purple-500 shadow-sm dark:bg-purple-900/20 dark:border-purple-500'
                                                : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                                        }`}
                                    >
                                        <div className="font-bold text-gray-900 dark:text-white text-sm">CAPEX</div>
                                        <div className="text-[10px] text-gray-500 dark:text-gray-400">Modal</div>
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {/* Expense Category (Mandiri) */}
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Kategori Pengeluaran</label>
                                        </div>

                                        <div className="relative">
                                            <Combobox
                                                options={categories.map(c => ({ value: c.id, label: c.name }))}
                                                value={formData.expenseCategoryId}
                                                onChange={val => setFormData({...formData, expenseCategoryId: val})}
                                                placeholder="Pilih kategori pengeluaran..."
                                                loading={isLoadingCategories}
                                            />
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-1">
                                            Kelola kategori di tab COA
                                        </p>
                                    </div>

                                    {/* CAPEX Details */}
                                    {formData.category === 'CAPEX' && (
                                        <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-800/30 grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-purple-700 dark:text-purple-300 mb-1 uppercase">Masa Manfaat (Bulan)</label>
                                                <input
                                                    type="number"
                                                    value={formData.usefulLife || ''}
                                                    onChange={e => setFormData({...formData, usefulLife: parseInt(e.target.value) || 0})}
                                                    className="w-full rounded-lg border border-purple-200 dark:border-purple-800 bg-white dark:bg-gray-800 text-sm py-1.5"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-purple-700 dark:text-purple-300 mb-1 uppercase">Penyusutan</label>
                                                <div className="text-sm font-black text-purple-600 dark:text-purple-400 pt-1.5">
                                                    {formatCurrency(Number(formData.depreciation))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Konfirmasi */}
                        {step === 3 && (
                            <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
                                <div className="flex items-center gap-3 mb-2">
                                    <HiOutlineCheckCircle className="text-blue-500 w-5 h-5" />
                                    <h2 className="text-xl font-black text-gray-900 dark:text-white">Konfirmasi Data</h2>
                                </div>

                                <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-3xl border border-blue-100 dark:border-blue-900/30 space-y-3">
                                    <div className="flex justify-between items-center pb-3 border-b border-blue-200/30">
                                        <span className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase">Total Nominal</span>
                                        <span className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">{formatCurrency(Number(formData.amount))}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-xs pt-2">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Kategori</p>
                                            <p className="font-bold text-gray-700 dark:text-gray-200">{selectedCategoryDetail?.name || "-"}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Tipe</p>
                                            <p className="font-bold text-gray-700 dark:text-gray-200">{formData.category}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Tanggal</p>
                                            <p className="font-bold text-gray-700 dark:text-gray-200">{formData.date}</p>
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Keterangan</p>
                                            <p className="text-gray-600 dark:text-gray-400 italic">"{formData.description || "Tidak ada keterangan"}"</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Bukti Transaksi (Opsional)</label>
                                    <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl p-6 flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 transition-all cursor-pointer bg-gray-50/50 dark:bg-[#161e2e]/50">
                                        <HiOutlinePhoto className="w-8 h-8 mb-2" />
                                        <p className="text-[10px] font-bold uppercase tracking-widest">Klik untuk Upload</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="flex justify-between gap-4 pt-6 mt-4 border-t border-gray-100 dark:border-gray-800">
                            {step > 1 ? (
                                <button 
                                    type="button" 
                                    onClick={prevStep} 
                                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-all"
                                >
                                    <HiOutlineArrowLeft className="w-5 h-5" />
                                    Kembali
                                </button>
                            ) : (
                                <button 
                                    type="button" 
                                    onClick={() => setIsModalOpen(false)} 
                                    className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-all"
                                >
                                    Batal
                                </button>
                            )}

                            {step < 3 ? (
                                <button 
                                    type="button" 
                                    onClick={nextStep} 
                                    className="flex items-center gap-2 px-8 py-2.5 bg-gray-900 dark:bg-blue-600 text-white font-bold rounded-xl hover:bg-black dark:hover:bg-blue-700 transition-all shadow-lg active:scale-95"
                                >
                                    Lanjut
                                    <HiOutlineArrowRight className="w-5 h-5" />
                                </button>
                            ) : (
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 active:scale-95 disabled:opacity-50"
                                >
                                    {isSubmitting ? 'Menyimpan...' : 'Simpan Transaksi'}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
      )}
      </>
      ) : activeTab === 'rab' ? (
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
      ) : (
          /* COA View */
          <CategoryList />
      )}
    </div>
  )
}
