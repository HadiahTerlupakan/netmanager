import { useCallback, useEffect, useState } from 'react'

import { buildProfilePppPayload, createInitialProfilePppFormData, mapProfilePppToFormData, splitIpRange } from '@/app/admin/paket/profileppp/lib/profilePppHelpers'
import type { Bandwidth, MikroTikRouter, ProfilePPP, ProfilePppFormData } from '@/app/admin/paket/profileppp/lib/profilePppTypes'

export function useProfilePppPageState() {
  const [loading, setLoading] = useState(true)
  const [siteId, setSiteId] = useState<string | undefined>(undefined)
  const [profilePPPs, setProfilePPPs] = useState<ProfilePPP[]>([])
  const [mikroTikRouters, setMikroTikRouters] = useState<MikroTikRouter[]>([])
  const [bandwidths, setBandwidths] = useState<Bandwidth[]>([])
  const [pppConnectionMode, setPppConnectionMode] = useState<'RADIUS' | 'MIKROTIK_API'>('RADIUS')
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<ProfilePPP | null>(null)
  const [formData, setFormData] = useState<ProfilePppFormData>(createInitialProfilePppFormData())

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams()
      if (siteId) queryParams.append('siteId', siteId)

      const [profilePPPsRes, routersRes, bandwidthsRes, settingsRes] = await Promise.all([
        fetch(`/api/profileppps?${queryParams.toString()}`),
        fetch('/api/mikrotik-routers'),
        fetch(`/api/bandwidths?${queryParams.toString()}`),
        fetch('/api/settings/general'),
      ])

      if (!profilePPPsRes.ok) {
        let errorMessage = `Gagal memuat data profile PPP: ${profilePPPsRes.status}`
        try {
          const errorData = await profilePPPsRes.json()
          if (errorData && typeof errorData === 'object' && 'error' in errorData) {
            errorMessage = errorData.error || errorMessage
          }
        } catch (_e: unknown) {
          errorMessage = `Gagal memuat data profile PPP: ${profilePPPsRes.status} ${profilePPPsRes.statusText || ''}`
        }
        throw new Error(errorMessage)
      }

      const profilePPPsData = await profilePPPsRes.json()
      const routersData = routersRes.ok ? await routersRes.json() : { routers: [] }
      const bandwidthsData = bandwidthsRes.ok ? await bandwidthsRes.json() : { data: [] }
      const settingsJson = settingsRes.ok ? await settingsRes.json() : { data: { pppConnectionMode: 'RADIUS' } }
      const settingsData = settingsJson.data || settingsJson

      setProfilePPPs(profilePPPsData.data || profilePPPsData || [])
      setMikroTikRouters(routersData.data?.routers || routersData.routers || [])
      setBandwidths(bandwidthsData.data || [])
      const pppMode = settingsData.pppConnectionMode || 'RADIUS'
      setPppConnectionMode(pppMode)
      if (pppMode !== 'RADIUS') {
        setFormData((prev) => ({ ...prev, poolMode: 'MIKROTIK' }))
      }
      setError(null)
    } catch (error: unknown) {
      console.error('Error loading data:', error)
      setError(error instanceof Error ? error.message : 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [siteId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const url = editingProfile ? `/api/profileppps/${editingProfile.id}` : '/api/profileppps'
      const method = editingProfile ? 'PUT' : 'POST'
      const cleanedData = buildProfilePppPayload(formData, pppConnectionMode)
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanedData),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Gagal menyimpan profile PPP')
      }

      await loadData()
      handleCloseModal()
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Terjadi kesalahan')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus profile PPP ini?')) return
    try {
      const res = await fetch(`/api/profileppps/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Gagal menghapus profile PPP')
        return
      }
      await loadData()
    } catch (error) {
      console.error('Error deleting profile PPP:', error)
      alert('Terjadi kesalahan saat menghapus profile PPP')
    }
  }

  const handleEdit = async (profile: ProfilePPP) => {
    setEditingProfile(profile)
    let ipRangeStart = ''
    let ipRangeEnd = ''
    try {
      const detailRes = await fetch(`/api/profileppps/${profile.id}`)
      if (detailRes.ok) {
        const detailData = await detailRes.json()
        const splitRange = splitIpRange(detailData.ipRange)
        ipRangeStart = splitRange.ipRangeStart
        ipRangeEnd = splitRange.ipRangeEnd
      }
    } catch (error: unknown) {
      console.error('Error fetching profile detail:', error)
    }

    setFormData(mapProfilePppToFormData(profile, ipRangeStart, ipRangeEnd))
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingProfile(null)
    setFormData(createInitialProfilePppFormData())
  }

  const handleFormChange = <K extends keyof ProfilePppFormData>(field: K, value: ProfilePppFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return {
    loading,
    siteId,
    setSiteId,
    profilePPPs,
    mikroTikRouters,
    bandwidths,
    pppConnectionMode,
    error,
    isModalOpen,
    editingProfile,
    formData,
    handleSubmit,
    handleDelete,
    handleEdit,
    handleCloseModal,
    handleFormChange,
    openCreateModal: () => {
      setFormData((prev) => ({ ...prev, siteId: siteId || '' }))
      setIsModalOpen(true)
    },
  }
}
