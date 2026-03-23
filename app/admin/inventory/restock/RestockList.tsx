'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Modal } from '@/components/ui/Modal'
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiCheck, FiDownload, FiImage, FiSearch, FiFilter } from 'react-icons/fi'
import { ResponsiveTable, type Column } from '@/components/ui/ResponsiveTable'
import { usePermission } from '@/hooks/use-permission'
import { getWithAuth, postWithAuth, patchWithAuth, putWithAuth, deleteWithAuth } from '@/lib/api-client'
import { toast } from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PhotoUpload, type UploadedPhoto, type PhotoUploadRef } from '@/components/inventory/PhotoUpload'
import { SearchableSelect } from '@/components/ui/SearchableSelect'

interface PurchaseRequest {
  id: string
  nomorRequest: string
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ORDERED' | 'RECEIVED' | 'CANCELLED'
  createdAt: string
  approvedAt?: string
  requester: { name: string }
  approver?: { name: string }
  gudangId: string
  gudang: { nama: string; id: string }
  keterangan?: string
  items: {
    id: string
    barangId: string
    jumlah: number
    receivedQuantity: number
    barang: { nama: string; kode: string; satuan: string }
  }[]
}

interface BarangGudang {
  id: string
  barangId: string
  gudangId: string
  stok: number
  stokBaru: number
  stokBekas: number
  stokRusak: number
  gudang?: { id: string; nama: string }
}

interface RestockSetting {
  id: string
  barangId: string
  gudangId: string
  minStok: number
  maxStok: number
}

interface Barang {
  id: string
  kode: string
  nama: string
  satuan: string
  minStokDefault?: number
  totalStock?: number
  stockPerGudang?: BarangGudang[]
  barangGudang?: BarangGudang[]
}

interface Gudang {
  id: string
  nama: string
}

interface AutoTableDoc extends jsPDF {
  lastAutoTable: {
    finalY: number
  }
}

export default function RestockCRUDPage() {
  const { hasPermission } = usePermission()
  const canApprove = hasPermission('restock:approve')
  const canUpdate = hasPermission('restock:update')

  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [barangs, setBarangs] = useState<Barang[]>([])
  const [allBarangsSource, setAllBarangsSource] = useState<Barang[]>([])
  const [allSettingsSource, setAllSettingsSource] = useState<RestockSetting[]>([])
  const [gudangs, setGudangs] = useState<Gudang[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAllItems, setShowAllItems] = useState(false)

  // Form State
  const [showForm, setShowForm] = useState(false)
  const [editingPR, setEditingPR] = useState<PurchaseRequest | null>(null)
  const [formGudang, setFormGudang] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [formItems, setFormItems] = useState<{barangId: string, quantity: number}[]>([{barangId: '', quantity: 1}])

  // Details State
  const [viewingPR, setViewingPR] = useState<PurchaseRequest | null>(null)

  // Receiving State
  const [receivingPR, setReceivingPR] = useState<PurchaseRequest | null>(null)
  const [receivedItems, setReceivedItems] = useState<Record<string, number>>({})
  const [receivedPhotos, setReceivedPhotos] = useState<UploadedPhoto[]>([])
  const [isFinishingPO, setIsFinishingPO] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const photoUploadRef = useRef<PhotoUploadRef>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [resRequests, resBarangs, resGudangs, resSettings] = await Promise.all([
        getWithAuth('/api/inventory/restock/requests'),
        getWithAuth('/api/inventory/barang?view=all&limit=1000'),
        getWithAuth('/api/inventory/gudang?view=all'),
        getWithAuth('/api/inventory/restock/settings?limit=1000')
      ])

      if (resRequests.ok) {
        const data = await resRequests.json()
        setRequests(data.data || [])
      }

      if (resBarangs.ok) {
        const data = await resBarangs.json()
        setAllBarangsSource(data.data?.barangs || data.barangs || [])
      }

      if (resSettings.ok) {
        const data = await resSettings.json()
        const rawSettings = data.data?.settings || data.settings || data.data || []
        setAllSettingsSource(Array.isArray(rawSettings) ? rawSettings : [])
      }

      if (resGudangs.ok) {
        const data = await resGudangs.json()
        const result = data.data || data
        setGudangs(result.gudangs || [])
      }
    } catch (error) {
      console.error('Fetch data error:', error)
      toast.error('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [])

  // DYNAMIC FILTER LOGIC
  useEffect(() => {
    if (showAllItems) {
      setBarangs(allBarangsSource)
    } else {
      const filtered = allBarangsSource.filter(barang => {
        if (!formGudang) return false
        const stocks = barang.stockPerGudang || barang.barangGudang || []
        const stockInfo = stocks.find((s: BarangGudang) => (s.gudangId || s.gudang?.id) === formGudang)
        const currentStockBaru = stockInfo?.stokBaru || 0
        const setting = allSettingsSource.find(s => s.barangId === barang.id && s.gudangId === formGudang)
        const minStock = (setting?.minStok ?? barang.minStokDefault) || 0
        return currentStockBaru <= minStock
      })
      setBarangs(filtered)
    }
  }, [formGudang, showAllItems, allBarangsSource, allSettingsSource])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleOpenCreate = () => {
    setEditingPR(null)
    setFormGudang(gudangs[0]?.id || '')
    setFormNotes('')
    setFormItems([{barangId: '', quantity: 1}])
    setShowForm(true)
  }

  const handleOpenEdit = (pr: PurchaseRequest) => {
    setEditingPR(pr)
    setFormGudang(pr.gudangId)
    setFormNotes(pr.keterangan || '')
    setFormItems(pr.items.map(i => ({ barangId: i.barangId, quantity: i.jumlah })))
    setShowForm(true)
  }

  const handleSaveRequest = async () => {
    if (!formGudang || formItems.some(i => !i.barangId || i.quantity <= 0)) {
      toast.error('Harap lengkapi data barang dan gudang')
      return
    }

    try {
      setSubmitting(true)
      const payload = { gudangId: formGudang, keterangan: formNotes, items: formItems }
      const res = editingPR 
        ? await putWithAuth(`/api/inventory/restock/requests/${editingPR.id}`, payload)
        : await postWithAuth('/api/inventory/restock/requests', payload)

      if (res.ok) {
        toast.success(editingPR ? 'Pengajuan diperbarui' : 'Pengajuan berhasil dibuat')
        setShowForm(false)
        fetchData()
      } else {
        const data = await res.json()
        throw new Error(data.error || 'Gagal menyimpan data')
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Terjadi kesalahan')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus pengajuan ini?')) return
    try {
      const res = await deleteWithAuth(`/api/inventory/restock/requests/${id}`)
      if (res.ok) {
        toast.success('Pengajuan dihapus')
        fetchData()
      }
    } catch (_error) {
      toast.error('Gagal menghapus')
    }
  }

  const handleApprove = async (id: string) => {
    try {
      const res = await patchWithAuth(`/api/inventory/restock/requests/${id}/approve`, {})
      if (res.ok) {
        toast.success('Pengajuan disetujui')
        fetchData()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Gagal menyetujui')
      }
    } catch (_error) {
      toast.error('Terjadi kesalahan')
    }
  }

  const handleOpenReceive = (pr: PurchaseRequest) => {
    setReceivingPR(pr)
    const initialItems: Record<string, number> = {}
    pr.items.forEach(item => {
      initialItems[item.id] = item.jumlah - item.receivedQuantity
    })
    setReceivedItems(initialItems)
    setReceivedPhotos([])
    setIsFinishingPO(true)
  }

  const handleSubmitReceipt = async () => {
    if (!receivingPR) return
    if (receivedPhotos.length === 0) {
      toast.error('Foto bukti penerimaan barang wajib diunggah')
      return
    }

    try {
      setSubmitting(true)
      let photoUrls: string[] = []
      if (photoUploadRef.current) {
          toast.loading('Sedang mengunggah foto...')
          photoUrls = await photoUploadRef.current.uploadPhotos()
          toast.dismiss()
      }

      const response = await patchWithAuth(`/api/inventory/restock/requests/${receivingPR.id}/receive`, {
        items: receivedItems,
        fotoBukti: photoUrls,
        closePO: isFinishingPO
      })

      if (response.ok) {
        toast.success('Barang berhasil diterima & Stok bertambah')
        setReceivingPR(null)
        fetchData()
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Gagal memproses')
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Terjadi kesalahan')
    } finally {
      setSubmitting(false)
    }
  }

  const generatePOPDF = (pr: PurchaseRequest) => {
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(30, 41, 59)
    doc.text('PURCHASE ORDER', pageWidth / 2, 25, { align: 'center' })
    
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(20, 32, pageWidth - 20, 32)
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    
    const leftCol = 20
    const rightCol = 130
    
    doc.text('Nomor Dokumen:', leftCol, 45)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text(pr.nomorRequest, leftCol + 35, 45)
    
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text('Tanggal Pengajuan:', leftCol, 52)
    doc.setTextColor(30, 41, 59)
    doc.text(new Date(pr.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }), leftCol + 35, 52)
    
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text('Gudang Tujuan:', leftCol, 59)
    doc.setTextColor(30, 41, 59)
    doc.text(pr.gudang?.nama || '-', leftCol + 35, 59)

    doc.text('Status Dokumen:', rightCol, 45)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(79, 70, 229)
    doc.text(pr.status, rightCol + 35, 45)
    
    if (pr.approvedAt) {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text('Tanggal Approval:', rightCol, 52)
      doc.setTextColor(30, 41, 59)
      doc.text(new Date(pr.approvedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }), rightCol + 35, 52)
    }

    const tableData = pr.items.map(item => [
      item.barang.kode, 
      item.barang.nama, 
      `${item.jumlah} ${item.barang.satuan}`,
      '-'
    ])
    
    autoTable(doc, { 
      startY: 70, 
      head: [['KODE BARANG', 'NAMA BARANG', 'JUMLAH', 'KETERANGAN']], 
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 10, fontStyle: 'bold', halign: 'center' },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: { 2: { halign: 'center' } }
    })

    const finalY = (doc as unknown as AutoTableDoc).lastAutoTable.finalY + 30
    if (finalY > 250) doc.addPage()
    const signatureY = finalY > 250 ? 40 : finalY
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 41, 59)
    doc.text('Dibuat oleh (Pemohon),', 40, signatureY, { align: 'center' })
    doc.setFont('courier', 'italic')
    doc.setTextColor(150, 150, 150)
    doc.text('[ Digital Signature ]', 40, signatureY + 15, { align: 'center' })
    doc.setFont('helvetica', 'bold')
    doc.text(pr.requester?.name || '-', 40, signatureY + 30, { align: 'center' })
    doc.line(20, signatureY + 32, 60, signatureY + 32)
    
    if (pr.approver) {
      doc.setFont('helvetica', 'normal')
      doc.text('Disetujui oleh,', pageWidth - 40, signatureY, { align: 'center' })
      doc.setFont('courier', 'italic')
      doc.setTextColor(79, 70, 229)
      doc.text('[ Verified Digitally ]', pageWidth - 40, signatureY + 15, { align: 'center' })
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 41, 59)
      doc.text(pr.approver.name, pageWidth - 40, signatureY + 30, { align: 'center' })
      doc.line(pageWidth - 60, signatureY + 32, pageWidth - 20, signatureY + 32)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text(`ID: ${pr.id.slice(0, 8)}`, pageWidth - 40, signatureY + 36, { align: 'center' })
    }

    doc.save(`PO-${pr.nomorRequest}.pdf`)
    toast.success('PDF Purchase Order berhasil diunduh')
  }

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; class: string }> = {
      DRAFT: { label: 'Draft', class: 'bg-gray-100 text-gray-800' },
      SUBMITTED: { label: 'Diajukan', class: 'bg-yellow-100 text-yellow-800' },
      APPROVED: { label: 'Disetujui', class: 'bg-green-100 text-green-800' },
      ORDERED: { label: 'Dalam Pengiriman', class: 'bg-blue-100 text-blue-800' },
      RECEIVED: { label: 'Selesai', class: 'bg-indigo-100 text-indigo-800' },
      CANCELLED: { label: 'Dibatalkan', class: 'bg-red-100 text-red-800' }
    }
    const config = configs[status] || { label: status, class: 'bg-gray-100 text-gray-800' }
    return <span className={`px-2 py-1 text-xs font-bold rounded-full ${config.class}`}>{config.label}</span>
  }

  const columns: Column<PurchaseRequest>[] = [
    {
      key: 'nomor',
      header: 'No. Pengajuan',
      priority: 'primary',
      render: (pr) => (
        <div className="flex flex-col">
          <span className="text-sm font-bold text-gray-900 dark:text-white">{pr.nomorRequest}</span>
          <span className="text-xs text-gray-500">{new Date(pr.createdAt).toLocaleDateString('id-ID')}</span>
        </div>
      )
    },
    {
      key: 'gudang',
      header: 'Gudang Tujuan',
      priority: 'secondary',
      render: (pr) => <span className="text-sm">{pr.gudang?.nama || '-'}</span>
    },
    {
      key: 'status',
      header: 'Status',
      priority: 'primary',
      render: (pr) => getStatusBadge(pr.status)
    },
    {
      key: 'actions',
      header: 'Aksi',
      priority: 'primary',
      render: (pr) => (
        <div className="flex items-center gap-2">
          <button onClick={() => setViewingPR(pr)} title="Lihat Detail" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><FiEye /></button>
          <button onClick={() => generatePOPDF(pr)} title="Download PO" className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><FiDownload /></button>
          
          {pr.status === 'DRAFT' && canUpdate && (
            <>
              <button onClick={() => handleOpenEdit(pr)} title="Edit" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><FiEdit2 /></button>
              <button onClick={() => handleDelete(pr.id)} title="Hapus" className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><FiTrash2 /></button>
              {canApprove && <button onClick={() => handleApprove(pr.id)} className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded-lg ml-2 transition-all hover:scale-105">Approve</button>}
            </>
          )}

          {(pr.status === 'APPROVED' || pr.status === 'ORDERED') && (
            <>
              {canUpdate && <button onClick={() => handleOpenReceive(pr)} className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg ml-2 transition-all hover:scale-105">Verifikasi Sampai</button>}
            </>
          )}
        </div>
      )
    }
  ]

  const filteredRequests = requests.filter(r => r.nomorRequest.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Pengajuan Restock</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Manajemen pengajuan stok barang, approval, dan verifikasi penerimaan</p>
        </div>
        <button onClick={handleOpenCreate} className="inline-flex items-center px-6 py-3.5 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 font-bold transition-all transform active:scale-95">
          <FiPlus className="mr-2" /> Buat Pengajuan Baru
        </button>
      </div>

      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nomor pengajuan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-gray-800 border-none rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-[2.5rem] overflow-hidden border border-gray-100 dark:border-gray-700">
        <ResponsiveTable data={filteredRequests} columns={columns} keyField="id" loading={loading} emptyMessage="Belum ada data pengajuan." />
      </div>

      {/* MODAL: Form Tambah/Edit */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingPR ? 'Edit Pengajuan' : 'Buat Pengajuan Restock'} size="3xl">
        <div className="p-0 flex flex-col h-[85vh] md:h-auto overflow-hidden">
          <div className="p-6 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-50 dark:bg-gray-900/50 rounded-[2rem] border border-gray-100 dark:border-gray-800">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  <FiFilter className="text-indigo-500" /> Gudang Tujuan
                </label>
                <select value={formGudang} onChange={(e) => setFormGudang(e.target.value)} className="w-full bg-white dark:bg-gray-800 border-none rounded-2xl h-12 px-4 shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all font-bold">
                  <option value="">Pilih Gudang Terlebih Dahulu</option>
                  {gudangs.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  <FiEdit2 className="text-indigo-500" /> Catatan / Keterangan
                </label>
                <input type="text" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="w-full bg-white dark:bg-gray-800 border-none rounded-2xl h-12 px-4 shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium" placeholder="Contoh: Stok bulanan Site A" />
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                    <FiImage className="text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-gray-900 dark:text-white tracking-tight">Daftar Barang</h3>
                    <p className="text-[11px] text-gray-500 font-bold uppercase tracking-tighter">Pilih item untuk di-restock</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl transition-all border ${showAllItems ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700' : 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-800'}`}>
                      <input type="checkbox" id="showAll" checked={showAllItems} onChange={(e) => setShowAllItems(e.target.checked)} className="w-4 h-4 text-indigo-600 rounded-lg border-gray-300 focus:ring-indigo-500" />
                      <label htmlFor="showAll" className={`text-[11px] font-black uppercase cursor-pointer select-none ${showAllItems ? 'text-gray-500' : 'text-indigo-600'}`}>
                        {showAllItems ? 'Filter Stok Minim' : 'Lihat Semua Barang'}
                      </label>
                  </div>
                  <button onClick={() => setFormItems([...formItems, {barangId: '', quantity: 1}])} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-[11px] font-black uppercase rounded-2xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100 dark:shadow-none">
                    <FiPlus /> Tambah
                  </button>
                </div>
              </div>
              
              {!formGudang && (
                  <div className="p-12 bg-blue-50/50 dark:bg-blue-900/5 border-2 border-dashed border-blue-100 dark:border-blue-900/20 rounded-[3rem] text-center">
                      <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-3xl flex items-center justify-center mx-auto mb-4 rotate-3">
                        <FiFilter className="text-blue-600 text-2xl" />
                      </div>
                      <p className="text-base text-blue-700 dark:text-blue-300 font-black">Silakan Pilih Gudang</p>
                      <p className="text-xs text-blue-500/70 dark:text-blue-400/70 mt-2 font-medium max-w-xs mx-auto text-balance text-center">Sistem akan menyaring barang yang stoknya di bawah batas minimal pada gudang tersebut.</p>
                  </div>
              )}

              {formGudang && barangs.length === 0 && !loading && !showAllItems && (
                  <div className="p-12 bg-green-50/50 dark:bg-green-900/5 border-2 border-dashed border-green-100 dark:border-green-900/20 rounded-[3rem] text-center">
                      <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-3xl flex items-center justify-center mx-auto mb-4 -rotate-3">
                        <FiCheck className="text-green-600 text-2xl" />
                      </div>
                      <p className="text-base text-green-700 dark:text-green-300 font-black">Semua Stok Aman</p>
                      <p className="text-xs text-green-500/70 dark:text-green-400/70 mt-2 font-medium max-w-xs mx-auto text-balance text-center">Tidak ada barang di bawah limit stok. Gunakan mode &quot;Lihat Semua&quot; untuk restock manual.</p>
                  </div>
              )}

              <div className="space-y-5">
                  {formItems.map((item, idx) => {
                      const selectedBarang = barangs.find(b => b.id === item.barangId)
                      const stocks = selectedBarang?.stockPerGudang || selectedBarang?.barangGudang || []
                      const stockInfo = stocks.find((s: BarangGudang) => (s.gudangId || s.gudang?.id) === formGudang)
                      const currentStockBaru = stockInfo?.stokBaru || 0
                      const currentStockBekas = stockInfo?.stokBekas || 0
                      const currentStockRusak = stockInfo?.stokRusak || 0
                      const setting = allSettingsSource.find(s => s.barangId === item.barangId && s.gudangId === formGudang)
                      const minStock = (setting?.minStok ?? selectedBarang?.minStokDefault) || 0
                      const isVeryLow = currentStockBaru <= minStock / 2

                      const barangOptions = barangs.map(b => {
                        const bStocks = b.stockPerGudang || b.barangGudang || []
                        const bStockInfo = bStocks.find((s: BarangGudang) => (s.gudangId || s.gudang?.id) === formGudang)
                        const bBaru = bStockInfo?.stokBaru || 0
                        const bMin = (allSettingsSource.find(s => s.barangId === b.id && s.gudangId === formGudang)?.minStok ?? b.minStokDefault) || 0
                        return {
                            value: b.id,
                            label: `${b.kode} - ${b.nama}`,
                            subLabel: `Baru: ${bBaru} (Limit: ${bMin})`,
                            badge: bBaru <= bMin ? <span className="px-2 py-0.5 bg-red-500 text-white text-[8px] font-black rounded-full uppercase">Min</span> : <span className="px-2 py-0.5 bg-green-500 text-white text-[8px] font-black rounded-full uppercase">Ok</span>
                        }
                      })

                      return (
                          <div key={idx} className="group relative bg-white dark:bg-gray-800 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
                              <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
                                  <div className="hidden lg:flex w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 items-center justify-center text-xs font-black text-indigo-400 border border-indigo-100 dark:border-indigo-800/50 group-hover:scale-110 transition-transform">{idx + 1}</div>
                                  <div className="flex-1 w-full space-y-3">
                                      <SearchableSelect options={barangOptions} value={item.barangId} onChange={(val) => { const newItems = [...formItems]; newItems[idx].barangId = val; setFormItems(newItems) }} placeholder={showAllItems ? "Cari nama atau kode barang..." : "Pilih barang stok rendah..."} />
                                      {item.barangId && (
                                          <div className="grid grid-cols-3 gap-2 sm:gap-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800/50">
                                              <div className="flex flex-col items-center justify-center py-1">
                                                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Stok Baru</span>
                                                  <span className={`text-sm font-black ${currentStockBaru <= minStock ? 'text-red-500' : 'text-indigo-600'}`}>{currentStockBaru}</span>
                                              </div>
                                              <div className="flex flex-col items-center justify-center py-1 border-x border-gray-200 dark:border-gray-800">
                                                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Bekas</span>
                                                  <span className="text-sm font-black text-blue-500">{currentStockBekas}</span>
                                              </div>
                                              <div className="flex flex-col items-center justify-center py-1">
                                                  <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Rusak</span>
                                                  <span className="text-sm font-black text-orange-500">{currentStockRusak}</span>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                                  <div className="flex items-center gap-4 w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0 lg:pl-6 lg:border-l border-gray-100 dark:border-gray-800">
                                      <div className="flex-1 lg:flex-none flex flex-col space-y-1.5">
                                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Jumlah Restock</label>
                                          <div className="flex items-center bg-gray-50 dark:bg-gray-900 rounded-2xl px-3 h-12 border border-gray-100 dark:border-gray-800 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                                              <input type="number" min="1" value={item.quantity} onChange={(e) => { const newItems = [...formItems]; newItems[idx].quantity = parseInt(e.target.value) || 0; setFormItems(newItems) }} className="w-full lg:w-24 bg-transparent border-none rounded-xl text-center font-black text-indigo-600 focus:ring-0 text-xl" />
                                              <span className="text-[10px] font-black text-gray-400 uppercase pr-1 hidden lg:block">{selectedBarang?.satuan || ''}</span>
                                          </div>
                                      </div>
                                      <button onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))} className="p-3.5 text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-500 hover:text-white rounded-2xl transition-all duration-300 shadow-sm active:scale-90 mt-5"><FiTrash2 className="text-lg" /></button>
                                  </div>
                              </div>
                              {item.barangId && isVeryLow && (
                                <div className="absolute -top-2 -right-2 px-3 py-1 bg-red-500 text-white text-[9px] font-black uppercase rounded-full shadow-lg shadow-red-200 dark:shadow-none animate-bounce">Critical Low</div>
                              )}
                          </div>
                      )
                  })}
                  {formItems.length > 0 && (
                    <button onClick={() => setFormItems([...formItems, {barangId: '', quantity: 1}])} className="w-full py-5 bg-gray-50 dark:bg-gray-900/50 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[2.5rem] text-gray-400 text-xs font-black uppercase tracking-widest hover:text-indigo-600 hover:border-indigo-200 dark:hover:border-indigo-900/30 transition-all flex items-center justify-center gap-3">
                      <FiPlus className="text-lg" /> Tambah Item Lainnya
                    </button>
                  )}
                  {/* Spacer to give room for the last item's dropdown */}
                  <div className="h-60" />
              </div>
            </div>
          </div>

          <div className="p-8 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 rounded-b-[3rem]">
            <div className="flex gap-4">
              <button onClick={() => setShowForm(false)} className="flex-1 px-6 py-4 bg-gray-50 dark:bg-gray-900 text-gray-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-95">Batal</button>
              <button onClick={handleSaveRequest} disabled={submitting || !formGudang || formItems.some(i => !i.barangId)} className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest disabled:opacity-30 shadow-2xl shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-3">
                {submitting ? 'Sedang Memproses...' : <><FiCheck className="text-lg" /> Simpan Pengajuan</>}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL: View Detail */}
      <Modal isOpen={!!viewingPR} onClose={() => setViewingPR(null)} title="Detail Pengajuan Restock" size="2xl">
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
              <div className="text-xs font-bold text-gray-400 uppercase mb-1">Nomor</div>
              <div className="font-bold text-indigo-600">{viewingPR?.nomorRequest}</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
              <div className="text-xs font-bold text-gray-400 uppercase mb-1">Status</div>
              <div>{viewingPR && getStatusBadge(viewingPR.status)}</div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-xs font-bold text-gray-400 uppercase px-1">Daftar Barang</div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                {viewingPR?.items.map((i, idx) => (
                <div key={i.id} className={`flex justify-between p-4 ${idx !== 0 ? 'border-t border-gray-50 dark:border-gray-700' : ''}`}>
                    <div>
                  <div className="font-bold text-sm text-gray-900 dark:text-white">{i.barang.nama}</div>
                  <div className="text-xs text-gray-500">{i.barang.kode}</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-indigo-600">{i.jumlah}</div>
                  <div className="text-[10px] text-gray-400 uppercase font-bold">{i.barang.satuan}</div>
                </div>
                </div>
                ))}
            </div>
          </div>
          <button onClick={() => setViewingPR(null)} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-lg">Tutup</button>
        </div>
      </Modal>

      {/* MODAL: Verifikasi Sampai (Revisi & Foto) */}
      <Modal isOpen={!!receivingPR} onClose={() => !submitting && setReceivingPR(null)} title="Verifikasi Barang Sampai" size="2xl">
        <div className="p-6 space-y-6">
          <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-2xl flex justify-between items-center border border-indigo-100 dark:border-indigo-800">
            <div>
              <div className="text-xs font-bold text-indigo-400 uppercase mb-1">Konfirmasi Kedatangan</div>
              <div className="font-bold text-indigo-900 dark:text-indigo-200 text-lg">{receivingPR?.nomorRequest}</div>
            </div>
            <FiCheck className="text-indigo-600 w-10 h-10" />
          </div>

          <div className="space-y-4">
            <div className="font-bold flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 px-1">
              <FiEdit2 /> Revisi Jumlah Realita
            </div>
            <div className="max-h-[250px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {receivingPR?.items.map(item => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:border-indigo-200">
                    <div>
                    <div className="font-bold text-sm text-gray-900 dark:text-white">{item.barang.nama}</div>
                    <div className="text-xs text-gray-500 italic">Dipesan: {item.jumlah} {item.barang.satuan}</div>
                    </div>
                    <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Diterima:</span>
                    <input
                        type="number"
                        min="0"
                        value={receivedItems[item.id] || 0}
                        onChange={(e) => setReceivedItems({...receivedItems, [item.id]: parseInt(e.target.value) || 0})}
                        className="w-20 bg-gray-50 dark:bg-gray-900 border-none rounded-xl text-right font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                    />
                    </div>
                </div>
                ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="font-bold flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 px-1">
              <FiImage /> Foto Bukti Barang Sampai (Wajib)
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <PhotoUpload 
                ref={photoUploadRef}
                onPhotosChange={setReceivedPhotos} 
                maxPhotos={3}
                transactionType="inventory-masuk"
                />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setReceivingPR(null)} className="flex-1 px-4 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-colors">Batal</button>
            <button 
              onClick={handleSubmitReceipt} 
              disabled={submitting || receivedPhotos.length === 0} 
              className="flex-[2] px-4 py-4 bg-green-600 text-white rounded-2xl font-bold disabled:opacity-50 shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? 'Menyimpan...' : (
                  <>
                    <FiCheck /> Konfirmasi & Tambah Stok
                  </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
        }
      `}</style>
    </div>
  )
}
