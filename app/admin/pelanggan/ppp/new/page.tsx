"use client"

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { HiArrowPath, HiArrowDownTray, HiEye, HiEyeSlash } from 'react-icons/hi2'
import { MapPickerWithSearch } from '@/components/common/MapPicker'

type HargaPaket = {
  id: string
  name: string
  harga: number
  durasi: number
  durasiUnit: 'JAM' | 'HARI' | 'BULAN' | 'TAHUN'
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'
  usePPN?: boolean
  ppnPercentage?: number | null
  useDiscount?: boolean
  discountType?: 'FIXED' | 'PERCENT' | null
  discountValue?: number | null
  discountDuration?: number | null
  discountDurationUnit?: 'JAM' | 'HARI' | 'BULAN' | 'TAHUN' | null
  profilePPP?: {
    id: string
    name: string
  } | null
  bandwidth?: {
    id: string
    name: string
  } | null
}

export default function PelangganPPPNewPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hargaPakets, setHargaPakets] = useState<HargaPaket[]>([])
  const [idPelangganError, setIdPelangganError] = useState<string | null>(null)
  const [checkingId, setCheckingId] = useState(false)
  const [showPasswordLogin, setShowPasswordLogin] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'paket' | 'info'>('paket')
  const [fileKTP, setFileKTP] = useState<File | null>(null)
  const [fileRumahSekitar, setFileRumahSekitar] = useState<File | null>(null)
  const [fileBAST, setFileBAST] = useState<File | null>(null)

  const [formData, setFormData] = useState({
    idPelanggan: '',
    nama: '',
    username: '',
    password: '12345', // Default password PPPoE
    passwordLogin: '12345', // Default password untuk login portal pelanggan
    hargaPaketId: '',
    tipe: 'REGULER' as 'REGULER' | 'NON_REGULER',
    tanggalAktif: new Date().toISOString().split('T')[0], // Default: hari ini
    jatuhTempo: '',
    status: 'AKTIF' as 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE',
    alamat: '',
    noTelp: '',
    email: '',
    latitude: null as number | null,
    longitude: null as number | null,
    jenisDokumen: null as 'KTP' | 'SIM' | 'Paspor' | null,
    noDokumen: '',
    catatan: '',
    usePPN: true, // Gunakan PPN atau tidak
    useDiscount: false, // Gunakan diskon atau tidak
    useProrate: false, // Gunakan perhitungan prorate atau tidak
    // Custom diskon per pelanggan
    discountType: null as 'FIXED' | 'PERCENT' | null,
    discountValue: null as number | null,
    discountDuration: null as number | null,
    discountDurationUnit: null as 'JAM' | 'HARI' | 'BULAN' | 'TAHUN' | null,
    // Biaya lain-lain
    biayaInstalasi: null as number | null,
    biayaInstalasiIsRecurring: false, // Default: 1x
    useDiskonBiayaInstalasi: false, // Centang untuk menggunakan diskon biaya instalasi
    biayaInstalasiDiskon: null as number | null,
    biayaSewaPerangkat: null as number | null,
    biayaSewaPerangkatIsRecurring: true, // Default: berulang
    useDiskonSewaPerangkat: false, // Centang untuk menggunakan diskon sewa perangkat
    biayaSewaPerangkatDiskon: null as number | null,
    biayaLainnya: null as number | null,
    biayaLainnyaIsRecurring: false, // Default: 1x
    useDiskonBiayaLainnya: false, // Centang untuk menggunakan diskon biaya lainnya
    biayaLainnyaDiskon: null as number | null,
    keteranganBiayaLainnya: '',
  })

  // Generate ID pelanggan otomatis (angka unik 8 digit) - sync version (fallback)
  const generateIdPelangganSync = () => {
    const now = new Date()
    // Menggunakan beberapa digit terakhir dari timestamp + random untuk memastikan unik
    const timestamp = now.getTime() // Timestamp dalam milidetik
    const timestampStr = String(timestamp)
    // Ambil 5 digit terakhir dari timestamp (unik per detik/menit)
    const timestampPart = timestampStr.slice(-5)
    // Random 3 digit untuk memastikan tidak duplikat
    const random = Math.floor(Math.random() * 1000) // Random 0-999
    // Format: 5 digit timestamp + 3 digit random = 8 digit (contoh: 68001234)
    return timestampPart + String(random).padStart(3, '0')
  }

  // Generate ID pelanggan dari API (async)
  const generateIdPelanggan = async () => {
    try {
      const res = await fetch('/api/pelanggan-ppp/generate-id')
      if (res.ok) {
        const data = await res.json()
        if (data.idPelanggan) {
          return data.idPelanggan
        }
      }
      // Fallback: generate di frontend jika API error
      return generateIdPelangganSync()
    } catch (error) {
      console.error('Error generating ID:', error)
      // Fallback: generate di frontend jika API error
      return generateIdPelangganSync()
    }
  }

  // Load atau generate ID pelanggan yang terjamin unik dari API
  const loadOrGenerateIdPelanggan = async () => {
    try {
      // Panggil API untuk generate ID yang terjamin unik
      const res = await fetch('/api/pelanggan-ppp/generate-id')
      if (res.ok) {
        const data = await res.json()
        if (data.idPelanggan) {
          return data.idPelanggan
        }
      }
      
      // Fallback: generate di frontend jika API error
      console.warn('API generate-id tidak tersedia, menggunakan fallback')
      return generateIdPelangganSync()
    } catch (error) {
      // Fallback: generate di frontend jika API error
      console.warn('Error memanggil API generate-id:', error)
      return generateIdPelangganSync()
    }
  }

  useEffect(() => {
    setMounted(true)
    // Generate ID pelanggan otomatis saat component mount
    loadOrGenerateIdPelanggan().then((id) => {
      setFormData((prev) => ({
        ...prev,
        idPelanggan: id,
        username: id, // Set username sama dengan ID pelanggan secara default
      }))
    })
    loadHargaPakets()
  }, [])

  const loadHargaPakets = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/hargapakets?status=AKTIF')
      if (res.ok) {
        const data = await res.json()
        setHargaPakets(data || [])
      }
    } catch (err: any) {
      console.error('Error loading harga pakets:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validasi
    if (!formData.idPelanggan.trim()) {
      setError('ID Pelanggan harus diisi')
      return
    }
    if (!/^\d{8}$/.test(formData.idPelanggan.trim())) {
      setError('ID Pelanggan harus 8 digit angka')
      return
    }
    if (idPelangganError) {
      setError(idPelangganError)
      return
    }
    if (!formData.nama.trim()) {
      setError('Nama pelanggan harus diisi')
      return
    }
    if (!formData.username.trim()) {
      setError('Username PPPoE harus diisi')
      return
    }
    if (!formData.password.trim()) {
      setError('Password PPPoE harus diisi')
      return
    }
    if (!formData.passwordLogin.trim()) {
      setError('Password Login Portal harus diisi')
      return
    }
    if (!formData.hargaPaketId) {
      setError('Harga Paket harus dipilih')
      return
    }

    try {
      setSubmitting(true)
      
      // Buat FormData untuk mengirim file
      const formDataToSend = new FormData()
      
      // Tambahkan semua field formData
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          if (typeof value === 'number') {
            formDataToSend.append(key, value.toString())
          } else if (typeof value === 'boolean') {
            formDataToSend.append(key, value ? 'true' : 'false')
          } else if (typeof value === 'object' && !(value instanceof File)) {
            formDataToSend.append(key, JSON.stringify(value))
          } else {
            formDataToSend.append(key, value as string | Blob)
          }
        }
      })
      
      // Tambahkan file jika ada
      if (fileKTP) {
        formDataToSend.append('fileKTP', fileKTP)
      }
      if (fileRumahSekitar) {
        formDataToSend.append('fileRumahSekitar', fileRumahSekitar)
      }
      if (fileBAST) {
        formDataToSend.append('fileBAST', fileBAST)
      }
      
      const res = await fetch('/api/pelanggan-ppp', {
        method: 'POST',
        body: formDataToSend,
      })

      if (!res.ok) {
        const errorData = await res.json()
        // Jika error karena ID duplikat, generate ID baru dan retry
        if (errorData.error?.includes('sudah digunakan') || errorData.error?.includes('unique') || res.status === 409) {
          const newId = await generateIdPelanggan()
          setFormData(prev => ({ ...prev, idPelanggan: newId }))
          setError('ID Pelanggan sudah digunakan. ID baru telah di-generate. Silakan submit ulang.')
          return
        }
        throw new Error(errorData.error || 'Gagal menyimpan pelanggan PPP')
      }

      // Berhasil, redirect ke halaman list
      router.push('/admin/pelanggan/ppp')
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menyimpan data')
    } finally {
      setSubmitting(false)
    }
  }

  // Hitung jatuh tempo berdasarkan tanggal aktif dan durasi paket
  const calculateJatuhTempo = useCallback((tanggalAktif: string, hargaPaketId: string) => {
    if (!tanggalAktif || !hargaPaketId || hargaPakets.length === 0) {
      return ''
    }

    const selectedPaket = hargaPakets.find((p) => p.id === hargaPaketId)
    if (!selectedPaket) {
      return ''
    }

    const startDate = new Date(tanggalAktif)
    const jatuhTempo = new Date(startDate)

    // Tambahkan durasi berdasarkan unit
    switch (selectedPaket.durasiUnit) {
      case 'JAM':
        jatuhTempo.setHours(jatuhTempo.getHours() + selectedPaket.durasi)
        break
      case 'HARI':
        jatuhTempo.setDate(jatuhTempo.getDate() + selectedPaket.durasi)
        break
      case 'BULAN':
        jatuhTempo.setMonth(jatuhTempo.getMonth() + selectedPaket.durasi)
        break
      case 'TAHUN':
        jatuhTempo.setFullYear(jatuhTempo.getFullYear() + selectedPaket.durasi)
        break
    }

    return jatuhTempo.toISOString().split('T')[0]
  }, [hargaPakets])

  // Cek apakah ID Pelanggan sudah ada (untuk validasi duplikat)
  const checkIdPelangganExists = async (id: string) => {
    if (!id || id.trim() === '') {
      setIdPelangganError(null)
      return false
    }

    try {
      setCheckingId(true)
      const res = await fetch(`/api/pelanggan-ppp/check-id?idPelanggan=${encodeURIComponent(id)}`)
      if (res.ok) {
        const data = await res.json()
        return data.exists === true
      }
      // Jika error, anggap ID belum ada (untuk menghindari false positive)
      return false
    } catch (error) {
      console.error('Error checking ID pelanggan:', error)
      return false
    } finally {
      setCheckingId(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setFormData((prev) => {
      const updated = { ...prev, [name]: type === 'checkbox' ? checked : value }
      
      // Jika yang berubah adalah tanggal aktif atau harga paket, hitung ulang jatuh tempo
      if (name === 'tanggalAktif' || name === 'hargaPaketId') {
        updated.jatuhTempo = calculateJatuhTempo(
          name === 'tanggalAktif' ? value : updated.tanggalAktif,
          name === 'hargaPaketId' ? value : updated.hargaPaketId
        )
      }
      
      // Jika ID Pelanggan berubah, update username juga jika masih sama dengan ID lama
      if (name === 'idPelanggan') {
        if (prev.username === prev.idPelanggan) {
          updated.username = value
        }
        // Reset error saat user mengetik
        setIdPelangganError(null)
      }
      
      return updated
    })
  }

  // Validasi ID Pelanggan dengan debounce
  useEffect(() => {
    const idValue = formData.idPelanggan.trim()
    
    // Validasi format (harus 8 digit angka)
    if (idValue && !/^\d{8}$/.test(idValue)) {
      setIdPelangganError('ID Pelanggan harus 8 digit angka')
      return
    }

    // Cek duplikat dengan debounce
    if (!idValue) {
      setIdPelangganError(null)
      return
    }

    const timeoutId = setTimeout(async () => {
      const exists = await checkIdPelangganExists(idValue)
      if (exists) {
        setIdPelangganError('ID Pelanggan sudah digunakan, silakan gunakan ID lain')
      } else {
        setIdPelangganError(null)
      }
    }, 500) // Debounce 500ms

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.idPelanggan])

  // Update jatuh tempo saat harga paket atau tanggal aktif berubah
  useEffect(() => {
    if (formData.tanggalAktif && formData.hargaPaketId && hargaPakets.length > 0) {
      const jatuhTempo = calculateJatuhTempo(formData.tanggalAktif, formData.hargaPaketId)
      if (jatuhTempo) {
        setFormData((prev) => ({ ...prev, jatuhTempo }))
      }
    }
  }, [formData.hargaPaketId, formData.tanggalAktif, calculateJatuhTempo])

  // Fungsi untuk menghitung total tagihan menggunakan useMemo untuk menghindari hydration mismatch
  const totalInfo = useMemo(() => {
    if (!formData.hargaPaketId || hargaPakets.length === 0) return null

    const selectedPaket = hargaPakets.find((p) => p.id === formData.hargaPaketId)
    if (!selectedPaket) return null

    let subtotal = selectedPaket.harga
    let prorateInfo = null

    // Hitung prorate jika diaktifkan dan ada tanggal aktif & jatuh tempo
    if (formData.useProrate && formData.tanggalAktif && formData.jatuhTempo) {
      const tanggalAktif = new Date(formData.tanggalAktif)
      const jatuhTempo = new Date(formData.jatuhTempo)
      const selisihHari = Math.ceil((jatuhTempo.getTime() - tanggalAktif.getTime()) / (1000 * 60 * 60 * 24))
      
      // Hitung durasi paket dalam hari
      let durasiPaketHari = 0
      switch (selectedPaket.durasiUnit) {
        case 'JAM':
          durasiPaketHari = selectedPaket.durasi / 24
          break
        case 'HARI':
          durasiPaketHari = selectedPaket.durasi
          break
        case 'BULAN':
          durasiPaketHari = selectedPaket.durasi * 30 // Approximasi 30 hari per bulan
          break
        case 'TAHUN':
          durasiPaketHari = selectedPaket.durasi * 365 // Approximasi 365 hari per tahun
          break
      }

      if (durasiPaketHari > 0 && selisihHari > 0) {
        const prorateRatio = Math.min(selisihHari / durasiPaketHari, 1) // Maksimal 100%
        const hargaSebelumProrate = subtotal
        subtotal = Math.round(subtotal * prorateRatio)
        prorateInfo = {
          selisihHari,
          durasiPaketHari,
          ratio: prorateRatio,
          hargaSebelumProrate,
          hargaSetelahProrate: subtotal,
        }
      }
    }

    // Hitung diskon (prioritas: custom diskon pelanggan > diskon paket)
    let diskon = 0
    let diskonInfo = null
    
    if (formData.useDiscount) {
      // Gunakan custom diskon pelanggan jika ada
      if (formData.discountType && formData.discountValue !== null) {
        if (formData.discountType === 'FIXED') {
          diskon = formData.discountValue
        } else if (formData.discountType === 'PERCENT') {
          diskon = (subtotal * formData.discountValue) / 100
        }
        diskonInfo = {
          type: formData.discountType,
          value: formData.discountValue,
          duration: formData.discountDuration,
          durationUnit: formData.discountDurationUnit,
          isCustom: true,
        }
      }
      // Fallback ke diskon paket jika custom diskon tidak diisi
      else if (selectedPaket.useDiscount && selectedPaket.discountType && selectedPaket.discountValue) {
        if (selectedPaket.discountType === 'FIXED') {
          diskon = selectedPaket.discountValue
        } else if (selectedPaket.discountType === 'PERCENT') {
          diskon = (subtotal * selectedPaket.discountValue) / 100
        }
        diskonInfo = {
          type: selectedPaket.discountType,
          value: selectedPaket.discountValue,
          duration: selectedPaket.discountDuration,
          durationUnit: selectedPaket.discountDurationUnit,
          isCustom: false,
        }
      }
    }
    subtotal = Math.max(0, subtotal - diskon)

    // Hitung PPN (jika pelanggan menggunakan PPN DAN paket memiliki PPN)
    let ppn = 0
    if (formData.usePPN && selectedPaket.usePPN && selectedPaket.ppnPercentage) {
      ppn = (subtotal * selectedPaket.ppnPercentage) / 100
    }

    // Hitung biaya lain-lain
    const biayaInstalasiSebelumDiskon = formData.biayaInstalasi || 0
    let biayaInstalasi = biayaInstalasiSebelumDiskon
    
    // Hitung diskon biaya instalasi jika checkbox dicentang dan ada diskon
    if (biayaInstalasi > 0 && formData.useDiskonBiayaInstalasi && formData.biayaInstalasiDiskon && formData.biayaInstalasiDiskon > 0) {
      const diskonInstalasi = (biayaInstalasi * formData.biayaInstalasiDiskon) / 100
      biayaInstalasi = Math.max(0, biayaInstalasi - diskonInstalasi)
    }
    
    const biayaSewaPerangkatSebelumDiskon = formData.biayaSewaPerangkat || 0
    let biayaSewaPerangkat = biayaSewaPerangkatSebelumDiskon
    
    // Hitung diskon sewa perangkat jika checkbox dicentang dan ada diskon
    if (biayaSewaPerangkat > 0 && formData.useDiskonSewaPerangkat && formData.biayaSewaPerangkatDiskon && formData.biayaSewaPerangkatDiskon > 0) {
      const diskonSewa = (biayaSewaPerangkat * formData.biayaSewaPerangkatDiskon) / 100
      biayaSewaPerangkat = Math.max(0, biayaSewaPerangkat - diskonSewa)
    }
    
    const biayaLainnyaSebelumDiskon = formData.biayaLainnya || 0
    let biayaLainnya = biayaLainnyaSebelumDiskon
    
    // Hitung diskon biaya lain-lain jika checkbox dicentang dan ada diskon
    if (biayaLainnya > 0 && formData.useDiskonBiayaLainnya && formData.biayaLainnyaDiskon && formData.biayaLainnyaDiskon > 0) {
      const diskonLainnya = (biayaLainnya * formData.biayaLainnyaDiskon) / 100
      biayaLainnya = Math.max(0, biayaLainnya - diskonLainnya)
    }
    
    const totalBiayaLainnya = biayaInstalasi + biayaSewaPerangkat + biayaLainnya

    const total = subtotal + ppn + totalBiayaLainnya

    return {
      hargaPaket: selectedPaket.harga,
      diskon,
      ppn,
      subtotal,
      biayaInstalasi,
      biayaSewaPerangkat,
      biayaLainnya,
      totalBiayaLainnya,
      total,
      paket: selectedPaket,
      diskonInfo,
      prorateInfo,
      biayaInstalasiDiskon: formData.useDiskonBiayaInstalasi ? formData.biayaInstalasiDiskon : null,
      biayaInstalasiSebelumDiskon: biayaInstalasiSebelumDiskon,
      biayaSewaPerangkatDiskon: formData.useDiskonSewaPerangkat ? formData.biayaSewaPerangkatDiskon : null,
      biayaSewaPerangkatSebelumDiskon: biayaSewaPerangkatSebelumDiskon,
      biayaLainnyaDiskon: formData.useDiskonBiayaLainnya ? formData.biayaLainnyaDiskon : null,
      biayaLainnyaSebelumDiskon: biayaLainnyaSebelumDiskon,
    }
  }, [formData.hargaPaketId, formData.usePPN, formData.useDiscount, formData.useProrate, formData.tanggalAktif, formData.jatuhTempo, formData.discountType, formData.discountValue, formData.discountDuration, formData.discountDurationUnit, formData.biayaInstalasi, formData.useDiskonBiayaInstalasi, formData.biayaInstalasiDiskon, formData.biayaSewaPerangkat, formData.useDiskonSewaPerangkat, formData.biayaSewaPerangkatDiskon, formData.biayaLainnya, formData.useDiskonBiayaLainnya, formData.biayaLainnyaDiskon, hargaPakets])

  // Format rupiah
  const formatRupiah = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="w-full space-y-5">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tambah Pelanggan PPP</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Tambah pelanggan baru dengan koneksi PPPoE
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form - 2 kolom */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <form className="space-y-5" onSubmit={handleSubmit}>
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex space-x-8" aria-label="Tabs">
              <button
                type="button"
                onClick={() => setActiveTab('paket')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'paket'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Paket Langganan
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'info'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Info Pelanggan
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'paket' && (
            <div className="space-y-5">
          {/* Status dan Tipe Pelanggan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Status Registrasi */}
            <div className="space-y-4">
              <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                Status Registrasi
              </h3>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status Registrasi <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="AKTIF"
                      checked={formData.status === 'AKTIF'}
                      onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE' }))}
                      className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      required
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Aktif sekarang
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="NONAKTIF"
                      checked={formData.status === 'NONAKTIF'}
                      onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE' }))}
                      className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      required
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Menunggu
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Tipe Pelanggan */}
            <div className="space-y-4">
              <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                Tipe Pelanggan
              </h3>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipe Pelanggan <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipe"
                      value="REGULER"
                      checked={formData.tipe === 'REGULER'}
                      onChange={(e) => setFormData((prev) => ({ ...prev, tipe: e.target.value as 'REGULER' | 'NON_REGULER' }))}
                      className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      required
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Reguler
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="tipe"
                      value="NON_REGULER"
                      checked={formData.tipe === 'NON_REGULER'}
                      onChange={(e) => setFormData((prev) => ({ ...prev, tipe: e.target.value as 'REGULER' | 'NON_REGULER' }))}
                      className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      required
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Non Reguler
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Paket & Tanggal */}
          <div className="space-y-4">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Paket & Tanggal
            </h3>

            <div className="space-y-2">
              <label htmlFor="hargaPaketId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Harga Paket <span className="text-red-500">*</span>
              </label>
              <select
                id="hargaPaketId"
                name="hargaPaketId"
                required
                value={formData.hargaPaketId}
                onChange={handleChange}
                disabled={loading}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">-- Pilih Harga Paket --</option>
                {hargaPakets.map((paket) => {
                  const hargaFormatted = new Intl.NumberFormat('id-ID', {
                    style: 'currency',
                    currency: 'IDR',
                    minimumFractionDigits: 0,
                  }).format(paket.harga)
                  const durasiText = `${paket.durasi} ${paket.durasiUnit.toLowerCase()}`
                  return (
                    <option key={paket.id} value={paket.id}>
                      {paket.name} - {hargaFormatted} / {durasiText}
                    </option>
                  )
                })}
              </select>
              {formData.hargaPaketId && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {(() => {
                    const selectedPaket = hargaPakets.find((p) => p.id === formData.hargaPaketId)
                    if (selectedPaket) {
                      return `Profile PPP: ${selectedPaket.profilePPP?.name || 'Tidak ada'} | Bandwidth: ${selectedPaket.bandwidth?.name || 'Tidak ada'}`
                    }
                    return ''
                  })()}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="tanggalAktif" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tanggal Aktif <span className="text-red-500">*</span>
                </label>
                <input
                  id="tanggalAktif"
                  name="tanggalAktif"
                  type="date"
                  required
                  value={formData.tanggalAktif}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="jatuhTempo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Jatuh Tempo <span className="text-red-500">*</span>
                </label>
                <input
                  id="jatuhTempo"
                  name="jatuhTempo"
                  type="date"
                  required
                  value={formData.jatuhTempo}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                />
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Jatuh tempo dihitung otomatis, namun bisa diubah manual jika diperlukan
                </p>
              </div>
            </div>

            {/* PPN & Diskon */}
            <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Pengaturan Pajak & Diskon
              </h4>
              
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="usePPN"
                    checked={formData.usePPN}
                    onChange={(e) => setFormData((prev) => ({ ...prev, usePPN: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Gunakan PPN
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">
                  Centang jika pelanggan ini dikenakan PPN (Pajak Pertambahan Nilai)
                </p>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="useProrate"
                    checked={formData.useProrate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, useProrate: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Gunakan Prorate
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">
                  Centang untuk menghitung tagihan berdasarkan proporsi waktu (jika pelanggan aktif tidak sesuai durasi paket penuh)
                </p>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="useDiscount"
                    checked={formData.useDiscount}
                    onChange={(e) => setFormData((prev) => ({ 
                      ...prev, 
                      useDiscount: e.target.checked,
                      // Reset custom diskon jika diskon dinonaktifkan
                      ...(e.target.checked ? {} : {
                        discountType: null,
                        discountValue: null,
                        discountDuration: null,
                        discountDurationUnit: null,
                      })
                    }))}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Gunakan Diskon
                  </span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-7">
                  Centang jika pelanggan ini mendapatkan diskon. Jika tidak diisi custom diskon, akan menggunakan diskon dari paket.
                </p>
              </div>

              {/* Custom Diskon */}
              {formData.useDiscount && (
                <div className="space-y-3 mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Custom Diskon (Opsional)
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                    Jika diisi, akan override diskon dari paket. Kosongkan untuk menggunakan diskon dari paket.
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Jenis Diskon
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="customDiscountType"
                          value="FIXED"
                          checked={formData.discountType === 'FIXED'}
                          onChange={(e) => setFormData((prev) => ({ 
                            ...prev, 
                            discountType: e.target.value as 'FIXED' | 'PERCENT',
                            discountValue: null // Reset value saat ganti jenis
                          }))}
                          className="border-gray-300 dark:border-gray-700"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Fixed (Nominal Tetap)</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="customDiscountType"
                          value="PERCENT"
                          checked={formData.discountType === 'PERCENT'}
                          onChange={(e) => setFormData((prev) => ({ 
                            ...prev, 
                            discountType: e.target.value as 'FIXED' | 'PERCENT',
                            discountValue: null // Reset value saat ganti jenis
                          }))}
                          className="border-gray-300 dark:border-gray-700"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Persen (%)</span>
                      </label>
                    </div>
                  </div>

                  {formData.discountType && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nilai Diskon {formData.discountType === 'FIXED' ? '(Rp)' : '(%)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={formData.discountType === 'PERCENT' ? 100 : undefined}
                        step={formData.discountType === 'PERCENT' ? '0.01' : '1'}
                        value={formData.discountValue || ''}
                        onChange={(e) => setFormData((prev) => ({ 
                          ...prev, 
                          discountValue: e.target.value ? parseFloat(e.target.value) : null 
                        }))}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                        placeholder={formData.discountType === 'FIXED' ? '50000' : '10'}
                      />
                    </div>
                  )}

                  {formData.discountType && formData.discountValue && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Durasi Diskon
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          value={formData.discountDuration || ''}
                          onChange={(e) => setFormData((prev) => ({ 
                            ...prev, 
                            discountDuration: e.target.value ? parseInt(e.target.value) : null 
                          }))}
                          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                          placeholder="30"
                        />
                        <select
                          value={formData.discountDurationUnit || ''}
                          onChange={(e) => setFormData((prev) => ({ 
                            ...prev, 
                            discountDurationUnit: e.target.value as 'JAM' | 'HARI' | 'BULAN' | 'TAHUN' | null
                          }))}
                          className="w-32 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                        >
                          <option value="">Pilih Unit</option>
                          <option value="JAM">Jam</option>
                          <option value="HARI">Hari</option>
                          <option value="BULAN">Bulan</option>
                          <option value="TAHUN">Tahun</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Biaya Lain-lain */}
              <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Biaya Lain-lain
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tambahkan biaya tambahan jika diperlukan (opsional)
                </p>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="biayaInstalasi" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Biaya Instalasi (Rp)
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.biayaInstalasiIsRecurring}
                            onChange={(e) => setFormData((prev) => ({ ...prev, biayaInstalasiIsRecurring: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600"
                          />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Berulang</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.useDiskonBiayaInstalasi}
                            onChange={(e) => setFormData((prev) => ({ 
                              ...prev, 
                              useDiskonBiayaInstalasi: e.target.checked,
                              // Reset diskon jika checkbox dinonaktifkan
                              ...(e.target.checked ? {} : { biayaInstalasiDiskon: null })
                            }))}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600"
                          />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Diskon</span>
                        </label>
                      </div>
                    </div>
                    <input
                      id="biayaInstalasi"
                      name="biayaInstalasi"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.biayaInstalasi || ''}
                      onChange={(e) => setFormData((prev) => ({ 
                        ...prev, 
                        biayaInstalasi: e.target.value ? parseInt(e.target.value) : null 
                      }))}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formData.biayaInstalasiIsRecurring ? 'Biaya akan ditagih setiap periode' : 'Biaya hanya ditagih 1x'}
                    </p>
                    
                    {formData.biayaInstalasi && formData.biayaInstalasi > 0 && formData.useDiskonBiayaInstalasi && (
                      <div className="mt-2">
                        <label htmlFor="biayaInstalasiDiskon" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Diskon Biaya Instalasi (%)
                        </label>
                        <input
                          id="biayaInstalasiDiskon"
                          name="biayaInstalasiDiskon"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={formData.biayaInstalasiDiskon || ''}
                          onChange={(e) => setFormData((prev) => ({ 
                            ...prev, 
                            biayaInstalasiDiskon: e.target.value ? parseFloat(e.target.value) : null 
                          }))}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                          placeholder="0"
                        />
                        {formData.useDiskonBiayaInstalasi && formData.biayaInstalasiDiskon && formData.biayaInstalasiDiskon > 0 && formData.biayaInstalasi && formData.biayaInstalasi > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Diskon: {formData.biayaInstalasiDiskon}% = {formatRupiah(Math.round((formData.biayaInstalasi * formData.biayaInstalasiDiskon) / 100))}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="biayaSewaPerangkat" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Biaya Sewa Perangkat (Rp)
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.biayaSewaPerangkatIsRecurring}
                            onChange={(e) => setFormData((prev) => ({ ...prev, biayaSewaPerangkatIsRecurring: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600"
                          />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Berulang</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.useDiskonSewaPerangkat}
                            onChange={(e) => setFormData((prev) => ({ 
                              ...prev, 
                              useDiskonSewaPerangkat: e.target.checked,
                              // Reset diskon jika checkbox dinonaktifkan
                              ...(e.target.checked ? {} : { biayaSewaPerangkatDiskon: null })
                            }))}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600"
                          />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Diskon</span>
                        </label>
                      </div>
                    </div>
                    <input
                      id="biayaSewaPerangkat"
                      name="biayaSewaPerangkat"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.biayaSewaPerangkat || ''}
                      onChange={(e) => setFormData((prev) => ({ 
                        ...prev, 
                        biayaSewaPerangkat: e.target.value ? parseInt(e.target.value) : null 
                      }))}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formData.biayaSewaPerangkatIsRecurring ? 'Biaya akan ditagih setiap periode' : 'Biaya hanya ditagih 1x'}
                    </p>
                    
                    {formData.biayaSewaPerangkat && formData.biayaSewaPerangkat > 0 && formData.useDiskonSewaPerangkat && (
                      <div className="mt-2">
                        <label htmlFor="biayaSewaPerangkatDiskon" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Diskon Sewa Perangkat (%)
                        </label>
                        <input
                          id="biayaSewaPerangkatDiskon"
                          name="biayaSewaPerangkatDiskon"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={formData.biayaSewaPerangkatDiskon || ''}
                          onChange={(e) => setFormData((prev) => ({ 
                            ...prev, 
                            biayaSewaPerangkatDiskon: e.target.value ? parseFloat(e.target.value) : null 
                          }))}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                          placeholder="0"
                        />
                        {formData.useDiskonSewaPerangkat && formData.biayaSewaPerangkatDiskon && formData.biayaSewaPerangkatDiskon > 0 && formData.biayaSewaPerangkat && formData.biayaSewaPerangkat > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Diskon: {formData.biayaSewaPerangkatDiskon}% = {formatRupiah(Math.round((formData.biayaSewaPerangkat * formData.biayaSewaPerangkatDiskon) / 100))}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="biayaLainnya" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Biaya Lainnya (Rp)
                      </label>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.biayaLainnyaIsRecurring}
                            onChange={(e) => setFormData((prev) => ({ ...prev, biayaLainnyaIsRecurring: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600"
                          />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Berulang</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.useDiskonBiayaLainnya}
                            onChange={(e) => setFormData((prev) => ({ 
                              ...prev, 
                              useDiskonBiayaLainnya: e.target.checked,
                              // Reset diskon jika checkbox dinonaktifkan
                              ...(e.target.checked ? {} : { biayaLainnyaDiskon: null })
                            }))}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-indigo-600"
                          />
                          <span className="text-xs text-gray-600 dark:text-gray-400">Diskon</span>
                        </label>
                      </div>
                    </div>
                    <input
                      id="biayaLainnya"
                      name="biayaLainnya"
                      type="number"
                      min="0"
                      step="1"
                      value={formData.biayaLainnya || ''}
                      onChange={(e) => setFormData((prev) => ({ 
                        ...prev, 
                        biayaLainnya: e.target.value ? parseInt(e.target.value) : null 
                      }))}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formData.biayaLainnyaIsRecurring ? 'Biaya akan ditagih setiap periode' : 'Biaya hanya ditagih 1x'}
                    </p>
                    
                    {formData.biayaLainnya && formData.biayaLainnya > 0 && formData.useDiskonBiayaLainnya && (
                      <div className="mt-2">
                        <label htmlFor="biayaLainnyaDiskon" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Diskon Biaya Lainnya (%)
                        </label>
                        <input
                          id="biayaLainnyaDiskon"
                          name="biayaLainnyaDiskon"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={formData.biayaLainnyaDiskon || ''}
                          onChange={(e) => setFormData((prev) => ({ 
                            ...prev, 
                            biayaLainnyaDiskon: e.target.value ? parseFloat(e.target.value) : null 
                          }))}
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                          placeholder="0"
                        />
                        {formData.useDiskonBiayaLainnya && formData.biayaLainnyaDiskon && formData.biayaLainnyaDiskon > 0 && formData.biayaLainnya && formData.biayaLainnya > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Diskon: {formData.biayaLainnyaDiskon}% = {formatRupiah(Math.round((formData.biayaLainnya * formData.biayaLainnyaDiskon) / 100))}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {formData.biayaLainnya && formData.biayaLainnya > 0 && (
                    <div>
                      <label htmlFor="keteranganBiayaLainnya" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Keterangan Biaya Lainnya
                      </label>
                      <input
                        id="keteranganBiayaLainnya"
                        name="keteranganBiayaLainnya"
                        type="text"
                        value={formData.keteranganBiayaLainnya}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                        placeholder="Keterangan biaya lainnya"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
            </div>
          )}

          {activeTab === 'info' && (
            <div className="space-y-5">
          {/* Data Dasar */}
          <div className="space-y-4">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Data Dasar
            </h3>

            <div className="space-y-2">
              <label htmlFor="idPelanggan" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                ID Pelanggan <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="idPelanggan"
                  name="idPelanggan"
                  type="text"
                  required
                  value={formData.idPelanggan}
                  onChange={handleChange}
                  maxLength={8}
                  pattern="[0-9]{8}"
                  className={`w-full rounded-lg border ${
                    idPelangganError
                      ? 'border-red-300 dark:border-red-600'
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 ${
                    idPelangganError
                      ? 'focus:ring-red-500'
                      : 'focus:ring-indigo-500'
                  } focus:border-transparent transition-colors`}
                  placeholder="8 digit angka (otomatis atau manual)"
                />
                {checkingId && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <HiArrowPath className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              {idPelangganError ? (
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                  {idPelangganError}
                </p>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  ID pelanggan otomatis di-generate (8 digit), bisa diubah manual. Pastikan ID unik dan tidak duplikat.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="nama" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nama Pelanggan <span className="text-red-500">*</span>
              </label>
              <input
                id="nama"
                name="nama"
                type="text"
                required
                value={formData.nama}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="Nama lengkap pelanggan"
              />
            </div>
          </div>

          {/* Informasi Kontak */}
          <div className="space-y-4">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Informasi Kontak
            </h3>

            <div className="space-y-2">
              <label htmlFor="alamat" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Alamat
              </label>
              <textarea
                id="alamat"
                name="alamat"
                rows={3}
                value={formData.alamat}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="Alamat lengkap pelanggan"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="noTelp" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  No. Telepon
                </label>
                <input
                  id="noTelp"
                  name="noTelp"
                  type="text"
                  value={formData.noTelp}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  placeholder="081234567890"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Titik Koordinat (Tikor)
              </label>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label htmlFor="latitude" className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                      Latitude
                    </label>
                    <input
                      id="latitude"
                      name="latitude"
                      type="number"
                      step="any"
                      value={formData.latitude || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, latitude: e.target.value ? parseFloat(e.target.value) : null }))}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                      placeholder="-6.200000"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="longitude" className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                      Longitude
                    </label>
                    <input
                      id="longitude"
                      name="longitude"
                      type="number"
                      step="any"
                      value={formData.longitude || ''}
                      onChange={(e) => setFormData((prev) => ({ ...prev, longitude: e.target.value ? parseFloat(e.target.value) : null }))}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                      placeholder="106.816666"
                    />
                  </div>
                </div>
                <MapPickerWithSearch
                  lat={formData.latitude}
                  lon={formData.longitude}
                  height={300}
                  onChange={(lat, lon) => {
                    setFormData((prev) => ({ ...prev, latitude: lat, longitude: lon }))
                  }}
                />
              </div>
            </div>
          </div>

          {/* Kredensial PPPoE */}
          <div className="space-y-4">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Kredensial PPPoE
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Username PPPoE <span className="text-red-500">*</span>
                </label>
                {formData.username !== formData.idPelanggan && (
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, username: prev.idPelanggan }))}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
                  >
                    Gunakan ID Pelanggan
                  </button>
                )}
              </div>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="username@domain atau sama dengan ID Pelanggan"
              />
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Default: sama dengan ID Pelanggan ({formData.idPelanggan}), bisa diubah manual jika diperlukan
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password PPPoE <span className="text-red-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="text"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="Password untuk koneksi PPPoE"
              />
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Default: 12345, bisa diubah manual jika diperlukan. Password ini digunakan untuk koneksi PPPoE.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="passwordLogin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password Login Portal <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="passwordLogin"
                  name="passwordLogin"
                  type={showPasswordLogin ? 'text' : 'password'}
                  required
                  value={formData.passwordLogin}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 pr-10 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  placeholder="Password untuk login portal pelanggan"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordLogin(!showPasswordLogin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label={showPasswordLogin ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPasswordLogin ? (
                    <HiEyeSlash className="w-5 h-5" />
                  ) : (
                    <HiEye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                Default: 12345, bisa diubah manual jika diperlukan. Password ini digunakan untuk login di portal pelanggan (/pelanggan/login).
              </p>
            </div>
          </div>

          {/* Catatan */}
          <div className="space-y-4">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Catatan
            </h3>

            <div className="space-y-2">
              <label htmlFor="catatan" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Catatan Tambahan
              </label>
              <textarea
                id="catatan"
                name="catatan"
                rows={4}
                value={formData.catatan}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                placeholder="Catatan atau keterangan tambahan tentang pelanggan"
              />
            </div>
          </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={submitting || loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {submitting ? (
                <>
                  <HiArrowPath className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <HiArrowDownTray className="w-4 h-4" />
                  Simpan
                </>
              )}
            </button>
            <Link
              href="/admin/pelanggan/ppp"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Batal
            </Link>
          </div>
            </form>
          </div>
        </div>

        {/* Panel Informasi - 1 kolom */}
        {mounted && (
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 sticky top-5">
            {activeTab === 'info' ? (
              <>
                <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
                  Upload Dokumen
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="fileKTP-sidebar" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Upload KTP
                    </label>
                    <input
                      id="fileKTP-sidebar"
                      name="fileKTP"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setFileKTP(e.target.files?.[0] || null)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/20 dark:file:text-indigo-400 dark:hover:file:bg-indigo-900/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    />
                    {fileKTP && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {fileKTP.name} ({(fileKTP.size / 1024).toFixed(2)} KB)
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="fileRumahSekitar-sidebar" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Upload Rumah Sekitar
                    </label>
                    <input
                      id="fileRumahSekitar-sidebar"
                      name="fileRumahSekitar"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setFileRumahSekitar(e.target.files?.[0] || null)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/20 dark:file:text-indigo-400 dark:hover:file:bg-indigo-900/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    />
                    {fileRumahSekitar && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {fileRumahSekitar.name} ({(fileRumahSekitar.size / 1024).toFixed(2)} KB)
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="fileBAST-sidebar" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Upload BAST
                    </label>
                    <input
                      id="fileBAST-sidebar"
                      name="fileBAST"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setFileBAST(e.target.files?.[0] || null)}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/20 dark:file:text-indigo-400 dark:hover:file:bg-indigo-900/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    />
                    {fileBAST && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {fileBAST.name} ({(fileBAST.size / 1024).toFixed(2)} KB)
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2 mb-4">
                  Informasi Tagihan
                </h3>

            {!formData.hargaPaketId || hargaPakets.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {hargaPakets.length === 0 ? 'Memuat data paket...' : 'Pilih paket untuk melihat detail tagihan'}
                </p>
              </div>
            ) : totalInfo ? (
              <div className="space-y-4">
                {/* Info Paket */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Paket Terpilih
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {totalInfo.paket.name}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Durasi: {totalInfo.paket.durasi} {totalInfo.paket.durasiUnit === 'JAM' ? 'jam' : totalInfo.paket.durasiUnit === 'HARI' ? 'hari' : totalInfo.paket.durasiUnit === 'BULAN' ? 'bulan' : 'tahun'}
                    </p>
                    {totalInfo.paket.profilePPP && (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Profile: {totalInfo.paket.profilePPP.name}
                      </p>
                    )}
                    {totalInfo.paket.bandwidth && (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Bandwidth: {totalInfo.paket.bandwidth.name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Rincian Tagihan */}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Rincian Tagihan
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400">Harga Paket</span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {formatRupiah(totalInfo.prorateInfo ? totalInfo.prorateInfo.hargaSebelumProrate : totalInfo.hargaPaket)}
                      </span>
                    </div>

                    {totalInfo.prorateInfo && (
                      <>
                        <div className="flex justify-between items-center text-blue-600 dark:text-blue-400">
                          <span>Prorate ({Math.round(totalInfo.prorateInfo.ratio * 100)}%)</span>
                          <span className="font-medium">
                            - {formatRupiah(totalInfo.prorateInfo.hargaSebelumProrate - totalInfo.prorateInfo.hargaSetelahProrate)}
                          </span>
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400 ml-2">
                          (Periode: {totalInfo.prorateInfo.selisihHari} hari dari {totalInfo.prorateInfo.durasiPaketHari} hari)
                        </div>
                      </>
                    )}

                        {totalInfo.diskon > 0 && (
                          <>
                            <div className="flex justify-between items-center text-green-600 dark:text-green-400">
                              <span>
                                Diskon {totalInfo.diskonInfo?.isCustom ? '(Custom)' : '(Paket)'}
                              </span>
                              <span className="font-medium">- {formatRupiah(totalInfo.diskon)}</span>
                            </div>
                            {totalInfo.diskonInfo?.duration && totalInfo.diskonInfo?.durationUnit && (
                              <div className="text-xs text-green-600 dark:text-green-400 ml-2">
                                (Berlaku selama {totalInfo.diskonInfo.duration} {totalInfo.diskonInfo.durationUnit === 'JAM' ? 'jam' : totalInfo.diskonInfo.durationUnit === 'HARI' ? 'hari' : totalInfo.diskonInfo.durationUnit === 'BULAN' ? 'bulan' : 'tahun'})
                              </div>
                            )}
                          </>
                        )}

                    {totalInfo.ppn > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">
                          PPN ({totalInfo.paket.ppnPercentage}%)
                        </span>
                        <span className="text-gray-900 dark:text-white font-medium">
                          + {formatRupiah(totalInfo.ppn)}
                        </span>
                      </div>
                    )}

                    {(totalInfo.totalBiayaLainnya > 0 || (formData.biayaInstalasi && formData.biayaInstalasi > 0) || (formData.biayaSewaPerangkat && formData.biayaSewaPerangkat > 0) || (formData.biayaLainnya && formData.biayaLainnya > 0)) && (
                      <>
                        {formData.biayaInstalasi && formData.biayaInstalasi > 0 && (
                          <>
                            <div className="flex justify-between items-center text-purple-600 dark:text-purple-400">
                              <span>
                                Biaya Instalasi {formData.biayaInstalasiIsRecurring ? '(Berulang)' : '(1x)'}
                                {formData.useDiskonBiayaInstalasi && totalInfo.biayaInstalasiDiskon && totalInfo.biayaInstalasiDiskon > 0 && (
                                  <> - Diskon {totalInfo.biayaInstalasiDiskon}%</>
                                )}
                              </span>
                              <span className="font-medium">+ {formatRupiah(totalInfo.biayaInstalasi || 0)}</span>
                            </div>
                            {formData.useDiskonBiayaInstalasi && totalInfo.biayaInstalasiDiskon && totalInfo.biayaInstalasiDiskon > 0 && totalInfo.biayaInstalasiSebelumDiskon > 0 && (
                              <div className="text-xs text-purple-600 dark:text-purple-400 ml-2">
                                (Sebelum diskon: {formatRupiah(totalInfo.biayaInstalasiSebelumDiskon)})
                              </div>
                            )}
                          </>
                        )}
                        {formData.biayaSewaPerangkat && formData.biayaSewaPerangkat > 0 && (
                          <>
                            <div className="flex justify-between items-center text-purple-600 dark:text-purple-400">
                              <span>
                                Biaya Sewa Perangkat {formData.biayaSewaPerangkatIsRecurring ? '(Berulang)' : '(1x)'}
                                {formData.useDiskonSewaPerangkat && totalInfo.biayaSewaPerangkatDiskon && totalInfo.biayaSewaPerangkatDiskon > 0 && (
                                  <> - Diskon {totalInfo.biayaSewaPerangkatDiskon}%</>
                                )}
                              </span>
                              <span className="font-medium">+ {formatRupiah(totalInfo.biayaSewaPerangkat || 0)}</span>
                            </div>
                            {formData.useDiskonSewaPerangkat && totalInfo.biayaSewaPerangkatDiskon && totalInfo.biayaSewaPerangkatDiskon > 0 && totalInfo.biayaSewaPerangkatSebelumDiskon > 0 && (
                              <div className="text-xs text-purple-600 dark:text-purple-400 ml-2">
                                (Sebelum diskon: {formatRupiah(totalInfo.biayaSewaPerangkatSebelumDiskon)})
                              </div>
                            )}
                          </>
                        )}
                        {formData.biayaLainnya && formData.biayaLainnya > 0 && (
                          <>
                            <div className="flex justify-between items-center text-purple-600 dark:text-purple-400">
                              <span>
                                Biaya Lainnya {formData.biayaLainnyaIsRecurring ? '(Berulang)' : '(1x)'}
                                {formData.useDiskonBiayaLainnya && totalInfo.biayaLainnyaDiskon && totalInfo.biayaLainnyaDiskon > 0 && (
                                  <> - Diskon {totalInfo.biayaLainnyaDiskon}%</>
                                )}
                                {formData.keteranganBiayaLainnya ? ` (${formData.keteranganBiayaLainnya})` : ''}
                              </span>
                              <span className="font-medium">+ {formatRupiah(totalInfo.biayaLainnya || 0)}</span>
                            </div>
                            {formData.useDiskonBiayaLainnya && totalInfo.biayaLainnyaDiskon && totalInfo.biayaLainnyaDiskon > 0 && totalInfo.biayaLainnyaSebelumDiskon > 0 && (
                              <div className="text-xs text-purple-600 dark:text-purple-400 ml-2">
                                (Sebelum diskon: {formatRupiah(totalInfo.biayaLainnyaSebelumDiskon)})
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-semibold text-gray-900 dark:text-white">
                          Total Tagihan
                        </span>
                        <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                          {formatRupiah(totalInfo.total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status PPN, Prorate & Diskon */}
                <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">PPN</span>
                    <span className={`font-medium ${formData.usePPN ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                      {formData.usePPN ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">Prorate</span>
                    <span className={`font-medium ${formData.useProrate ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                      {formData.useProrate ? 'Aktif' : 'Tidak Aktif'}
                    </span>
                  </div>
                  {formData.useProrate && totalInfo.prorateInfo && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 ml-0">
                      Periode: {totalInfo.prorateInfo.selisihHari} hari / {totalInfo.prorateInfo.durasiPaketHari} hari ({Math.round(totalInfo.prorateInfo.ratio * 100)}%)
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Diskon</span>
                      <span className={`font-medium ${formData.useDiscount ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                        {formData.useDiscount ? 'Aktif' : 'Tidak Aktif'}
                      </span>
                    </div>
                    {formData.useDiscount && totalInfo.diskonInfo && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 ml-0">
                        {totalInfo.diskonInfo.isCustom ? (
                          <>
                            Custom: {totalInfo.diskonInfo.type === 'FIXED' ? formatRupiah(totalInfo.diskonInfo.value) : `${totalInfo.diskonInfo.value}%`}
                            {totalInfo.diskonInfo.duration && totalInfo.diskonInfo.durationUnit && (
                              <> - Durasi: {totalInfo.diskonInfo.duration} {totalInfo.diskonInfo.durationUnit === 'JAM' ? 'jam' : totalInfo.diskonInfo.durationUnit === 'HARI' ? 'hari' : totalInfo.diskonInfo.durationUnit === 'BULAN' ? 'bulan' : 'tahun'}</>
                            )}
                          </>
                        ) : (
                          <>
                            Paket: {totalInfo.diskonInfo.type === 'FIXED' ? formatRupiah(totalInfo.diskonInfo.value) : `${totalInfo.diskonInfo.value}%`}
                            {totalInfo.diskonInfo.duration && totalInfo.diskonInfo.durationUnit && (
                              <> - Durasi: {totalInfo.diskonInfo.duration} {totalInfo.diskonInfo.durationUnit === 'JAM' ? 'jam' : totalInfo.diskonInfo.durationUnit === 'HARI' ? 'hari' : totalInfo.diskonInfo.durationUnit === 'BULAN' ? 'bulan' : 'tahun'}</>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Info Tambahan */}
                {formData.tanggalAktif && formData.jatuhTempo && (
                  <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Periode Layanan
                    </h4>
                    <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      <div className="flex justify-between">
                        <span>Aktif:</span>
                        <span className="font-medium">
                          {new Date(formData.tanggalAktif).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Jatuh Tempo:</span>
                        <span className="font-medium">
                          {new Date(formData.jatuhTempo).toLocaleDateString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Memuat informasi paket...
                </p>
              </div>
            )}
              </>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

