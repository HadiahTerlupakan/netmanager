'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiOutlineChevronLeft, HiOutlineCheck } from 'react-icons/hi2';
import { Button } from '@/components/ui/Button'
import axios from 'axios';
import { toast } from 'react-hot-toast';

export default function CanvasingCreateClient() {
    const router = useRouter();
    const [isProcessing, setIsProcessing] = useState(false);
    const [formData, setFormData] = useState({
        nama: '',
        noKtp: '',
        noTelpon: '',
        email: '',
        alamat: '',
        kabel: 150,
        odp: '',
        paket: 'HOME_10MBPS',
        sn: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsProcessing(true);
        try {
            await axios.post('/api/marketing/canvasing', formData);
            toast.success('Canvasing berhasil ditambahkan');
            router.push('/admin/marketing/canvasing');
            router.refresh();
        } catch (error) {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.error || 'Gagal menambahkan canvasing');
            } else {
                toast.error('Gagal menambahkan canvasing');
            }
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="p-6">
            <div className="flex items-center gap-4 mb-8">
                <Button 
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                >
                    <HiOutlineChevronLeft className="w-6 h-6" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Tambah Canvasing Baru</h1>
                    <p className="text-gray-500">Input data calon pelanggan baru secara manual</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="max-w-4xl bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Nama Lengkap (Sesuai KTP)</label>
                        <input
                            required
                            type="text"
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={formData.nama}
                            onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Nomor KTP (NIK)</label>
                        <input
                            required
                            type="text"
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={formData.noKtp}
                            onChange={(e) => setFormData({ ...formData, noKtp: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Nomor Telepon</label>
                        <input
                            required
                            type="text"
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={formData.noTelpon}
                            onChange={(e) => setFormData({ ...formData, noTelpon: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Email (Opsional)</label>
                        <input
                            type="email"
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-bold text-gray-700">Alamat Lengkap</label>
                        <textarea
                            required
                            rows={3}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                            value={formData.alamat}
                            onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Paket Layanan</label>
                        <select
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={formData.paket}
                            onChange={(e) => setFormData({ ...formData, paket: e.target.value })}
                        >
                            <option value="HOME_10MBPS">Home 10 Mbps</option>
                            <option value="HOME_20MBPS">Home 20 Mbps</option>
                            <option value="HOME_30MBPS">Home 30 Mbps</option>
                            <option value="HOME_50MBPS">Home 50 Mbps</option>
                            <option value="HOME_100MBPS">Home 100 Mbps</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Estimasi Kabel (Meter)</label>
                        <input
                            required
                            type="number"
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={formData.kabel}
                            onChange={(e) => setFormData({ ...formData, kabel: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">ODP Terdekat (Opsional)</label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={formData.odp}
                            onChange={(e) => setFormData({ ...formData, odp: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Serial Number (Opsional)</label>
                        <input
                            type="text"
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={formData.sn}
                            onChange={(e) => setFormData({ ...formData, sn: e.target.value })}
                        />
                    </div>
                </div>

                <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-end gap-4">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.back()}
                    >
                        Batal
                    </Button>
                    <Button type="submit"
                        loading={isProcessing}
                    >
                        <HiOutlineCheck className="w-5 h-5" />
                        Simpan Data
                    </Button>
                </div>
            </form>
        </div>
    );
}
