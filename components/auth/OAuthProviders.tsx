"use client"
import * as React from 'react'
import { signIn } from 'next-auth/react'
import { FcGoogle } from 'react-icons/fc'
import { FaGithub, FaMicrosoft } from 'react-icons/fa'

interface OAuthProvider {
  id: string
  name: string
  displayName: string
  color: string
  textColor: string
  borderColor: string
  hoverColor: string
  icon: string
}

interface OAuthProvidersProps {
  callbackUrl?: string
  className?: string
}

export default function OAuthProviders({
  callbackUrl = '/admin',
  className = ''
}: OAuthProvidersProps) {
  const [loadingProvider, setLoadingProvider] = React.useState<string | null>(null)
  const [providers, setProviders] = React.useState<OAuthProvider[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch enabled OAuth providers from API
  React.useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/auth/oauth/providers')
        const data = await response.json()

        if (response.ok && data.success) {
          // Only use providers returned by API (from database or env vars fallback on server)
          setProviders(data.data || [])
        } else {
          // API returned error
          console.warn('OAuth API error:', data.error || 'Unknown error')
          setError(data.error || 'Failed to load providers')
          setProviders([])
        }
      } catch (error) {
        console.error('Error fetching OAuth providers:', error)
        setError('Network error loading providers')
        setProviders([])
      } finally {
        setLoading(false)
      }
    }

    fetchProviders()
  }, [])

  const handleOAuthSignIn = async (providerId: string) => {
    setLoadingProvider(providerId)
    try {
      await signIn(providerId, {
        callbackUrl,
        redirect: true,
      })
    } catch (error) {
      console.error(`Error signing in with ${providerId}:`, error)
      setLoadingProvider(null)
    }
  }

  const getIcon = (provider: OAuthProvider) => {
    switch (provider.name.toLowerCase()) {
      case 'google':
        return <FcGoogle className="w-5 h-5" />
      case 'github':
        return <FaGithub className="w-5 h-5" />
      case 'microsoft':
        return <FaMicrosoft className="w-5 h-5" />
      default:
        return <span className="w-5 h-5 text-lg">{provider.icon}</span>
    }
  }

  // Jika loading, tampilkan skeleton
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="w-full h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
      </div>
    )
  }

  // Jika tidak ada providers, tidak tampilkan apa-apa (login dengan credentials saja)
  if (providers.length === 0) {
    // Jika ada error, tampilkan pesan kecil (opsional, bisa dihilangkan)
    if (error) {
      return null // Tidak tampilkan apa-apa, cukup login dengan credentials
    }
    return null // Tidak ada provider OAuth yang diaktifkan
  }

  return (
    <>
      <div className={`space-y-3 ${className}`}>
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => handleOAuthSignIn(provider.id)}
            disabled={loadingProvider !== null}
            className={`w-full inline-flex items-center justify-center gap-3 px-6 py-3 ${provider.color} ${provider.textColor} text-sm font-medium rounded-lg border ${provider.borderColor} ${provider.hoverColor} disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm`}
          >
            {loadingProvider === provider.id ? (
              <div className={`w-5 h-5 border-2 ${provider.textColor === 'text-white' ? 'border-white border-t-transparent' : 'border-gray-300 border-t-gray-600'} rounded-full animate-spin`} />
            ) : (
              getIcon(provider)
            )}
            <span>{provider.displayName}</span>
          </button>
        ))}
      </div>

      {/* OAuth setup link - hanya tampil jika di halaman /admin dan ada providers */}
      {typeof window !== 'undefined' && window.location.pathname.startsWith('/admin') && providers.length > 0 && (
        <div className="mt-4 text-center">
          <a
            href="/admin/pengaturan/oauth"
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <span>Kelola OAuth providers</span>
            <span className="text-xs">→</span>
          </a>
        </div>
      )}
    </>
  )
}
