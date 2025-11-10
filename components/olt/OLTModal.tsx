"use client"
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { oltCreateSchema, oltUpdateSchema } from '@/lib/validations/olt'
import { HiEye, HiEyeSlash, HiCheck, HiXMark, HiOutlineSignal, HiArrowPath, HiXMark as HiClose } from 'react-icons/hi2'

type OLTFormData = z.infer<typeof oltCreateSchema>

interface OLTModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: OLTFormData) => Promise<void>
  olt?: any | null
  mode: 'add' | 'edit'
  onTestSuccess?: () => void // Callback untuk refresh list setelah test berhasil
}

export default function OLTModal({ isOpen, onClose, onSubmit, olt, mode, onTestSuccess }: OLTModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResults, setTestResults] = useState<{
    snmp?: { success: boolean; message: string }
    telnet?: { success: boolean; message: string }
  } | null>(null)
  const schema = mode === 'add' ? oltCreateSchema : oltUpdateSchema

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<OLTFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      ipAddress: '',
      type: 'ZTE-C300',
      version: '',
      snmpCommunityWrite: 'public',
      snmpVersion: '2',
      snmpPort: 161,
      telnetUsername: 'zte',
      telnetPassword: '',
      telnetPort: 23,
    },
  })

  useEffect(() => {
    if (isOpen && olt && mode === 'edit') {
      setValue('name', olt.name)
      setValue('ipAddress', olt.ipAddress)
      setValue('type', olt.type)
      setValue('version', olt.version || '')
      setValue('snmpCommunityWrite', olt.snmpCommunityWrite || 'public')
      setValue('snmpVersion', olt.snmpVersion || '2')
      setValue('snmpPort', olt.snmpPort || 161)
      setValue('telnetUsername', olt.telnetUsername || 'zte')
      setValue('telnetPassword', olt.telnetPassword || '')
      setValue('telnetPort', olt.telnetPort || 23)
      setTestResults(null)
    } else if (isOpen && mode === 'add') {
      reset()
      setTestResults(null)
    } else if (!isOpen) {
      setTestResults(null)
      setIsTesting(false)
    }
  }, [isOpen, olt, mode, setValue, reset])

  const onFormSubmit = async (data: OLTFormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
      onClose()
      reset()
    } catch (error) {
      console.error('Error submitting form:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleTestConnection = async () => {
    setIsTesting(true)
    setTestResults(null)

    try {
      // Get current form values
      const formData = watch()
      const { ipAddress, snmpPort, snmpCommunityWrite, snmpVersion, telnetPort, telnetUsername, telnetPassword } =
        formData

      if (!ipAddress) {
        alert('IP Address harus diisi terlebih dahulu')
        setIsTesting(false)
        return
      }

      const response = await fetch('/api/olts/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ipAddress,
          snmpPort: snmpPort !== undefined && snmpPort !== null ? Number(snmpPort) : 161,
          snmpCommunityWrite: snmpCommunityWrite || 'public',
          snmpVersion: snmpVersion || '2',
          telnetPort: telnetPort !== undefined && telnetPort !== null ? Number(telnetPort) : 23,
          telnetUsername: telnetUsername || 'zte',
          telnetPassword: telnetPassword || '',
          oltId: mode === 'edit' && olt?.id ? olt.id : undefined, // Send OLT ID if editing
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setTestResults({
          snmp: result.snmp,
          telnet: result.telnet,
        })
        
        // Refresh list jika test berhasil dan status di-update (untuk edit mode)
        if (mode === 'edit' && olt?.id && (result.snmp.success || result.telnet.success)) {
          // Call callback untuk refresh list
          if (onTestSuccess) {
            setTimeout(() => {
              onTestSuccess()
            }, 500) // Delay sedikit untuk memastikan database sudah terupdate
          }
        }
      } else {
        alert(result.error || 'Test connection gagal')
      }
    } catch (error: any) {
      console.error('Error testing connection:', error)
      alert('Terjadi kesalahan saat test connection: ' + (error.message || 'Unknown error'))
    } finally {
      setIsTesting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {mode === 'add' ? 'Tambah OLT' : 'OLT Edit'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

        <form onSubmit={handleSubmit(onFormSubmit)} className="p-6 space-y-6">
          {/* OLT Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              OLT Name
            </label>
            <input
              type="text"
              {...register('name')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
          </div>

          {/* IP Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              IP Address
            </label>
            <input
              type="text"
              {...register('ipAddress')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {errors.ipAddress && <p className="mt-1 text-sm text-red-600">{errors.ipAddress.message}</p>}
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">OLT Type</p>
            <select
              {...register('type')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="ZTE-C300">ZTE-C300</option>
              <option value="ZTE-C320">ZTE-C320</option>
              <option value="Huawei-MA5608T">Huawei-MA5608T</option>
              <option value="Huawei-OLT">Huawei-OLT</option>
            </select>
            {errors.type && <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>}
          </div>

          {/* SNMP Section */}
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">SNMP</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Community Write (RW)
              </label>
              <input
                type="text"
                {...register('snmpCommunityWrite')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {errors.snmpCommunityWrite && (
                <p className="mt-1 text-sm text-red-600">{errors.snmpCommunityWrite.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Version
              </label>
              <select
                {...register('snmpVersion')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="1">SNMPv1</option>
                <option value="2">SNMPv2</option>
                <option value="3">SNMPv3</option>
              </select>
              {errors.snmpVersion && <p className="mt-1 text-sm text-red-600">{errors.snmpVersion.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Port
              </label>
              <input
                type="number"
                {...register('snmpPort', { valueAsNumber: true })}
                min="1"
                max="65535"
                placeholder="161"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Port SNMP (default: 161, bisa di-custom)</p>
              {errors.snmpPort && <p className="mt-1 text-sm text-red-600">{errors.snmpPort.message}</p>}
            </div>
          </div>

          {/* Telnet Section */}
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Telnet</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Username
              </label>
              <input
                type="text"
                {...register('telnetUsername')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {errors.telnetUsername && (
                <p className="mt-1 text-sm text-red-600">{errors.telnetUsername.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('telnetPassword')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {showPassword ? <HiEye className="w-4 h-4" /> : <HiEyeSlash className="w-4 h-4" />}
                </button>
              </div>
              {errors.telnetPassword && (
                <p className="mt-1 text-sm text-red-600">{errors.telnetPassword.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Port
              </label>
              <input
                type="number"
                {...register('telnetPort', { valueAsNumber: true })}
                min="1"
                max="65535"
                placeholder="23"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Port Telnet (default: 23, bisa di-custom)</p>
              {errors.telnetPort && (
                <p className="mt-1 text-sm text-red-600">{errors.telnetPort.message}</p>
              )}
            </div>
          </div>

          {/* Version (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Version (optional)
            </label>
            <input
              type="text"
              {...register('version')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., C300 Version V2.1.0 Software"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Data akan diambil otomatis dari device via SNMP saat sync
            </p>
            {errors.version && <p className="mt-1 text-sm text-red-600">{errors.version.message}</p>}
          </div>

          {/* Test Results */}
          {testResults && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Test Connection Results</h3>
              
              {/* SNMP Result */}
              {testResults.snmp && (
                <div className={`p-3 rounded-md border ${
                  testResults.snmp.success
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${
                      testResults.snmp.success
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}>
                      {testResults.snmp.success ? <HiCheck className="w-4 h-4 inline" /> : <HiXMark className="w-4 h-4 inline" />} SNMP
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${
                    testResults.snmp.success
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {testResults.snmp.message}
                  </p>
                  {!testResults.snmp.success && (
                    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-800 dark:text-yellow-300">
                      <p className="font-semibold mb-1">Tips Troubleshooting SNMP:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Pastikan SNMP aktif di device OLT</li>
                        <li>Cek community string (biasanya "public" untuk read-only)</li>
                        <li>Verifikasi port SNMP (default 161, atau custom port)</li>
                        <li>Coba ganti SNMP version (v1, v2c, atau v3)</li>
                        <li>Pastikan firewall tidak memblokir port SNMP</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Telnet Result */}
              {testResults.telnet && (
                <div className={`p-3 rounded-md border ${
                  testResults.telnet.success
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${
                      testResults.telnet.success
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-red-700 dark:text-red-400'
                    }`}>
                      {testResults.telnet.success ? <HiCheck className="w-4 h-4 inline" /> : <HiXMark className="w-4 h-4 inline" />} Telnet
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${
                    testResults.telnet.success
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {testResults.telnet.message}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <span className="flex items-center gap-2">
                <HiClose className="w-4 h-4" /> Close
              </span>
            </button>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex items-center gap-2">
                {isTesting ? (
                  <>
                    <HiArrowPath className="w-4 h-4 animate-spin" /> Testing...
                  </>
                ) : (
                  <>
                    <HiOutlineSignal className="w-4 h-4" /> Test Connection
                  </>
                )}
              </span>
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="flex items-center gap-2">
                <span>↓</span> Submit
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

