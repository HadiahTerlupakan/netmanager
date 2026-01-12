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
    HiOutlineClock,
    HiOutlineSignal,
    HiOutlineWifi,
    HiOutlineSquare3Stack3D,
    HiOutlineQrCode,
    HiOutlineGift,
    HiOutlineStar
} from 'react-icons/hi2';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface PointClaim {
    id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    buktiUrls: string[];
    keterangan?: string;
    pointValue: number;
    reviewNotes?: string;
    createdAt: string;
}

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
        status: string;
    };
    pointClaims?: PointClaim[];
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
            toast.success('Request disetujui dan Work Order telah dibuat');
            router.refresh();
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
            const res = await axios.get(`/api/marketing/canvasing/${id}`);
            setItem(res.data);
        } catch (error) {
            toast.error('Gagal menolak request');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleApproveClaim = async (claimId: string) => {
        setIsProcessing(true);
        try {
            await axios.put(`/api/marketing/point-claims/${claimId}`, { 
                action: 'approve'
            });
            toast.success('Claim poin berhasil disetujui');
            const res = await axios.get(`/api/marketing/canvasing/${id}`);
            setItem(res.data);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Gagal menyetujui claim');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRejectClaim = async (claimId: string) => {
        const notes = prompt('Alasan penolakan:');
        if (!notes) {
            toast.error('Alasan penolakan harus diisi');
            return;
        }
        
        setIsProcessing(true);
        try {
            await axios.put(`/api/marketing/point-claims/${claimId}`, { 
                action: 'reject', 
                notes 
            });
            toast.success('Claim poin ditolak');
            const res = await axios.get(`/api/marketing/canvasing/${id}`);
            setItem(res.data);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Gagal menolak claim');
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }
    
    if (!item) {
        return (
            <div className="text-center py-20">
                <p className="text-red-500 font-semibold">Data tidak ditemukan</p>
                <button onClick={() => router.back()} className="mt-4 text-indigo-600 hover:underline">
                    ← Kembali
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Back Button */}
            <button 
                onClick={() => router.back()}
                className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
                <HiOutlineChevronLeft className="w-5 h-5" />
                <span>Kembali ke Daftar</span>
            </button>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column - Profile Card */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Profile Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {/* Cover */}
                        <div className="h-24 bg-indigo-600 dark:bg-indigo-700"></div>
                        
                        {/* Avatar & Name */}
                        <div className="px-6 pb-6">
                            <div className="-mt-12 mb-4">
                                <div className="w-24 h-24 rounded-2xl bg-white dark:bg-gray-700 border-4 border-white dark:border-gray-800 shadow-lg flex items-center justify-center text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                                    {item.nama.charAt(0).toUpperCase()}
                                </div>
                            </div>
                            
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{item.nama}</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Calon Pelanggan</p>
                            
                            {/* Status Badge */}
                            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
                                item.status === 'APPROVED' 
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                                    : item.status === 'REJECTED'
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                            }`}>
                                {item.status === 'APPROVED' && <HiOutlineCheck className="w-4 h-4" />}
                                {item.status === 'REJECTED' && <HiOutlineXMark className="w-4 h-4" />}
                                {item.status === 'PENDING' && <HiOutlineClock className="w-4 h-4" />}
                                {item.status}
                            </div>
                        </div>
                        
                        {/* Contact Info */}
                        <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4 space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                                <HiOutlinePhone className="w-5 h-5 text-gray-400" />
                                <a href={`https://wa.me/${item.noTelpon}`} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                    {item.noTelpon}
                                </a>
                            </div>
                            {item.email && (
                                <div className="flex items-center gap-3 text-sm">
                                    <HiOutlineEnvelope className="w-5 h-5 text-gray-400" />
                                    <span className="text-gray-600 dark:text-gray-300">{item.email}</span>
                                </div>
                            )}
                            <div className="flex items-start gap-3 text-sm">
                                <HiOutlineMapPin className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                                <span className="text-gray-600 dark:text-gray-300">{item.alamat}</span>
                            </div>
                        </div>
                        
                        {/* NIK */}
                        <div className="border-t border-gray-100 dark:border-gray-700 px-6 py-4">
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">NIK KTP</p>
                            <p className="font-mono text-sm text-gray-800 dark:text-gray-200">{item.noKtp}</p>
                        </div>
                    </div>

                    {/* Sales Info Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Sales</h3>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold">
                                {item.sales.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white">{item.sales.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{item.sales.email}</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                            Diajukan {format(new Date(item.createdAt), 'dd MMMM yyyy, HH:mm', { locale: idLocale })}
                        </p>
                    </div>

                    {/* Map Link */}
                    {item.latitude && item.longitude && (
                        <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Lokasi GPS</h3>
                                    <p className="font-mono text-sm text-gray-800 dark:text-gray-200">{item.latitude}, {item.longitude}</p>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                                    <HiOutlineMapPin className="w-5 h-5" />
                                </div>
                            </div>
                        </a>
                    )}
                </div>

                {/* Right Column - Details */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Technical Specs */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Spesifikasi Layanan</h3>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800">
                                <HiOutlineWifi className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mb-2" />
                                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-1">Paket</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{item.paket}</p>
                            </div>
                            
                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800">
                                <HiOutlineSquare3Stack3D className="w-6 h-6 text-purple-600 dark:text-purple-400 mb-2" />
                                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">Kabel</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{item.kabel}m</p>
                            </div>
                            
                            <div className="bg-pink-50 dark:bg-pink-900/20 rounded-xl p-4 border border-pink-100 dark:border-pink-800">
                                <HiOutlineSignal className="w-6 h-6 text-pink-600 dark:text-pink-400 mb-2" />
                                <p className="text-xs text-pink-600 dark:text-pink-400 font-medium mb-1">ODP</p>
                                <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{item.odp || '-'}</p>
                            </div>
                            
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-800">
                                <HiOutlineQrCode className="w-6 h-6 text-amber-600 dark:text-amber-400 mb-2" />
                                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">SN</p>
                                <p className="text-sm font-bold text-gray-900 dark:text-white font-mono truncate">{item.sn || '-'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Documentation */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Dokumentasi</h3>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* KTP */}
                            <div 
                                className={`aspect-video rounded-xl overflow-hidden border-2 ${
                                    item.fotoKtp 
                                        ? 'cursor-zoom-in hover:border-indigo-400 dark:hover:border-indigo-500' 
                                        : 'border-dashed'
                                } border-gray-200 dark:border-gray-700 transition-colors`}
                                onClick={() => item.fotoKtp && setZoomImage(item.fotoKtp)}
                            >
                                {item.fotoKtp ? (
                                    <div className="relative w-full h-full group">
                                        <img src={item.fotoKtp} alt="KTP" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        <div className="absolute inset-x-0 bottom-0 h-12 bg-black/50" />
                                        <span className="absolute bottom-3 left-3 text-white text-sm font-medium">Foto KTP</span>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                                        <span className="text-sm">Foto KTP</span>
                                        <span className="text-xs mt-1">Tidak tersedia</span>
                                    </div>
                                )}
                            </div>
                            
                            {/* Location */}
                            <div 
                                className={`aspect-video rounded-xl overflow-hidden border-2 ${
                                    item.foto 
                                        ? 'cursor-zoom-in hover:border-indigo-400 dark:hover:border-indigo-500' 
                                        : 'border-dashed'
                                } border-gray-200 dark:border-gray-700 transition-colors`}
                                onClick={() => item.foto && setZoomImage(item.foto)}
                            >
                                {item.foto ? (
                                    <div className="relative w-full h-full group">
                                        <img src={item.foto} alt="Lokasi" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        <div className="absolute inset-x-0 bottom-0 h-12 bg-black/50" />
                                        <span className="absolute bottom-3 left-3 text-white text-sm font-medium">Foto Lokasi</span>
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                                        <span className="text-sm">Foto Lokasi</span>
                                        <span className="text-xs mt-1">Tidak tersedia</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Work Order Badge */}
                    {item.workOrder && (
                        <div className="bg-green-600 dark:bg-green-700 rounded-2xl p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-green-100 text-sm mb-1">Work Order Dibuat</p>
                                    <p className="text-2xl font-bold font-mono">{item.workOrder.workOrderNumber}</p>
                                    {item.workOrder.status && (
                                        <p className="text-green-200 text-xs mt-1">Status: {item.workOrder.status}</p>
                                    )}
                                </div>
                                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                                    <HiOutlineCheck className="w-8 h-8" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Point Claims Section */}
                    {item.pointClaims && item.pointClaims.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                    <HiOutlineGift className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Claim Poin</h3>
                            </div>
                            
                            {item.pointClaims.map((claim) => (
                                <div key={claim.id} className={`border rounded-xl p-4 mb-4 last:mb-0 ${
                                    claim.status === 'APPROVED' 
                                        ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' 
                                        : claim.status === 'REJECTED'
                                        ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                                        : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
                                }`}>
                                    {/* Claim Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <HiOutlineStar className={`w-5 h-5 ${
                                                claim.status === 'APPROVED' ? 'text-green-600' 
                                                : claim.status === 'REJECTED' ? 'text-red-600' 
                                                : 'text-amber-600'
                                            }`} />
                                            <span className={`text-sm font-bold ${
                                                claim.status === 'APPROVED' ? 'text-green-700 dark:text-green-400' 
                                                : claim.status === 'REJECTED' ? 'text-red-700 dark:text-red-400' 
                                                : 'text-amber-700 dark:text-amber-400'
                                            }`}>
                                                +{claim.pointValue} Poin - {claim.status}
                                            </span>
                                        </div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {format(new Date(claim.createdAt), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                                        </span>
                                    </div>

                                    {/* Bukti Photos */}
                                    {claim.buktiUrls && claim.buktiUrls.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Bukti Foto:</p>
                                            <div className="flex gap-2 flex-wrap">
                                                {claim.buktiUrls.map((url, idx) => (
                                                    <img 
                                                        key={idx} 
                                                        src={url} 
                                                        alt={`Bukti ${idx + 1}`}
                                                        className="w-20 h-20 rounded-lg object-cover cursor-zoom-in border border-gray-200 dark:border-gray-600"
                                                        onClick={() => setZoomImage(url)}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Keterangan */}
                                    {claim.keterangan && (
                                        <div className="mb-4">
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Keterangan:</p>
                                            <p className="text-sm text-gray-700 dark:text-gray-300">{claim.keterangan}</p>
                                        </div>
                                    )}

                                    {/* Review Notes */}
                                    {claim.reviewNotes && (
                                        <div className="mb-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Catatan Review:</p>
                                            <p className="text-sm text-gray-700 dark:text-gray-300">{claim.reviewNotes}</p>
                                        </div>
                                    )}

                                    {/* Action Buttons for PENDING */}
                                    {claim.status === 'PENDING' && (
                                        <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                                            <button
                                                onClick={() => handleApproveClaim(claim.id)}
                                                disabled={isProcessing}
                                                className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <HiOutlineCheck className="w-4 h-4" />
                                                Setujui Claim
                                            </button>
                                            <button
                                                onClick={() => handleRejectClaim(claim.id)}
                                                disabled={isProcessing}
                                                className="py-2 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                                            >
                                                <HiOutlineXMark className="w-4 h-4" />
                                                Tolak
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Action Buttons */}
                    {item.status === 'PENDING' && (
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Tindakan</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                                Dengan menyetujui, sistem akan otomatis membuat Work Order instalasi.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={handleApprove}
                                    disabled={isProcessing}
                                    className="flex-1 py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                                >
                                    <HiOutlineCheck className="w-5 h-5" />
                                    Setujui
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={isProcessing}
                                    className="py-3 px-6 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
                                >
                                    <HiOutlineXMark className="w-5 h-5" />
                                    Tolak
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Zoom Modal */}
            {zoomImage && (
                <div 
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-sm"
                    onClick={() => setZoomImage(null)}
                >
                    <img src={zoomImage} alt="Zoomed" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
                    <button className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                        <HiOutlineXMark className="w-8 h-8" />
                    </button>
                </div>
            )}
        </div>
    );
}
