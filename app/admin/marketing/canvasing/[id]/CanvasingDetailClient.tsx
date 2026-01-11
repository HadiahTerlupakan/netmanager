'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    HiOutlineChevronLeft, 
    HiOutlineCheck, 
    HiOutlineXMark,
    HiOutlineMapPin,
    HiOutlinePhone,
    HiOutlineEnvelope,
    HiOutlineIdentification,
    HiOutlineCalendar,
    HiOutlineUser,
    HiOutlineArchiveBox,
    HiOutlineQueueList
} from 'react-icons/hi2';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface CanvasingDetail {
    id: string;
    nama: string;
    noKtp: string;
    noTelpon: string;
    email?: string;
    alamat: string;
    kabel: number;
    odp?: string;
    paket: string;
    sn?: string;
    latitude?: number;
    longitude?: number;
    foto?: string;
    fotoKtp?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    sales: {
        name: string;
        email: string;
    };
    createdAt: string;
    workOrder?: {
        workOrderNumber: string;
    };
}

export default function CanvasingDetailClient({ id }: { id: string }) {
    const router = useRouter();
    const [item, setItem] = useState<CanvasingDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [zoomImage, setZoomImage] = useState<string | null>(null);

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                const res = await axios.get(`/api/marketing/canvasing/${id}`);
                setItem(res.data);
            } catch (error) {
                console.error('Fetch detail error:', error);
                toast.error('Gagal memuat detail canvasing');
            } finally {
                setIsLoading(false);
            }
        };
        fetchDetail();
    }, [id]);

    const handleApprove = async () => {
        if (!confirm('Setujui request ini? Sistem akan otomatis membuat Work Order instalasi.')) return;
        
        setIsProcessing(true);
        try {
            await axios.post(`/api/marketing/canvasing/${id}/approve`);
            toast.success('Request disetujui and Work Order telah dibuat');
            router.refresh();
            // Refetch data
            const res = await axios.get(`/api/marketing/canvasing/${id}`);
            setItem(res.data);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Gagal menyetujui request');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async () => {
        if (!confirm('Tolak request ini?')) return;
        
        setIsProcessing(true);
        try {
            await axios.put(`/api/marketing/canvasing/${id}`, { status: 'REJECTED' });
            toast.success('Request ditolak');
            router.refresh();
            // Refetch data
            const res = await axios.get(`/api/marketing/canvasing/${id}`);
            setItem(res.data);
        } catch (error) {
            toast.error('Gagal menolak request');
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">Memuat detail...</div>;
    if (!item) return <div className="p-8 text-center text-red-500 font-bold">Data tidak ditemukan</div>;

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => router.back()}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <HiOutlineChevronLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{item.nama}</h1>
                        <p className="text-gray-500">Request Canvasing / {item.paket}</p>
                    </div>
                </div>

                {item.status === 'PENDING' && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleReject}
                            disabled={isProcessing}
                            className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
                        >
                            <HiOutlineXMark className="w-5 h-5" />
                            Tolak
                        </button>
                        <button
                            onClick={handleApprove}
                            disabled={isProcessing}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
                        >
                            <HiOutlineCheck className="w-5 h-5" />
                            Setujui
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Photos & Location */}
                <div className="lg:col-span-1 space-y-8">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                            <h2 className="font-bold text-gray-900 flex items-center gap-2">
                                <HiOutlineArchiveBox className="w-5 h-5 text-indigo-500" />
                                Foto Dokumentasi
                            </h2>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Foto Lokasi</p>
                                <div 
                                    className="aspect-video bg-gray-100 rounded-xl overflow-hidden cursor-zoom-in"
                                    onClick={() => setZoomImage(item.foto!)}
                                >
                                    {item.foto ? (
                                        <img src={item.foto} alt="Lokasi" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 italic text-sm">Tidak ada foto</div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Foto KTP</p>
                                <div 
                                    className="aspect-video bg-gray-100 rounded-xl overflow-hidden cursor-zoom-in"
                                    onClick={() => setZoomImage(item.fotoKtp!)}
                                >
                                    {item.fotoKtp ? (
                                        <img src={item.fotoKtp} alt="KTP" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 italic text-sm">Tidak ada foto KTP</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
                        <div className="inline-flex p-3 bg-indigo-50 rounded-full mb-4">
                            <HiOutlineMapPin className="w-8 h-8 text-indigo-600" />
                        </div>
                        <h3 className="font-bold text-gray-900 mb-2">Lokasi Pemasangan</h3>
                        <p className="text-sm text-gray-500 mb-6">{item.alamat}</p>
                        <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.alamat)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-indigo-600 font-bold hover:underline"
                        >
                            Buka di Google Maps
                            <HiOutlineChevronLeft className="w-4 h-4 rotate-180" />
                        </a>
                    </div>
                </div>

                {/* Right Column: Information */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Status Info */}
                    <div className={`p-6 rounded-2xl border flex items-center justify-between ${
                        item.status === 'APPROVED' ? 'bg-green-50 border-green-100 text-green-700' :
                        item.status === 'REJECTED' ? 'bg-red-50 border-red-100 text-red-700' :
                        'bg-yellow-50 border-yellow-100 text-yellow-700'
                    }`}>
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${
                                item.status === 'APPROVED' ? 'bg-green-600' :
                                item.status === 'REJECTED' ? 'bg-red-600' :
                                'bg-yellow-600'
                            }`}>
                                <HiOutlineCheck className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="text-sm uppercase font-bold opacity-75">Status Saat Ini</p>
                                <h3 className="text-xl font-bold">{item.status}</h3>
                            </div>
                        </div>
                        {item.workOrder && (
                            <div className="text-right">
                                <p className="text-sm opacity-75 italic">Link Work Order</p>
                                <p className="font-bold font-mono">{item.workOrder.workOrderNumber}</p>
                            </div>
                        )}
                    </div>

                    {/* Basic Info Grid */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                            <h2 className="font-bold text-gray-900 flex items-center gap-2">
                                <HiOutlineIdentification className="w-5 h-5 text-indigo-500" />
                                Informasi Pelanggan
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-100">
                            <InfoBox label="Nama Sesuai KTP" value={item.nama} icon={<HiOutlineUser />} />
                            <InfoBox label="NIK KTP" value={item.noKtp} icon={<HiOutlineIdentification />} />
                            <InfoBox label="No. Telepon" value={item.noTelpon} icon={<HiOutlinePhone />} />
                            <InfoBox label="Email" value={item.email || '-'} icon={<HiOutlineEnvelope />} />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-50 bg-gray-50/50">
                            <h2 className="font-bold text-gray-900 flex items-center gap-2">
                                <HiOutlineQueueList className="w-5 h-5 text-indigo-500" />
                                Informasi Paket & Teknis
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-100">
                            <InfoBox label="Paket Dipilih" value={item.paket} icon={<HiOutlineArchiveBox />} />
                            <InfoBox label="Estimasi Kabel" value={`${item.kabel} Meter`} icon={<HiOutlineMapPin />} />
                            <InfoBox label="ODP Terdekat" value={item.odp || '-'} icon={<HiOutlineMapPin />} />
                            <InfoBox label="Serial Number" value={item.sn || '-'} icon={<HiOutlineIdentification />} />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                                <HiOutlineUser className="w-6 h-6 text-gray-500" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 capitalize">Diajukan Oleh (Sales)</p>
                                <p className="font-bold text-gray-900">{item.sales.name}</p>
                                <p className="text-xs text-gray-500">{item.sales.email}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-gray-400 uppercase">Waktu Input</p>
                            <p className="text-sm font-medium text-gray-700">
                                {format(new Date(item.createdAt), 'dd MMMM yyyy HH:mm', { locale: idLocale })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Zoom Modal */}
            {zoomImage && (
                <div 
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
                    onClick={() => setZoomImage(null)}
                >
                    <img src={zoomImage} alt="Zoomed" className="max-w-full max-h-full rounded-lg shadow-2xl" />
                    <button className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                        <HiOutlineXMark className="w-8 h-8" />
                    </button>
                </div>
            )}
        </div>
    );
}

function InfoBox({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
    return (
        <div className="bg-white p-6 flex flex-col gap-1">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
                {icon}
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</span>
            </div>
            <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
        </div>
    );
}
