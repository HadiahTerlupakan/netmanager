import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Image, Dimensions, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useOfflineQuery } from '@/hooks/useOfflineQuery'; // Using query to get ticket number if needed? or params
import { useOfflineMutation } from '@/hooks/useOfflineMutation';
import { SyncService } from '@/services/SyncService';
import { format } from 'date-fns';
import axios from 'axios'; // Still used for non-sync stuff if any?
import { Config } from '../../../constants/Config';
import tw from 'twrnc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Camera, X, CheckCircle, Plus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

export default function CompleteWorkOrderScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { token } = useAuth();

    const [loading, setLoading] = useState(false);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [photos, setPhotos] = useState<string[]>([]); // Changed to Array
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [ticketNumber, setTicketNumber] = useState<string>(''); // To store ticket number

    // Offline Mutation
    const { mutate, isLoading: isMutating } = useOfflineMutation();

    useEffect(() => {
        (async () => {
            try {
                let currentLocation = await Location.getLastKnownPositionAsync({});
                if (!currentLocation) {
                    currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                }
                setLocation(currentLocation);
            } catch (error) {
                console.warn("Location Error:", error);
            }
        })();
        
        // Fetch specific WO details just for ticket number (lightweight)
        // or just rely on ID if ticket number is effectively ID for offline
        // Better: Fetch to get real ticket number
        const fetchTicketNum = async () => {
             try {
                const res = await axios.get(`${Config.API_URL}/api/mobile/work-orders/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    const wo = res.data.data;
                    setTicketNumber(wo.ticket?.ticketNumber || wo.workOrderNumber || id as string);
                }
             } catch (e) {
                // If offline, we might use ID as fallback
                setTicketNumber(id as string);
             }
        };
        fetchTicketNum();

    }, []);

    const pickImage = async () => {
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.5,
        });

        if (!result.canceled) {
            setPhotos(prev => [...prev, result.assets[0].uri]);
        }
    };

    const removePhoto = (index: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        // VALIDATION: Mandatory Notes & Photos
        if (!resolutionNotes.trim()) {
            Alert.alert('Perhatian', 'Mohon isi catatan pekerjaan.');
            return;
        }

        if (photos.length === 0) {
            Alert.alert('Perhatian', 'Wajib upload minimal 1 foto bukti pekerjaan.');
            return;
        }

        // Get fresh location
        let finalLocation = location;
        let locationName = '';

        try {
            finalLocation = await Location.getCurrentPositionAsync({});
            if (finalLocation) {
                const reverseGeocode = await Location.reverseGeocodeAsync({
                    latitude: finalLocation.coords.latitude,
                    longitude: finalLocation.coords.longitude
                });
                if (reverseGeocode.length > 0) {
                    const addr = reverseGeocode[0];
                    locationName = `${addr.street || ''} ${addr.district || ''} ${addr.city || ''}`.trim();
                    if (!locationName) locationName = addr.name || addr.region || '';
                }
            }
        } catch (e) {
            console.log("Loc error", e);
        }
        
        // Watermark Lines
        // Construct Location String similar to backend logic
        const coords = (finalLocation) ? `(${finalLocation.coords.latitude.toFixed(6)}, ${finalLocation.coords.longitude.toFixed(6)})` : '';
        let locStr = locationName || `Loc: ${coords}` || 'Loc: Unknown';
        
        // Note: Indexing 1/N is not supported in bulk generic sync yet, simplified watermark
        const watermarkLines = [
             format(new Date(), 'dd MMM yyyy HH:mm'),
             `#${ticketNumber}`,
             `Tech: ${'Teknisi'}`, // Specific user name might not be available if not in context, 'Teknisi' is generic safe
             locStr
        ];

        const payload = {
            action: 'COMPLETE',
            latitude: finalLocation?.coords.latitude.toString(),
            longitude: finalLocation?.coords.longitude.toString(),
            locationName,
            notes: resolutionNotes
        };
        
        await mutate({
            ...payload,
            photoUrls: [], // Placeholder
            meta: {
                photos: photos,
                targetField: 'photoUrls', // Backend expects photoUrls array for COMPLETE
                singleFile: false,
                photoType: 'workorder-completion',
                watermarkLines
            }
        }, {
            url: `/api/mobile/work-orders/${id}/update`,
            method: 'POST',
            onSuccess: (data, isOffline) => {
                if (isOffline) {
                    Alert.alert('Offline', 'Laporan disimpan di antrian.', [
                        { text: 'OK', onPress: () => router.replace('/(app)/dashboard') }
                    ]);
                } else {
                    Alert.alert('Berhasil', 'Pekerjaan telah diselesaikan dan laporan terkirim!', [
                        { text: 'OK', onPress: () => router.replace('/(app)/dashboard') }
                    ]);
                }
            },
            onError: (err) => Alert.alert('Gagal', err.message || 'Gagal menyelesaikan pekerjaan')
        });
    };

    return (
        <SafeAreaView style={tw`flex-1 bg-white`}>
            {/* Header */}
            <View style={tw`px-4 py-3 flex-row items-center border-b border-gray-100`}>
                <TouchableOpacity onPress={() => router.back()} style={tw`p-2 mr-2 -ml-2`}>
                    <ArrowLeft size={24} color="#1f2937" />
                </TouchableOpacity>
                <View>
                    <Text style={tw`font-bold text-lg text-gray-800`}>Laporan Penyelesaian</Text>
                    <Text style={tw`text-xs text-gray-500`}>Lengkapi bukti pekerjaan</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={tw`p-5`}>

                <View style={tw`items-center mb-6`}>
                    <View style={tw`w-14 h-14 bg-green-100 rounded-full items-center justify-center mb-2`}>
                        <CheckCircle size={28} color="#16a34a" />
                    </View>
                    <Text style={tw`text-gray-500 text-center text-xs px-8`}>
                        Pastikan semua bukti foto memiliki pencahayaan yang baik. Sistem akan otomatis menambahkan watermark (Lokasi & Waktu).
                    </Text>
                </View>

                {/* Form */}
                <Text style={tw`font-bold text-gray-700 mb-2`}>Catatan Pengerjaan <Text style={tw`text-red-500`}>*</Text></Text>
                <TextInput
                    style={tw`border border-gray-200 rounded-xl p-4 text-sm h-28 mb-6 bg-gray-50`}
                    multiline
                    textAlignVertical="top"
                    placeholder="Jelaskan apa saja yang dikerjakan..."
                    value={resolutionNotes}
                    onChangeText={setResolutionNotes}
                />

                <View style={tw`flex-row justify-between items-center mb-2`}>
                    <Text style={tw`font-bold text-gray-700`}>Foto Bukti <Text style={tw`text-red-500`}>*</Text></Text>
                    <Text style={tw`text-xs text-gray-400`}>{photos.length} Foto</Text>
                </View>

                {/* Photo Grid */}
                <View style={tw`flex-row flex-wrap gap-2 mb-8`}>
                    {photos.map((uri, index) => (
                        <View key={index} style={tw`w-[31%] aspect-square relative`}>
                            <Image source={{ uri }} style={tw`w-full h-full rounded-xl border border-gray-200`} resizeMode="cover" />
                            <TouchableOpacity
                                onPress={() => removePhoto(index)}
                                style={tw`absolute -top-2 -right-2 bg-red-500 p-1.5 rounded-full border border-white`}
                            >
                                <X color="white" size={12} />
                            </TouchableOpacity>
                            <View style={tw`absolute bottom-1 right-1 bg-black/60 px-1.5 py-0.5 rounded text-white`}>
                                <Text style={tw`text-[10px] text-white font-bold`}>{index + 1}</Text>
                            </View>
                        </View>
                    ))}

                    {/* Add Button */}
                    <TouchableOpacity
                        onPress={pickImage}
                        style={tw`w-[31%] aspect-square rounded-xl border-2 border-dashed border-gray-300 items-center justify-center bg-gray-50 active:bg-blue-50 active:border-blue-300`}
                    >
                        <Camera size={24} color="#9ca3af" />
                        <Text style={tw`text-[10px] text-gray-400 mt-1 font-bold`}>+ FOTO</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>

            {/* Bottom Button */}
            <View style={tw`p-4 border-t border-gray-100`}>
                <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={isMutating}
                    style={tw`w-full bg-green-600 py-4 rounded-xl items-center shadow-lg shadow-green-200 ${(isMutating || !resolutionNotes || photos.length === 0) ? 'opacity-70' : ''}`}
                >
                    {isMutating ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={tw`font-bold text-white text-base`}>Kirim Laporan & Selesai</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
