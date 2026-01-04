"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "react-hot-toast";
import {
    HiOutlineCreditCard,
    HiPlus,
    HiOutlineTrash,
    HiOutlinePencil,
    HiOutlineFunnel
} from "react-icons/hi2";
import ResponsiveTable from "@/components/ui/ResponsiveTable";

type Expense = {
    id: string;
    date: string;
    amount: string;
    category: string;
    description: string;
    user?: { name: string };
};

export function ClientComponent() { // ExpensePage() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { register, handleSubmit, reset } = useForm();

    useEffect(() => {
        fetchExpenses();
    }, []);

    const fetchExpenses = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/finance/expenses");
            const data = await res.json();

            if (Array.isArray(data)) {
                setExpenses(data);
            } else {
                console.error("Invalid expenses data format:", data);
                setExpenses([]);
                if (data.error) {
                    toast.error(data.error);
                }
            }
        } catch (error) {
            console.error("Error loading expenses:", error);
            toast.error("Gagal memuat data pengeluaran");
            setExpenses([]);
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: any) => {
        try {
            const res = await fetch("/api/finance/expenses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) throw new Error("Gagal menyimpan");

            toast.success("Pengeluaran berhasil disimpan");
            setIsModalOpen(false);
            reset();
            fetchExpenses();
        } catch (error) {
            toast.error("Terjadi kesalahan");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Apakah Anda yakin ingin menghapus data ini?")) return;
        try {
            await fetch(`/api/finance/expenses/${id}`, { method: 'DELETE' });
            toast.success("Data dihapus");
            fetchExpenses();
        } catch (error) {
            toast.error("Gagal menghapus");
        }
    }

    return (
        <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-gray-900/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <HiOutlineCreditCard className="w-8 h-8 text-rose-600 dark:text-rose-400" />
                        Data Pengeluaran
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Kelola pengeluaran operasional perusahaan
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition-colors text-sm font-medium"
                >
                    <HiPlus className="w-4 h-4" />
                    Tambah Pengeluaran
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <ResponsiveTable
                    data={expenses}
                    loading={loading}
                    keyField="id"
                    columns={[
                        {
                            key: 'date',
                            header: 'Tanggal',
                            priority: 'primary',
                            render: (item) => format(new Date(item.date), "dd MMM yyyy", { locale: id })
                        },
                        {
                            key: 'category',
                            header: 'Kategori',
                            priority: 'primary',
                            render: (item) => (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                    {item.category}
                                </span>
                            )
                        },
                        {
                            key: 'description',
                            header: 'Keterangan',
                            priority: 'secondary',
                            render: (item) => (
                                <span className="text-gray-600 dark:text-gray-300 max-w-xs truncate block">
                                    {item.description || "-"}
                                </span>
                            )
                        },
                        {
                            key: 'amount',
                            header: 'Jumlah',
                            priority: 'primary',
                            render: (item) => (
                                <span className="text-rose-600 font-semibold font-mono">
                                    Rp {Number(item.amount).toLocaleString("id-ID")}
                                </span>
                            )
                        },
                        {
                            key: 'user',
                            header: 'Dinput Oleh',
                            priority: 'tertiary',
                            render: (item) => item.user?.name || "System"
                        }
                    ]}
                    emptyMessage="Belum ada data pengeluaran"
                    renderActions={(item) => (
                        <button 
                            onClick={() => handleDelete(item.id)} 
                            className="text-gray-400 hover:text-red-500 transition-colors p-2"
                            title="Hapus"
                        >
                            <HiOutlineTrash className="w-4 h-4" />
                        </button>
                    )}
                />
            </div>

            {/* Modal Form */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-xl">
                        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Tambah Pengeluaran</h2>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tanggal</label>
                                <input {...register("date", { required: true })} type="date" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none" defaultValue={format(new Date(), 'yyyy-MM-dd')} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jumlah (Rp)</label>
                                <input {...register("amount", { required: true })} type="number" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none" placeholder="0" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kategori</label>
                                <select {...register("category", { required: true })} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none">
                                    <option value="Operasional">Operasional</option>
                                    <option value="Perbaikan">Perbaikan</option>
                                    <option value="Gaji">Gaji</option>
                                    <option value="Pembelian Alat">Pembelian Alat</option>
                                    <option value="Lainnya">Lainnya</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keterangan</label>
                                <textarea {...register("description")} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none" rows={3} placeholder="Detail pengeluaran..."></textarea>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Batal</button>
                                <button type="submit" className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition-colors">Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
