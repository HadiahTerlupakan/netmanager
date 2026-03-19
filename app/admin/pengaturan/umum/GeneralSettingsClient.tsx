"use client"

import { useEffect, useState } from 'react'
import { HiArrowPath, HiCheckCircle, HiExclamationCircle } from 'react-icons/hi2'
import { CompanyProfileSettings } from '@/components/admin/settings/CompanyProfileSettings'
import { BillingSettings } from '@/components/admin/settings/BillingSettings'
import { NotificationSettings } from '@/components/admin/settings/NotificationSettings'
import { NetworkSettings } from '@/components/admin/settings/NetworkSettings'
import { TimezoneSettings } from '@/components/admin/settings/TimezoneSettings'
import { TenantSync } from '@/components/admin/settings/TenantSync'

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

  // Backfill state
  const [backfilling, setBackfilling] = useState(false)
  const [backfillResult, setBackfillResult] = useState<{ success: boolean; message: string; log?: string } | null>(null)
  const [backfillError, setBackfillError] = useState<string | null>(null)

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

  // ─── BACKFILL (SYNC TENANT) ──────────────────────────────────────────
  const handleBackfill = async () => {
    setBackfilling(true)
    setBackfillError(null)
    setBackfillResult(null)

    try {
      const res = await fetch('/api/settings/backup/backfill', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}: Gagal sinkronisasi tenant`)
      }

      setBackfillResult(data)
    } catch (err) {
      setBackfillError(err instanceof Error ? err.message : 'Terjadi kesalahan saat sinkronisasi tenant')
    } finally {
      setBackfilling(false)
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

  return (
    <div className="w-full space-y-5">
      <div className="mb-4 text-center md:text-left">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Pengaturan Umum</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Konfigurasi profil perusahaan, penagihan, notifikasi, dan infrastruktur utama
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <HiArrowPath className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Memuat semua pengaturan...</span>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6">
            <CompanyProfileSettings 
              settings={settings}
              handleChange={handleChange}
              handleBankChange={handleBankChange}
              addBankAccount={addBankAccount}
              removeBankAccount={removeBankAccount}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <BillingSettings 
                settings={settings}
                handleChange={handleChange}
              />
              <NotificationSettings 
                settings={settings}
                handleChange={handleChange}
                handleCheckboxChange={handleCheckboxChange}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <NetworkSettings 
                settings={settings}
                handleChange={handleChange}
              />
              <TimezoneSettings 
                timezone={settings.timezone}
                currentTime={currentTime}
                handleChange={handleChange}
              />
            </div>

            <TenantSync 
              backfilling={backfilling}
              backfillResult={backfillResult}
              backfillError={backfillError}
              handleBackfill={handleBackfill}
            />
          </div>

          {/* Feedback & Actions */}
          <div className="sticky bottom-4 z-10">
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex-1">
                {success && (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 animate-in fade-in slide-in-from-left-2">
                    <HiCheckCircle className="w-5 h-5" />
                    <span className="text-sm font-bold">Semua pengaturan berhasil disimpan!</span>
                  </div>
                )}
                {error && (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 animate-in fade-in slide-in-from-left-2">
                    <HiExclamationCircle className="w-5 h-5" />
                    <span className="text-sm font-bold">{error}</span>
                  </div>
                )}
                {!success && !error && (
                  <p className="text-xs text-gray-500 font-medium">Pastikan semua data bertanda bintang (*) telah diisi dengan benar.</p>
                )}
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  type="button"
                  onClick={loadSettings}
                  disabled={loading || saving}
                  className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all disabled:opacity-50"
                >
                  <HiArrowPath className="w-4 h-4" />
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-[2] md:flex-none inline-flex items-center justify-center gap-2 px-8 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
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
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
