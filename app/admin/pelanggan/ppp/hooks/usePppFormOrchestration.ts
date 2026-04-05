import { useCallback, useEffect, useMemo, useState } from 'react'

import type { PppClientInfoTabFormData } from '@/app/admin/pelanggan/ppp/components/info/PppClientInfoTabSection'
import type { PppClientBillingPreferencesFormData } from '@/app/admin/pelanggan/ppp/components/package/PppClientBillingPreferencesSection'
import { calculatePppBilling, calculatePppDueDate, formatPppRupiah } from '@/app/admin/pelanggan/ppp/shared/billing'
import { applyPppClientFieldChange } from '@/app/admin/pelanggan/ppp/shared/form'

type HargaPaket = {
  id: string
  name: string
  harga: number
  durasi: number
  durasiUnit: 'JAM' | 'HARI' | 'BULAN' | 'TAHUN'
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE' | 'ISOLIR' | 'DISMANTLE'
  usePPN?: boolean
  ppnPercentage?: number | null
  useDiscount?: boolean
  discountType?: 'FIXED' | 'PERCENT' | null
  discountValue?: number | null
  discountDuration?: number | null
  discountDurationUnit?: 'JAM' | 'HARI' | 'BULAN' | 'TAHUN' | null
  profilePPP?: { id: string; name: string } | null
  bandwidth?: { id: string; name: string } | null
}

type BasePppFormData = PppClientInfoTabFormData & PppClientBillingPreferencesFormData & {
  idPelanggan: string
  username: string
  password: string
  passwordLogin: string
  hargaPaketId: string
  tipe: 'REGULER' | 'NON_REGULER'
  tanggalAktif: string
  jatuhTempo: string
  status: 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE' | 'ISOLIR' | 'DISMANTLE'
  autoIsolir: boolean
  latitude: number | null
  longitude: number | null
  odpId: string
  siteId: string | undefined
}

type UsePppFormOrchestrationOptions<T extends BasePppFormData> = {
  initialFormData: T
  hargaPakets: HargaPaket[]
  allowNonPositiveProrate: boolean
}

export function usePppFormOrchestration<T extends BasePppFormData>({
  initialFormData,
  hargaPakets,
  allowNonPositiveProrate,
}: UsePppFormOrchestrationOptions<T>) {
  const [formData, setFormData] = useState<T>(initialFormData)
  const [activeTab, setActiveTab] = useState<'paket' | 'info'>('paket')
  const [showPasswordLogin, setShowPasswordLogin] = useState(false)
  const [mounted] = useState(true)
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [jatuhTempoManuallyEdited, setJatuhTempoManuallyEdited] = useState(false)

  const calculateJatuhTempo = useCallback((tanggalAktif: string | undefined, hargaPaketId: string | undefined) => {
    return calculatePppDueDate(tanggalAktif, hargaPaketId, hargaPakets)
  }, [hargaPakets])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>, resetIdError?: () => void) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setFormData((prev) => {
      const result = applyPppClientFieldChange({
        prev,
        name,
        value,
        checked,
        type,
        calculateJatuhTempo,
      })

      if (result.shouldMarkManualDueDate) {
        setJatuhTempoManuallyEdited(true)
      }

      if (result.shouldResetManualDueDate) {
        setJatuhTempoManuallyEdited(false)
      }

      if (result.shouldResetIdError && resetIdError) {
        resetIdError()
      }

      return result.updated as T
    })
  }

  useEffect(() => {
    if (!jatuhTempoManuallyEdited && formData.tanggalAktif && formData.hargaPaketId && hargaPakets.length > 0) {
      const jatuhTempo = calculateJatuhTempo(formData.tanggalAktif, formData.hargaPaketId)
      if (jatuhTempo) {
        const timeoutId = setTimeout(() => {
          setFormData((prev) => ({ ...prev, jatuhTempo }))
        }, 0)
        return () => clearTimeout(timeoutId)
      }
    }
  }, [formData.hargaPaketId, formData.tanggalAktif, calculateJatuhTempo, jatuhTempoManuallyEdited, hargaPakets.length])

  const totalInfo = useMemo(() => {
    return calculatePppBilling(formData, hargaPakets, { allowNonPositiveProrate })
  }, [formData, hargaPakets, allowNonPositiveProrate])

  const updateBillingPreferencesFormData = useCallback((updater: (prev: PppClientBillingPreferencesFormData) => Partial<PppClientBillingPreferencesFormData>) => {
    setFormData((prev) => ({
      ...prev,
      ...updater(prev),
    }))
  }, [])

  const updateInfoTabFormData = useCallback((updater: (prev: PppClientInfoTabFormData) => Partial<PppClientInfoTabFormData>) => {
    setFormData((prev) => ({
      ...prev,
      ...updater(prev),
    }))
  }, [])

  return {
    formData,
    setFormData,
    activeTab,
    setActiveTab,
    showPasswordLogin,
    setShowPasswordLogin,
    mounted,
    showMapPicker,
    setShowMapPicker,
    jatuhTempoManuallyEdited,
    setJatuhTempoManuallyEdited,
    calculateJatuhTempo,
    handleChange,
    totalInfo,
    formatRupiah: formatPppRupiah,
    updateBillingPreferencesFormData,
    updateInfoTabFormData,
  }
}
