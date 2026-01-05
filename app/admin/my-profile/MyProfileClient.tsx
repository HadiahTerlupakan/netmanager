'use client'

import { useState, useEffect, useRef } from 'react'
import { useToast } from '@/components/common/ToastProvider'
import { HiOutlineUser, HiOutlineCamera, HiOutlineLockClosed, HiOutlineEnvelope, HiOutlinePhone, HiOutlineBuildingOffice, HiOutlineMapPin, HiOutlineClock } from 'react-icons/hi2'
import { HiSave } from 'react-icons/hi'

interface ProfileData {
    id: string
    name: string | null
    email: string
    phone: string | null
    image: string | null
    workingHourMode: 'FIXED' | 'FLEXIBLE' | 'SHIFT'
    startWorkTime: string | null
    endWorkTime: string | null
    workDays: string | null
    departments: { id: string; name: string } | null
    sites: { id: string; name: string } | null
    role: { id: string; name: string } | null
}

export default function MyProfileClient() {
    const { show } = useToast()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    const [changingPassword, setChangingPassword] = useState(false)
    
    const [profile, setProfile] = useState<ProfileData | null>(null)
    const [editMode, setEditMode] = useState(false)
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    
    // Edit form state
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    
    // Password form state
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        fetchProfile()
    }, [])

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/admin/profile')
            const data = await res.json()
            if (data.success) {
                setProfile(data.data)
                setName(data.data.name || '')
                setPhone(data.data.phone || '')
            }
        } catch (error) {
            show({ type: 'error', message: 'Gagal memuat profil' })
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/admin/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone })
            })
            const data = await res.json()
            if (data.success) {
                setProfile(prev => prev ? { ...prev, name, phone } : null)
                setEditMode(false)
                show({ type: 'success', message: 'Profil berhasil diperbarui' })
            } else {
                show({ type: 'error', message: data.error || 'Gagal menyimpan' })
            }
        } catch (error) {
            show({ type: 'error', message: 'Gagal menyimpan profil' })
        } finally {
            setSaving(false)
        }
    }

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadingPhoto(true)
        try {
            const formData = new FormData()
            formData.append('photo', file)

            const res = await fetch('/api/admin/profile/photo', {
                method: 'POST',
                body: formData
            })
            const data = await res.json()
            if (data.success) {
                setProfile(prev => prev ? { ...prev, image: data.data.image } : null)
                show({ type: 'success', message: 'Foto berhasil diperbarui' })
            } else {
                show({ type: 'error', message: data.error || 'Gagal upload foto' })
            }
        } catch (error) {
            show({ type: 'error', message: 'Gagal upload foto' })
        } finally {
            setUploadingPhoto(false)
        }
    }

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            show({ type: 'error', message: 'Password baru dan konfirmasi tidak cocok' })
            return
        }
        if (newPassword.length < 6) {
            show({ type: 'error', message: 'Password minimal 6 karakter' })
            return
        }

        setChangingPassword(true)
        try {
            const res = await fetch('/api/admin/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
            })
            const data = await res.json()
            if (data.success) {
                setShowPasswordModal(false)
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
                show({ type: 'success', message: 'Password berhasil diubah' })
            } else {
                show({ type: 'error', message: data.error || 'Gagal mengubah password' })
            }
        } catch (error) {
            show({ type: 'error', message: 'Gagal mengubah password' })
        } finally {
            setChangingPassword(false)
        }
    }

    const getInitials = (name?: string | null) => {
        if (!name) return 'U'
        return name.charAt(0).toUpperCase()
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto p-6">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Profil Saya</h1>

            {/* Profile Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Header with Avatar */}
                <div className="bg-linear-to-r from-blue-600 to-blue-700 px-6 py-8">
                    <div className="flex items-center gap-6">
                        <div className="relative">
                            {profile?.image ? (
                                <img 
                                    src={profile.image} 
                                    alt="Profile" 
                                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center border-4 border-white shadow-lg">
                                    <span className="text-blue-600 text-3xl font-bold">
                                        {getInitials(profile?.name)}
                                    </span>
                                </div>
                            )}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingPhoto}
                                className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-lg hover:bg-gray-50 transition-colors"
                            >
                                {uploadingPhoto ? (
                                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <HiOutlineCamera className="w-4 h-4 text-gray-600" />
                                )}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                className="hidden"
                            />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">{profile?.name || 'User'}</h2>
                            <p className="text-blue-100">{profile?.email}</p>
                            {profile?.role && (
                                <span className="inline-block mt-2 px-3 py-1 bg-blue-500 text-white text-sm rounded-full">
                                    {profile.role.name}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Profile Info */}
                <div className="p-6 space-y-4">
                    {editMode ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Telepon</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                >
                                    <HiSave className="w-4 h-4" />
                                    {saving ? 'Menyimpan...' : 'Simpan'}
                                </button>
                                <button
                                    onClick={() => {
                                        setEditMode(false)
                                        setName(profile?.name || '')
                                        setPhone(profile?.phone || '')
                                    }}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                >
                                    Batal
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-4 py-3 border-b border-gray-100">
                                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                                    <HiOutlineEnvelope className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Email</p>
                                    <p className="font-medium">{profile?.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 py-3 border-b border-gray-100">
                                <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                                    <HiOutlinePhone className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Telepon</p>
                                    <p className="font-medium">{profile?.phone || '-'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 py-3 border-b border-gray-100">
                                <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center">
                                    <HiOutlineBuildingOffice className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Department</p>
                                    <p className="font-medium">{profile?.departments?.name || '-'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 py-3 border-b border-gray-100">
                                <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
                                    <HiOutlineMapPin className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Site</p>
                                    <p className="font-medium">{profile?.sites?.name || '-'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 py-3">
                                <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center">
                                    <HiOutlineClock className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Jam Kerja</p>
                                    <p className="font-medium">
                                        {profile?.workingHourMode === 'FLEXIBLE' ? 'Fleksibel' : 
                                         `${profile?.startWorkTime || '09:00'} - ${profile?.endWorkTime || '17:00'}`}
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Action Buttons */}
                {!editMode && (
                    <div className="px-6 pb-6 flex gap-3">
                        <button
                            onClick={() => setEditMode(true)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                        >
                            <HiOutlineUser className="w-5 h-5" />
                            Edit Profil
                        </button>
                        <button
                            onClick={() => setShowPasswordModal(true)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                        >
                            <HiOutlineLockClosed className="w-5 h-5" />
                            Ganti Password
                        </button>
                    </div>
                )}
            </div>

            {/* Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                        <h3 className="text-lg font-bold mb-4">Ganti Password</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password Lama</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={handleChangePassword}
                                disabled={changingPassword}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {changingPassword ? 'Menyimpan...' : 'Simpan'}
                            </button>
                            <button
                                onClick={() => {
                                    setShowPasswordModal(false)
                                    setCurrentPassword('')
                                    setNewPassword('')
                                    setConfirmPassword('')
                                }}
                                className="flex-1 px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
                            >
                                Batal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
