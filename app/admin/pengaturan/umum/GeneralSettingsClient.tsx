"use client"

import { useEffect, useState } from 'react'
import { HiArrowPath, HiCheckCircle, HiClock, HiExclamationCircle, HiGlobeAlt, HiPlus, HiXMark } from 'react-icons/hi2'
import Link from 'next/link'
import { TIMEZONE_OPTIONS } from '@/lib/constants/timezone-constants'

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
  email: string
  deskripsiInvoice: string
  rekeningBank: BankAccount[]
  invoiceOtomatis: string
  disablePerpanjanganPaket: string
  timezone: string
  attendanceTolerance: string
  pppConnectionMode: 'RADIUS' | 'MIKROTIK_API'
  reminderOtomatis: string
  reminderFrequency: 'ONCE' | 'DAILY'
  reminderTime: string
  notifApp: boolean
  notifWa: boolean
  notifEmail: boolean
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
    email: '',
    deskripsiInvoice: '',
    rekeningBank: [],
    invoiceOtomatis: '5',
    disablePerpanjanganPaket: '5',
    timezone: 'Asia/Jakarta',
    attendanceTolerance: '0',
    pppConnectionMode: 'RADIUS',
    reminderOtomatis: '3',
    reminderFrequency: 'DAILY',
    reminderTime: '08:00',
    notifApp: true,
    notifWa: false,
    notifEmail: false,
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
      } catch (_e) {
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
          email: data.email || '',
          deskripsiInvoice: data.deskripsiInvoice || '',
          rekeningBank: data.rekeningBank || [],
          invoiceOtomatis: data.invoiceOtomatis || '5',
          disablePerpanjanganPaket: data.disablePerpanjanganPaket || '5',
          timezone: data.timezone || 'Asia/Jakarta',
          attendanceTolerance: data.attendanceTolerance || '0',
          pppConnectionMode: data.pppConnectionMode || 'RADIUS',
          reminderOtomatis: data.reminderOtomatis || '3',
          reminderFrequency: data.reminderFrequency || 'DAILY',
          reminderTime: data.reminderTime || '08:00',
          notifApp: data.notifApp ?? true,
          notifWa: data.notifWa ?? false,
          notifEmail: data.notifEmail ?? false,
        })
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Gagal memuat pengaturan')
      }
    } catch (err: unknown) {
      console.error('Error loading settings:', err)
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat pengaturan')
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
    } catch (err: unknown) {
      console.error('Error saving settings:', err)
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan pengaturan')
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

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target
    setSettings((prev) => ({ ...prev, [name]: checked }))
    setError(null)
    setSuccess(false)
  }

  const handleBankChange = (index: number, field: keyof BankAccount, value: string) => {
    setSettings((prev) => {
      const newBanks = [...prev.rekeningBank]
      newBanks[index] = { ...newBanks[index], [field]: value } as BankAccount
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

            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className="text-red-500">!</span> Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={settings.email}
                onChange={handleChange}
                placeholder="Masukkan email perusahaan"
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

            {/* Attendance Tolerance */}
            <div className="space-y-2">
              <label htmlFor="attendanceTolerance" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Toleransi Keterlambatan Absensi (Menit)
              </label>
              <input
                id="attendanceTolerance"
                name="attendanceTolerance"
                type="number"
                min="0"
                max="60"
                value={settings.attendanceTolerance}
                onChange={handleChange}
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Karyawan yang check-in lewat dari jam masuk + toleransi ini akan dianggap TERLAMBAT. (0 = Tidak ada toleransi)
              </p>
            </div>

            {/* Pengaturan Reminder & Notifikasi */}
            <div className="space-y-4 p-4 bg-linear-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Pengaturan Reminder Tagihan
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="reminderOtomatis" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Mulai Kirim Reminder (H-X)
                  </label>
                  <select
                    id="reminderOtomatis"
                    name="reminderOtomatis"
                    value={settings.reminderOtomatis}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  >
                    {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                      <option key={num} value={num.toString()}>
                        {num} Hari Sebelum Jatuh Tempo
                      </option>
                    ))}
                    <option value="0">Tepat di Hari Jatuh Tempo (H-0)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="reminderFrequency" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Frekuensi Reminder
                  </label>
                  <select
                    id="reminderFrequency"
                    name="reminderFrequency"
                    value={settings.reminderFrequency}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  >
                    <option value="ONCE">Kirim Sekali (Tepat H-X)</option>
                    <option value="DAILY">Kirim Tiap Hari (Mulai H-X s.d Jatuh Tempo)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="reminderTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Jam Pengiriman (Waktu Setempat)
                </label>
                <input
                  type="time"
                  id="reminderTime"
                  name="reminderTime"
                  value={settings.reminderTime}
                  onChange={handleChange}
                  className="w-full sm:w-48 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                />
              </div>

              <div className="border-t border-orange-200 dark:border-orange-800 pt-4 mt-4">
                <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Channel Pengiriman Notifikasi
                </span>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="notifApp"
                      checked={settings.notifApp}
                      onChange={handleCheckboxChange}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Aplikasi Mobile (Push Notification)</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="notifWa"
                      checked={settings.notifWa}
                      onChange={handleCheckboxChange}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">WhatsApp (Akan dikirim jika integrasi aktif)</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="notifEmail"
                      checked={settings.notifEmail}
                      onChange={handleCheckboxChange}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Email (Akan dikirim jika SMTP dikonfigurasi)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* PPP Network Settings */}
            <div className="space-y-4 p-4 bg-linear-to-r from-blue-50/50 to-cyan-50/50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Pengaturan Jaringan PPP
                </span>
              </div>

              {/* Mode Koneksi */}
              <div className="space-y-2">
                <label htmlFor="pppConnectionMode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mode Koneksi PPP
                </label>
                <select
                  id="pppConnectionMode"
                  name="pppConnectionMode"
                  value={settings.pppConnectionMode}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                >
                  <option value="RADIUS">RADIUS - Autentikasi via FreeRADIUS Server</option>
                  <option value="MIKROTIK_API">MikroTik API - PPP Secret langsung di Router</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {settings.pppConnectionMode === 'RADIUS'
                    ? 'Pelanggan diautentikasi via FreeRADIUS. User disimpan di database RADIUS.'
                    : 'RADIUS dinonaktifkan di router. User dibuat langsung sebagai PPP Secret di MikroTik.'
                  }
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <strong>Isolir:</strong> Kedua mode sama - ubah profile ke &quot;expired users&quot; di MikroTik.
                </p>
              </div>
            </div>

            {/* Zona Waktu */}
            <div className="space-y-3 p-4 bg-linear-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
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

