"use client"

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'react-hot-toast'
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
  autoIsolirEnabled: boolean
  autoIsolirHariToleransi: string
  reminderOtomatis: string
  reminderFrequency: 'ONCE' | 'DAILY'
  reminderTime: string
  notifApp: boolean
  notifWa: boolean
  notifEmail: boolean
}

export function ClientComponent() {
  const { data: session } = useSession()
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
    autoIsolirEnabled: true,
    autoIsolirHariToleransi: '1',
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

  const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'Super Admin'

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

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/settings/general')
      if (res.ok) {
        const response = await res.json()
        const data = response.data // Access the nested data object
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
          autoIsolirEnabled: data.autoIsolirEnabled ?? true,
          autoIsolirHariToleransi: data.autoIsolirHariToleransi || '1',
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
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Handlers for props
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setSettings(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target
    setSettings(prev => ({ ...prev, [name]: checked }))
  }

  const handleBankChange = (index: number, field: keyof BankAccount, value: string) => {
    const newBankAccounts = [...settings.rekeningBank]
    newBankAccounts[index] = { ...newBankAccounts[index], [field]: value }
    setSettings(prev => ({ ...prev, rekeningBank: newBankAccounts }))
  }

  const addBankAccount = () => {
    setSettings(prev => ({
      ...prev,
      rekeningBank: [...prev.rekeningBank, { namaBank: '', atasNama: '', noRekening: '' }]
    }))
  }

  const removeBankAccount = (index: number) => {
    const newBankAccounts = [...settings.rekeningBank]
    newBankAccounts.splice(index, 1)
    setSettings(prev => ({ ...prev, rekeningBank: newBankAccounts }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)

    try {
      const res = await fetch('/api/settings/general', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (res.ok) {
        toast.success('Pengaturan berhasil disimpan!')
        setSuccess(true)
        loadSettings()
        setTimeout(() => setSuccess(false), 3000)
      } else {
        const errorData = await res.json()
        const errorMsg = errorData.error || 'Gagal menyimpan pengaturan'
        toast.error(errorMsg)
        setError(errorMsg)
      }
    } catch (err: unknown) {
      console.error('Error saving settings:', err)
      const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan pengaturan'
      toast.error(errorMsg)
      setError(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const handleBackfill = async () => {
    if (!confirm('Apakah Anda yakin ingin menjalankan sinkronisasi data multi-tenant? Operasi ini akan memakan waktu.')) {
      return
    }

    try {
      setBackfilling(true)
      setBackfillError(null)
      setBackfillResult(null)
      toast.loading('Sedang melakukan sinkronisasi...', { id: 'backfill' })

      const res = await fetch('/api/settings/backup/backfill', {
        method: 'POST',
      })

      const data = await res.json()

      if (res.ok) {
        toast.success('Sinkronisasi data multi-tenant selesai!', { id: 'backfill' })
        setBackfillResult({
          success: true,
          message: data.message || 'Sinkronisasi berhasil diselesaikan',
          log: data.log
        })
      } else {
        const errorMsg = data.error || 'Terjadi kesalahan saat sinkronisasi'
        toast.error(errorMsg, { id: 'backfill' })
        setBackfillError(errorMsg)
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Kesalahan jaringan atau server'
      toast.error(errorMsg, { id: 'backfill' })
      setBackfillError(errorMsg)
    } finally {
      setBackfilling(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Pengaturan Umum
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Kelola profil perusahaan, penagihan, dan konfigurasi sistem lainnya.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
            <HiExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <HiCheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <p className="text-sm text-green-800 dark:text-green-400 font-medium">
              Pengaturan berhasil disimpan!
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          <CompanyProfileSettings 
            settings={settings} 
            handleChange={handleChange}
            handleBankChange={handleBankChange}
            addBankAccount={addBankAccount}
            removeBankAccount={removeBankAccount}
          />
          <BillingSettings 
            settings={settings} 
            handleChange={handleChange} 
          />
          <NotificationSettings 
            settings={settings} 
            handleChange={handleChange}
            handleCheckboxChange={handleCheckboxChange}
          />
          <NetworkSettings 
            settings={settings} 
            handleChange={handleChange} 
          />
          
          {isSuperAdmin && (
            <TenantSync 
              backfilling={backfilling}
              backfillResult={backfillResult}
              backfillError={backfillError}
              handleBackfill={handleBackfill}
            />
          )}

          <TimezoneSettings 
            timezone={settings.timezone} 
            currentTime={currentTime} 
            handleChange={handleChange}
          />

          <div className="sticky bottom-6 flex justify-end">
            <button
              type="submit"
              disabled={saving || loading}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {saving ? (
                <>
                  <HiArrowPath className="w-5 h-5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                'Simpan Semua Pengaturan'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
