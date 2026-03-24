'use client'
import Image from 'next/image';

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/use-toast'
import { HiOutlineUser, HiOutlineCamera, HiOutlineLockClosed, HiOutlineEnvelope, HiOutlinePhone, HiOutlineBuildingOffice, HiOutlineMapPin, HiOutlineClock } from 'react-icons/hi2'
import { HiSave } from 'react-icons/hi'
import { MdTimer } from 'react-icons/md'
import { fetchWithHandling, isFetchError, formatErrorMessage } from '@/lib/utils/fetch-wrapper'
import { validateRequired, validateLength } from '@/lib/utils/validation'
import { Modal, ModalFooter } from '@/components/ui/Modal'

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
    const { showToast } = useToast()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploadingPhoto, setUploadingPhoto] = useState(false)
    const [changingPassword, setChangingPassword] = useState(false)
    const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
    
    const [profile, setProfile] = useState<ProfileData | null>(null)
    const [editMode, setEditMode] = useState(false)
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    
    // Edit form state
    const [name, setName] = useState('')
    const [phone, setPhone] = useState('')
    const [editErrors, setEditErrors] = useState<Record<string, string>>({})
    
    // Password form state
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
    
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Handle rate limit countdown
    useEffect(() => {
        if (retryCountdown !== null && retryCountdown > 0) {
            const timer = setTimeout(() => setRetryCountdown(retryCountdown - 1), 1000)
            return () => clearTimeout(timer)
        } else if (retryCountdown === 0) {
            setRetryCountdown(null)
        }
    }, [retryCountdown])

    const fetchProfile = useCallback(async () => {
        // No AbortController needed for simple profile fetch, but we'll add standard error handling check
        try {
            const response = await fetchWithHandling<ProfileData>('/api/admin/profile')
            if (response.data) {
                setProfile(response.data)
                setName(response.data.name || '')
                setPhone(response.data.phone || '')
            }
        } catch (error) {
            if (isFetchError(error)) {
                showToast('error', formatErrorMessage(error))
            }
        } finally {
            setLoading(false)
        }
    }, [showToast])

    useEffect(() => {
        fetchProfile()
    }, [fetchProfile])

    const handleSave = async () => {
        // Validate
        const errors: Record<string, string> = {}
        const nameValid = validateRequired(name, 'Nama')
        if (!nameValid.valid) errors.name = nameValid.error!
        
        const nameLength = validateLength(name, 3, 50, 'Nama')
        if (!nameLength.valid) errors.name = nameLength.error!

        if (Object.keys(errors).length > 0) {
            setEditErrors(errors)
            return
        }

        setSaving(true)
        try {
            await fetchWithHandling('/api/admin/profile', {
                method: 'PATCH',
                body: JSON.stringify({ name, phone })
            })
            
            setProfile(prev => prev ? { ...prev, name, phone } : null)
            setEditMode(false)
            setEditErrors({})
            showToast('success', 'Profil Anda telah diperbarui')
        } catch (error) {
            if (isFetchError(error)) {
                if (error.retryAfter) setRetryCountdown(error.retryAfter)
                showToast('error', formatErrorMessage(error))
            }
        } finally {
            setSaving(false)
        }
    }

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Basic frontend file validation
        if (file.size > 2 * 1024 * 1024) {
            showToast('error', 'Ukuran foto maksimal adalah 2MB')
            return
        }

        setUploadingPhoto(true)
        try {
            const formData = new FormData()
            formData.append('photo', file)

            const response = await fetchWithHandling<{ image: string }>('/api/admin/profile/photo', {
                method: 'POST',
                body: formData
            })
            
            if (response.data) {
                setProfile(prev => prev ? { ...prev, image: response.data!.image } : null)
                showToast('success', 'Foto profil telah diperbarui')
            }
        } catch (error) {
            if (isFetchError(error)) {
                showToast('error', formatErrorMessage(error))
            }
        } finally {
            setUploadingPhoto(false)
        }
    }

    const handleChangePassword = async () => {
        const errors: Record<string, string> = {}
        
        if (!currentPassword) errors.currentPassword = 'Password lama wajib diisi'
        
        const passLen = validateLength(newPassword, 8, 32, 'Password baru')
        if (!passLen.valid) errors.newPassword = passLen.error!
        
        if (newPassword !== confirmPassword) {
            errors.confirmPassword = 'Konfirmasi password tidak cocok'
        }

        if (Object.keys(errors).length > 0) {
            setPasswordErrors(errors)
            return
        }

        setChangingPassword(true)
        try {
            await fetchWithHandling('/api/admin/profile', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
            })
            
            setShowPasswordModal(false)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
            setPasswordErrors({})
            showToast('success', 'Password Anda telah berhasil diubah')
        } catch (error) {
            if (isFetchError(error)) {
                if (error.retryAfter) setRetryCountdown(error.retryAfter)
                showToast('error', formatErrorMessage(error))
            }
        } finally {
            setChangingPassword(false)
        }
    }

    const getInitials = (name?: string | null) => {
        if (!name) return 'U'
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
    }

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-96 gap-4">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"></div>
                <p className="text-gray-500 animate-pulse">Memuat data profil...</p>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Profil Saya</h1>

            {/* Rate Limit Warning */}
            {retryCountdown !== null && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3 dark:bg-yellow-900/20 dark:border-yellow-800">
                    <MdTimer className="text-yellow-600 text-xl" />
                    <div>
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">Terlalu Banyak Permintaan</p>
                        <p className="text-sm text-yellow-600 dark:text-yellow-400">
                            Mohon tunggu {retryCountdown} detik sebelum mencoba lagi...
                        </p>
                    </div>
                </div>
            )}

            {/* Profile Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Header with Avatar */}
                <div className="bg-linear-to-r from-blue-600 to-blue-700 px-6 py-8">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center border-4 border-white dark:border-gray-800 shadow-lg overflow-hidden shrink-0">
                                {profile?.image ? (
                                    <Image width={96} height={96} src={profile.image} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-blue-600 dark:text-blue-400 text-3xl font-bold">
                                        {getInitials(profile?.name)}
                                    </span>
                                )}
                            </div>
                            <Button onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingPhoto}
                                className="absolute bottom-0 right-0 bg-white dark:bg-gray-600 rounded-full p-2 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors ring-2 ring-blue-600"
                                title="Ganti Foto"
                            >
                                {uploadingPhoto ? (
                                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <HiOutlineCamera className="w-4 h-4 text-gray-600 dark:text-gray-200" />
                                )}
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                className="hidden"
                            />
                        </div>
                        <div className="text-center sm:text-left">
                            <h2 className="text-2xl font-bold text-white">{profile?.name || 'User'}</h2>
                            <p className="text-blue-100 opacity-90">{profile?.email}</p>
                            {profile?.role && (
                                <span className="inline-block mt-2 px-3 py-1 bg-white/20 backdrop-blur-md text-white text-xs font-semibold rounded-full border border-white/30">
                                    {profile.role.name}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Profile Info */}
                <div className="p-6 space-y-4">
                    {editMode ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Lengkap</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value)
                                        if (editErrors.name) setEditErrors({ ...editErrors, name: '' })
                                    }}
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${editErrors.name ? 'border-red-500' : 'border-gray-300'}`}
                                />
                                {editErrors.name && <p className="text-xs text-red-500 mt-1">{editErrors.name}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nomor Telepon / WhatsApp</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Contoh: 08123456789"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                />
                            </div>
                            <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
                                <Button onClick={handleSave}
                                    disabled={saving || retryCountdown !== null}
                                    
                                >
                                    <HiSave className="w-4 h-4" />
                                    {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                                </Button>
                                <Button onClick={() => {
                                        setEditMode(false)
                                        setEditErrors({})
                                        setName(profile?.name || '')
                                        setPhone(profile?.phone || '')
                                    }}
                                    className="px-6 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
                                >
                                    Batal
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                            <InfoItem 
                                icon={<HiOutlineEnvelope className="w-5 h-5 text-blue-600" />}
                                label="Alamat Email"
                                value={profile?.email ?? null}
                                bgColor="bg-blue-50"
                            />
                            <InfoItem 
                                icon={<HiOutlinePhone className="w-5 h-5 text-green-600" />}
                                label="Nomor Telepon"
                                value={profile?.phone || 'Belum diatur'}
                                bgColor="bg-green-50"
                            />
                            <InfoItem 
                                icon={<HiOutlineBuildingOffice className="w-5 h-5 text-purple-600" />}
                                label="Departemen"
                                value={profile?.departments?.name || '-'}
                                bgColor="bg-purple-50"
                            />
                            <InfoItem 
                                icon={<HiOutlineMapPin className="w-5 h-5 text-orange-600" />}
                                label="Site Kerja"
                                value={profile?.sites?.name || '-'}
                                bgColor="bg-orange-50"
                            />
                            <InfoItem 
                                icon={<HiOutlineClock className="w-5 h-5 text-amber-600" />}
                                label="Mode Jam Kerja"
                                value={profile?.workingHourMode === 'FLEXIBLE' ? 'Fleksibel' : 
                                       profile?.workingHourMode === 'SHIFT' ? 'Shift Kerja' :
                                       `${profile?.startWorkTime || '09:00'} - ${profile?.endWorkTime || '17:00'}`}
                                bgColor="bg-amber-50"
                            />
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                {!editMode && (
                    <div className="px-6 pb-6 pt-4 border-t dark:border-gray-700 flex flex-col sm:flex-row gap-3">
                        <Button onClick={() => setEditMode(true)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors font-semibold"
                        >
                            <HiOutlineUser className="w-5 h-5" />
                            Lengkapi Profil
                        </Button>
                        <Button onClick={() => setShowPasswordModal(true)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-semibold border border-gray-200 dark:border-gray-600"
                        >
                            <HiOutlineLockClosed className="w-5 h-5" />
                            Ganti Password
                        </Button>
                    </div>
                )}
            </div>

            {/* Password Modal */}
            <Modal
                isOpen={showPasswordModal}
                onClose={() => {
                    setShowPasswordModal(false)
                    setCurrentPassword('')
                    setNewPassword('')
                    setConfirmPassword('')
                    setPasswordErrors({})
                }}
                title="Ubah Password Keamanan"
                description="Pastikan password baru Anda kuat dan unik."
                size="md"
            >
                <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password Saat Ini</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => {
                                        setCurrentPassword(e.target.value)
                                        if (passwordErrors.currentPassword) setPasswordErrors({ ...passwordErrors, currentPassword: '' })
                                    }}
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${passwordErrors.currentPassword ? 'border-red-500' : 'border-gray-300'}`}
                                />
                                {passwordErrors.currentPassword && <p className="text-xs text-red-500 mt-1">{passwordErrors.currentPassword}</p>}
                            </div>
                            <div className="pt-2 border-t dark:border-gray-700">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password Baru</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => {
                                        setNewPassword(e.target.value)
                                        if (passwordErrors.newPassword) setPasswordErrors({ ...passwordErrors, newPassword: '' })
                                    }}
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${passwordErrors.newPassword ? 'border-red-500' : 'border-gray-300'}`}
                                />
                                {passwordErrors.newPassword && <p className="text-xs text-red-500 mt-1">{passwordErrors.newPassword}</p>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Konfirmasi Password Baru</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => {
                                        setConfirmPassword(e.target.value)
                                        if (passwordErrors.confirmPassword) setPasswordErrors({ ...passwordErrors, confirmPassword: '' })
                                    }}
                                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${passwordErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'}`}
                                />
                                {passwordErrors.confirmPassword && <p className="text-xs text-red-500 mt-1">{passwordErrors.confirmPassword}</p>}
                            </div>
                </div>
                <ModalFooter>
                            <Button onClick={() => {
                                    setShowPasswordModal(false)
                                    setCurrentPassword('')
                                    setNewPassword('')
                                    setConfirmPassword('')
                                    setPasswordErrors({})
                                }}
                                className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg font-medium"
                            >
                                Batal
                            </Button>
                            <Button onClick={handleChangePassword}
                                disabled={changingPassword || retryCountdown !== null}
                                 className="flex-1"
                            >
                                {changingPassword ? 'Memproses...' : 'Update Password'}
                            </Button>
                </ModalFooter>
            </Modal>
        </div>
    )
}

function InfoItem({ icon, label, value, bgColor }: { icon: React.ReactNode, label: string, value?: string | null, bgColor: string }) {
    return (
        <div className="flex items-start gap-4 py-3 group">
            <div className={`w-10 h-10 ${bgColor} dark:bg-gray-700 rounded-xl flex items-center justify-center shrink-0 shadow-xs group-hover:scale-110 transition-transform`}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">{label}</p>
                <p className="font-semibold text-gray-800 dark:text-gray-200 wrap-break-word">{value || '-'}</p>
            </div>
        </div>
    )
}
