"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import type { FieldValues } from "react-hook-form";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { toast } from "react-hot-toast";
import {
    HiOutlineCreditCard,
    HiPlus,
    HiOutlineTrash,
    HiOutlineCalendar,
    HiOutlineBanknotes,
    HiOutlineTag,
    HiOutlineDocumentText,
    HiOutlineCheckCircle,
    HiOutlineArrowRight,
    HiOutlineArrowLeft,
    HiOutlinePhoto,
    HiOutlineInformationCircle
} from "react-icons/hi2";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import { usePermission } from "@/hooks/use-permission";
import { Combobox } from "@/components/ui/Combobox";
import { formatCurrency } from "@/lib/utils";
import { Modal, ModalBody } from "@/components/ui/Modal";
import { Button } from '@/components/ui/Button'

type Expense = {
    id: string;
    date: string;
    amount: number;
    description: string;
    category: { name: string };
    account: { name: string };
    user?: { name: string };
};

type Category = {
    id: string;
    name: string;
    type: string;
};

type Account = {
    id: string;
    name: string;
    balance: number;
    accountNumber?: string;
};

// Component Input Mata Uang (Currency Input)
const CurrencyInput = ({
    label,
    value,
    onChange,
    placeholder = "0",
    error
}: {
    label: string;
    value: number;
    onChange: (val: number) => void;
    placeholder?: string;
    error?: string;
}) => (
    <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
        <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Rp</span>
            </div>
            <input
                type="number"
                value={value || ""}
                onChange={(e) => onChange(Number(e.target.value))}
                className={`block w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 transition-all ${error ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                placeholder={placeholder}
            />
        </div>
        {value > 0 && (
            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-mono font-medium text-right">
                {formatCurrency(value)}
            </p>
        )}
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
);

export function ClientComponent() {
    const { hasPermission } = usePermission();
    const canCreate = hasPermission("expense:create") || hasPermission("mixradius_expenses:create");
    const canDelete = hasPermission("expense:delete") || hasPermission("mixradius_expenses:delete");

    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [step, setStep] = useState(1);

    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);

    const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm({
        defaultValues: {
            date: format(new Date(), 'yyyy-MM-dd'),
            amount: 0,
            description: "",
            categoryId: "",
            accountId: "",
            attachments: [] as string[]
        }
    });

    const watchedAmount = watch("amount");
    const watchedCategoryId = watch("categoryId");
    const watchedAccountId = watch("accountId");
    // const watchedDate = watch("date");
    const watchedDescription = watch("description");

    const selectedAccount = useMemo(() =>
        accounts.find(a => a.id === watchedAccountId),
        [accounts, watchedAccountId]);

    const selectedCategory = useMemo(() =>
        categories.find(c => c.id === watchedCategoryId),
        [categories, watchedCategoryId]);

    useEffect(() => {
        fetchExpenses();
        fetchMetadata();
    }, []);

    const fetchMetadata = async () => {
        try {
            const [catRes, accRes] = await Promise.all([
                fetch("/api/finance/categories"),
                fetch("/api/finance/accounts")
            ]);

            const catData = await catRes.json();
            const accData = await accRes.json();

            setCategories(Array.isArray(catData) ? catData.filter((c: Category) => c.type === 'EXPENSE') : []);
            setAccounts(Array.isArray(accData.data) ? accData.data : (Array.isArray(accData) ? accData : []));
        } catch (_error) {
            console.error("Error fetching metadata:", _error);
        }
    };

    const fetchExpenses = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/finance/expenses");
            const data = await res.json();
            setExpenses(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error loading expenses:", error);
            toast.error("Gagal memuat data pengeluaran");
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: FieldValues) => {
        try {
            const res = await fetch("/api/finance/expenses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...data,
                    amount: Number(data.amount)
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch((): null => null);
                throw new Error(errData?.error || "Gagal menyimpan pengeluaran");
            }

            toast.success("Pengeluaran berhasil disimpan");
            setIsModalOpen(false);
            reset();
            setStep(1);
            fetchExpenses();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal menyimpan pengeluaran");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Apakah Anda yakin ingin menghapus data ini?")) return;
        try {
            const res = await fetch(`/api/finance/expenses/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("Gagal menghapus pengeluaran");
            toast.success("Pengeluaran berhasil dihapus");
            fetchExpenses();
        } catch (_error) {
            toast.error("Gagal menghapus pengeluaran");
        }
    }

    const nextStep = () => {
        if (step === 1) {
            if (!watchedAmount || watchedAmount <= 0) {
                toast.error("Nominal pengeluaran harus lebih dari 0");
                return;
            }
        } else if (step === 2) {
            if (!watchedCategoryId || !watchedAccountId) {
                toast.error("Kategori dan Sumber Dana wajib dipilih");
                return;
            }
        }
        setStep(step + 1);
    }

    const prevStep = () => setStep(step - 1);

    return (
        <div className="p-6 space-y-6 min-h-screen bg-gray-50/50 dark:bg-[#0b1120]">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-xl">
                            <HiOutlineCreditCard className="w-8 h-8 text-rose-600 dark:text-rose-400" />
                        </div>
                        Pengeluaran Harian
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Catat dan pantau pengeluaran operasional perusahaan secara real-time
                    </p>
                </div>
                {canCreate && (
                    <button
                        onClick={() => {
                            reset();
                            setStep(1);
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg shadow-rose-500/20 transition-all font-bold active:scale-95"
                    >
                        <HiPlus className="w-5 h-5" />
                        Tambah Pengeluaran
                    </button>
                )}
            </div>

            {/* Dashboard Cards (Optional Mini Summary) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Hari Ini</p>
                    <h3 className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
                        {formatCurrency(expenses.filter(e => format(new Date(e.date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).reduce((acc, curr) => acc + Number(curr.amount), 0))}
                    </h3>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 overflow-hidden">
                <ResponsiveTable
                    data={expenses}
                    loading={loading}
                    keyField="id"
                    columns={[
                        {
                            key: 'date',
                            header: 'Tanggal',
                            priority: 'primary',
                            render: (item) => (
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-400">
                                        <HiOutlineCalendar className="w-4 h-4" />
                                    </div>
                                    <span className="font-semibold">{format(new Date(item.date), "dd MMM yyyy", { locale: id })}</span>
                                </div>
                            )
                        },
                        {
                            key: 'category_display',
                            header: 'Kategori / COA',
                            priority: 'primary',
                            render: (item) => (
                                <div className="space-y-1">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                                        {(item.category && typeof item.category === 'object' ? item.category.name : String(item.category || "Beban Lainnya"))}
                                    </span>
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">BEBAN OPERASIONAL</p>
                                </div>
                            )
                        },
                        {
                            key: 'account_display',
                            header: 'Sumber Dana',
                            priority: 'secondary',
                            render: (item) => (
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 font-medium">
                                    <HiOutlineBanknotes className="w-4 h-4 text-emerald-500" />
                                    {(item.account && typeof item.account === 'object' ? item.account.name : "-")}
                                </div>
                            )
                        },
                        {
                            key: 'amount',
                            header: 'Nominal',
                            priority: 'primary',
                            render: (item) => (
                                <span className="text-rose-600 dark:text-rose-400 font-black font-mono text-lg">
                                    {formatCurrency(Number(item.amount))}
                                </span>
                            )
                        },
                        {
                            key: 'description',
                            header: 'Keterangan',
                            priority: 'tertiary',
                            render: (item) => (
                                <span className="text-gray-500 dark:text-gray-400 text-sm italic truncate max-w-[200px] block">
                                    {item.description || "Tidak ada keterangan"}
                                </span>
                            )
                        }
                    ]}
                    emptyMessage="Belum ada data pengeluaran yang dicatat."
                    renderActions={(item) => (
                        <div className="flex items-center justify-end gap-2">
                            {canDelete && (
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                    title="Hapus"
                                >
                                    <HiOutlineTrash className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    )}
                />
            </div>

            {/* Wizard Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                padding={false}
                size="xl"
                showCloseButton={false}
            >
                {/* Stepper Indicator */}
                <div className="bg-gray-50 dark:bg-[#161e2e] p-8 pb-4">
                    <div className="flex items-center justify-between max-w-xs mx-auto relative">
                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -translate-y-1/2 -z-0"></div>
                        {[1, 2, 3].map((s) => (
                            <div
                                key={s}
                                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-500 ${step >= s
                                        ? "bg-rose-600 text-white shadow-lg shadow-rose-500/40 scale-110"
                                        : "bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 text-gray-400"
                                    }`}
                            >
                                {step > s ? <HiOutlineCheckCircle className="w-6 h-6" /> : s}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] font-black uppercase tracking-widest text-gray-400 px-4">
                        <span className={step === 1 ? "text-rose-600 dark:text-rose-400" : ""}>Detail</span>
                        <span className={step === 2 ? "text-rose-600 dark:text-rose-400" : ""}>Klasifikasi</span>
                        <span className={step === 3 ? "text-rose-600 dark:text-rose-400" : ""}>Konfirmasi</span>
                    </div>
                </div>

                <ModalBody className="p-8">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        {/* Step 1: Detail Pengeluaran */}
                        {step === 1 && (
                            <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
                                <div className="flex items-center gap-3 mb-2">
                                    <HiOutlineInformationCircle className="text-rose-500 w-5 h-5" />
                                    <h2 className="text-xl font-black text-gray-900 dark:text-white">Detail Pengeluaran</h2>
                                </div>

                                <div className="grid grid-cols-1 gap-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Tanggal</label>
                                        <div className="relative">
                                            <HiOutlineCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                            <input
                                                {...register("date", { required: true })}
                                                type="date"
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 transition-all"
                                            />
                                        </div>
                                    </div>

                                    <Controller
                                        name="amount"
                                        control={control}
                                        rules={{ required: true, min: 1 }}
                                        render={({ field }) => (
                                            <CurrencyInput
                                                label="Nominal Pengeluaran"
                                                value={field.value}
                                                onChange={field.onChange}
                                                error={errors.amount ? "Nominal wajib diisi" : undefined}
                                            />
                                        )}
                                    />

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Keterangan</label>
                                        <div className="relative">
                                            <HiOutlineDocumentText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                                            <textarea
                                                {...register("description")}
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 transition-all"
                                                rows={3}
                                                placeholder="Misal: Pembayaran Token Listrik Gudang..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Klasifikasi Akun */}
                        {step === 2 && (
                            <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
                                <div className="flex items-center gap-3 mb-2">
                                    <HiOutlineTag className="text-rose-500 w-5 h-5" />
                                    <h2 className="text-xl font-black text-gray-900 dark:text-white">Klasifikasi Akun</h2>
                                </div>

                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Kategori Beban (COA)</label>
                                        <Controller
                                            name="categoryId"
                                            control={control}
                                            rules={{ required: true }}
                                            render={({ field }) => (
                                                <Combobox
                                                    options={categories.map(c => ({ value: c.id, label: c.name }))}
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="Pilih kategori beban..."
                                                />
                                            )}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Sumber Dana (Kas/Bank)</label>
                                        <Controller
                                            name="accountId"
                                            control={control}
                                            rules={{ required: true }}
                                            render={({ field }) => (
                                                <Combobox
                                                    options={accounts.map(a => ({
                                                        value: a.id,
                                                        label: (
                                                            <div className="flex justify-between w-full">
                                                                <span>{a.name}</span>
                                                                <span className="font-mono text-xs opacity-60">{formatCurrency(a.balance)}</span>
                                                            </div>
                                                        ),
                                                        searchLabel: a.name
                                                    }))}
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    placeholder="Pilih sumber dana..."
                                                />
                                            )}
                                        />
                                    </div>

                                    {/* Real-time Balance Summary */}
                                    {selectedAccount && (
                                        <div className="p-4 bg-gray-50 dark:bg-[#161e2e] rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Saldo Akun Saat Ini</p>
                                                <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedAccount.balance)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estimasi Sisa</p>
                                                <p className="text-sm font-bold font-mono text-gray-600 dark:text-gray-300">
                                                    {formatCurrency(selectedAccount.balance - watchedAmount)}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Step 3: Konfirmasi */}
                        {step === 3 && (
                            <div className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-300">
                                <div className="flex items-center gap-3 mb-2">
                                    <HiOutlineCheckCircle className="text-rose-500 w-5 h-5" />
                                    <h2 className="text-xl font-black text-gray-900 dark:text-white">Konfirmasi & Bukti</h2>
                                </div>

                                <div className="bg-rose-50 dark:bg-rose-900/10 p-5 rounded-3xl border border-rose-100 dark:border-rose-900/30 space-y-3">
                                    <div className="flex justify-between items-center pb-3 border-b border-rose-200/30">
                                        <span className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase">Total Pengeluaran</span>
                                        <span className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">{formatCurrency(watchedAmount)}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-sm pt-2">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Kategori</p>
                                            <p className="font-bold text-gray-700 dark:text-gray-200">{selectedCategory?.name || "-"}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Sumber Dana</p>
                                            <p className="font-bold text-gray-700 dark:text-gray-200">{selectedAccount?.name || "-"}</p>
                                        </div>
                                        <div className="col-span-2 space-y-1">
                                            <p className="text-[10px] font-black text-gray-400 uppercase">Keterangan</p>
                                            <p className="text-gray-600 dark:text-gray-400 italic">&quot;{watchedDescription || "Tidak ada keterangan"}&quot;</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Upload Bukti / Nota (Opsional)</label>
                                    <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl p-8 flex flex-col items-center justify-center text-gray-400 hover:border-rose-400 transition-all cursor-pointer bg-gray-50/50 dark:bg-[#161e2e]/50">
                                        <HiOutlinePhoto className="w-10 h-10 mb-2" />
                                        <p className="text-xs font-bold uppercase tracking-widest">Klik atau Tarik File</p>
                                        <p className="text-[10px] mt-1">PNG, JPG up to 5MB</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Navigation Buttons */}
                        <div className="flex justify-between gap-4 pt-6 mt-4 border-t border-gray-100 dark:border-gray-800">
                            {step > 1 ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={prevStep}
                                    className="flex items-center gap-2"
                                >
                                    <HiOutlineArrowLeft className="w-5 h-5" />
                                    Kembali
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Batal
                                </Button>
                            )}

                            {step < 3 ? (
                                <Button type="button"
                                    onClick={nextStep}
                                >
                                    Lanjut
                                    <HiOutlineArrowRight className="w-5 h-5" />
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    variant="destructive"
                                >
                                    Simpan Transaksi
                                </Button>
                            )}
                        </div>
                    </form>
                </ModalBody>
            </Modal>
        </div>
    );
}
