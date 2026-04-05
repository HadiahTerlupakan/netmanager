"use client"

import { useState } from 'react'
import {
    HiOutlineCog6Tooth,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiCube
} from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { usePaymentGatewayConfigs } from '../hooks/usePaymentGatewayConfigs'
import type { PaymentGatewayFormPayload } from '../hooks/usePaymentGatewayConfigs'

const PROVIDERS = [
    { id: 'XENDIT', name: 'Xendit', icon: HiCube, color: 'text-green-500' },
    { id: 'MIDTRANS', name: 'Midtrans', icon: HiCube, color: 'text-blue-500' },
    { id: 'DUITKU', name: 'Duitku', icon: HiCube, color: 'text-yellow-500' },
    { id: 'TRIPAY', name: 'Tripay', icon: HiCube, color: 'text-purple-500' },
    { id: 'DANA', name: 'DANA', icon: HiCube, color: 'text-blue-400' },
    { id: 'BRI', name: 'BRI API', icon: HiCube, color: 'text-blue-600' },
    { id: 'BCA', name: 'BCA API', icon: HiCube, color: 'text-blue-700' },
    { id: 'MOOTA', name: 'Moota.co', icon: HiCube, color: 'text-teal-500' },
]

export default function PaymentGatewayTab() {
    const {
        configs,
        loading,
        saving,
        testing,
        toggleProvider,
        saveConfig,
        testConnection,
    } = usePaymentGatewayConfigs()
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
    const [modalOpen, setModalOpen] = useState(false)
    const [formData, setFormData] = useState<PaymentGatewayFormPayload>({
        isProduction: false,
        priority: 1,
        apiKey: '',
        apiSecret: '',
        clientKey: '',
        merchantId: '',
    })

    const getProviderConfig = (providerId: string) => configs.find(config => config.provider === providerId)
    const webhookBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yourdomain.com'
    const webhookUrl = `${webhookBaseUrl}/api/payment/webhook/${selectedProvider?.toLowerCase()}`

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
        const result = await toggleProvider(providerId, isEnabled)
        if (!result.success) {
            alert(result.message ?? 'Gagal mengupdate status provider')
        }
    }

    const handleTestConnection = async () => {
        if (!selectedProvider) return

        const result = await testConnection({
            provider: selectedProvider,
            ...formData,
        })

        if (result.success) {
            alert(`Koneksi berhasil!\n\n${result.message ?? 'Tidak ada detail tambahan.'}`)
        } else {
            alert(`Koneksi gagal!\n\n${result.message ?? 'Tidak ada detail tambahan.'}`)
        }
    }

    const handleSave = async () => {
        if (!selectedProvider) return

        const result = await saveConfig(selectedProvider, formData)

        if (result.success) {
            alert('Konfigurasi berhasil disimpan!')
            setModalOpen(false)
        } else {
            alert(`Gagal menyimpan: ${result.message ?? 'Tidak ada detail tambahan.'}`)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <PageLoader />
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
                                    <div className={`text-4xl ${provider.color}`}>
                                        <provider.icon className="w-10 h-10" />
                                    </div>
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
            <Modal
                isOpen={modalOpen && !!selectedProvider}
                onClose={() => setModalOpen(false)}
                title={`Configure ${PROVIDERS.find(p => p.id === selectedProvider)?.name}`}
                size="lg"
            >
                <div className="space-y-4">
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

                    {/* Merchant ID for Duitku, Tripay & DANA */}
                    {(selectedProvider === 'DUITKU' || selectedProvider === 'TRIPAY' || selectedProvider === 'DANA') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Merchant Code *
                            </label>
                            <input
                                type="text"
                                value={formData.merchantId}
                                onChange={(e) => setFormData({ ...formData, merchantId: e.target.value })}
                                placeholder="Enter merchant code"
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Your unique merchant code from {
                                    selectedProvider === 'TRIPAY' ? 'Tripay' :
                                        selectedProvider === 'DANA' ? 'DANA' :
                                            'Duitku'
                                } dashboard
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
                                value={webhookUrl}
                                readOnly
                                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white"
                            />
                            <button
                                type="button"
                                onClick={() => navigator.clipboard.writeText(webhookUrl)}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                            >
                                Copy
                            </button>
                        </div>
                    </div>
                </div>

                <ModalFooter>
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
                </ModalFooter>
            </Modal>
        </div>
    )
}
