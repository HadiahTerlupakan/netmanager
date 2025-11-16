"use client"

import React from 'react'
import { HiArrowPath, HiCheck, HiXMark } from 'react-icons/hi2'

type TestResult = {
  success: boolean
  message: string
}

type RouterInfo = {
  identity?: string
  version?: string
  boardName?: string
  uptime?: string
  userOnline?: number
}

type TestConnectionResult = {
  success: boolean
  api: TestResult
  routerInfo?: RouterInfo
  message: string
}

type TestConnectionModalProps = {
  open: boolean
  onClose: () => void
  result: TestConnectionResult | null
  isLoading?: boolean
}

export default function TestConnectionModal({ open, onClose, result, isLoading }: TestConnectionModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Hasil Test Koneksi</h3>
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Tutup
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <HiArrowPath className="mb-4 w-12 h-12 animate-spin text-gray-400" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Sedang menguji koneksi...</p>
          </div>
        ) : result ? (
          <div className="space-y-4">
            {/* Overall Status */}
            <div
              className={`rounded-lg border p-4 ${
                result.success
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                  : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
              }`}
            >
              <div className="flex items-center gap-2">
                {result.success ? <HiCheck className="w-8 h-8 text-green-600 dark:text-green-400" /> : <HiXMark className="w-8 h-8 text-red-600 dark:text-red-400" />}
                <div>
                  <h4
                    className={`font-semibold ${
                      result.success
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-red-800 dark:text-red-300'
                    }`}
                  >
                    {result.success ? 'Koneksi Berhasil' : 'Koneksi Gagal'}
                  </h4>
                  <p
                    className={`text-sm ${
                      result.success
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}
                  >
                    {result.message}
                  </p>
                </div>
              </div>
            </div>

            {/* API Result */}
            <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-2 flex items-center gap-2">
                {result.api.success ? <HiCheck className="w-6 h-6 text-green-600 dark:text-green-400" /> : <HiXMark className="w-6 h-6 text-red-600 dark:text-red-400" />}
                <h4 className="font-semibold text-gray-900 dark:text-white">Test API Connection</h4>
              </div>
              <div className="ml-8">
                <p
                  className={`text-sm ${
                    result.api.success
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {result.api.message}
                </p>
              </div>
            </div>

            {/* Router Info */}
            {result.routerInfo && result.api.success && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                <h4 className="mb-3 font-semibold text-blue-900 dark:text-blue-300">Informasi Router</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-400">Identity</p>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                      {result.routerInfo.identity || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-400">Version</p>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                      {result.routerInfo.version || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-400">Board Name</p>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                      {result.routerInfo.boardName || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-400">Uptime</p>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                      {result.routerInfo.uptime || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-400">User Online</p>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">
                      {result.routerInfo.userOnline ?? 0} active
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            Tidak ada hasil test koneksi
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

