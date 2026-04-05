"use client"

import { useEffect, useState } from 'react'

import { Modal } from '@/components/ui/Modal'

import { ProfileDetailContent } from '@/app/admin/paket/profileppp/components/ProfileDetailContent'
import type { ProfileDetail } from '@/app/admin/paket/profileppp/lib/profilePppTypes'

type ProfileDetailModalProps = {
  open: boolean
  onClose: () => void
  profileId: string | null
}

export default function ProfileDetailModal({ open, onClose, profileId }: ProfileDetailModalProps) {
  const [profile, setProfile] = useState<ProfileDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && profileId) {
      void loadDetail(profileId)
    } else {
      setProfile(null)
      setError(null)
    }
  }, [open, profileId])

  const loadDetail = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/profileppps/${id}`)
      if (!res.ok) throw new Error('Gagal memuat detail profile')
      const data = await res.json()
      setProfile(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Detail Profile PPP"
      size="2xl"
    >
      <ProfileDetailContent
        profile={profile}
        loading={loading}
        error={error}
      />
    </Modal>
  )
}
