"use client"

import { useEffect, useState } from 'react'
import { HiArrowPath, HiCheckCircle, HiClock, HiExclamationCircle, HiGlobeAlt, HiPlus, HiXMark } from 'react-icons/hi2'
import Link from 'next/link'
import { TIMEZONE_OPTIONS, type TimezoneOption } from '@/lib/constants/timezone-constants'

type BankAccount = {
  id?: string
  namaBank: string
  atasNama: string
  noRekening: string
}

type GeneralSettings = {
  perusahaan: string
  namaAplikasi: string
  alamat: string
  nomorHp: string
  deskripsiInvoice: string
  rekeningBank: BankAccount[]
  invoiceOtomatis: string
  disablePerpanjanganPaket: string
  timezone: string
}

export function ClientComponent() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [currentTime, setCurrentTime] = useState<string>('')
  const [settings, setSettings] = useState<GeneralSettings>({
    perusahaan: '',
    namaAplikasi: '',
    alamat: '',
    nomorHp: '',
    deskripsiInvoice: '',
    rekeningBank: [],
    invoiceOtomatis: '5',
    disablePerpanjanganPaket: '5',
    timezone: 'Asia/Jakarta',
  })

  // Update current time every second based on selected timezone
  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date()
        const timeStr = now.toLocaleString('id-ID', {
          timeZone: settings.timezone,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        setCurrentTime(timeStr)
      } catch (e) {
        setCurrentTime('Invalid timezone')
      }
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [settings.timezone])

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/settings/general')
      if (res.ok) {
        const data = await res.json()
        setSettings({
          perusahaan: data.perusahaan || '',
          namaAplikasi: data.namaAplikasi || '',
          alamat: data.alamat || '',
          nomorHp: data.nomorHp || '',
          deskripsiInvoice: data.deskripsiInvoice || '',
          rekeningBank: data.rekeningBank || [],
          invoiceOtomatis: data.invoiceOtomatis || '5',
          disablePerpanjanganPaket: data.disablePerpanjanganPaket || '5',
          timezone: data.timezone || 'Asia/Jakarta',
        })
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Gagal memuat pengaturan')
      }
    } catch (err: any) {
      console.error('Error loading settings:', err)
      setError(err.message || 'Terjadi kesalahan saat memuat pengaturan')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    try {
      setSaving(true)
      const res = await fetch('/api/settings/general', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Gagal menyimpan pengaturan')
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Error saving settings:', err)
      setError(err.message || 'Terjadi kesalahan saat menyimpan pengaturan')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setSettings((prev) => ({ ...prev, [name]: value }))
    setError(null)
    setSuccess(false)
  }

  const handleBankChange = (index: number, field: keyof BankAccount, value: string) => {
    setSettings((prev) => {
      const newBanks = [...prev.rekeningBank]
      newBanks[index] = { ...newBanks[index], [field]: value }
      return { ...prev, rekeningBank: newBanks }
    })
  }

  const addBankAccount = () => {
    setSettings((prev) => ({
      ...prev,
      rekeningBank: [...prev.rekeningBank, { namaBank: '', atasNama: '', noRekening: '' }],
    }))
  }

  const removeBankAccount = (index: number) => {
    setSettings((prev) => ({
      ...prev,
      rekeningBank: prev.rekeningBank.filter((_, i) => i !== index),
    }))
  }

  const invoiceOtomatisOptions = [
    { value: '1', label: '1 HARI SEBELUM JATUH TEMPO' },
    { value: '2', label: '2 HARI SEBELUM JATUH TEMPO' },
    { value: '3', label: '3 HARI SEBELUM JATUH TEMPO' },
    { value: '4', label: '4 HARI SEBELUM JATUH TEMPO' },
    { value: '5', label: '5 HARI SEBELUM JATUH TEMPO' },
    { value: '6', label: '6 HARI SEBELUM JATUH TEMPO' },
    { value: '7', label: '7 HARI SEBELUM JATUH TEMPO' },
  ]

  return (
    <div className="w-full space-y-5">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Pengaturan Umum</h2>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <HiArrowPath className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Memuat pengaturan...</span>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Perusahaan */}
            <div className="space-y-2">
              <label htmlFor="perusahaan" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className="text-red-500">!</span> Perusahaan
              </label>
              <input
                id="perusahaan"
                name="perusahaan"
                type="text"
                value={settings.perusahaan}
                onChange={handleChange}
                placeholder="Masukkan nama perusahaan"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              />
            </div>

            {/* Nama Aplikasi */}
            <div className="space-y-2">
              <label htmlFor="namaAplikasi" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className="text-red-500">!</span> Nama Aplikasi
              </label>
              <input
                id="namaAplikasi"
                name="namaAplikasi"
                type="text"
                value={settings.namaAplikasi}
                onChange={handleChange}
                placeholder="Masukkan nama aplikasi (contoh: NetManager)"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              />
            </div>

            {/* Alamat */}
            <div className="space-y-2">
              <label htmlFor="alamat" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className="text-red-500">!</span> Alamat
              </label>
              <textarea
                id="alamat"
                name="alamat"
                value={settings.alamat}
                onChange={handleChange}
                placeholder="Masukkan alamat perusahaan"
                rows={3}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors resize-y"
              />
            </div>

            {/* Nomor HP */}
            <div className="space-y-2">
              <label htmlFor="nomorHp" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className="text-red-500">!</span> Nomor HP
              </label>
              <input
                id="nomorHp"
                name="nomorHp"
                type="text"
                value={settings.nomorHp}
                onChange={handleChange}
                placeholder="Masukkan nomor HP"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              />
            </div>

            {/* Deskripsi Invoice */}
            <div className="space-y-2">
              <label htmlFor="deskripsiInvoice" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className="text-red-500">!</span> Deskripsi Invoice
              </label>
              <input
                id="deskripsiInvoice"
                name="deskripsiInvoice"
                type="text"
                value={settings.deskripsiInvoice}
                onChange={handleChange}
                placeholder="Masukkan deskripsi invoice"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              />
            </div>

            {/* Rekening Bank */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Rekening Bank
                </label>
                <button
                  type="button"
                  onClick={addBankAccount}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                >
                  <HiPlus className="w-4 h-4" />
                  Tambah Rekening
                </button>
              </div>

              {settings.rekeningBank.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                  Belum ada rekening bank. Klik &quot;Tambah Rekening&quot; untuk menambahkan.
                </div>
              ) : (
                <div className="space-y-4">
                  {settings.rekeningBank.map((bank, index) => (
                    <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Bank {index + 1}
                        </span>
                        {settings.rekeningBank.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBankAccount(index)}
                            className="text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                            aria-label="Hapus rekening bank"
                          >
                            <HiXMark className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Nama Bank
                          </label>
                          <input
                            type="text"
                            value={bank.namaBank}
                            onChange={(e) => handleBankChange(index, 'namaBank', e.target.value)}
                            placeholder="Nama Bank"
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Atas Nama
                          </label>
                          <input
                            type="text"
                            value={bank.atasNama}
                            onChange={(e) => handleBankChange(index, 'atasNama', e.target.value)}
                            placeholder="Atas Nama"
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            No. Rekening
                          </label>
                          <input
                            type="text"
                            value={bank.noRekening}
                            onChange={(e) => handleBankChange(index, 'noRekening', e.target.value)}
                            placeholder="No. Rekening"
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Invoice Otomatis */}
            <div className="space-y-2">
              <label htmlFor="invoiceOtomatis" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Invoice Otomatis
              </label>
              <select
                id="invoiceOtomatis"
                name="invoiceOtomatis"
                value={settings.invoiceOtomatis}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              >
                {invoiceOtomatisOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                INVOICE BELUM BAYAR PADA DATA PELANGGAN (
                <span className="text-blue-600 dark:text-blue-400">HOTSPOT</span> /{' '}
                <span className="text-blue-600 dark:text-blue-400">PPP</span>) HARUS SUDAH TERBAYARKAN SEBELUM PERIODE YANG DIPILIH
              </p>
            </div>

            {/* Disable Perpanjangan Paket Sampai */}
            <div className="space-y-2">
              <label htmlFor="disablePerpanjanganPaket" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Disable Perpanjangan Paket Sampai
              </label>
              <select
                id="disablePerpanjanganPaket"
                name="disablePerpanjanganPaket"
                value={settings.disablePerpanjanganPaket}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              >
                {invoiceOtomatisOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Zona Waktu */}
            <div className="space-y-3 p-4 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center gap-2">
                <HiGlobeAlt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <label htmlFor="timezone" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Zona Waktu Aplikasi
                </label>
              </div>

              <select
                id="timezone"
                name="timezone"
                value={settings.timezone}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>

              {/* Live Clock Preview */}
              <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <HiClock className="w-5 h-5 text-green-600 dark:text-green-400 animate-pulse" />
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Waktu saat ini di zona {settings.timezone}:</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{currentTime || 'Memuat...'}</p>
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Zona waktu ini akan digunakan untuk semua jadwal otomatis (cron job) seperti generate tagihan, sync OLT/ONU, dll.
              </p>
            </div>

            {/* Messages */}
            {success && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
                <HiCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-400">
                    Pengaturan berhasil disimpan
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                <HiExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-400">{error}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {saving ? (
                  <>
                    <HiArrowPath className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <HiCheckCircle className="w-4 h-4" />
                    Simpan Perubahan
                  </>
                )}
              </button>
              <Link
                href="/admin/pengaturan"
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Atau Kembali
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

