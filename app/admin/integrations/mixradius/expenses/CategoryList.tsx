import { useState, useEffect, useMemo } from 'react'
import {
    HiOutlineFolder,
    HiOutlineFolderOpen,
    HiOutlinePencilSquare,
    HiOutlineTrash,
    HiOutlinePlus,
    HiOutlineTag,
    HiChevronRight,
    HiChevronDown,
    HiOutlineCalendar
} from 'react-icons/hi2'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency } from '@/lib/utils'

interface Category {
    id: string
    name: string
    type: string
    parentId: string | null
    parent?: { name: string }
    _count?: { children: number }
    totalDirect: number // Total pengeluaran langsung di kategori ini
}

interface CategoryWithTotal extends Category {
    children: CategoryWithTotal[]
    totalRecursive: number // Total pengeluaran termasuk anak-anaknya
}

export default function CategoryList() {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<Category | null>(null)
    const [selectedType, setSelectedType] = useState<'OPEX' | 'CAPEX'>('OPEX')
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

    // Date Filters
    const [startDate, setStartDate] = useState(() => {
        const now = new Date()
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    })
    const [endDate, setEndDate] = useState(() => {
        return (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })()
    })

    const [formData, setFormData] = useState({
        name: '',
        type: 'OPEX',
        parentId: ''
    })

    // Fetch Categories with Totals
    const fetchCategories = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                type: selectedType,
                startDate,
                endDate
            })

            const res = await fetch(`/api/finance/expense-categories?${params}`)
            const json = await res.json()
            // Fix: Extract data from wrapper { success: true, data: [...] }
            const data = Array.isArray(json) ? json : (json.data || [])

            if (Array.isArray(data)) {
                setCategories(data)

                // Auto expand categories that have children
                const parents = data.filter((c: Category) => data.some((child: Category) => child.parentId === c.id)).map((c: Category) => c.id)
                setExpandedIds(new Set(parents))
            }
        } catch (_error) {
            toast.error('Gagal mengambil data kategori')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCategories()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedType, startDate, endDate])

    // Build Tree Structure & Calculate Recursive Totals
    const categoryTree = useMemo(() => {
        const buildTree = (cats: Category[], parentId: string | null = null): CategoryWithTotal[] => {
            return cats
                .filter(cat => cat.parentId === parentId)
                .map(cat => {
                    const children = buildTree(cats, cat.id)
                    const totalRecursive = (cat.totalDirect || 0) + children.reduce((sum, child) => sum + child.totalRecursive, 0)

                    return {
                        ...cat,
                        children,
                        totalRecursive
                    }
                })
        }
        return buildTree(categories)
    }, [categories])

    // Calculate Grand Total for current view
    const grandTotal = useMemo(() => {
        return categoryTree.reduce((sum, cat) => sum + cat.totalRecursive, 0)
    }, [categoryTree])

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const handleOpenModal = (item?: Category, parentId?: string) => {
        if (item) {
            setEditingItem(item)
            setFormData({
                name: item.name,
                type: item.type as 'OPEX' | 'CAPEX',
                parentId: item.parentId || ''
            })
        } else {
            setEditingItem(null)
            setFormData({
                name: '',
                type: selectedType,
                parentId: parentId || ''
            })
        }
        setIsModalOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const url = editingItem
                ? `/api/finance/expense-categories/${editingItem.id}`
                : '/api/finance/expense-categories'

            const method = editingItem ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    type: formData.type,
                    parentId: formData.parentId || null
                })
            })

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                // Just toast the error, don't throw to avoid unhandled promise rejection in console if not caught upstream properly
                toast.error(errData.error || errData.message || 'Gagal menyimpan')
                return
            }

            toast.success(editingItem ? 'Kategori diperbarui' : 'Kategori dibuat')
            setIsModalOpen(false)
            fetchCategories()
        } catch (error) {
            console.error(error)
            toast.error(error instanceof Error ? error.message : 'Gagal menyimpan kategori')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Hapus kategori ini? Sub-kategori juga akan terhapus jika ada.')) return

        try {
            const res = await fetch(`/api/finance/expense-categories/${id}`, {
                method: 'DELETE'
            })

            const json = await res.json()
            if (!res.ok) {
                toast.error(json.error || 'Gagal menghapus')
                return
            }

            toast.success('Kategori dihapus')
            fetchCategories()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Gagal menghapus kategori')
        }
    }

    // Recursive Tree Item Component
    const CategoryItem = ({ item, level = 0, isLast = false, parentIndexString = '' }: { item: CategoryWithTotal, level?: number, isLast?: boolean, parentIndexString?: string }) => {
        const hasChildren = item.children && item.children.length > 0
        const isExpanded = expandedIds.has(item.id)
        const hasAmount = item.totalRecursive > 0

        // Calculate current index string (e.g. "1.1", "1.2") based on parent and item index
        // Note: We need the index from the map function to generate this correctly.
        // I'll update the recursive map call to pass `idx` and calculate `currentIndexString`.

        // This is handled in the recursive calls below. For root items, it's passed from the main render.

        // Level 0: Main Card Style
        if (level === 0) {
            return (
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden transition-all hover:shadow-md">
                    {/* Header / Main Row */}
                    <div className="relative flex items-center justify-between p-4 group">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            {/* Icon Box with Number */}
                            <div className={`
                                w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br relative overflow-hidden
                                ${selectedType === 'OPEX'
                                    ? 'from-orange-50 to-orange-100 text-orange-600 dark:from-orange-900/30 dark:to-orange-800/20 dark:text-orange-400'
                                    : 'from-purple-50 to-purple-100 text-purple-600 dark:from-purple-900/30 dark:to-purple-800/20 dark:text-purple-400'
                                }
                            `}>
                                <span className="absolute -bottom-2 -right-1 text-4xl opacity-10 font-black">{parentIndexString}</span>
                                <span className="text-lg font-bold">{parentIndexString}</span>
                            </div>

                            {/* Title & Subtitle */}
                            <div className="flex flex-col min-w-0">
                                <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                                    {item.name}
                                </h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    {hasChildren ? (
                                        <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400">
                                            {item.children.length} Sub-kategori
                                        </span>
                                    ) : (
                                        <span className="text-xs text-gray-400 italic">Tidak ada sub-kategori</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Total & Toggle */}
                        <div className="flex items-center gap-4 sm:gap-6">
                            <div className={`text-right flex flex-col items-end ${hasAmount ? 'opacity-100' : 'opacity-40'}`}>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</span>
                                <span className={`text-lg font-black font-mono ${selectedType === 'OPEX' ? 'text-orange-600 dark:text-orange-400' : 'text-purple-600 dark:text-purple-400'}`}>
                                    {formatCurrency(item.totalRecursive)}
                                </span>
                                {hasChildren && item.totalDirect > 0 && (
                                    <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5" title="Langsung di kategori ini">
                                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                        Direct: {formatCurrency(item.totalDirect)}
                                    </span>
                                )}
                            </div>

                            {/* Hover Actions (Desktop) */}
                            <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenModal(undefined, item.id); }}
                                    className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                    title="Tambah Sub"
                                >
                                    <HiOutlinePlus className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenModal(item); }}
                                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <HiOutlinePencilSquare className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Hapus"
                                >
                                    <HiOutlineTrash className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Expand Button */}
                            <button
                                onClick={() => hasChildren && toggleExpand(item.id)}
                                className={`
                                    w-8 h-8 flex items-center justify-center rounded-lg border transition-all
                                    ${hasChildren
                                        ? isExpanded
                                            ? 'bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200'
                                            : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-600'
                                        : 'invisible'
                                    }
                                `}
                            >
                                <HiChevronRight className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Children Container (Inside Card Body) */}
                    {hasChildren && isExpanded && (
                        <div className="bg-gray-50/50 dark:bg-black/20 border-t border-gray-100 dark:border-gray-700/50 p-2 space-y-1">
                            {item.children.map((child: CategoryWithTotal, idx: number) => (
                                <CategoryItem
                                    key={child.id}
                                    item={child}
                                    level={level + 1}
                                    isLast={idx === item.children.length - 1}
                                    parentIndexString={`${parentIndexString}.${idx + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )
        }

        // Level > 0: List Item Style
        return (
            <div className="relative pl-4 mt-1">
                {/* Visual Tree Connector */}
                <div className={`absolute left-0 top-0 w-[2px] bg-gray-200 dark:bg-gray-700/50 rounded-full my-1 ${isLast ? 'h-[20px] bottom-auto' : 'bottom-0'}`}></div>

                {/* Item Row */}
                <div className="pr-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors group flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0">
                    <div className="flex items-center gap-3 flex-1 min-w-0 pl-1">
                        <span className="font-mono text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                            {parentIndexString}
                        </span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                            {item.name}
                        </span>
                        {hasChildren && (
                            <button onClick={(e) => { e.stopPropagation(); toggleExpand(item.id); }} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-gray-500 font-medium transition-colors cursor-pointer">
                                {item.children.length} sub
                                {isExpanded ? <HiChevronDown className="w-3 h-3" /> : <HiChevronRight className="w-3 h-3" />}
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-4 pl-8 sm:pl-0">
                        <span className={`font-mono text-sm font-bold ${hasAmount ? 'text-gray-700 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600'}`}>
                            {formatCurrency(item.totalRecursive)}
                        </span>

                        {/* Mini Actions */}
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleOpenModal(undefined, item.id); }}
                                className="p-1.5 text-gray-400 hover:text-emerald-600 transition-colors"
                                title="Tambah Sub"
                            >
                                <HiOutlinePlus className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleOpenModal(item); }}
                                className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                                title="Edit"
                            >
                                <HiOutlinePencilSquare className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                title="Hapus"
                            >
                                <HiOutlineTrash className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Recursive Children for deep nesting */}
                {hasChildren && isExpanded && (
                    <div className="w-full space-y-1">
                        {item.children.map((child: CategoryWithTotal, idx: number) => (
                            <CategoryItem
                                key={child.id}
                                item={child}
                                level={level + 1}
                                isLast={idx === item.children.length - 1}
                                parentIndexString={`${parentIndexString}.${idx + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Toolbar */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                    {/* Type Switcher */}
                    <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-xl">
                        <button
                            onClick={() => setSelectedType('OPEX')}
                            className={`px-6 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${selectedType === 'OPEX'
                                    ? 'bg-white dark:bg-gray-800 text-orange-600 shadow-sm transform scale-100'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                        >
                            OPEX
                        </button>
                        <button
                            onClick={() => setSelectedType('CAPEX')}
                            className={`px-6 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${selectedType === 'CAPEX'
                                    ? 'bg-white dark:bg-gray-800 text-purple-600 shadow-sm transform scale-100'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                                }`}
                        >
                            CAPEX
                        </button>
                    </div>

                    {/* Date Filters */}
                    <div className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 bg-white dark:bg-gray-900">
                        <HiOutlineCalendar className="w-5 h-5 text-gray-400" />
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
                </div>

                <div className="flex items-center gap-4 w-full xl:w-auto justify-between xl:justify-end">
                    {/* Total Display */}
                    <div className="text-right px-4">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Total {selectedType}</p>
                        <p className={`text-xl font-black ${selectedType === 'OPEX' ? 'text-orange-600' : 'text-purple-600'}`}>
                            {formatCurrency(grandTotal)}
                        </p>
                    </div>

                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 dark:bg-blue-600 text-white rounded-xl hover:bg-black dark:hover:bg-blue-700 transition-all shadow-lg shadow-gray-200 dark:shadow-none text-sm font-bold active:scale-95 whitespace-nowrap"
                    >
                        <HiOutlinePlus className="w-5 h-5" />
                        <span className="hidden sm:inline">Tambah Induk</span>
                        <span className="sm:hidden">Tambah</span>
                    </button>
                </div>
            </div>

            {/* Tree View */}
            <div className="min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 space-y-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-blue-600"></div>
                        <p className="text-gray-400 text-sm animate-pulse">Memuat struktur kategori...</p>
                    </div>
                ) : categoryTree.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-80 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl bg-gray-50/50 dark:bg-gray-800/30">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-full shadow-sm mb-4">
                            <HiOutlineFolder className="w-12 h-12 text-gray-300" />
                        </div>
                        <p className="text-lg font-medium text-gray-600 dark:text-gray-300">Belum ada kategori</p>
                        <p className="text-sm">Mulai dengan menambahkan induk kategori baru untuk {selectedType}</p>
                    </div>
                ) : (
                    <div className="space-y-2 pb-10">
                        {categoryTree.map((cat, index) => (
                            <CategoryItem key={cat.id} item={cat} parentIndexString={(index + 1).toString()} />
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Form */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingItem ? 'Edit Kategori' : 'Buat Kategori Baru'}
            >
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Nama Kategori
                        </label>
                        <div className="relative">
                            <HiOutlineTag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                                placeholder="Contoh: Biaya Listrik, Alat Tulis Kantor"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Induk Kategori (Opsional)
                        </label>
                        <div className="relative">
                            <HiOutlineFolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <select
                                value={formData.parentId}
                                onChange={e => setFormData({ ...formData, parentId: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition-all shadow-sm appearance-none"
                            >
                                <option value="">-- Jadikan Induk Utama --</option>
                                {categories
                                    .filter(c => c.id !== editingItem?.id) // Prevent self-parenting
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))
                                }
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                <HiChevronDown className="w-4 h-4 text-gray-400" />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 ml-1">
                            Biarkan kosong jika ini adalah kategori utama (level teratas).
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
                        >
                            {editingItem ? 'Simpan Perubahan' : 'Buat Kategori'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}