"use client"

import React from 'react'
import { HiArrowPath, HiCheck, HiXMark } from 'react-icons/hi2'
import { Button } from '@/components/ui/Button'
import { Modal, ModalFooter } from '@/components/ui/Modal'

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
  ping?: TestResult
  api?: TestResult
  routerInfo?: RouterInfo
  message?: string
}

type TestConnectionModalProps = {
  open: boolean
  onClose: () => void
  result: TestConnectionResult | null
  isLoading?: boolean
}

export default function TestConnectionModal({ open, onClose, result: rawResult, isLoading }: TestConnectionModalProps) {
  if (!open) return null

  // Handle standardized API response format { success: true, data: { ... } }
  const result = rawResult && 'data' in rawResult 
    ? (rawResult.data as TestConnectionResult) 
    : rawResult;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Hasil Test Koneksi"
      size="2xl"
    >
      <div className="p-6">
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
                {result.api?.success ? <HiCheck className="w-6 h-6 text-green-600 dark:text-green-400" /> : <HiXMark className="w-6 h-6 text-red-600 dark:text-red-400" />}
                <h4 className="font-semibold text-gray-900 dark:text-white">Test API Connection</h4>
              </div>
              <div className="ml-8">
                <p
                  className={`text-sm ${
                    result.api?.success
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {result.api?.message || 'Tidak ada informasi API'}
                </p>
              </div>
            </div>

            {/* Router Info */}
            {result.routerInfo && result.api?.success && (
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

        <ModalFooter>
          <Button onClick={onClose}
            
          >
            Tutup
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}

