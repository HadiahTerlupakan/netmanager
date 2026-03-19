"use client"

import { Cloud, Eye, EyeOff, Globe, Key, ShieldCheck, Box } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/Button'

type R2SettingsProps = {
  settings: {
    r2AccountId: string
    r2AccessKeyId: string
    r2SecretAccessKey: string
    r2BucketName: string
    r2PublicUrl: string
    r2Enabled: boolean
  }
  showR2Secret: boolean
  setShowR2Secret: (show: boolean) => void
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleToggle: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleTestR2: () => void
  testing: boolean
}

export function R2Settings({
  settings,
  showR2Secret,
  setShowR2Secret,
  handleChange,
  handleToggle,
  handleTestR2,
  testing
}: R2SettingsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-500" />
              Cloudflare R2 Storage
            </CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Penyimpanan objek S3-compatible untuk backup database dan file statis
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              name="r2Enabled"
              checked={settings.r2Enabled}
              onChange={handleToggle}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {settings.r2Enabled ? 'Aktif' : 'Nonaktif'}
            </span>
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${!settings.r2Enabled ? 'opacity-50' : ''}`}>
          <div className="space-y-2">
            <label htmlFor="r2AccountId" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              R2 Account ID
            </label>
            <input
              id="r2AccountId"
              name="r2AccountId"
              type="text"
              value={settings.r2AccountId}
              onChange={handleChange}
              disabled={!settings.r2Enabled}
              placeholder="Cloudflare Account ID"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none disabled:cursor-not-allowed"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="r2BucketName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Bucket Name
            </label>
            <div className="relative">
              <Box className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="r2BucketName"
                name="r2BucketName"
                type="text"
                value={settings.r2BucketName}
                onChange={handleChange}
                disabled={!settings.r2Enabled}
                placeholder="nama-bucket"
                className="w-full pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="r2AccessKeyId" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              R2 Access Key ID
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="r2AccessKeyId"
                name="r2AccessKeyId"
                type="text"
                value={settings.r2AccessKeyId}
                onChange={handleChange}
                disabled={!settings.r2Enabled}
                className="w-full pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="r2SecretAccessKey" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              R2 Secret Access Key
            </label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="r2SecretAccessKey"
                name="r2SecretAccessKey"
                type={showR2Secret ? 'text' : 'password'}
                value={settings.r2SecretAccessKey}
                onChange={handleChange}
                disabled={!settings.r2Enabled}
                className="w-full pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none pr-10 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowR2Secret(!showR2Secret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showR2Secret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className={`space-y-2 ${!settings.r2Enabled ? 'opacity-50' : ''}`}>
          <label htmlFor="r2PublicUrl" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            R2 Public URL (Custom Domain atau R2.dev)
          </label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="r2PublicUrl"
              name="r2PublicUrl"
              type="url"
              value={settings.r2PublicUrl}
              onChange={handleChange}
              disabled={!settings.r2Enabled}
              placeholder="https://pub-xxxx.r2.dev"
              className="w-full pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none disabled:cursor-not-allowed"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Digunakan untuk akses publik ke file-file statis jika diperlukan.
          </p>
        </div>

        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestR2}
            disabled={!settings.r2Enabled || testing}
            className="gap-2"
          >
            {testing ? 'Mencoba...' : 'Test Koneksi R2'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
