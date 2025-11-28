"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    HiOutlinePlus,
    HiOutlineTrash,
    HiOutlineCheck,
    HiArrowPath,
} from 'react-icons/hi2'

const formatRupiah = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseInt(amount) : amount
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(num)
}

export default function BudgetPlanningPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [categories, setCategories] = useState<any[]>([])
    const [budgets, setBudgets] = useState<any[]>([])
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [newBudget, setNewBudget] = useState<any>(null)

    useEffect(() => {
        fetchData()
    }, [selectedMonth, selectedYear])

    const fetchData = async () => {
        try {
            setLoading(true)

            // Fetch categories
            const categoriesRes = await fetch('/api/finance/budget/categories')
            if (categoriesRes.ok) {
                const data = await categoriesRes.json()
                setCategories(data)
            }

            // Fetch budgets for selected period
            const budgetsRes = await fetch(
                `/api/finance/budget?month=${selectedMonth}&year=${selectedYear}`
            )
            if (budgetsRes.ok) {
                const data = await budgetsRes.json()
                setBudgets(data.data || [])
            }
        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateBudget = async (categoryId: string) => {
        const amount = prompt('Enter budget amount (IDR):')
        if (!amount || parseFloat(amount) <= 0) return

        try {
            const response = await fetch('/api/finance/budget', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    year: selectedYear,
                    month: selectedMonth,
                    categoryId,
                    budgetAmount: amount,
                }),
            })

            if (response.ok) {
                alert('Budget created successfully!')
                fetchData()
            } else {
                const error = await response.json()
                alert(`Failed to create budget: ${error.error || 'Unknown error'}`)
            }
        } catch (error) {
            console.error('Error creating budget:', error)
            alert('Error creating budget')
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <HiArrowPath className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
        )
    }

    // Group categories by type
    const opexCategories = categories.filter((c) => c.type === 'OPEX' && !c.parentId)
    const capexCategories = categories.filter((c) => c.type === 'CAPEX' && !c.parentId)

    const getBudgetForCategory = (categoryId: string) => {
        return budgets.find((b) => b.categoryId === categoryId)
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Budget Planning</h1>
                <p className="text-gray-500 dark:text-gray-400">Plan and allocate budgets</p>
            </div>

            {/* Period Selector */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Select Period
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Month
                        </label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                                <option key={month} value={month}>
                                    {new Date(2000, month - 1).toLocaleString('id-ID', { month: 'long' })}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Year
                        </label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map((year) => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* OPEX Budgets */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    OPEX (Operational Expenses)
                </h3>
                <div className="space-y-3">
                    {opexCategories.map((category) => {
                        const budget = getBudgetForCategory(category.id)
                        return (
                            <div
                                key={category.id}
                                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                            >
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900 dark:text-white">{category.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {category.description || category.code}
                                    </p>
                                </div>
                                {budget ? (
                                    <div className="text-right">
                                        <p className="font-bold text-emerald-600 dark:text-emerald-400">
                                            {formatRupiah(budget.budgetAmount)}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Actual: {formatRupiah(budget.actualAmount)}
                                        </p>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleCreateBudget(category.id)}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                    >
                                        <HiOutlinePlus className="w-4 h-4" />
                                        Add Budget
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* CAPEX Budgets */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    CAPEX (Capital Expenses)
                </h3>
                <div className="space-y-3">
                    {capexCategories.map((category) => {
                        const budget = getBudgetForCategory(category.id)
                        return (
                            <div
                                key={category.id}
                                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                            >
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900 dark:text-white">{category.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {category.description || category.code}
                                    </p>
                                </div>
                                {budget ? (
                                    <div className="text-right">
                                        <p className="font-bold text-emerald-600 dark:text-emerald-400">
                                            {formatRupiah(budget.budgetAmount)}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Actual: {formatRupiah(budget.actualAmount)}
                                        </p>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleCreateBudget(category.id)}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                    >
                                        <HiOutlinePlus className="w-4 h-4" />
                                        Add Budget
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
