import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import tw from 'twrnc';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { Config } from '@/constants/Config';

interface Transaction {
    id: string;
    type: 'masuk' | 'keluar';
    barang: {
        kode: string;
        nama: string;
        satuan: string;
    };
    gudang: {
        nama: string;
    };
    jumlah: number;
    kondisi: string;
    keterangan: string | null;
    tanggal: string;
}

type FilterType = 'all' | 'masuk' | 'keluar';

export default function RiwayatBarangScreen() {
    const router = useRouter();
    const { token } = useAuth();

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterType>('all');

    useEffect(() => {
        fetchRiwayat();
    }, []);

    const fetchRiwayat = async () => {
        try {
            const res = await axios.get(`${Config.API_URL}/api/mobile/inventory/riwayat`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTransactions(res.data?.data || res.data?.transactions || []);
        } catch (error) {
            console.error('Failed to fetch riwayat:', error);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchRiwayat();
        setRefreshing(false);
    };

    const filteredTransactions = transactions.filter(t =>
        filter === 'all' || t.type === filter
    );

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const filterButtons: { label: string; value: FilterType }[] = [
        { label: 'Semua', value: 'all' },
        { label: 'Masuk', value: 'masuk' },
        { label: 'Keluar', value: 'keluar' }
    ];

    return (
        <View style={tw`flex-1 bg-gray-50`}>
            {/* Header */}
            <View style={tw`bg-white border-b border-gray-100`}>
                <View style={tw`px-4 py-4 flex-row items-center justify-between`}>
                    <TouchableOpacity onPress={() => router.back()} style={tw`p-2 -ml-2`}>
                        <Ionicons name="arrow-back" size={24} color="#374151" />
                    </TouchableOpacity>
                    <Text style={tw`text-lg font-bold text-gray-900`}>Riwayat Transaksi</Text>
                    <View style={tw`w-8`} />
                </View>

                {/* Filter Tabs */}
                <View style={tw`flex-row px-4 pb-3 gap-2`}>
                    {filterButtons.map((btn) => (
                        <TouchableOpacity
                            key={btn.value}
                            onPress={() => setFilter(btn.value)}
                            style={tw`flex-1 py-2 px-3 rounded-lg ${filter === btn.value ? 'bg-blue-600' : 'bg-gray-100'}`}
                        >
                            <Text style={tw`text-sm font-semibold text-center ${filter === btn.value ? 'text-white' : 'text-gray-600'}`}>
                                {btn.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <ScrollView
                style={tw`flex-1`}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View style={tw`p-4`}>
                    {loading ? (
                        <View style={tw`py-12 items-center`}>
                            <Text style={tw`text-gray-500`}>Memuat...</Text>
                        </View>
                    ) : filteredTransactions.length === 0 ? (
                        <View style={tw`py-12 items-center`}>
                            <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
                            <Text style={tw`text-gray-500 mt-2`}>Belum ada transaksi</Text>
                        </View>
                    ) : (
                        filteredTransactions.map((t) => (
                            <View
                                key={t.id}
                                style={tw`bg-white rounded-xl p-4 mb-3 border border-gray-100 shadow-sm`}
                            >
                                <View style={tw`flex-row items-start`}>
                                    <View
                                        style={tw`w-10 h-10 rounded-lg items-center justify-center ${t.type === 'masuk' ? 'bg-green-100' : 'bg-orange-100'}`}
                                    >
                                        <Ionicons
                                            name={t.type === 'masuk' ? 'add' : 'remove'}
                                            size={20}
                                            color={t.type === 'masuk' ? '#16A34A' : '#EA580C'}
                                        />
                                    </View>
                                    <View style={tw`flex-1 ml-3`}>
                                        <View style={tw`flex-row items-start justify-between`}>
                                            <View style={tw`flex-1`}>
                                                <Text style={tw`font-semibold text-gray-900`}>{t.barang.nama}</Text>
                                                <Text style={tw`text-xs text-gray-500`}>{t.barang.kode}</Text>
                                            </View>
                                            <Text style={tw`text-sm font-bold ${t.type === 'masuk' ? 'text-green-600' : 'text-orange-600'}`}>
                                                {t.type === 'masuk' ? '+' : '-'}{t.jumlah} {t.barang.satuan}
                                            </Text>
                                        </View>
                                        <View style={tw`mt-2 flex-row items-center flex-wrap gap-1`}>
                                            <Text style={tw`text-xs text-gray-500`}>{t.gudang.nama}</Text>
                                            <Text style={tw`text-xs text-gray-400`}>•</Text>
                                            <Text style={tw`text-xs text-gray-500`}>{t.kondisi}</Text>
                                        </View>
                                        <Text style={tw`text-xs text-gray-400 mt-1`}>{formatDate(t.tanggal)}</Text>
                                        {t.keterangan && (
                                            <Text style={tw`text-sm text-gray-600 mt-2`}>{t.keterangan}</Text>
                                        )}
                                    </View>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
