import { View, Text, TouchableOpacity, ScrollView, Alert, Image, TextInput, Modal, ActivityIndicator, RefreshControl } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useState, useEffect, useRef, useCallback } from 'react';
import tw from 'twrnc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { MapPin, Clock, X, RotateCcw, Camera, ArrowLeft, Timer, Plus, CheckCircle } from 'lucide-react-native';
import axios from 'axios';
import { Config } from '@/constants/Config';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import { useOfflineQuery } from '@/hooks/useOfflineQuery';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';

interface Overtime {
    id: string;
    createdAt: string;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
    startTime?: string;
    endTime?: string;
    duration?: number;
    rejectionReason?: string;
}

interface HolidayInfo {
    description: string;
    isNational: boolean;
}

export default function LemburScreen() {
    const { user, token } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Data States
    const [history, setHistory] = useState<Overtime[]>([]);
    const [todayRequest, setTodayRequest] = useState<Overtime | null>(null);
    const [hasCheckedOut, setHasCheckedOut] = useState(false);
    const [holidayInfo, setHolidayInfo] = useState<HolidayInfo | null>(null);

    // Location
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [locationName, setLocationName] = useState('Mencari lokasi...');

    // Request Modal
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [reason, setReason] = useState('');

    // Camera & Photo States
    const [showCamera, setShowCamera] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [photo, setPhoto] = useState<string | null>(null);
    const [activeAction, setActiveAction] = useState<'start' | 'stop' | null>(null);
    const cameraRef = useRef<CameraView>(null);
    const [facing, setFacing] = useState<CameraType>('front');
    const watermarkRef = useRef<View>(null);
    const [capturedTime, setCapturedTime] = useState<Date | null>(null);

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Offline Query
    const { data: overtimeData, isLoading: loadingData, refetch: fetchData } = useOfflineQuery({
        key: 'overtime_data',
        fetcher: async () => {
             const res = await axios.get(`${Config.API_URL}/api/mobile/overtime`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data;
        },
        enabled: !!token
    });
    
    // Offline Mutation
    const { mutate, isLoading: isMutating } = useOfflineMutation();

    useEffect(() => {
        if (overtimeData) {
            setHistory(overtimeData.history || []);
            setHasCheckedOut(overtimeData.hasCheckedOut || false);
            setHolidayInfo(overtimeData.holidayInfo || null);

            // Find today's active request
            const todayStr = new Date().toISOString().split('T')[0];
            const today = (overtimeData.history || []).find(
                (item: Overtime) => item.createdAt.startsWith(todayStr) || item.status === 'IN_PROGRESS'
            );
            setTodayRequest(today || null);
        }
    }, [overtimeData]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
            getLocation();
        }, [fetchData])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        await getLocation();
        setRefreshing(false);
    };

    // Location
    const getLocation = async () => {
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Izin Ditolak', 'Aplikasi membutuhkan izin lokasi.');
                return;
            }

            let loc = await Location.getLastKnownPositionAsync({});
            if (!loc) {
                loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            }

            setLocation(loc);

            try {
                const reverse = await Location.reverseGeocodeAsync({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude
                });
                if (reverse.length > 0) {
                    const addr = reverse[0];
                    setLocationName(`${addr.street || ''} ${addr.district || ''}, ${addr.city || ''}`);
                }
            } catch (e) {
                setLocationName(`${loc.coords.latitude.toFixed(6)}, ${loc.coords.longitude.toFixed(6)}`);
            }
        } catch (error) {
            console.warn("Location Error in Lembur:", error);
            setLocationName("Lokasi tidak ditemukan");
            // Optional: Alert user if necessary, or just fail silently for UI
        }
    };

        if (!reason.trim()) {
            Alert.alert('Error', 'Alasan wajib diisi');
            return;
        }
        
        await mutate({
             action: 'request',
             date: new Date().toISOString(),
             reason: reason.trim()
        }, {
             url: `/api/mobile/overtime`,
             method: 'POST',
             onSuccess: (data, isOffline) => {
                  Alert.alert(isOffline ? 'Offline' : 'Sukses', isOffline ? 'Pengajuan diantrikan' : 'Pengajuan berhasil dikirim');
                  setShowRequestModal(false);
                  setReason('');
                  fetchData();
             },
             onError: (err) => Alert.alert('Error', err.message || 'Gagal mengirim pengajuan')
        });
    };

    // Camera functions
    const handleCapture = async () => {
        if (cameraRef.current) {
            const result = await cameraRef.current.takePictureAsync({
                quality: 0.7,
                skipProcessing: false
            });
            setPhoto(result?.uri ?? null);
            setCapturedTime(new Date());
            setShowCamera(false);
        }
    };

    const startCamera = (action: 'start' | 'stop') => {
        setActiveAction(action);
        setShowCamera(true);
    };

    // Capture watermarked photo  
    const captureWatermarkedPhoto = async (): Promise<string | null> => {
        if (!watermarkRef.current) return photo;
        try {
            const uri = await captureRef(watermarkRef, {
                format: 'jpg',
                quality: 0.8,
            });
            return uri;
        } catch (error) {
            console.error('Watermark capture error:', error);
            return photo;
        }
    };

    // Submit action
    const submitAction = async () => {
        if (!photo || !location || !todayRequest || !activeAction) {
            Alert.alert("Data Belum Lengkap", "Pastikan foto dan lokasi sudah tersedia.");
            return;
        }

        setLoading(true);
        try {
            const watermarkedUri = await captureWatermarkedPhoto();
            if (!watermarkedUri) throw new Error('Failed to capture photo');

            // Use useOfflineMutation with URI and Meta
            await mutate({
                action: activeAction,
                overtimeId: todayRequest.id,
                photo: null, // Placeholder
                location: `${location.coords.latitude},${location.coords.longitude}`,
                meta: {
                    photos: [watermarkedUri],
                    targetField: 'photo',
                    singleFile: true,
                    photoType: 'employee-attendance'
                }
            }, {
                url: `/api/mobile/overtime`,
                method: 'POST',
                onSuccess: (data, isOffline) => {
                     Alert.alert(isOffline ? "Offline" : "Berhasil", isOffline ? "Aksi disimpan di antrian" : (activeAction === 'start' ? "Lembur dimulai!" : "Lembur selesai!"));
                     setPhoto(null);
                     setCapturedTime(null);
                     setActiveAction(null);
                     fetchData();
                },
                onError: (err) => Alert.alert('Gagal', err.message || 'Terjadi kesalahan')
            });

        } catch (error: any) {
            Alert.alert("Gagal", error.response?.data?.error || error.message || "Terjadi kesalahan.");
        } finally {
            setLoading(false);
        }
    };

    const canStartOvertime = hasCheckedOut || holidayInfo?.isNational;

    // Status helpers
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return tw`bg-green-100`;
            case 'APPROVED': return tw`bg-blue-100`;
            case 'IN_PROGRESS': return tw`bg-purple-100`;
            case 'REJECTED': return tw`bg-red-100`;
            default: return tw`bg-yellow-100`;
        }
    };

    const getStatusTextColor = (status: string) => {
        switch (status) {
            case 'COMPLETED': return tw`text-green-700`;
            case 'APPROVED': return tw`text-blue-700`;
            case 'IN_PROGRESS': return tw`text-purple-700`;
            case 'REJECTED': return tw`text-red-700`;
            default: return tw`text-yellow-700`;
        }
    };

    // Camera view
    if (showCamera) {
        if (!permission?.granted) {
            return (
                <View style={tw`flex-1 justify-center items-center`}>
                    <Text>Aplikasi butuh izin kamera</Text>
                    <TouchableOpacity onPress={requestPermission} style={tw`bg-indigo-600 p-2 rounded mt-2`}>
                        <Text style={tw`text-white`}>Izinkan</Text>
                    </TouchableOpacity>
                </View>
            )
        }

        return (
            <View style={tw`flex-1 bg-black`}>
                <CameraView
                    style={tw`flex-1`}
                    facing={facing}
                    ref={cameraRef}
                >
                    {/* Face Guide */}
                    <View style={tw`absolute inset-0 items-center justify-center`}>
                        <View style={[tw`w-56 h-72 border-2 border-white/60 rounded-full`, { borderStyle: 'dashed' }]} />
                        <Text style={tw`text-white/80 text-xs mt-4`}>Posisikan wajah dalam lingkaran</Text>
                    </View>

                    {/* Top Info */}
                    <View style={tw`absolute top-12 left-0 right-0 items-center`}>
                        <View style={tw`bg-black/50 px-4 py-2 rounded-full`}>
                            <Text style={tw`text-white font-bold text-lg`}>{format(currentTime, 'HH:mm:ss')}</Text>
                        </View>
                        <Text style={tw`text-white/70 text-xs mt-1`}>{format(currentTime, 'EEEE, d MMMM yyyy', { locale: id })}</Text>
                        <View style={tw`bg-indigo-600 px-3 py-1 rounded-full mt-2`}>
                            <Text style={tw`text-white text-xs font-bold`}>
                                {activeAction === 'start' ? '🟢 MULAI LEMBUR' : '🔴 SELESAI LEMBUR'}
                            </Text>
                        </View>
                    </View>

                    {/* Bottom Controls */}
                    <View style={tw`absolute bottom-0 left-0 right-0 p-6 pb-12`}>
                        <View style={tw`bg-black/50 p-3 rounded-xl mb-4`}>
                            <View style={tw`flex-row items-center`}>
                                <MapPin size={14} color="#fff" />
                                <Text style={tw`text-white text-xs ml-2 flex-1`} numberOfLines={1}>{locationName}</Text>
                            </View>
                            {location && (
                                <Text style={tw`text-white/60 text-[10px] mt-1`}>
                                    {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
                                </Text>
                            )}
                        </View>

                        <View style={tw`flex-row justify-between items-center`}>
                            <TouchableOpacity onPress={() => { setShowCamera(false); setActiveAction(null); }} style={tw`bg-white/20 p-3 rounded-full`}>
                                <X color="white" size={24} />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleCapture} style={tw`h-20 w-20 bg-white rounded-full border-4 border-gray-300 items-center justify-center`}>
                                <View style={tw`h-16 w-16 bg-white rounded-full border-2 border-gray-200`} />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => setFacing(curr => curr === 'back' ? 'front' : 'back')} style={tw`bg-white/20 p-3 rounded-full`}>
                                <RotateCcw color="white" size={24} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </CameraView>
            </View>
        );
    }

    return (
        <SafeAreaView style={tw`flex-1 bg-gray-50`}>
            <ScrollView
                contentContainerStyle={tw`pb-20`}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Header - Indigo color for Lembur */}
                <View style={tw`bg-indigo-600 px-6 pt-6 pb-12 rounded-b-[40px]`}>
                    <TouchableOpacity onPress={() => router.back()} style={tw`absolute top-6 left-4`}>
                        <ArrowLeft size={24} color="white" />
                    </TouchableOpacity>
                    <View style={tw`items-center`}>
                        <Text style={tw`text-indigo-100 font-medium text-sm mb-1`}>
                            {format(currentTime, 'EEEE, d MMMM yyyy', { locale: id })}
                        </Text>
                        <Text style={tw`text-white font-bold text-5xl`}>
                            {format(currentTime, 'HH:mm')}
                        </Text>
                        <Text style={tw`text-indigo-200 text-xs mt-1`}>Lembur</Text>
                    </View>
                </View>

                {/* Content Card */}
                <View style={tw`px-4 -mt-8`}>
                    <View style={tw`bg-white rounded-2xl shadow-sm p-4 border border-gray-100`}>

                        {/* Location */}
                        <View style={tw`flex-row items-center bg-gray-50 p-3 rounded-xl mb-4`}>
                            <View style={tw`bg-indigo-100 p-2 rounded-full mr-3`}>
                                <MapPin size={20} color="#4f46e5" />
                            </View>
                            <View style={tw`flex-1`}>
                                <Text style={tw`text-xs text-gray-400 font-medium`}>Lokasi Saat Ini</Text>
                                <Text style={tw`text-gray-800 font-bold text-sm`}>{locationName}</Text>
                            </View>
                        </View>

                        {/* Status Info */}
                        {todayRequest?.status === 'IN_PROGRESS' && (
                            <View style={tw`flex-row justify-between mb-4`}>
                                <View style={tw`items-center flex-1 border-r border-gray-100`}>
                                    <Text style={tw`text-xs text-gray-400 mb-1`}>Mulai</Text>
                                    <Text style={tw`text-lg font-bold text-gray-800`}>
                                        {todayRequest.startTime ? format(new Date(todayRequest.startTime), 'HH:mm') : '--:--'}
                                    </Text>
                                </View>
                                <View style={tw`items-center flex-1`}>
                                    <Text style={tw`text-xs text-gray-400 mb-1`}>Selesai</Text>
                                    <Text style={tw`text-lg font-bold text-gray-800`}>--:--</Text>
                                </View>
                            </View>
                        )}

                        {/* Photo Preview with Watermark */}
                        {photo && activeAction ? (
                            <View style={tw`mb-4`}>
                                <View
                                    ref={watermarkRef}
                                    collapsable={false}
                                    style={tw`w-full h-80 rounded-xl overflow-hidden mb-2 bg-black`}
                                >
                                    <Image
                                        source={{ uri: photo }}
                                        style={tw`w-full h-full`}
                                        resizeMode="cover"
                                    />
                                    <View style={tw`absolute bottom-0 left-0 right-0 bg-black/60 p-3`}>
                                        <View style={tw`flex-row items-center mb-1`}>
                                            <Clock size={12} color="#fff" />
                                            <Text style={tw`text-white font-bold text-sm ml-2`}>
                                                {capturedTime ? format(capturedTime, 'HH:mm:ss') : '--:--:--'}
                                            </Text>
                                            <Text style={tw`text-white/80 text-xs ml-2`}>
                                                {capturedTime ? format(capturedTime, 'EEEE, d MMMM yyyy', { locale: id }) : ''}
                                            </Text>
                                        </View>
                                        <View style={tw`flex-row items-center mb-1`}>
                                            <MapPin size={12} color="#fff" />
                                            <Text style={tw`text-white text-xs ml-2 flex-1`} numberOfLines={1}>
                                                {locationName}
                                            </Text>
                                        </View>
                                        <Text style={tw`text-yellow-400 text-xs font-bold`}>
                                            {activeAction === 'start' ? '🟢 MULAI LEMBUR' : '🔴 SELESAI LEMBUR'} - {user?.name}
                                        </Text>
                                    </View>
                                </View>
                                <View style={tw`flex-row gap-2`}>
                                    <TouchableOpacity onPress={() => { setPhoto(null); setCapturedTime(null); }} style={tw`flex-1 bg-gray-100 py-3 rounded-xl items-center`}>
                                        <Text style={tw`font-bold text-gray-600`}>Ulang Foto</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={submitAction} disabled={loading} style={tw`flex-1 bg-indigo-600 py-3 rounded-xl items-center`}>
                                        <Text style={tw`font-bold text-white`}>{loading ? 'Menyimpan...' : 'Konfirmasi'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <>
                                {/* No Request / Rejected / Completed - Show Request Button */}
                                {(!todayRequest || todayRequest.status === 'REJECTED' || todayRequest.status === 'COMPLETED') && (
                                    <TouchableOpacity
                                        onPress={() => setShowRequestModal(true)}
                                        style={tw`bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl h-32 items-center justify-center mb-4`}
                                    >
                                        <Plus size={32} color="#4f46e5" />
                                        <Text style={tw`text-indigo-600 font-bold mt-2`}>Ajukan Lembur</Text>
                                        <Text style={tw`text-indigo-400 text-xs`}>Perlu approval admin</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Pending - Show Status */}
                                {todayRequest?.status === 'PENDING' && (
                                    <View style={tw`bg-yellow-50 border border-yellow-200 rounded-2xl p-4 items-center mb-4`}>
                                        <Timer size={32} color="#ca8a04" />
                                        <Text style={tw`text-yellow-700 font-bold text-lg mt-2`}>Menunggu Approval</Text>
                                        <Text style={tw`text-yellow-600 text-xs text-center mt-1`}>
                                            Pengajuan: "{todayRequest.reason}"
                                        </Text>
                                    </View>
                                )}

                                {/* Approved - Show Start Button */}
                                {todayRequest?.status === 'APPROVED' && (
                                    <View style={tw`mb-4`}>
                                        <View style={tw`bg-green-50 border border-green-200 rounded-xl p-3 flex-row items-center mb-3`}>
                                            <CheckCircle size={20} color="#16a34a" />
                                            <View style={tw`ml-3`}>
                                                <Text style={tw`font-bold text-sm text-green-700`}>Disetujui</Text>
                                                <Text style={tw`text-xs text-green-600`}>Silakan mulai saat jam lembur tiba.</Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => canStartOvertime && startCamera('start')}
                                            disabled={!canStartOvertime}
                                            style={[
                                                tw`rounded-2xl h-32 items-center justify-center`,
                                                canStartOvertime ? tw`bg-indigo-50 border-2 border-dashed border-indigo-200` : tw`bg-gray-100 border-2 border-dashed border-gray-200`
                                            ]}
                                        >
                                            <Camera size={32} color={canStartOvertime ? "#4f46e5" : "#9ca3af"} />
                                            <Text style={canStartOvertime ? tw`text-indigo-600 font-bold mt-2` : tw`text-gray-400 font-bold mt-2`}>
                                                Mulai Lembur
                                            </Text>
                                        </TouchableOpacity>
                                        {!canStartOvertime && (
                                            <Text style={tw`text-amber-600 text-xs text-center mt-2`}>
                                                ⚠️ Checkout absen dulu sebelum mulai
                                            </Text>
                                        )}
                                    </View>
                                )}

                                {/* In Progress - Show Stop Button */}
                                {todayRequest?.status === 'IN_PROGRESS' && (
                                    <TouchableOpacity
                                        onPress={() => startCamera('stop')}
                                        style={tw`bg-red-50 border-2 border-dashed border-red-200 rounded-2xl h-32 items-center justify-center mb-4`}
                                    >
                                        <Camera size={32} color="#dc2626" />
                                        <Text style={tw`text-red-600 font-bold mt-2`}>Selesai Lembur</Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        )}
                    </View>

                    {/* History */}
                    <View style={tw`mt-4`}>
                        <Text style={tw`text-lg font-bold text-gray-900 mb-3`}>Riwayat Terbaru</Text>
                        {history.length === 0 ? (
                            <Text style={tw`text-gray-400 text-center py-4`}>Belum ada data.</Text>
                        ) : (
                            history.slice(0, 5).map((item) => (
                                <View key={item.id} style={tw`bg-white p-4 rounded-xl mb-2 flex-row justify-between items-center border border-gray-100`}>
                                    <View style={tw`flex-1 mr-3`}>
                                        <Text style={tw`font-bold text-sm text-gray-900`}>
                                            {format(new Date(item.createdAt), 'dd MMM yyyy')}
                                        </Text>
                                        <Text style={tw`text-xs text-gray-500`} numberOfLines={1}>
                                            {item.reason}
                                        </Text>
                                    </View>
                                    <View style={[tw`px-2 py-1 rounded`, getStatusColor(item.status)]}>
                                        <Text style={[tw`text-xs font-bold uppercase`, getStatusTextColor(item.status)]}>
                                            {item.status.replace('_', ' ')}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Request Modal */}
            <Modal visible={showRequestModal} transparent animationType="fade">
                <View style={tw`flex-1 bg-black/50 justify-center items-center p-4`}>
                    <View style={tw`bg-white w-full max-w-sm rounded-2xl p-6`}>
                        <Text style={tw`text-lg font-bold mb-4`}>Form Pengajuan Lembur</Text>
                        <TextInput
                            style={[tw`w-full p-3 rounded-lg border border-gray-200 bg-gray-50 mb-4`, { minHeight: 100, textAlignVertical: 'top' }]}
                            placeholder="Alasan lembur..."
                            multiline
                            value={reason}
                            onChangeText={setReason}
                            placeholderTextColor="#94a3b8"
                        />
                        <View style={tw`flex-row gap-3`}>
                            <TouchableOpacity
                                style={tw`flex-1 py-3 bg-gray-100 rounded-xl`}
                                onPress={() => setShowRequestModal(false)}
                            >
                                <Text style={tw`text-center text-gray-500 font-bold`}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[tw`flex-1 py-3 rounded-xl`, reason.trim() ? tw`bg-indigo-600` : tw`bg-gray-300`]}
                                onPress={handleSubmitRequest}
                                disabled={!reason.trim() || loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={tw`text-center text-white font-bold`}>Kirim</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
