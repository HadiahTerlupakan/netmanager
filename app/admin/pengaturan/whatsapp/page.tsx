"use client"

import { useState, useEffect } from 'react'
import {
    HiOutlineCog6Tooth,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineArrowPath,
} from 'react-icons/hi2'

interface WhatsAppSettings {
    whatsappProvider: 'WABLAS' | 'FONNTE' | 'OFFICIAL'
    whatsappApiKey: string
    whatsappDeviceId: string
    whatsappDomain: string
}

const PROVIDERS = [
    { id: 'WABLAS', name: 'Wablas', enabled: true },
    { id: 'FONNTE', name: 'Fonnte', enabled: true },
    { id: 'OFFICIAL', name: 'Official WhatsApp Business API', enabled: false }
]

export default function WhatsAppSettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [settings, setSettings] = useState<WhatsAppSettings>({
        whatsappProvider: 'WABLAS',
        whatsappApiKey: '',
        whatsappDeviceId: '',
        whatsappDomain: ''
    })
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/admin/settings/whatsapp')
            if (response.ok) {
                const data = await response.json()
                setSettings({
                    whatsappProvider: data.whatsappProvider || 'WABLAS',
                    whatsappApiKey: data.whatsappApiKey || '',
                    whatsappDeviceId: data.whatsappDeviceId || '',
                    whatsappDomain: data.whatsappDomain || ''
                })
            }
        } catch (error) {
            console.error('Error fetching WhatsApp settings:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        try {
            setSaving(true)
            setError(null)
            setSuccess(false)

            const response = await fetch('/api/admin/settings/whatsapp', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            })

            if (response.ok) {
                setSuccess(true)
                setTimeout(() => setSuccess(false), 3000)
                fetchSettings()
            } else {
                const errorData = await response.json()
                setError(errorData.error || 'Failed to save settings')
            }
        } catch (error: any) {
            console.error('Error saving settings:', error)
            setError(error.message || 'Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    const handleTest = async () => {
        try {
            setTesting(true)
            setError(null)

            const testPhone = prompt('Masukkan nomor WhatsApp untuk test (contoh: 628123456789):')
            if (!testPhone) {
                setTesting(false)
                return
            }

            const response = await fetch('/api/admin/settings/whatsapp/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: testPhone })
            })

            const result = await response.json()

            if (result.success) {
                alert('✅ Test message sent successfully!\n\nCheck your WhatsApp.')
            } else {
                alert(`❌ Test failed!\n\n${result.message}`)
            }
        } catch (error: any) {
            console.error('Error testing WhatsApp:', error)
            alert('Error testing WhatsApp')
        } finally {
            setTesting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <HiOutlineArrowPath className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                    <div className="text-gray-500">Loading...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
            {/* Header */}
            <div className="max-w-4xl mx-auto mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <HiOutlineCog6Tooth className="w-8 h-8 text-blue-600" />
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        WhatsApp API Configuration
                    </h1>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                    Configure WhatsApp Business API for sending invoices and notifications
                </p>
            </div>

            {/* Success/Error Messages */}
            {success && (
                <div className="max-w-4xl mx-auto mb-6">
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
                        <HiOutlineCheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                        <span className="text-green-800 dark:text-green-200">Settings saved successfully!</span>
                    </div>
                </div>
            )}

            {error && (
                <div className="max-w-4xl mx-auto mb-6">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
                        <HiOutlineXCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        <span className="text-red-800 dark:text-red-200">{error}</span>
                    </div>
                </div>
            )}

            {/* Configuration Card */}
            <div className="max-w-4xl mx-auto">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 space-y-6">
                    {/* Provider Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            WhatsApp Provider *
                        </label>
                        <select
                            value={settings.whatsappProvider}
                            onChange={(e) => setSettings({ ...settings, whatsappProvider: e.target.value as any })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {PROVIDERS.map(provider => (
                                <option
                                    key={provider.id}
                                    value={provider.id}
                                    disabled={!provider.enabled}
                                >
                                    {provider.name} {!provider.enabled && '(Coming Soon)'}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Choose your WhatsApp Business API provider
                        </p>
                    </div>

                    {/* Wablas Configuration */}
                    {settings.whatsappProvider === 'WABLAS' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Wablas Domain *
                                </label>
                                <input
                                    type="text"
                                    value={settings.whatsappDomain}
                                    onChange={(e) => setSettings({ ...settings, whatsappDomain: e.target.value })}
                                    placeholder="console.wablas.com or yourdomain.wablas.id"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Your Wablas domain from dashboard (without https://)
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Device ID / Token
                                </label>
                                <input
                                    type="text"
                                    value={settings.whatsappDeviceId}
                                    onChange={(e) => setSettings({ ...settings, whatsappDeviceId: e.target.value })}
                                    placeholder="Enter your device ID or token (optional)"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Found in Wablas dashboard under Device Settings
                                </p>
                            </div>
                        </>
                    )}

                    {/* API Key (for all providers) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            API Key / Token *
                        </label>
                        <input
                            type="text"
                            value={settings.whatsappApiKey}
                            onChange={(e) => setSettings({ ...settings, whatsappApiKey: e.target.value })}
                            placeholder={settings.whatsappProvider === 'WABLAS' ? 'Enter Wablas API token' : 'Enter Fonnte API token'}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {settings.whatsappProvider === 'WABLAS'
                                ? 'Your Wablas API token from dashboard'
                                : 'Your Fonnte API token from dashboard'
                            }
                        </p>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h3 className="font-medium text-blue-900 dark:text-blue-400 mb-2">
                            📱 {settings.whatsappProvider === 'WABLAS' ? 'Wablas' : 'Fonnte'} Setup Guide:
                        </h3>
                        {settings.whatsappProvider === 'WABLAS' ? (
                            <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
                                <li>Register at: <a href="https://wablas.com" target="_blank" rel="noopener noreferrer" className="underline">wablas.com</a></li>
                                <li>Connect your WhatsApp Business number</li>
                                <li>Get your Domain from dashboard (e.g., console.wablas.com)</li>
                                <li>Get Device ID from Device Settings (optional)</li>
                                <li>Generate API Token from API Settings</li>
                                <li>Paste credentials above and test</li>
                            </ol>
                        ) : (
                            <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
                                <li>Register at: <a href="https://fonnte.com" target="_blank" rel="noopener noreferrer" className="underline">fonnte.com</a></li>
                                <li>Connect your WhatsApp number</li>
                                <li>Get API Token from dashboard</li>
                                <li>Paste token above and test</li>
                            </ol>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={handleTest}
                            disabled={testing || !settings.whatsappApiKey}
                            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            {testing ? (
                                <>
                                    <HiOutlineArrowPath className="w-4 h-4 animate-spin" />
                                    Testing...
                                </>
                            ) : (
                                <>
                                    Test WhatsApp
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !settings.whatsappApiKey}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <HiOutlineArrowPath className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <HiOutlineCheckCircle className="w-4 h-4" />
                                    Save Configuration
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
