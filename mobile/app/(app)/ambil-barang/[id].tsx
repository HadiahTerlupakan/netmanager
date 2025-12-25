import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, FlatList, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import tw from 'twrnc';
import { useAuth } from '../../../context/AuthContext';
import { ArrowLeft, Search, Package, Plus, Minus, Check, Trash2, Filter, AlertCircle, ChevronDown, X, CheckCircle } from 'lucide-react-native';
import axios from 'axios';
import { Config } from '../../../constants/Config';

interface Barang {
    id: string;
    kode: string;
    nama: string;
    satuan: string;
    stokBaru: number;
    stokBekas: number;
    stokRusak: number;
    isWorkOrderMaterial: boolean;
}

interface Gudang {
    id: string;
    nama: string;
    lokasi: string;
}

interface SelectedItem {
    barangId: string;
    barang: Barang;
    gudangId: string;
    jumlah: number;
    kondisi: 'BARU' | 'BEKAS' | 'RUSAK';
}

export default function AmbilBarangScreen() {
    const router = useRouter();
    const { id: workOrderId } = useLocalSearchParams();
    const { token } = useAuth();

    // Data State
    const [gudangs, setGudangs] = useState<Gudang[]>([]);
    const [barangs, setBarangs] = useState<Barang[]>([]);

    // UI State
    const [selectedGudang, setSelectedGudang] = useState<string>('');
    const [showGudangModal, setShowGudangModal] = useState(false);
    const [gudangSearch, setGudangSearch] = useState('');
    const [search, setSearch] = useState('');
    const [showAllItems, setShowAllItems] = useState(false);
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

    // Loading State
    const [loadingGudang, setLoadingGudang] = useState(true);
    const [loadingBarang, setLoadingBarang] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchGudangs();
    }, []);

    useEffect(() => {
        if (selectedGudang) {
            fetchBarangs();
        }
    }, [selectedGudang]);

    const fetchGudangs = async () => {
        try {
            const res = await axios.get(`${Config.API_URL}/api/mobile/inventory/gudang?workOrderId=${workOrderId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const list = res.data.gudangList || [];
            setGudangs(list);
            if (list.length > 0) setSelectedGudang(list[0].id);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Gagal memuat daftar gudang');
        } finally {
            setLoadingGudang(false);
        }
    };

    const fetchBarangs = async () => {
        setLoadingBarang(true);
        try {
            const res = await axios.get(`${Config.API_URL}/api/mobile/inventory/barang?gudangId=${selectedGudang}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBarangs(res.data.barangList || []);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Gagal memuat barang');
        } finally {
            setLoadingBarang(false);
        }
    };

    const addItem = (barang: Barang, kondisi: 'BARU' | 'BEKAS' | 'RUSAK') => {
        const stok = kondisi === 'BARU' ? barang.stokBaru : kondisi === 'BEKAS' ? barang.stokBekas : barang.stokRusak;

        // Find existing
        const existingIdx = selectedItems.findIndex(i => i.barangId === barang.id && i.kondisi === kondisi);

        if (existingIdx >= 0) {
            // Check max stock
            if (selectedItems[existingIdx].jumlah < stok) {
                const newItems = [...selectedItems];
                newItems[existingIdx].jumlah += 1;
                setSelectedItems(newItems);
            } else {
                Alert.alert('Stok Habis', `Maksimal stok tersedia: ${stok}`);
            }
        } else {
            if (stok > 0) {
                setSelectedItems([...selectedItems, {
                    barangId: barang.id,
                    barang,
                    gudangId: selectedGudang,
                    jumlah: 1,
                    kondisi
                }]);
            }
        }
    };

    const updateQuantity = (idx: number, delta: number) => {
        const item = selectedItems[idx];
        const stok = item.kondisi === 'BARU' ? item.barang.stokBaru : item.kondisi === 'BEKAS' ? item.barang.stokBekas : item.barang.stokRusak;

        const newQty = item.jumlah + delta;
        if (newQty <= 0) {
            // Remove
            const newItems = [...selectedItems];
            newItems.splice(idx, 1);
            setSelectedItems(newItems);
        } else if (newQty > stok) {
            Alert.alert('Stok Habis', `Maksimal stok tersedia: ${stok}`);
        } else {
            const newItems = [...selectedItems];
            newItems[idx].jumlah = newQty;
            setSelectedItems(newItems);
        }
    };

    const handleSubmit = async () => {
        if (selectedItems.length === 0) return;
        setSubmitting(true);

        try {
            await axios.post(`${Config.API_URL}/api/mobile/work-orders/${workOrderId}/materials`, {
                items: selectedItems.map(i => ({
                    barangId: i.barangId,
                    gudangId: i.gudangId,
                    jumlah: i.jumlah,
                    kondisi: i.kondisi
                }))
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            Alert.alert('Berhasil', 'Barang berhasil ditambahkan', [
                { text: 'OK', onPress: () => router.replace(`/(app)/work-order-detail/${workOrderId}`) }
            ]);
        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.error || 'Gagal menyimpan data';
            Alert.alert('Gagal', msg);
        } finally {
            setSubmitting(false);
        }
    };

    const filteredBarangs = barangs.filter(b => {
        const matchesSearch = b.nama.toLowerCase().includes(search.toLowerCase()) ||
            b.kode.toLowerCase().includes(search.toLowerCase());
        const matchesType = showAllItems || b.isWorkOrderMaterial;
        return matchesSearch && matchesType;
    });

    return (
        <View style={tw`flex-1 bg-gray-50`}>
            {/* Header */}
            <View style={tw`bg-white px-4 pt-12 pb-4 border-b border-gray-100 flex-row items-center justify-between shadow-sm`}>
                <TouchableOpacity onPress={() => router.back()} style={tw`p-2 rounded-full bg-gray-100`}>
                    <ArrowLeft size={20} color="#374151" />
                </TouchableOpacity>
                <Text style={tw`text-lg font-bold text-gray-900`}>Ambil Barang</Text>
                <View style={tw`w-9`} />
            </View>

            {/* Content */}
            <ScrollView style={tw`flex-1`} contentContainerStyle={tw`pb-32`}>

                {/* Check Existing Selections Warning */}
                {selectedItems.length > 0 && selectedItems[0].gudangId !== selectedGudang && (
                    <View style={tw`mx-4 mt-4 bg-yellow-50 p-3 rounded-lg border border-yellow-200 flex-row items-center gap-3`}>
                        <AlertCircle size={20} color="#a16207" />
                        <Text style={tw`flex-1 text-xs text-yellow-800`}>
                            Anda memiliki item terpilih dari gudang lain. Mengganti gudang akan menghapus pilihan saat ini.
                        </Text>
                    </View>
                )}

                {/* Warehouse Selector */}
                <View style={tw`px-4 pt-4`}>
                    <Text style={tw`text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide`}>Gudang Sumber</Text>
                    {loadingGudang ? (
                        <View style={tw`h-12 bg-gray-200 rounded-xl animate-pulse`} />
                    ) : (
                        <TouchableOpacity
                            onPress={() => setShowGudangModal(true)}
                            style={tw`flex-row items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-xl active:bg-gray-50`}
                        >
                            <View style={tw`flex-row items-center gap-3`}>
                                <View style={tw`w-8 h-8 rounded-full bg-blue-100 items-center justify-center`}>
                                    <Package size={16} color="#2563eb" />
                                </View>
                                <View>
                                    <Text style={tw`font-bold text-gray-900 text-sm`}>
                                        {selectedGudang ? gudangs.find(g => g.id === selectedGudang)?.nama : 'Pilih Gudang'}
                                    </Text>
                                    <Text style={tw`text-xs text-gray-500`}>
                                        {selectedGudang ? gudangs.find(g => g.id === selectedGudang)?.lokasi || 'Lokasi tidak tersedia' : 'Ketuk untuk memilih'}
                                    </Text>
                                </View>
                            </View>
                            <ChevronDown size={20} color="#6b7280" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Warehouse Modal */}
                <Modal
                    visible={showGudangModal}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setShowGudangModal(false)}
                >
                    <View style={tw`flex-1 bg-black/50 justify-end`}>
                        <View style={tw`bg-white rounded-t-3xl h-[80%] overflow-hidden`}>
                            <View style={tw`px-4 py-3 border-b border-gray-100 flex-row items-center justify-between bg-gray-50`}>
                                <Text style={tw`font-bold text-lg text-gray-900 shadow-sm`}>Pilih Gudang Sumber</Text>
                                <TouchableOpacity onPress={() => setShowGudangModal(false)} style={tw`p-2 bg-gray-200 rounded-full`}>
                                    <X size={20} color="#374151" />
                                </TouchableOpacity>
                            </View>

                            <View style={tw`p-4`}>
                                <View style={tw`flex-row items-center bg-gray-100 rounded-xl px-3 h-12 mb-4`}>
                                    <Search size={20} color="#9ca3af" />
                                    <TextInput
                                        style={tw`flex-1 ml-2 text-base text-gray-900`}
                                        placeholder="Cari gudang..."
                                        value={gudangSearch}
                                        onChangeText={setGudangSearch}
                                    />
                                </View>

                                <FlatList
                                    data={gudangs.filter(g => g.nama.toLowerCase().includes(gudangSearch.toLowerCase()))}
                                    keyExtractor={item => item.id}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            onPress={() => {
                                                if (selectedItems.length > 0 && selectedGudang !== item.id) {
                                                    Alert.alert('Konfirmasi', 'Mengganti gudang akan menghapus item yang sudah dipilih. Lanjutkan?', [
                                                        { text: 'Batal', style: 'cancel' },
                                                        { text: 'Ya', onPress: () => { setSelectedItems([]); setSelectedGudang(item.id); setShowGudangModal(false); } }
                                                    ]);
                                                } else {
                                                    setSelectedGudang(item.id);
                                                    setShowGudangModal(false);
                                                }
                                            }}
                                            style={tw`flex-row items-center justify-between p-4 mb-2 rounded-xl border ${selectedGudang === item.id ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}
                                        >
                                            <View>
                                                <Text style={tw`font-bold text-gray-900 ${selectedGudang === item.id ? 'text-blue-700' : ''}`}>{item.nama}</Text>
                                                <Text style={tw`text-xs text-gray-500 mt-0.5`}>{item.lokasi}</Text>
                                            </View>
                                            {selectedGudang === item.id && (
                                                <CheckCircle size={20} color="#2563eb" />
                                            )}
                                        </TouchableOpacity>
                                    )}
                                    ListEmptyComponent={
                                        <View style={tw`py-10 items-center`}>
                                            <Text style={tw`text-gray-400`}>Gudang tidak ditemukan</Text>
                                        </View>
                                    }
                                />
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Search & Filter */}
                <View style={tw`px-4 py-4 gap-3`}>
                    <View style={tw`flex-row gap-2`}>
                        <View style={tw`flex-1 flex-row items-center bg-white border border-gray-200 rounded-xl px-3 h-11`}>
                            <Search size={20} color="#9ca3af" />
                            <TextInput
                                style={tw`flex-1 ml-2 text-base text-gray-900`}
                                placeholder="Cari nama atau kode barang..."
                                value={search}
                                onChangeText={setSearch}
                            />
                        </View>
                        <TouchableOpacity
                            onPress={() => setShowAllItems(!showAllItems)}
                            style={tw`w-11 h-11 items-center justify-center rounded-xl border ${showAllItems ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}
                        >
                            <Filter size={20} color={showAllItems ? '#2563eb' : '#6b7280'} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Selected Items Summary */}
                {selectedItems.length > 0 && (
                    <View style={tw`mx-4 mb-4 bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden`}>
                        <View style={tw`bg-blue-50 px-4 py-3 border-b border-blue-100 flex-row justify-between items-center`}>
                            <Text style={tw`font-semibold text-blue-900`}>Keranjang ({selectedItems.length})</Text>
                            <TouchableOpacity onPress={() => setSelectedItems([])}>
                                <Text style={tw`text-xs text-red-600 font-medium`}>Hapus Semua</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={tw`p-2`}>
                            {selectedItems.map((item, idx) => (
                                <View key={`${item.barangId}-${item.kondisi}`} style={tw`flex-row items-center justify-between p-3 border-b border-gray-50 last:border-0`}>
                                    <View style={tw`flex-1`}>
                                        <Text style={tw`font-medium text-gray-900 truncate`}>{item.barang.nama}</Text>
                                        <View style={tw`flex-row items-center gap-2 mt-1`}>
                                            <View style={tw`px-1.5 py-0.5 rounded ${item.kondisi === 'BARU' ? 'bg-green-100' :
                                                item.kondisi === 'BEKAS' ? 'bg-yellow-100' : 'bg-red-100'
                                                }`}>
                                                <Text style={tw`text-[10px] font-bold ${item.kondisi === 'BARU' ? 'text-green-700' :
                                                    item.kondisi === 'BEKAS' ? 'text-yellow-700' : 'text-red-700'
                                                    }`}>{item.kondisi}</Text>
                                            </View>
                                            <Text style={tw`text-xs text-gray-500`}>{item.barang.satuan}</Text>
                                        </View>
                                    </View>
                                    <View style={tw`flex-row items-center gap-3 bg-gray-50 rounded-lg p-1`}>
                                        <TouchableOpacity onPress={() => updateQuantity(idx, -1)} style={tw`w-7 h-7 bg-white rounded-md items-center justify-center shadow-sm`}>
                                            <Minus size={14} color="#374151" />
                                        </TouchableOpacity>
                                        <Text style={tw`font-bold text-gray-900 w-4 text-center`}>{item.jumlah}</Text>
                                        <TouchableOpacity onPress={() => updateQuantity(idx, 1)} style={tw`w-7 h-7 bg-white rounded-md items-center justify-center shadow-sm`}>
                                            <Plus size={14} color="#374151" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Items List */}
                <View style={tw`px-4`}>
                    <Text style={tw`text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide`}>Daftar Barang</Text>
                    {loadingBarang ? (
                        <View style={tw`py-10 items-center`}>
                            <ActivityIndicator size="small" color="#3b82f6" />
                            <Text style={tw`text-xs text-gray-400 mt-2`}>Memuat barang...</Text>
                        </View>
                    ) : filteredBarangs.length === 0 ? (
                        <View style={tw`py-10 items-center bg-white rounded-xl border border-dashed border-gray-300`}>
                            <Package size={32} color="#d1d5db" />
                            <Text style={tw`text-sm text-gray-400 mt-2 font-medium`}>Barang tidak ditemukan</Text>
                        </View>
                    ) : (
                        <View style={tw`gap-3`}>
                            {filteredBarangs.map(barang => {
                                const hasStock = barang.stokBaru > 0 || barang.stokBekas > 0 || barang.stokRusak > 0;
                                return (
                                    <View key={barang.id} style={tw`bg-white p-4 rounded-xl border border-gray-100 shadow-sm`}>
                                        <View style={tw`mb-3`}>
                                            <Text style={tw`text-xs text-gray-400 font-mono mb-0.5`}>{barang.kode}</Text>
                                            <Text style={tw`font-semibold text-gray-900 text-base`}>{barang.nama}</Text>
                                            <Text style={tw`text-xs text-gray-500`}>{barang.satuan}</Text>
                                        </View>

                                        {!hasStock ? (
                                            <Text style={tw`text-xs text-red-500 font-medium text-center py-2 bg-red-50 rounded-lg`}>Stok Kosong</Text>
                                        ) : (
                                            <View style={tw`flex-row gap-2`}>
                                                <TouchableOpacity
                                                    onPress={() => addItem(barang, 'BARU')}
                                                    disabled={barang.stokBaru <= 0}
                                                    style={tw`flex-1 py-2 rounded-lg items-center ${barang.stokBaru > 0 ? 'bg-green-50 active:bg-green-100' : 'bg-gray-50 opacity-50'}`}
                                                >
                                                    <Text style={tw`text-[10px] font-bold text-green-700`}>BARU</Text>
                                                    <Text style={tw`text-xs text-green-800`}>{barang.stokBaru}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => addItem(barang, 'BEKAS')}
                                                    disabled={barang.stokBekas <= 0}
                                                    style={tw`flex-1 py-2 rounded-lg items-center ${barang.stokBekas > 0 ? 'bg-yellow-50 active:bg-yellow-100' : 'bg-gray-50 opacity-50'}`}
                                                >
                                                    <Text style={tw`text-[10px] font-bold text-yellow-700`}>BEKAS</Text>
                                                    <Text style={tw`text-xs text-yellow-800`}>{barang.stokBekas}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => addItem(barang, 'RUSAK')}
                                                    disabled={barang.stokRusak <= 0}
                                                    style={tw`flex-1 py-2 rounded-lg items-center ${barang.stokRusak > 0 ? 'bg-red-50 active:bg-red-100' : 'bg-gray-50 opacity-50'}`}
                                                >
                                                    <Text style={tw`text-[10px] font-bold text-red-700`}>RUSAK</Text>
                                                    <Text style={tw`text-xs text-red-800`}>{barang.stokRusak}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Bottom Action */}
            {selectedItems.length > 0 && (
                <View style={tw`absolute bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-200 shadow-2xl`}>
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={submitting}
                        style={tw`bg-blue-600 rounded-xl py-3.5 flex-row items-center justify-center gap-2 shadow-lg shadow-blue-200`}
                    >
                        {submitting ? (
                            <ActivityIndicator color="white" size="small" />
                        ) : (
                            <>
                                <Check size={20} color="white" />
                                <Text style={tw`text-white font-bold text-base`}>
                                    Ambil Barang ({selectedItems.reduce((a, b) => a + b.jumlah, 0)})
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}
