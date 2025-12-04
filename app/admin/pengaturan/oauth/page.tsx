"use client"

import { useState, useEffect } from 'react'
import {
  HiCheckCircle,
  HiXCircle,
  HiExclamationTriangle,
  HiArrowPath,
  HiEye,
  HiEyeSlash,
} from 'react-icons/hi2'
import { FcGoogle } from 'react-icons/fc'
import { FaGithub, FaMicrosoft } from 'react-icons/fa'

interface OAuthConfig {
  id: string
  provider: string
  providerName: string
  isEnabled: boolean
  isProduction: boolean
  priority: number
  scope?: string
  redirectUri?: string
  lastTestedAt?: string
  testStatus?: string
}

interface ProviderFormData {
  clientId: string
  clientSecret: string
  tenantId?: string
  scope: string
  priority: number
  isEnabled: boolean
  isProduction: boolean
}

const PROVIDERS = [
  {
    id: 'GOOGLE',
    name: 'Google',
    icon: FcGoogle,
    color: 'from-blue-500 to-blue-600',
    docs: 'https://console.cloud.google.com/',
    requiredFields: ['clientId', 'clientSecret'],
    defaultScope: 'openid email profile',
    description: 'Allow users to sign in with their Google account'
  },
  {
    id: 'GITHUB',
    name: 'GitHub',
    icon: FaGithub,
    color: 'from-gray-700 to-gray-900',
    docs: 'https://github.com/settings/developers',
    requiredFields: ['clientId', 'clientSecret'],
    defaultScope: 'user:email',
    description: 'Allow users to sign in with their GitHub account'
  },
  {
    id: 'MICROSOFT',
    name: 'Microsoft',
    icon: FaMicrosoft,
    color: 'from-blue-500 to-blue-700',
    docs: 'https://portal.azure.com/',
    requiredFields: ['clientId', 'clientSecret', 'tenantId'],
    defaultScope: 'openid email profile',
    description: 'Allow users to sign in with their Microsoft account'
  },
]

export default function OAuthSettings() {
  const [configs, setConfigs] = useState<Record<string, OAuthConfig>>({})
  const [formData, setFormData] = useState<Record<string, ProviderFormData>>({})
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/oauth/configs')

      if (response.ok) {
        const data = await response.json()
        const configMap: Record<string, OAuthConfig> = {}

        data.data?.forEach((config: OAuthConfig) => {
          configMap[config.provider] = config
        })

        setConfigs(configMap)
      }
    } catch (error) {
      console.error('Error fetching configs:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (providerId: string) => {
    const provider = PROVIDERS.find(p => p.id === providerId)
    if (!provider) return

    const data = formData[providerId]
    if (!data) return

    // Validation
    if (!data.clientId || !data.clientSecret) {
      alert('Client ID and Client Secret are required')
      return
    }

    if (providerId === 'MICROSOFT' && !data.tenantId) {
      alert('Tenant ID is required for Microsoft OAuth')
      return
    }

    try {
      setSaving(providerId)

      const response = await fetch(`/api/admin/oauth/configs/${providerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerName: provider.name,
          clientId: data.clientId,
          clientSecret: data.clientSecret,
          tenantId: data.tenantId || null,
          scope: data.scope || provider.defaultScope,
          priority: data.priority || 0,
          isEnabled: data.isEnabled,
          isProduction: data.isProduction,
        }),
      })

      if (response.ok) {
        await fetchConfigs()
        alert(`${provider.name} OAuth configuration saved successfully!`)
        setExpandedProvider(null)
        setFormData(prev => ({ ...prev, [providerId]: {} as ProviderFormData }))
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save configuration')
      }
    } catch (error) {
      console.error('Error saving:', error)
      alert('Failed to save configuration')
    } finally {
      setSaving(null)
    }
  }

  const handleTest = async (providerId: string) => {
    try {
      setTesting(providerId)
      const response = await fetch('/api/admin/oauth/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId }),
      })

      if (response.ok) {
        const result = await response.json()
        alert(result.success ? 'Connection test successful!' : `Test failed: ${result.message}`)
        await fetchConfigs()
      } else {
        alert('Test failed')
      }
    } catch (error) {
      console.error('Error testing:', error)
      alert('Test failed')
    } finally {
      setTesting(null)
    }
  }

  const toggleExpand = (providerId: string) => {
    if (expandedProvider === providerId) {
      setExpandedProvider(null)
    } else {
      setExpandedProvider(providerId)

      // Initialize form data with existing config or defaults
      const existing = configs[providerId]
      const provider = PROVIDERS.find(p => p.id === providerId)

      if (!formData[providerId]) {
        setFormData(prev => ({
          ...prev,
          [providerId]: {
            clientId: '',
            clientSecret: '',
            tenantId: '',
            scope: provider?.defaultScope || '',
            priority: existing?.priority || 0,
            isEnabled: existing?.isEnabled || false,
            isProduction: existing?.isProduction || false,
          }
        }))
      }
    }
  }

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center space-x-3">
          <HiArrowPath className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-gray-600 dark:text-gray-400">Loading OAuth settings...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          OAuth Provider Configuration
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Configure OAuth providers to allow users to sign in with their social accounts.
          Click on a provider below to configure its settings.
        </p>
      </div>

      {/* Provider Cards */}
      <div className="space-y-4">
        {PROVIDERS.map((provider) => {
          const Icon = provider.icon
          const config = configs[provider.id]
          const isExpanded = expandedProvider === provider.id
          const data = formData[provider.id] || {}

          return (
            <div
              key={provider.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-all"
            >
              {/* Provider Header - Always Visible */}
              <div
                className="p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                onClick={() => toggleExpand(provider.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-14 h-14 bg-gradient-to-br ${provider.color} rounded-lg flex items-center justify-center shadow-md`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                        <span>{provider.name}</span>
                        {config?.isEnabled && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Active
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{provider.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    {config && (
                      <div className="flex items-center space-x-2">
                        {config.testStatus === 'SUCCESS' ? (
                          <div className="flex items-center text-green-600 dark:text-green-400">
                            <HiCheckCircle className="w-5 h-5 mr-1" />
                            <span className="text-xs">Tested</span>
                          </div>
                        ) : config.testStatus ? (
                          <div className="flex items-center text-red-600 dark:text-red-400">
                            <HiXCircle className="w-5 h-5 mr-1" />
                            <span className="text-xs">Failed</span>
                          </div>
                        ) : (
                          <div className="flex items-center text-gray-400">
                            <HiExclamationTriangle className="w-5 h-5 mr-1" />
                            <span className="text-xs">Not tested</span>
                          </div>
                        )}
                      </div>
                    )}

                    <button className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                      {isExpanded ? 'Collapse' : 'Configure'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Configuration Form - Collapsible */}
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-900">
                  <div className="max-w-2xl space-y-4">
                    {/* Documentation Link */}
                    <div className="flex items-center justify-between">
                      <a
                        href={provider.docs}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                      >
                        <span>📚 View {provider.name} Documentation</span>
                        <span className="ml-1">→</span>
                      </a>
                    </div>

                    {/* Client ID */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Client ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={data.clientId || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          [provider.id]: { ...prev[provider.id], clientId: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Enter OAuth Client ID"
                      />
                    </div>

                    {/* Client Secret */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Client Secret <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showSecrets[provider.id] ? 'text' : 'password'}
                          value={data.clientSecret || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            [provider.id]: { ...prev[provider.id], clientSecret: e.target.value }
                          }))}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          placeholder="Enter OAuth Client Secret"
                        />
                        <button
                          type="button"
                          onClick={() => toggleSecret(provider.id)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          {showSecrets[provider.id] ? <HiEyeSlash className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Tenant ID (Microsoft only) */}
                    {provider.id === 'MICROSOFT' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Tenant ID <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={data.tenantId || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            [provider.id]: { ...prev[provider.id], tenantId: e.target.value }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          placeholder="Enter Azure AD Tenant ID"
                        />
                      </div>
                    )}

                    {/* Scopes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        OAuth Scopes
                      </label>
                      <input
                        type="text"
                        value={data.scope || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          [provider.id]: { ...prev[provider.id], scope: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder={provider.defaultScope}
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Space-separated list of OAuth scopes
                      </p>
                    </div>

                    {/* Priority */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Display Priority
                      </label>
                      <input
                        type="number"
                        value={data.priority || 0}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          [provider.id]: { ...prev[provider.id], priority: parseInt(e.target.value) || 0 }
                        }))}
                        className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        min="0"
                        max="100"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Higher values appear first on login page
                      </p>
                    </div>

                    {/* Toggles */}
                    <div className="flex items-center space-x-6">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={data.isEnabled || false}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            [provider.id]: { ...prev[provider.id], isEnabled: e.target.checked }
                          }))}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Enable this provider</span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={data.isProduction || false}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            [provider.id]: { ...prev[provider.id], isProduction: e.target.checked }
                          }))}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Production mode</span>
                      </label>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div>
                        {config && (
                          <button
                            onClick={() => handleTest(provider.id)}
                            disabled={testing === provider.id}
                            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {testing === provider.id ? (
                              <>
                                <HiArrowPath className="w-4 h-4 mr-2 animate-spin" />
                                Testing...
                              </>
                            ) : (
                              'Test Connection'
                            )}
                          </button>
                        )}
                      </div>

                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => toggleExpand(provider.id)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSave(provider.id)}
                          disabled={saving === provider.id}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {saving === provider.id ? (
                            <>
                              <HiArrowPath className="w-4 h-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save Configuration'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}