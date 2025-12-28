import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Image, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect, useRef } from 'react';
import tw from 'twrnc';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { Config } from '@/constants/Config';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { captureRef } from 'react-native-view-shot';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useOfflineQuery } from '@/hooks/useOfflineQuery';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';
import { SyncService } from '@/services/SyncService';

interface Gudang {
    id: string;
    nama: string;
}

interface Barang {
    id: string;
    kode: string;
    nama: string;
    satuan: string;
    stok: number;
    stokBaru: number;
    stokBekas: number;
    stokRusak: number;
}

interface PhotoWithMeta {
    uri: string;
    width: number;
    height: number;
    capturedAt: Date;
}

const KONDISI_OPTIONS = [
    { label: 'Baru', value: 'BARU' },
    { label: 'Bekas', value: 'BEKAS' },
    { label: 'Rusak', value: 'RUSAK' }
];

export default function BarangKeluarScreen() {
    const router = useRouter();
    const { token, user } = useAuth();
    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === 'dark';
    const pickerItemColor = isDarkMode ? '#FFFFFF' : '#1F2937';
    // Ensure the collapsed picker text is always dark because our container is bg-white
    const pickerStyle = { color: '#1F2937' };

    const [gudangs, setGudangs] = useState<Gudang[]>([]);
    const [barangs, setBarangs] = useState<Barang[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [selectedGudang, setSelectedGudang] = useState('');
    const [selectedBarang, setSelectedBarang] = useState('');
    const [jumlah, setJumlah] = useState('');
    const [kondisi, setKondisi] = useState('BARU');
    const [keterangan, setKeterangan] = useState('');
    const [tujuanPenggunaan, setTujuanPenggunaan] = useState('');
    const [photos, setPhotos] = useState<PhotoWithMeta[]>([]);

    // Refs for watermark capture
    const watermarkRefs = useRef<(View | null)[]>([]);

    const { mutate, isLoading: isMutating } = useOfflineMutation();

    // Offline Query: Gudangs
    const { data: gudangData, isLoading: loadingGudangs } = useOfflineQuery<Gudang[]>({
        key: 'gudang_list',
        fetcher: async () => {
             const res = await axios.get(`${Config.API_URL}/api/mobile/inventory/gudang`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data?.gudangList || res.data?.data || [];
        },
        enabled: !!token
    });

    useEffect(() => {
        if (gudangData) setGudangs(gudangData);
    }, [gudangData]);

    // Offline Query: Barangs
    const { data: barangData, isLoading: loadingBarangs } = useOfflineQuery<Barang[]>({
        key: `barang_list_${selectedGudang}`,
        fetcher: async () => {
            const res = await axios.get(`${Config.API_URL}/api/mobile/inventory/barang?gudangId=${selectedGudang}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data?.barangList || [];
        },
        enabled: !!token && !!selectedGudang
    });

    useEffect(() => {
        if (barangData) setBarangs(barangData);
        else if (!selectedGudang) setBarangs([]);
    }, [barangData, selectedGudang]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Izin akses galeri diperlukan');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.7,
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            setPhotos([...photos, {
                uri: asset.uri,
                width: asset.width,
                height: asset.height,
                capturedAt: new Date()
            }]);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Izin akses kamera diperlukan');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 0.7,
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            setPhotos([...photos, {
                uri: asset.uri,
                width: asset.width,
                height: asset.height,
                capturedAt: new Date()
            }]);
        }
    };

    const removePhoto = (index: number) => {
        setPhotos(photos.filter((_, i) => i !== index));
    };

    const captureWatermarkedPhoto = async (index: number): Promise<string | null> => {
        const ref = watermarkRefs.current[index];
        if (!ref) return photos[index]?.uri || null;

        try {
            const uri = await captureRef(ref, {
                format: 'jpg',
                quality: 0.8,
            });
            return uri;
        } catch (error) {
            console.error('Watermark capture error:', error);
            return photos[index]?.uri || null;
        }
    };

    const processPhotos = async (): Promise<string[]> => {
        const processedUris: string[] = [];
        for (let i = 0; i < photos.length; i++) {
            const watermarkedUri = await captureWatermarkedPhoto(i);
            if (watermarkedUri) processedUris.push(watermarkedUri);
        }
        return processedUris;
    };

    const uploadPhotos = async (uris: string[]): Promise<string[]> => {
        const uploadedUrls: string[] = [];

        for (const uri of uris) {
            try {
                const formData = new FormData();
                const filename = uri.split('/').pop() || 'photo.jpg';
                formData.append('file', {
                    uri: uri,
                    type: 'image/jpeg',
                    name: filename,
                } as any);
                formData.append('type', 'inventory-keluar');

                const res = await axios.post(`${Config.API_URL}/api/mobile/upload`, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    }
                });

                if (res.data?.url) {
                    uploadedUrls.push(res.data.url);
                }
            } catch (error) {
                console.error('Failed to upload photo:', error);
            }
        }
        return uploadedUrls;
    };

    const selectedBarangData = barangs.find(b => b.id === selectedBarang);
    const selectedBarangName = selectedBarangData ? `${selectedBarangData.kode} - ${selectedBarangData.nama}` : '';

    const getAvailableStock = () => {
        if (!selectedBarangData) return 0;
        if (kondisi === 'BEKAS') return selectedBarangData.stokBekas || 0;
        if (kondisi === 'RUSAK') return selectedBarangData.stokRusak || 0;
        return selectedBarangData.stokBaru || 0;
    };

    const handleSubmit = async () => {
        if (!selectedGudang || !selectedBarang || !jumlah) {
            Alert.alert('Error', 'Gudang, Barang, dan Jumlah wajib diisi');
            return;
        }

        const qty = parseInt(jumlah);
        if (isNaN(qty) || qty <= 0) {
            Alert.alert('Error', 'Jumlah harus berupa angka positif');
            return;
        }

        const availableStock = getAvailableStock();
        if (qty > availableStock) {
            Alert.alert('Error', `Stok ${kondisi} tidak mencukupi. Tersedia: ${availableStock}`);
            return;
        }

        // 1. Process Photos (Capture Watermark)
        const processedPhotos = await processPhotos();
        
        // 2. Check Connection
        const isOnline = await SyncService.isOnline();
        
        // 3. Prepare Data
        const payload = {
            barangId: selectedBarang,
            gudangId: selectedGudang,
            jumlah: qty,
            kondisi,
            keterangan,
            tujuanPenggunaan,
        };

        if (isOnline) {
            setSubmitting(true);
            try {
                // Upload photos first
                const uploadedUrls = await uploadPhotos(processedPhotos);
                
                 // Submit via Mutate (Online)
                 await mutate({
                    ...payload,
                    fotoBukti: uploadedUrls
                }, {
                    url: '/api/mobile/inventory/keluar',
                    method: 'POST',
                    onSuccess: () => {
                        Alert.alert('Sukses', 'Barang keluar berhasil dicatat', [
                            { text: 'OK', onPress: () => router.back() }
                        ]);
                    },
                    onError: (err) => Alert.alert('Error', err.message || 'Gagal menyimpan data')
                });

            } catch (error) {
                Alert.alert('Error', 'Gagal upload foto atau simpan data');
            } finally {
                setSubmitting(false);
            }
        } else {
             // Offline - Submit to Queue with Local URIs
             await mutate({
                ...payload,
                fotoBukti: [], // Placeholder
                meta: {
                    photos: processedPhotos, // Local URIs for SyncService
                    targetField: 'fotoBukti' 
                }
            }, {
                url: '/api/mobile/inventory/keluar',
                method: 'POST',
                onSuccess: (data, isOffline) => {
                    if (isOffline) {
                        router.back();
                    }
                }
            });
        }
    };

    return (
        <View style={tw`flex-1 bg-gray-50`}>
            {/* Header */}
            <View style={tw`bg-white px-4 py-4 border-b border-gray-100`}>
                <View style={tw`flex-row items-center justify-between`}>
                    <TouchableOpacity onPress={() => router.back()} style={tw`p-2 -ml-2`}>
                        <Ionicons name="arrow-back" size={24} color="#374151" />
                    </TouchableOpacity>
                    <Text style={tw`text-lg font-bold text-gray-900`}>Barang Keluar</Text>
                    <View style={tw`w-8`} />
                </View>
            </View>

            <ScrollView style={tw`flex-1`} keyboardShouldPersistTaps="handled">
                <View style={tw`p-4`}>
                    {/* Gudang Picker */}
                    <View style={tw`mb-4`}>
                        <Text style={tw`text-sm font-medium text-gray-700 mb-2`}>Gudang *</Text>
                        <View style={tw`bg-white border border-gray-200 rounded-xl overflow-hidden justify-center h-14`}>
                            <Picker
                                selectedValue={selectedGudang}
                                onValueChange={(itemValue) => setSelectedGudang(String(itemValue))}
                                mode="dropdown"
                                style={pickerStyle}
                                dropdownIconColor={isDarkMode ? '#FFFFFF' : '#1F2937'}
                            >
                                <Picker.Item label="Pilih Gudang..." value="" color={isDarkMode ? '#9CA3AF' : '#9CA3AF'} />
                                {gudangs.map(g => (
                                    <Picker.Item key={g.id} label={g.nama} value={String(g.id)} color={pickerItemColor} />
                                ))}
                            </Picker>
                        </View>
                    </View>

                    {/* Barang Picker */}
                    <View style={tw`mb-4`}>
                        <Text style={tw`text-sm font-medium text-gray-700 mb-2`}>Barang *</Text>
                        <View style={tw`bg-white border border-gray-200 rounded-xl overflow-hidden justify-center h-14`}>
                            {loading ? (
                                <View style={tw`h-14 items-center justify-center`}>
                                    <ActivityIndicator size="small" color="#3B82F6" />
                                </View>
                            ) : (
                                <Picker
                                    selectedValue={selectedBarang}
                                    onValueChange={(itemValue) => setSelectedBarang(String(itemValue))}
                                    enabled={!!selectedGudang}
                                    mode="dropdown"
                                    style={pickerStyle}
                                    dropdownIconColor={isDarkMode ? '#FFFFFF' : '#1F2937'}
                                >
                                    <Picker.Item label={selectedGudang ? "Pilih Barang..." : "Pilih gudang dulu"} value="" color={isDarkMode ? '#9CA3AF' : '#9CA3AF'} />
                                    {barangs.map(b => (
                                        <Picker.Item key={b.id} label={`${b.kode} - ${b.nama}`} value={String(b.id)} color={pickerItemColor} />
                                    ))}
                                </Picker>
                            )}
                        </View>
                        {selectedBarangData && (
                            <View style={tw`mt-2 p-3 bg-blue-50 rounded-lg`}>
                                <Text style={tw`text-xs text-blue-700 font-medium`}>
                                    Satuan: {selectedBarangData.satuan}
                                </Text>
                                <Text style={tw`text-xs text-blue-700 mt-1`}>
                                    Stok: Baru ({selectedBarangData.stokBaru || 0}) | Bekas ({selectedBarangData.stokBekas || 0}) | Rusak ({selectedBarangData.stokRusak || 0})
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Kondisi */}
                    <View style={tw`mb-4`}>
                        <Text style={tw`text-sm font-medium text-gray-700 mb-2`}>Kondisi</Text>
                        <View style={tw`bg-white border border-gray-200 rounded-xl overflow-hidden justify-center h-14`}>
                            <Picker
                                selectedValue={kondisi}
                                onValueChange={(itemValue) => setKondisi(String(itemValue))}
                                style={pickerStyle}
                                dropdownIconColor={isDarkMode ? '#FFFFFF' : '#1F2937'}
                            >
                                {KONDISI_OPTIONS.map(k => (
                                    <Picker.Item key={k.value} label={k.label} value={k.value} color={pickerItemColor} />
                                ))}
                            </Picker>
                        </View>
                        {selectedBarangData && (
                            <Text style={tw`text-xs text-gray-500 mt-1`}>
                                Stok {kondisi} tersedia: {getAvailableStock()}
                            </Text>
                        )}
                    </View>

                    {/* Jumlah */}
                    <View style={tw`mb-4`}>
                        <Text style={tw`text-sm font-medium text-gray-700 mb-2`}>Jumlah *</Text>
                        <TextInput
                            style={tw`bg-white border border-gray-200 rounded-xl px-4 py-3 text-base`}
                            placeholder="Masukkan jumlah"
                            keyboardType="numeric"
                            value={jumlah}
                            onChangeText={setJumlah}
                        />
                    </View>

                    {/* Tujuan Penggunaan */}
                    <View style={tw`mb-4`}>
                        <Text style={tw`text-sm font-medium text-gray-700 mb-2`}>Tujuan Penggunaan</Text>
                        <TextInput
                            style={tw`bg-white border border-gray-200 rounded-xl px-4 py-3 text-base`}
                            placeholder="Untuk apa barang ini digunakan"
                            value={tujuanPenggunaan}
                            onChangeText={setTujuanPenggunaan}
                        />
                    </View>

                    {/* Keterangan */}
                    <View style={tw`mb-4`}>
                        <Text style={tw`text-sm font-medium text-gray-700 mb-2`}>Keterangan</Text>
                        <TextInput
                            style={tw`bg-white border border-gray-200 rounded-xl px-4 py-3 text-base h-24`}
                            placeholder="Catatan tambahan (opsional)"
                            value={keterangan}
                            onChangeText={setKeterangan}
                            multiline
                            textAlignVertical="top"
                        />
                    </View>

                    {/* Photo Upload */}
                    <View style={tw`mb-6`}>
                        <Text style={tw`text-sm font-medium text-gray-700 mb-2`}>Foto Bukti</Text>

                        {/* Small Thumbnail Grid */}
                        {photos.length > 0 && (
                            <View style={tw`flex-row flex-wrap gap-2 mb-3`}>
                                {photos.map((photo, index) => (
                                    <View key={index} style={tw`relative`}>
                                        <Image
                                            source={{ uri: photo.uri }}
                                            style={tw`w-20 h-20 rounded-lg`}
                                        />
                                        <TouchableOpacity
                                            style={tw`absolute -top-2 -right-2 bg-red-500 rounded-full p-1`}
                                            onPress={() => removePhoto(index)}
                                        >
                                            <Ionicons name="close" size={14} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Hidden Watermark Views for Capture */}
                        {/* Hidden Watermark Views for Capture - Use 0 opacity but keep in layout bounds for reliable capture */}
                        <View style={[tw`absolute`, { top: 0, left: 0, right: 0, opacity: 0, zIndex: -10 }]} pointerEvents="none">
                            {photos.map((photo, index) => (
                                <View
                                    key={index}
                                    ref={(ref) => { watermarkRefs.current[index] = ref; }}
                                    collapsable={false}
                                    style={{ width: photo.width, height: photo.height, backgroundColor: 'black' }}
                                >
                                    <Image
                                        source={{ uri: photo.uri }}
                                        style={{ width: photo.width, height: photo.height }}
                                        resizeMode="contain"
                                    />
                                    {/* Watermark Overlay - Dynamic Sizing */}
                                    <View style={[
                                        tw`absolute bottom-0 left-0 right-0 bg-black/70`,
                                        { padding: photo.width * 0.04 }
                                    ]}>
                                        <Text style={{ 
                                            color: '#FB923C', // orange-400
                                            fontWeight: 'bold', 
                                            marginBottom: photo.width * 0.01,
                                            fontSize: photo.width * 0.05 
                                        }}>
                                            📤 BARANG KELUAR
                                        </Text>
                                        <Text style={{ 
                                            color: 'white', 
                                            fontSize: photo.width * 0.035,
                                            marginBottom: photo.width * 0.005
                                        }}>
                                            {selectedBarangName || 'Memilih barang...'}
                                        </Text>
                                        <Text style={{ 
                                            color: 'white', 
                                            fontSize: photo.width * 0.035,
                                            marginBottom: photo.width * 0.005
                                        }}>
                                            Jumlah: {jumlah || '0'} | Kondisi: {kondisi}
                                        </Text>
                                        {tujuanPenggunaan && (
                                            <Text style={{ 
                                                color: 'rgba(255,255,255,0.8)', 
                                                fontSize: photo.width * 0.035,
                                                marginBottom: photo.width * 0.02
                                            }}>
                                                Tujuan: {tujuanPenggunaan}
                                            </Text>
                                        )}
                                        <View style={tw`flex-row items-center mt-1`}>
                                            <Text style={{ 
                                                color: 'rgba(255,255,255,0.8)', 
                                                fontSize: photo.width * 0.03 
                                            }}>
                                                ⏰ {format(photo.capturedAt, 'HH:mm:ss')} • {format(photo.capturedAt, 'd MMM yyyy', { locale: idLocale })}
                                            </Text>
                                        </View>
                                        <Text style={{ 
                                            color: 'rgba(255,255,255,0.6)', 
                                            fontSize: photo.width * 0.03,
                                            marginTop: photo.width * 0.01
                                        }}>
                                            👤 {user?.name || 'User'}
                                        </Text>
                                    </View>
                                </View>
                            ))}
                        </View>

                        {/* Photo Buttons */}
                        <View style={tw`flex-row gap-3`}>
                            <TouchableOpacity
                                style={tw`flex-1 flex-row items-center justify-center bg-white border border-gray-200 rounded-xl py-3`}
                                onPress={takePhoto}
                            >
                                <Ionicons name="camera" size={20} color="#14B8A6" />
                                <Text style={tw`ml-2 text-teal-600 font-medium`}>Kamera</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={tw`flex-1 flex-row items-center justify-center bg-white border border-gray-200 rounded-xl py-3`}
                                onPress={pickImage}
                            >
                                <Ionicons name="images" size={20} color="#14B8A6" />
                                <Text style={tw`ml-2 text-teal-600 font-medium`}>Galeri</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={tw`bg-teal-600 rounded-xl py-4 items-center ${(submitting || isMutating) ? 'opacity-50' : ''}`}
                        onPress={handleSubmit}
                        disabled={submitting || isMutating}
                    >
                        {(submitting || isMutating) ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text style={tw`text-white font-bold text-base`}>Simpan</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}
