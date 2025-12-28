import { View, Text, TouchableOpacity, ScrollView, Alert, Dimensions, Image, ImageBackground } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useState, useEffect, useRef } from 'react';
import tw from 'twrnc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { MapPin, Clock, LogIn, LogOut, RefreshCw, X, RotateCcw, Camera } from 'lucide-react-native';
import axios from 'axios';
import { Config } from '../../constants/Config';
import { useAuth } from '../../context/AuthContext';
import { captureRef } from 'react-native-view-shot';
import { useOfflineQuery } from '@/hooks/useOfflineQuery';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';
import { SyncService } from '@/services/SyncService';

export default function AbsensiScreen() {
    const { user, token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Status State
    const [status, setStatus] = useState<'idle' | 'checked-in' | 'checked-out'>('idle');
    const [checkInTime, setCheckInTime] = useState<string | null>(null);
    const [checkOutTime, setCheckOutTime] = useState<string | null>(null);
    const [workDuration, setWorkDuration] = useState('00:00');
    const [locationName, setLocationName] = useState('Mencari lokasi...');

    // Camera & Location State
    const [showCamera, setShowCamera] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [photo, setPhoto] = useState<string | null>(null);
    const cameraRef = useRef<CameraView>(null);
    const [facing, setFacing] = useState<CameraType>('front');
    const watermarkRef = useRef<View>(null);
    const [capturedTime, setCapturedTime] = useState<Date | null>(null);

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch Initial Data (Location & Status)
    useEffect(() => {
        fetchStatus();
        getLocation();
    }, []);

    const { mutate, isLoading: isMutating } = useOfflineMutation();

    const { data: statusData, refetch: refetchStatus } = useOfflineQuery<any>({
        key: 'attendance_status_latest',
        fetcher: async () => {
             const res = await axios.get(`${Config.API_URL}/api/mobile/attendance/history?limit=1`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data;
        },
        enabled: !!token
    });

    useEffect(() => {
        if (statusData && statusData.success && statusData.data.length > 0) {
            const lastAttendance = statusData.data[0];
            const today = new Date().toDateString();
            const attendanceDate = new Date(lastAttendance.checkIn).toDateString();

            if (today === attendanceDate) {
                setCheckInTime(format(new Date(lastAttendance.checkIn), 'HH:mm'));
                if (lastAttendance.checkOut) {
                    setStatus('checked-out');
                    setCheckOutTime(format(new Date(lastAttendance.checkOut), 'HH:mm'));
                } else {
                    setStatus('checked-in');
                }
            } else {
                // New day, reset if needed or just idle
                 setStatus('idle');
                 setCheckInTime(null);
                 setCheckOutTime(null);
            }
        }
    }, [statusData]);

    const fetchStatus = refetchStatus; // Alias for compatibility called in useEffect

    const getLocation = async () => {
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Izin Ditolak', 'Aplikasi membutuhkan izin lokasi untuk absensi.');
                return;
            }

            let location = await Location.getLastKnownPositionAsync({});
            if (!location) {
                location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            }

            setLocation(location);

            // Reverse Geocode
            try {
                const reverse = await Location.reverseGeocodeAsync({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                });
                if (reverse.length > 0) {
                    const addr = reverse[0];
                    setLocationName(`${addr.street || ''} ${addr.district || ''}, ${addr.city || ''}`);
                }
            } catch (e) {
                console.log("Geocode failed, using coordinates");
                setLocationName(`${location.coords.latitude}, ${location.coords.longitude}`);
            }
        } catch (error) {
            console.warn("Location Error:", error);
            setLocationName("Lokasi tidak ditemukan (Cek GPS)");
            Alert.alert("Lokasi Error", "Pastikan GPS aktif. Di Emulator, set location di menu Extended Controls.");
        }
    };

    const handleCapture = async () => {
        if (cameraRef.current) {
            const photo = await cameraRef.current.takePictureAsync({
                base64: true,
                quality: 0.5
            });
            setPhoto('data:image/jpeg;base64,' + photo?.base64);
            setShowCamera(false);
        }
    };

    const processPhoto = async (): Promise<string | null> => {
       return await captureWatermarkedPhoto();
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
                formData.append('type', 'employee-attendance'); // Match backend upload type

                const res = await axios.post(`${Config.API_URL}/api/mobile/upload`, formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data',
                    }
                });
                if (res.data?.url) uploadedUrls.push(res.data.url);
            } catch (error) {
                console.error('Failed to upload photo:', error);
            }
        }
        return uploadedUrls;
    };

    const submitAttendance = async () => {
        if (!photo || !location) {
            Alert.alert("Data Belum Lengkap", "Pastikan foto dan lokasi sudah tersedia.");
            return;
        }

        const endpoint = status === 'idle' ? '/api/mobile/attendance/check-in' : '/api/mobile/attendance/check-out';
        
        // 1. Process Photo
        const processedUri = await processPhoto();
        if (!processedUri) return;

        // 2. Check Connection
        const isOnline = await SyncService.isOnline();
        
        // 3. Prepare Payload (JSON)
        const payload = {
            location: locationName,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            // notes: ... (if we add notes field later)
        };

        if (isOnline) {
             setLoading(true);
             try {
                // Upload Photo
                const uploadedUrls = await uploadPhotos([processedUri]);
                const photoUrl = uploadedUrls[0];
                
                if (!photoUrl) throw new Error("Gagal upload foto");

                // Submit JSON
                await mutate({
                    ...payload,
                    photoUrl: photoUrl
                }, {
                    url: endpoint,
                    method: 'POST',
                    onSuccess: () => {
                         Alert.alert("Berhasil", status === 'idle' ? "Check-in Berhasil!" : "Check-out Berhasil!");
                         fetchStatus();
                         setPhoto(null);
                    },
                    onError: (e) => Alert.alert("Gagal", e.message || "Terjadi kesalahan")
                });
             } catch (error: any) {
                 Alert.alert("Error", error.message || "Gagal Absen");
             } finally {
                 setLoading(false);
             }
        } else {
            // Offline
            await mutate({
                ...payload,
                photoUrl: null, // Placeholder
                meta: {
                    photos: [processedUri],
                    targetField: 'photoUrl',
                    singleFile: true,
                    photoType: 'employee-attendance'
                }
            }, {
                url: endpoint,
                method: 'POST',
                onSuccess: (data, isOffline) => {
                    if (isOffline) {
                        setPhoto(null);
                        // Manually update local status to reflect action immediately?
                        // If Check In -> Set Checked In (optimistic)
                        // But fetchStatus relies on query cache. 
                        // I can force update state technically, but complex.
                        // For now just alert is enough.
                    }
                }
            });
        }
    };

    // Switch to URI based capture for FormData compatibility
    const handleCaptureURI = async () => {
        if (cameraRef.current) {
            const result = await cameraRef.current.takePictureAsync({
                quality: 0.7,
                skipProcessing: false
            });
            // result.uri is the file path
            setPhoto(result?.uri ?? null);
            setCapturedTime(new Date()); // Store capture time for watermark
            setShowCamera(false);
        }
    }

    // Capture watermarked photo before submission
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

    if (showCamera) {
        if (!permission?.granted) {
            return (
                <View style={tw`flex-1 justify-center items-center`}>
                    <Text>Aplikasi butuh izin kamera</Text>
                    <TouchableOpacity onPress={requestPermission} style={tw`bg-blue-600 p-2 rounded mt-2`}>
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
                    {/* Face Guide Overlay */}
                    <View style={tw`absolute inset-0 items-center justify-center`}>
                        <View style={[tw`w-56 h-72 border-2 border-white/60 rounded-full`, { borderStyle: 'dashed' }]} />
                        <Text style={tw`text-white/80 text-xs mt-4`}>Posisikan wajah dalam lingkaran</Text>
                    </View>

                    {/* Top Info Bar */}
                    <View style={tw`absolute top-12 left-0 right-0 items-center`}>
                        <View style={tw`bg-black/50 px-4 py-2 rounded-full`}>
                            <Text style={tw`text-white font-bold text-lg`}>{format(currentTime, 'HH:mm:ss')}</Text>
                        </View>
                        <Text style={tw`text-white/70 text-xs mt-1`}>{format(currentTime, 'EEEE, d MMMM yyyy', { locale: id })}</Text>
                    </View>

                    {/* Bottom Controls */}
                    <View style={tw`absolute bottom-0 left-0 right-0 p-6 pb-12`}>
                        {/* Location Info */}
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

                        {/* Action Buttons */}
                        <View style={tw`flex-row justify-between items-center`}>
                            <TouchableOpacity onPress={() => setShowCamera(false)} style={tw`bg-white/20 p-3 rounded-full`}>
                                <X color="white" size={24} />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleCaptureURI} style={tw`h-20 w-20 bg-white rounded-full border-4 border-gray-300 items-center justify-center`}>
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
            <ScrollView contentContainerStyle={tw`pb-20`}>
                {/* Header */}
                <View style={tw`bg-blue-600 px-6 pt-6 pb-12 rounded-b-[40px]`}>
                    <View style={tw`items-center`}>
                        <Text style={tw`text-blue-100 font-medium text-sm mb-1`}>
                            {format(currentTime, 'EEEE, d MMMM yyyy', { locale: id })}
                        </Text>
                        <Text style={tw`text-white font-bold text-5xl`}>
                            {format(currentTime, 'HH:mm')}
                        </Text>
                    </View>
                </View>

                {/* Content Card */}
                <View style={tw`px-4 -mt-8`}>
                    <View style={tw`bg-white rounded-2xl shadow-sm p-4 border border-gray-100`}>

                        {/* Location */}
                        <View style={tw`flex-row items-center bg-gray-50 p-3 rounded-xl mb-4`}>
                            <View style={tw`bg-blue-100 p-2 rounded-full mr-3`}>
                                <MapPin size={20} color="#2563eb" />
                            </View>
                            <View style={tw`flex-1`}>
                                <Text style={tw`text-xs text-gray-400 font-medium`}>Lokasi Saat Ini</Text>
                                <Text style={tw`text-gray-800 font-bold text-sm`}>{locationName}</Text>
                            </View>
                            <TouchableOpacity onPress={getLocation}>
                                <RefreshCw size={16} color="#9ca3af" />
                            </TouchableOpacity>
                        </View>

                        {/* Info Status */}
                        <View style={tw`flex-row justify-between mb-6`}>
                            <View style={tw`items-center flex-1 border-r border-gray-100`}>
                                <Text style={tw`text-xs text-gray-400 mb-1`}>Masuk</Text>
                                <Text style={tw`text-lg font-bold text-gray-800`}>{checkInTime || '--:--'}</Text>
                            </View>
                            <View style={tw`items-center flex-1`}>
                                <Text style={tw`text-xs text-gray-400 mb-1`}>Keluar</Text>
                                <Text style={tw`text-lg font-bold text-gray-800`}>{checkOutTime || '--:--'}</Text>
                            </View>
                        </View>

                        {/* Main Action Button */}
                        {photo ? (
                            <View style={tw`mb-4`}>
                                {/* Watermarked Photo Preview - this will be captured */}
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
                                    {/* Watermark Overlay */}
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
                                        {location && (
                                            <Text style={tw`text-white/60 text-[10px]`}>
                                                📍 {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                                <View style={tw`flex-row gap-2`}>
                                    <TouchableOpacity onPress={() => { setPhoto(null); setCapturedTime(null); }} style={tw`flex-1 bg-gray-100 py-3 rounded-xl items-center`}>
                                        <Text style={tw`font-bold text-gray-600`}>Ulang Foto</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={submitAttendance} disabled={loading || isMutating} style={tw`flex-1 bg-blue-600 py-3 rounded-xl items-center`}>
                                        <Text style={tw`font-bold text-white`}>{(loading || isMutating) ? 'Menyimpan...' : 'Kirim Absensi'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => setShowCamera(true)}
                                disabled={status === 'checked-out'}
                                style={tw`bg-blue-50 border-2 border-dashed border-blue-200 rounded-2xl h-32 items-center justify-center mb-2`}
                            >
                                <Camera size={32} color="#2563eb" />
                                <Text style={tw`text-blue-600 font-bold mt-2`}>
                                    {status === 'idle' ? 'Ambil Foto Masuk' : status === 'checked-in' ? 'Ambil Foto Keluar' : 'Absensi Selesai'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}
