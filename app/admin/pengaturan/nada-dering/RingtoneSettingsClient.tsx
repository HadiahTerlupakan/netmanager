'use client'

import { useState, useEffect, useRef } from 'react'
import { HiOutlineSpeakerWave, HiOutlinePlay, HiOutlinePause, HiOutlineTrash, HiOutlineCloudArrowUp } from 'react-icons/hi2'

export default function RingtoneSettingsClient() {
    const [enabled, setEnabled] = useState(true)
    const [soundType, setSoundType] = useState<'default' | 'custom'>('default')
    const [customSoundData, setCustomSoundData] = useState<string | null>(null)
    const [customSoundName, setCustomSoundName] = useState<string>('Custom Tone')
    const [isPlaying, setIsPlaying] = useState(false)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    // Load settings from localStorage on mount
    useEffect(() => {
        const storedEnabled = localStorage.getItem('chat_sound_enabled')
        const storedType = localStorage.getItem('chat_sound_type')
        const storedData = localStorage.getItem('chat_custom_sound_data')
        const storedName = localStorage.getItem('chat_custom_sound_name')

        if (storedEnabled !== null) setEnabled(storedEnabled === 'true')
        if (storedType) setSoundType(storedType as 'default' | 'custom')
        if (storedData) setCustomSoundData(storedData)
        if (storedName) setCustomSoundName(storedName)
    }, [])

    // Ensure audio cleanup
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause()
                audioRef.current = null
            }
        }
    }, [])

    const saveSettings = (newEnabled: boolean, newType: 'default' | 'custom', newData: string | null, newName: string) => {
        localStorage.setItem('chat_sound_enabled', String(newEnabled))
        localStorage.setItem('chat_sound_type', newType)
        if (newData) {
            localStorage.setItem('chat_custom_sound_data', newData)
            localStorage.setItem('chat_custom_sound_name', newName)
        } else if (newType === 'default') {
            // Optional: clear custom data if switching to default? 
            // Better keep it in case user switches back, unless explicitly deleted
        }
    }

    const handleEnableToggle = () => {
        const newVal = !enabled
        setEnabled(newVal)
        localStorage.setItem('chat_sound_enabled', String(newVal))
    }

    const handleTypeChange = (type: 'default' | 'custom') => {
        setSoundType(type)
        localStorage.setItem('chat_sound_type', type)
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Max 500KB to respect LocalStorage limits and performance
        if (file.size > 500 * 1024) {
            alert('File terlalu besar. Maksimal 500KB.')
            return
        }

        if (!file.type.startsWith('audio/')) {
            alert('Format file harus audio (mp3/wav).')
            return
        }

        const reader = new FileReader()
        reader.onloadend = () => {
            const base64 = reader.result as string
            setCustomSoundData(base64)
            setCustomSoundName(file.name)
            setSoundType('custom') // Auto switch to custom
            
            localStorage.setItem('chat_custom_sound_data', base64)
            localStorage.setItem('chat_custom_sound_name', file.name)
            localStorage.setItem('chat_sound_type', 'custom')
        }
        reader.readAsDataURL(file)
    }

    const handleDeleteCustom = () => {
        setCustomSoundData(null)
        setCustomSoundName('Custom Tone')
        localStorage.removeItem('chat_custom_sound_data')
        localStorage.removeItem('chat_custom_sound_name')
        if (soundType === 'custom') {
            setSoundType('default')
            localStorage.setItem('chat_sound_type', 'default')
        }
    }

    const playSound = async (src: string) => {
        if (audioRef.current) {
            audioRef.current.pause()
            audioRef.current = null
            setIsPlaying(false)
        }

        try {
            let audioSrc = src
            
            // Convert Data URI to Blob manually (fetch fails on large data URIs)
            if (src.startsWith('data:')) {
                try {
                    const base64ToBlob = (dataURI: string) => {
                        const split = dataURI.split(',')
                        const data = split[1] || ''
                        const byteString = atob(data)
                        const mimeString = (split[0] ?? '').split(':')[1]?.split(';')[0] ?? 'application/octet-stream'
                        const ab = new ArrayBuffer(byteString.length)
                        const ia = new Uint8Array(ab)
                        for (let i = 0; i < byteString.length; i++) {
                            ia[i] = byteString.charCodeAt(i)
                        }
                        return new Blob([ab], { type: mimeString })
                    }
                    
                    const blob = base64ToBlob(src)
                    audioSrc = URL.createObjectURL(blob)
                } catch (e) {
                    console.error('Blob conversion failed:', e)
                }
            }

            const audio = new Audio(audioSrc)
            audioRef.current = audio
            
            audio.onended = () => {
                setIsPlaying(false)
                if (src.startsWith('data:audio') && audioSrc !== src) {
                    URL.revokeObjectURL(audioSrc) // Cleanup blob
                }
            }
            
            audio.onerror = (e) => {
                console.error('Audio play error', e)
                console.error('Audio Source Length:', src.length)
                
                let msg = 'Gagal memutar audio.'
                if (audio.error) {
                    switch (audio.error.code) {
                        case 1: msg += ' (Aborted)'; break;
                        case 2: msg += ' (Network Error)'; break;
                        case 3: msg += ' (Decode Error)'; break;
                        case 4: msg += ' (Source Not Supported)'; break;
                        default: msg += ` (Code: ${audio.error.code})`;
                    }
                }
                setIsPlaying(false)
                alert(`${msg}\nCek console untuk detail.`)
            }
            
            setIsPlaying(true)
            await audio.play()
        } catch (e: any) {
            console.error('Audio init/play catch:', e)
            setIsPlaying(false)
            alert('Gagal memproses audio: ' + e.message)
        }
    }

    const handlePreview = () => {
        if (isPlaying) {
            if (audioRef.current) audioRef.current.pause()
            setIsPlaying(false)
            return
        }

        if (soundType === 'default') {
            playSound('/sounds/notification.mp3')
        } else {
            if (customSoundData) {
                playSound(customSoundData)
            } else {
                alert('Belum ada file custom yang diupload.')
            }
        }
    }

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
                        <HiOutlineSpeakerWave className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Pengaturan Nada Dering</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Atur preferensi suara notifikasi chat Anda.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Master Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">Suara Notifikasi</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Aktifkan efek suara saat ada pesan masuk</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={enabled}
                                onChange={handleEnableToggle}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    {/* Sound Selection */}
                    <div className={`space-y-4 ${!enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Pilihan Nada</h3>
                        
                        {/* Default Option */}
                        <div 
                            className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${soundType === 'default' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                            onClick={() => handleTypeChange('default')}
                        >
                            <div className="flex items-center gap-3">
                                <input 
                                    type="radio" 
                                    checked={soundType === 'default'} 
                                    onChange={() => handleTypeChange('default')}
                                    className="text-indigo-600 focus:ring-indigo-500"
                                />
                                <div>
                                    <span className="block font-medium text-gray-900 dark:text-white">Default System</span>
                                    <span className="text-sm text-gray-500 dark:text-gray-400">Nada standar aplikasi (/sounds/notification.mp3)</span>
                                </div>
                            </div>
                        </div>

                        {/* Custom Option */}
                        <div 
                            className={`p-4 border rounded-lg transition-colors ${soundType === 'custom' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-gray-700'}`}
                        >
                            <div 
                                className="flex items-center justify-between cursor-pointer mb-3"
                                onClick={() => handleTypeChange('custom')}
                            >
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="radio" 
                                        checked={soundType === 'custom'} 
                                        onChange={() => handleTypeChange('custom')}
                                        className="text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <div>
                                        <span className="block font-medium text-gray-900 dark:text-white">Custom Upload</span>
                                        <span className="text-sm text-gray-500 dark:text-gray-400">Gunakan file audio pilihan Anda</span>
                                    </div>
                                </div>
                            </div>

                            {/* Upload Area - Show if custom selected */}
                            {soundType === 'custom' && (
                                <div className="ml-7 mt-2 space-y-3">
                                    {!customSoundData ? (
                                        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-indigo-500 transition-colors bg-white dark:bg-gray-800">
                                            <HiOutlineCloudArrowUp className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Klik untuk upload file MP3/WAV</p>
                                            <p className="text-xs text-gray-500">Maks. 500KB</p>
                                            <input 
                                                type="file" 
                                                accept="audio/*" 
                                                onChange={handleFileUpload}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center gap-3 truncate">
                                                <span className="text-2xl">🎵</span>
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[200px]">{customSoundName}</span>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteCustom(); }}
                                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                                                title="Hapus file"
                                            >
                                                <HiOutlineTrash className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Preview Button */}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                        <button
                            onClick={handlePreview}
                            disabled={!enabled || (soundType === 'custom' && !customSoundData)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                                isPlaying 
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300' 
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed'
                            }`}
                        >
                            {isPlaying ? <HiOutlinePause className="w-5 h-5" /> : <HiOutlinePlay className="w-5 h-5" />}
                            {isPlaying ? 'Stop Preview' : 'Test Bunyi'}
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="mt-4 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Pengaturan ini disimpan di browser Anda (LocalStorage) dan bersifat personal untuk perangkat ini.
                </p>
            </div>
        </div>
    )
}
