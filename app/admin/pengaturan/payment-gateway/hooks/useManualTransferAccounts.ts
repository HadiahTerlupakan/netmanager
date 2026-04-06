"use client"

import { useCallback, useEffect, useState } from 'react'

export interface CompanyBankAccount {
    id: string
    bankName: string
    accountNumber: string
    accountName: string
    isActive: boolean
    priority: number
    description?: string
    createdAt: string
}

export interface ManualTransferFormValues {
    bankName: string
    accountNumber: string
    accountName: string
    description: string
    isActive: boolean
    priority: number
}

export interface ManualTransferActionResult {
    success: boolean
    message?: string
}

const ACCOUNTS_URL = '/api/admin/company-bank-accounts'

async function safeParseJson(response: Response) {
    try {
        return await response.json()
    } catch {
        return null
    }
}

function getPayloadMessage(payload: unknown): string | undefined {
    if (payload && typeof payload === 'object') {
        const message = (payload as Record<string, unknown>).message
        if (typeof message === 'string' && message.length > 0) {
            return message
        }

        const details = (payload as Record<string, unknown>).details
        if (typeof details === 'string' && details.length > 0) {
            return details
        }

        const error = (payload as Record<string, unknown>).error
        if (typeof error === 'string' && error.length > 0) {
            return error
        }
    }

    return undefined
}

function extractAccounts(payload: unknown): CompanyBankAccount[] {
    if (Array.isArray(payload)) {
        return payload
    }

    if (payload && typeof payload === 'object') {
        const data = (payload as Record<string, unknown>).data
        if (Array.isArray(data)) {
            return data
        }
    }

    return []
}

export function useManualTransferAccounts() {
    const [accounts, setAccounts] = useState<CompanyBankAccount[]>([])
    const [loading, setLoading] = useState(true)

    const fetchAccounts = useCallback(async () => {
        try {
            setLoading(true)
            const response = await fetch(ACCOUNTS_URL)
            if (response.ok) {
                const payload = await safeParseJson(response)
                const normalized = extractAccounts(payload)
                if (normalized.length > 0) {
                    setAccounts(normalized)
                } else if (Array.isArray(payload)) {
                    setAccounts(payload)
                } else {
                    setAccounts([])
                }
            } else {
                console.error('Failed to fetch bank accounts:', response.statusText)
            }
        } catch (error) {
            console.error('Error fetching bank accounts:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void fetchAccounts()
    }, [fetchAccounts])

    const upsertAccount = useCallback(
        async (formData: ManualTransferFormValues, accountId?: string): Promise<ManualTransferActionResult> => {
            try {
                const url = accountId ? `${ACCOUNTS_URL}/${accountId}` : ACCOUNTS_URL
                const response = await fetch(url, {
                    method: accountId ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                })

                if (response.ok) {
                    await fetchAccounts()
                    return { success: true }
                }

                const payload = await safeParseJson(response)
                return {
                    success: false,
                    message: getPayloadMessage(payload) ?? 'Gagal menyimpan rekening',
                }
            } catch (error) {
                console.error('Error saving bank account:', error)
                return { success: false, message: 'Terjadi kesalahan saat menyimpan' }
            }
        },
        [fetchAccounts]
    )

    const deleteAccount = useCallback(
        async (id: string): Promise<ManualTransferActionResult> => {
            try {
                const response = await fetch(`${ACCOUNTS_URL}/${id}`, {
                    method: 'DELETE',
                })

                if (response.ok) {
                    await fetchAccounts()
                    return { success: true }
                }

                const payload = await safeParseJson(response)
                return {
                    success: false,
                    message: getPayloadMessage(payload) ?? 'Gagal menghapus rekening',
                }
            } catch (error) {
                console.error('Error deleting bank account:', error)
                return { success: false, message: 'Terjadi kesalahan saat menghapus' }
            }
        },
        [fetchAccounts]
    )

    const toggleAccount = useCallback(
        async (account: CompanyBankAccount): Promise<ManualTransferActionResult> => {
            try {
                const response = await fetch(`${ACCOUNTS_URL}/${account.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        bankName: account.bankName,
                        accountNumber: account.accountNumber,
                        accountName: account.accountName,
                        description: account.description ?? '',
                        priority: account.priority,
                        isActive: !account.isActive,
                    }),
                })

                if (response.ok) {
                    await fetchAccounts()
                    return { success: true }
                }

                const payload = await safeParseJson(response)
                return {
                    success: false,
                    message: getPayloadMessage(payload) ?? 'Gagal memperbarui status rekening',
                }
            } catch (error) {
                console.error('Error toggling bank account status:', error)
                return { success: false, message: 'Kesalahan saat memperbarui status rekening' }
            }
        },
        [fetchAccounts]
    )

    return {
        accounts,
        loading,
        fetchAccounts,
        upsertAccount,
        deleteAccount,
        toggleAccount,
    }
}
