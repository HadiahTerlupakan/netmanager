'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FiUpload, FiPlus, FiSearch, FiCalendar, FiFilter } from 'react-icons/fi'
import { KeluarForm } from '@/components/inventory/KeluarForm'
import { KeluarTable } from '@/components/inventory/KeluarTable'
import { DetailKeluarModal } from '@/components/inventory/DetailKeluarModal'
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

interface BarangKeluar {
  id: string
  barangId: string
  gudangId: string
  jumlah: number
  kondisi: 'BARU' | 'BEKAS' | 'RUSAK'
  isHilang?: boolean
  keterangan: string | null
  tanggal: string
  createdAt: string
  employeeId?: string | null
  purpose?: string | null
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

export default function BarangKeluarPage() {
  const { hasPermission } = usePermission()
  const canCreate = hasPermission('keluar:create')
  const canUpdate = hasPermission('keluar:update')

  const [showForm, setShowForm] = useState(false)
  const [editingKeluar, setEditingKeluar] = useState<BarangKeluar | null>(null)
  const [viewingKeluar, setViewingKeluar] = useState<BarangKeluar | null>(null)
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


  const handleEdit = (keluar: BarangKeluar) => {
    setEditingKeluar(keluar)
    setShowForm(true)
  }

  const handleView = (keluar: BarangKeluar) => {
    setViewingKeluar(keluar)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingKeluar(null)
    setRefreshTrigger(prev => prev + 1)
  }

  const handleViewClose = () => {
    setViewingKeluar(null)
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
            <FiUpload className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Barang Keluar
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Kelola catatan barang yang keluar dari gudang
            </p>
          </div>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            <FiPlus className="h-4 w-4 mr-2 text-white" />
            <span className="text-white">Barang Keluar</span>
          </button>
        )}
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={handleFormClose}
        title={editingKeluar ? 'Edit Barang Keluar' : 'Catat Barang Keluar'}
        size="lg"
      >
        <KeluarForm
          initialData={editingKeluar}
          onClose={handleFormClose}
        />
      </Modal>

      {/* List Container */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Riwayat Barang Keluar
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
          <KeluarTable
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
      <DetailKeluarModal
        keluar={viewingKeluar}
        isOpen={!!viewingKeluar}
        onClose={handleViewClose}
        onEdit={canUpdate ? handleEdit : undefined}
      />
    </div>
  )
}