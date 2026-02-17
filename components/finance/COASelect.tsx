'use client'

import { useState, useEffect } from 'react'
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox'

interface ChartOfAccount {
    id: string
    code: string
    name: string
    type: string
}

interface COASelectProps {
    value: string
    onChange: (value: string) => void
    type?: string // Optional filter by account type (ASSET, LIABILITY, etc)
    label?: string
    placeholder?: string
    error?: string
    disabled?: boolean
    className?: string
}

export function COASelect({
    value,
    onChange,
    type,
    label = "Chart of Account",
    placeholder = "Pilih Akun",
    error,
    disabled = false,
    className = ""
}: COASelectProps) {
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
    const [loading, setLoading] = useState(false)
    const [options, setOptions] = useState<ComboboxOption[]>([])

    useEffect(() => {
        const fetchAccounts = async () => {
            setLoading(true)
            try {
                const params = new URLSearchParams()
                if (type) params.append('type', type)

                const res = await fetch(`/api/finance/coa?${params.toString()}`)
                if (!res.ok) throw new Error('Failed to fetch COA')

                const data: ChartOfAccount[] = await res.json()
                setAccounts(data)

                const formattedOptions: ComboboxOption[] = data.map(acc => ({
                    value: acc.id,
                    label: `${acc.code} - ${acc.name}`,
                    searchLabel: `${acc.code} ${acc.name}`
                }))

                setOptions(formattedOptions)
            } catch (err) {
                console.error("Error loading COA:", err)
            } finally {
                setLoading(false)
            }
        }

        fetchAccounts()
    }, [type])

    return (
        <div className={`space-y-1 ${className}`}>
            {label && (
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {label}
                </label>
            )}
            <Combobox
                options={options}
                value={value}
                onChange={onChange}
                placeholder={loading ? "Memuat akun..." : placeholder}
                disabled={disabled || loading}
                loading={loading}
            />
            {error && (
                <p className="text-sm text-red-500">{error}</p>
            )}
        </div>
    )
}
