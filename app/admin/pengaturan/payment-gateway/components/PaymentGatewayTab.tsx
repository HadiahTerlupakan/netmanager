"use client"

import { useState, useEffect } from 'react'
import {
    HiOutlineCog6Tooth,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineArrowPath,
    HiXMark,
    HiOutlineCreditCard,
} from 'react-icons/hi2'

const PROVIDERS = [
    { id: 'XENDIT', name: 'Xendit', logo: '🟢' },
    { id: 'MIDTRANS', name: 'Midtrans', logo: '🔵' },
    { id: 'DUITKU', name: 'Duitku', logo: '🟡' },
    { id: 'BRI', name: 'BRI API', logo: '🔷' },
    { id: 'BCA', name: 'BCA API', logo: '🔶' },
]

export default function PaymentGatewayTab() {
    const [configs, setConfigs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [formData, setFormData] = useState<any>({})
    const [testing, setTesting] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetchConfigs()
    }, [])

    const fetchConfigs = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/admin/payment-gateway/configs')
            if (response.ok) {
                const data = await response.json()
                setConfigs(data)
            }
        } catch (error) {
            console.error('Error fetching configs:', error)
        } finally {
            setLoading(false)
        }
    }

    const getProviderConfig = (providerId: string) => {
        return configs.find(c => c.provider === providerId)
    }

    const handleOpenModal = (providerId: string) => {
        const config = getProviderConfig(providerId)
        setSelectedProvider(providerId)
        setFormData({
            isProduction: config?.isProduction || false,
            priority: config?.priority || 1,
            apiKey: '',
            apiSecret: '',
            clientKey: config?.clientKey || '',
            merchantId: config?.merchantId || '',
        })
        setModalOpen(true)
    }

    const handleToggleEnabled = async (providerId: string, isEnabled: boolean) => {
        try {
            const response = await fetch(`/api/admin/payment-gateway/configs/${providerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isEnabled })
            })

            if (response.ok) {
                fetchConfigs()
            } else {
                alert('Failed to update provider status')
            }
        } catch (error) {
            console.error('Error toggling provider:', error)
            alert('Error updating provider')
        }
    }

    const handleTestConnection = async () => {
        if (!selectedProvider) return

        try {
            setTesting(true)
            const response = await fetch('/api/admin/payment-gateway/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: selectedProvider,
                    apiKey: formData.apiKey,
                    apiSecret: formData.apiSecret,
                    clientKey: formData.clientKey,
                    merchantId: formData.merchantId,
                    isProduction: formData.isProduction
                })
            })

            const result = await response.json()

            if (result.success) {
                alert(`✅ Connection successful!\n\n${result.message}`)
            } else {
                alert(`❌ Connection failed!\n\n${result.message}`)
            }
        } catch (error) {
            console.error('Error testing connection:', error)
            alert('Error testing connection')
        } finally {
            setTesting(false)
        }
    }

    const handleSave = async () => {
        if (!selectedProvider) return

        try {
            setSaving(true)
            const response = await fetch(`/api/admin/payment-gateway/configs/${selectedProvider}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (response.ok) {
                alert('Configuration saved successfully!')
                setModalOpen(false)
                fetchConfigs()
            } else {
                const error = await response.json()
                alert(`Failed to save: ${error.details || error.error}`)
            }
        } catch (error) {
            console.error('Error saving config:', error)
            alert('Error saving configuration')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <HiOutlineArrowPath className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                    <div className="text-gray-500">Loading...</div>
                </div>
            </div>
        )
    }

    return (
        <div>
            {/* Provider Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {PROVIDERS.map(provider => {
                    const config = getProviderConfig(provider.id)
                    const isEnabled = config?.isEnabled || false

                    return (
                        <div
                            key={provider.id}
                            className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border-2 border-transparent hover:border-blue-500 transition-all"
                        >
                            {/* Provider Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="text-4xl">{provider.logo}</div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                            {provider.name}
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {isEnabled ? 'Active' : 'Inactive'}
                                        </p>
                                    </div>
                                </div>

                                {/* Toggle */}
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isEnabled}
                                        onChange={(e) => handleToggleEnabled(provider.id, e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            {/* Config Details */}
                            {config && isEnabled && (
                                <div className="space-y-2 mb-4 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-gray-400">Mode:</span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {config.isProduction ? 'Production' : 'Sandbox'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-gray-400">Priority:</span>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {config.priority}
                                        </span>
                                    </div>
                                    {config.lastTestedAt && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500 dark:text-gray-400">Last Test:</span>
                                            <div className="flex items-center gap-1">
                                                {config.testStatus === 'SUCCESS' ? (
                                                    <HiOutlineCheckCircle className="w-4 h-4 text-green-600" />
                                                ) : (
                                                    <HiOutlineXCircle className="w-4 h-4 text-red-600" />
                                                )}
                                                <span className="text-xs">
                                                    {new Date(config.lastTestedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Configure Button */}
                            <button
                                onClick={() => handleOpenModal(provider.id)}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <HiOutlineCog6Tooth className="w-5 h-5" />
                                Configure
                            </button>
                        </div>
                    )
                })}
            </div>

            {/* Configuration Modal */}
            {modalOpen && selectedProvider && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                Configure {PROVIDERS.find(p => p.id === selectedProvider)?.name}
                            </h3>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                <HiXMark className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4">
                            {/* Environment Toggle */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                <div>
                                    <label className="font-medium text-gray-900 dark:text-white">Environment</label>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Choose sandbox for testing, production for live payments
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-sm ${!formData.isProduction ? 'font-bold text-orange-600' : 'text-gray-500'}`}>
                                        Sandbox
                                    </span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.isProduction}
                                            onChange={(e) => setFormData({ ...formData, isProduction: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                                    </label>
                                    <span className={`text-sm ${formData.isProduction ? 'font-bold text-green-600' : 'text-gray-500'}`}>
                                        Production
                                    </span>
                                </div>
                            </div>

                            {/* API Key */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    API Key / Server Key *
                                </label>
                                <input
                                    type="password"
                                    value={formData.apiKey}
                                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                                    placeholder="Enter API key"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                            </div>

                            {/* API Secret (Optional) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    API Secret (if applicable)
                                </label>
                                <input
                                    type="password"
                                    value={formData.apiSecret}
                                    onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                                    placeholder="Enter API secret"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                            </div>

                            {/* Client Key */}
                            {selectedProvider === 'MIDTRANS' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Client Key
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.clientKey}
                                        onChange={(e) => setFormData({ ...formData, clientKey: e.target.value })}
                                        placeholder="Enter client key"
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>
                            )}

                            {/* Merchant ID for Duitku */}
                            {selectedProvider === 'DUITKU' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Merchant Code *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.merchantId}
                                        onChange={(e) => setFormData({ ...formData, merchantId: e.target.value })}
                                        placeholder="Enter merchant code (e.g., D1234)"
                                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Your unique merchant code from Duitku dashboard
                                    </p>
                                </div>
                            )}

                            {/* Priority */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Priority: {formData.priority}
                                </label>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    value={formData.priority}
                                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                                    className="w-full"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    Higher priority = preferred for payments (1-10)
                                </p>
                            </div>

                            {/* Webhook URL (Read-only) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Webhook URL (Copy this to provider dashboard)
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={`${process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'}/api/payment/webhook/${selectedProvider.toLowerCase()}`}
                                        readOnly
                                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                                    />
                                    <button
                                        onClick={() => navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_APP_URL}/api/payment/webhook/${selectedProvider.toLowerCase()}`)}
                                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800">
                            <button
                                onClick={handleTestConnection}
                                disabled={testing || !formData.apiKey}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {testing ? 'Testing...' : 'Test Connection'}
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving || !formData.apiKey}
                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {saving ? 'Saving...' : 'Save Configuration'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
