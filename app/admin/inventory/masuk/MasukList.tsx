'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FiDownload, FiPlus, FiSearch, FiCalendar, FiFilter } from 'react-icons/fi'
import { MasukForm } from '@/components/inventory/MasukForm'
import { MasukTable } from '@/components/inventory/MasukTable'
import { DetailMasukModal } from '@/components/inventory/DetailMasukModal'
import { getWithAuth } from '@/lib/api-client'
import { usePermission } from '@/hooks/use-permission'
import { Modal } from '@/components/ui/Modal'

interface Site {
  id: string
  name: string
}

interface Gudang {
  id: string
  nama: string
}


interface FotoMetadata {
  [key: string]: unknown
}

interface BarangMasuk {
  id: string
  barangId: string
  gudangId: string
  jumlah: number
  kondisi: 'BARU' | 'BEKAS' | 'RUSAK'
  keterangan: string | null
  tanggal: string
  createdAt: string
  employeeId?: string | null
  fotoBukti: string[]
  fotoMetadata?: FotoMetadata
  barang: {
    id: string
    kode: string
    nama: string
    satuan: string
  }
  gudang: {
    id: string
    kode: string
    nama: string
  }
  user?: {
    id: string
    name: string | null
    email: string
  } | null
}

export default function BarangMasukPage() {
  const { hasPermission } = usePermission()
  const canCreate = hasPermission('masuk:create')
  const canUpdate = hasPermission('masuk:update')

  const [showForm, setShowForm] = useState(false)
  const [editingMasuk, setEditingMasuk] = useState<BarangMasuk | null>(null)
  const [viewingMasuk, setViewingMasuk] = useState<BarangMasuk | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [siteId, setSiteId] = useState('')
  const [gudangId, setGudangId] = useState('')
  const [sites, setSites] = useState<Site[]>([])
  const [gudangs, setGudangs] = useState<Gudang[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Sites
        const siteRes = await getWithAuth('/api/admin/sites')
        if (siteRes.ok) {
          const data = await siteRes.json()
          setSites(data.data || [])
        }

        // Fetch Gudangs
        const gudangRes = await getWithAuth('/api/inventory/gudang?view=all')
        if (gudangRes.ok) {
          const data = await gudangRes.json()
          const result = data.data || data
          setGudangs(result.gudangs || [])
        }
      } catch (err: unknown) {
        console.error('Failed to fetch data', err)
      }
    }
    fetchData()
  }, [])


  const handleEdit = (masuk: BarangMasuk) => {
    setEditingMasuk(masuk)
    setShowForm(true)
  }

  const handleView = (masuk: BarangMasuk) => {
    setViewingMasuk(masuk)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingMasuk(null)
    setRefreshTrigger(prev => prev + 1)
  }

  const handleViewClose = () => {
    setViewingMasuk(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Link
            href="/admin/inventory"
            className="mr-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <FiDownload className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Barang Masuk
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Kelola catatan barang yang masuk ke gudang
            </p>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            <FiPlus className="h-4 w-4 mr-2 text-white" />
            <span className="text-white">Barang Masuk</span>
          </button>
        )}
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={handleFormClose}
        title={editingMasuk ? 'Edit Barang Masuk' : 'Catat Barang Masuk'}
        size="lg"
      >
        <MasukForm
          initialData={editingMasuk}
          onClose={handleFormClose}
        />
      </Modal>

      {/* List Container */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Riwayat Barang Masuk
          </h2>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiSearch className="text-gray-400" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari barang, kode, user..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
              />
            </div>

            {/* Site Filter */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiFilter className="text-gray-400" />
              </div>
              <select
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
              >
                <option value="">Semua Site</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>

            {/* Warehouse Filter */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiFilter className="text-gray-400" />
              </div>
              <select
                value={gudangId}
                onChange={(e) => setGudangId(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
              >
                <option value="">Semua Gudang</option>
                {gudangs.map(gudang => (
                  <option key={gudang.id} value={gudang.id}>{gudang.nama}</option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiCalendar className="text-gray-400" />
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
              />
            </div>

            {/* End Date */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiCalendar className="text-gray-400" />
              </div>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        <div className="p-6">
          <MasukTable
            onEdit={canUpdate ? handleEdit : undefined}
            onView={handleView}
            refreshTrigger={refreshTrigger}
            search={search}
            startDate={startDate}
            endDate={endDate}
            siteId={siteId}
            gudangId={gudangId}
          />
        </div>
      </div>

      {/* Detail Modal */}
      <DetailMasukModal
        masuk={viewingMasuk}
        isOpen={!!viewingMasuk}
        onClose={handleViewClose}
        onEdit={canUpdate ? handleEdit : undefined}
      />
    </div>
  )
}