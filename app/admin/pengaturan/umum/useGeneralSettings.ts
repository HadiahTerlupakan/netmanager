"use client"

import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { toast } from 'react-hot-toast'
import { useSession } from 'next-auth/react'

export type BankAccount = {
  id?: string
  namaBank: string
  atasNama: string
  noRekening: string
}

export type GeneralSettings = {
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

type BackfillResult = {
  success: boolean
  message: string
  log?: string
}

const defaultSettings: GeneralSettings = {
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
}

export type UseGeneralSettingsResult = {
  settings: GeneralSettings
  loading: boolean
  saving: boolean
  error: string | null
  success: boolean
  currentTime: string
  backfilling: boolean
  backfillResult: BackfillResult | null
  backfillError: string | null
  isSuperAdmin: boolean
  handleChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  handleCheckboxChange: (event: ChangeEvent<HTMLInputElement>) => void
  handleBankChange: (index: number, field: keyof BankAccount, value: string) => void
  addBankAccount: () => void
  removeBankAccount: (index: number) => void
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
  handleBackfill: () => Promise<void>
}

export function useGeneralSettings(): UseGeneralSettingsResult {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [currentTime, setCurrentTime] = useState<string>('')
  const [settings, setSettings] = useState<GeneralSettings>(defaultSettings)
  const [backfilling, setBackfilling] = useState(false)
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null)
  const [backfillError, setBackfillError] = useState<string | null>(null)

  const isSuperAdmin =
    session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'Super Admin'

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
        const data = response.data
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

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    setSettings(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target
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
      rekeningBank: [...prev.rekeningBank, { namaBank: '', atasNama: '', noRekening: '' }],
    }))
  }

  const removeBankAccount = (index: number) => {
    const newBankAccounts = [...settings.rekeningBank]
    newBankAccounts.splice(index, 1)
    setSettings(prev => ({ ...prev, rekeningBank: newBankAccounts }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
          log: data.log,
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

  return {
    settings,
    loading,
    saving,
    error,
    success,
    currentTime,
    backfilling,
    backfillResult,
    backfillError,
    isSuperAdmin,
    handleChange,
    handleCheckboxChange,
    handleBankChange,
    addBankAccount,
    removeBankAccount,
    handleSubmit,
    handleBackfill,
  }
}
