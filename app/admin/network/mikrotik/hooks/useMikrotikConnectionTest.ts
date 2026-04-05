import { useState } from 'react'

import {
  submitMikrotikConnectionTest,
  type MikrotikFormConnectionData,
  type MikrotikTestConnectionResult,
  validateMikrotikConnectionInput,
} from '@/app/admin/network/mikrotik/mikrotikFormShared'

type UseMikrotikConnectionTestOptions = {
  formData: MikrotikFormConnectionData
  routerId?: string
  onSuccess?: (result: MikrotikTestConnectionResult) => Promise<void> | void
}

export function useMikrotikConnectionTest({ formData, routerId, onSuccess }: UseMikrotikConnectionTestOptions) {
  const [isTesting, setIsTesting] = useState(false)
  const [showTestModal, setShowTestModal] = useState(false)
  const [testResult, setTestResult] = useState<MikrotikTestConnectionResult | null>(null)

  const runTest = async () => {
    const validationError = validateMikrotikConnectionInput(formData)
    if (validationError) {
      alert(validationError)
      return false
    }

    setIsTesting(true)
    setShowTestModal(true)
    setTestResult(null)

    try {
      const result = await submitMikrotikConnectionTest(formData, routerId)
      setTestResult(result)

      if (result.success && onSuccess) {
        await onSuccess(result)
      }

      return result.success === true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan'
      console.error('Error testing connection:', error)
      setTestResult({
        success: false,
        ping: { success: false, message: 'Error: ' + errorMessage },
        api: { success: false, message: 'Error: ' + errorMessage },
        message: 'Terjadi kesalahan saat test koneksi',
      })
      return false
    } finally {
      setIsTesting(false)
    }
  }

  return {
    isTesting,
    showTestModal,
    testResult,
    runTest,
    closeTestModal: () => setShowTestModal(false),
    openTestModal: () => setShowTestModal(true),
  }
}
