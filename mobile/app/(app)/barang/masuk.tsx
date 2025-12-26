import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator, Image } from 'react-native';
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

interface Gudang {
    id: string;
    nama: string;
    kode?: string;
}

interface Barang {
    id: string;
    kode: string;
    nama: string;
    satuan: string;
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

export default function BarangMasukScreen() {
    const router = useRouter();
    const { token, user } = useAuth();

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
    const [photos, setPhotos] = useState<PhotoWithMeta[]>([]);

    // Refs for watermark capture
    const watermarkRefs = useRef<(View | null)[]>([]);

    useEffect(() => {
        fetchGudangs();
    }, []);

    useEffect(() => {
        if (selectedGudang) {
            fetchBarangs(selectedGudang);
        } else {
            setBarangs([]);
            setSelectedBarang('');
        }
    }, [selectedGudang]);

    const fetchGudangs = async () => {
        try {
            const res = await axios.get(`${Config.API_URL}/api/mobile/inventory/gudang`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setGudangs(res.data?.gudangList || res.data?.data || []);
        } catch (error) {
            console.error('Failed to fetch gudangs:', error);
            Alert.alert('Error', 'Gagal memuat daftar gudang');
        }
    };

    const fetchBarangs = async (gudangId: string) => {
        setLoading(true);
        try {
            const res = await axios.get(`${Config.API_URL}/api/mobile/inventory/barang?gudangId=${gudangId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBarangs(res.data?.barangList || []);
        } catch (error) {
            console.error('Failed to fetch barangs:', error);
        } finally {
            setLoading(false);
        }
    };

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

    const uploadPhotos = async (): Promise<string[]> => {
        const uploadedUrls: string[] = [];

        for (let i = 0; i < photos.length; i++) {
            try {
                // Capture watermarked version
                const watermarkedUri = await captureWatermarkedPhoto(i);
                if (!watermarkedUri) continue;

                const formData = new FormData();
                const filename = watermarkedUri.split('/').pop() || 'photo.jpg';
                formData.append('file', {
                    uri: watermarkedUri,
                    type: 'image/jpeg',
                    name: filename,
                } as any);
                formData.append('type', 'inventory-masuk');

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

        setSubmitting(true);
        try {
            // Upload photos first (with watermark)
            let fotoBukti: string[] = [];
            if (photos.length > 0) {
                fotoBukti = await uploadPhotos();
            }

            const res = await axios.post(
                `${Config.API_URL}/api/mobile/inventory/masuk`,
                {
                    barangId: selectedBarang,
                    gudangId: selectedGudang,
                    jumlah: qty,
                    kondisi,
                    keterangan,
                    fotoBukti
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success) {
                Alert.alert('Sukses', 'Barang masuk berhasil dicatat', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            }
        } catch (error: any) {
            console.error('Submit error:', error);
            Alert.alert('Error', error.response?.data?.error || 'Gagal menyimpan data');
        } finally {
            setSubmitting(false);
        }
    };

    const selectedBarangData = barangs.find(b => b.id === selectedBarang);
    const selectedBarangName = selectedBarangData ? `${selectedBarangData.kode} - ${selectedBarangData.nama}` : '';

    return (
        <View style={tw`flex-1 bg-gray-50`}>
            {/* Header */}
            <View style={tw`bg-white px-4 py-4 border-b border-gray-100`}>
                <View style={tw`flex-row items-center justify-between`}>
                    <TouchableOpacity onPress={() => router.back()} style={tw`p-2 -ml-2`}>
                        <Ionicons name="arrow-back" size={24} color="#374151" />
                    </TouchableOpacity>
                    <Text style={tw`text-lg font-bold text-gray-900`}>Barang Masuk</Text>
                    <View style={tw`w-8`} />
                </View>
            </View>

            <ScrollView style={tw`flex-1`} keyboardShouldPersistTaps="handled">
                <View style={tw`p-4`}>
                    {/* Gudang Picker */}
                    <View style={tw`mb-4`}>
                        <Text style={tw`text-sm font-medium text-gray-700 mb-2`}>Gudang *</Text>
                        <View style={tw`bg-white border border-gray-200 rounded-xl overflow-hidden`}>
                            <Picker
                                selectedValue={selectedGudang}
                                onValueChange={(value) => setSelectedGudang(value)}
                                style={tw`h-12`}
                            >
                                <Picker.Item label="Pilih Gudang..." value="" />
                                {gudangs.map(g => (
                                    <Picker.Item key={g.id} label={g.nama} value={g.id} />
                                ))}
                            </Picker>
                        </View>
                    </View>

                    {/* Barang Picker */}
                    <View style={tw`mb-4`}>
                        <Text style={tw`text-sm font-medium text-gray-700 mb-2`}>Barang *</Text>
                        <View style={tw`bg-white border border-gray-200 rounded-xl overflow-hidden`}>
                            {loading ? (
                                <View style={tw`h-12 items-center justify-center`}>
                                    <ActivityIndicator size="small" color="#3B82F6" />
                                </View>
                            ) : (
                                <Picker
                                    selectedValue={selectedBarang}
                                    onValueChange={(value) => setSelectedBarang(value)}
                                    style={tw`h-12`}
                                    enabled={!!selectedGudang}
                                >
                                    <Picker.Item label={selectedGudang ? "Pilih Barang..." : "Pilih gudang dulu"} value="" />
                                    {barangs.map(b => (
                                        <Picker.Item key={b.id} label={`${b.kode} - ${b.nama}`} value={b.id} />
                                    ))}
                                </Picker>
                            )}
                        </View>
                        {selectedBarangData && (
                            <Text style={tw`text-xs text-gray-500 mt-1`}>
                                Satuan: {selectedBarangData.satuan}
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

                    {/* Kondisi */}
                    <View style={tw`mb-4`}>
                        <Text style={tw`text-sm font-medium text-gray-700 mb-2`}>Kondisi</Text>
                        <View style={tw`bg-white border border-gray-200 rounded-xl overflow-hidden`}>
                            <Picker
                                selectedValue={kondisi}
                                onValueChange={(value) => setKondisi(value)}
                                style={tw`h-12`}
                            >
                                {KONDISI_OPTIONS.map(k => (
                                    <Picker.Item key={k.value} label={k.label} value={k.value} />
                                ))}
                            </Picker>
                        </View>
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
                        <View style={tw`absolute -left-[9999px]`}>
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
                                    {/* Watermark Overlay */}
                                    <View style={tw`absolute bottom-0 left-0 right-0 bg-black/70 p-2`}>
                                        <Text style={tw`text-white font-bold text-xs`}>
                                            📦 BARANG MASUK
                                        </Text>
                                        <Text style={tw`text-white text-xs`}>
                                            {selectedBarangName || 'Memilih barang...'}
                                        </Text>
                                        <Text style={tw`text-white text-xs`}>
                                            Jumlah: {jumlah || '0'} | Kondisi: {kondisi}
                                        </Text>
                                        <View style={tw`flex-row items-center mt-1`}>
                                            <Text style={tw`text-white/80 text-[10px]`}>
                                                ⏰ {format(photo.capturedAt, 'HH:mm:ss')} • {format(photo.capturedAt, 'd MMM yyyy', { locale: idLocale })}
                                            </Text>
                                        </View>
                                        <Text style={tw`text-white/60 text-[10px]`}>
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
                                <Ionicons name="camera" size={20} color="#3B82F6" />
                                <Text style={tw`ml-2 text-blue-600 font-medium`}>Kamera</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={tw`flex-1 flex-row items-center justify-center bg-white border border-gray-200 rounded-xl py-3`}
                                onPress={pickImage}
                            >
                                <Ionicons name="images" size={20} color="#3B82F6" />
                                <Text style={tw`ml-2 text-blue-600 font-medium`}>Galeri</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={tw`bg-blue-600 rounded-xl py-4 items-center ${submitting ? 'opacity-50' : ''}`}
                        onPress={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? (
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
