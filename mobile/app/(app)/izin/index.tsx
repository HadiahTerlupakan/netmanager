import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Alert, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import tw from 'twrnc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { ArrowLeft, Plus, Clock, CheckCircle, XCircle, Camera, X, ChevronDown } from 'lucide-react-native';
import axios from 'axios';
import { Config } from '@/constants/Config';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { useOfflineQuery } from '@/hooks/useOfflineQuery';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';
import { CameraView, useCameraPermissions } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';

interface LeaveRequest {
    id: string;
    type: string;
    startDate: string;
    endDate: string;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    attachmentUrl?: string;
    attachments?: string[];
    rejectionReason?: string;
    createdAt: string;
}

const LEAVE_TYPES = [
    { value: 'SAKIT', label: 'Sakit' },
    { value: 'CUTI', label: 'Cuti' },
    { value: 'IZIN', label: 'Izin' },
    { value: 'LAINNYA', label: 'Lainnya' },
];

export default function IzinScreen() {
    const { token, user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [history, setHistory] = useState<LeaveRequest[]>([]);

    // Form Modal
    const [showModal, setShowModal] = useState(false);
    const [type, setType] = useState('SAKIT');
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [reason, setReason] = useState('');
    const [photos, setPhotos] = useState<string[]>([]);
    const [showTypePicker, setShowTypePicker] = useState(false);
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);

    // Camera
    const [showCamera, setShowCamera] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);

    // Offline Query
    const { data: historyData, isLoading: loadingHistory, refetch: fetchHistory } = useOfflineQuery({
        key: 'leaves_history',
        fetcher: async () => {
             const res = await axios.get(`${Config.API_URL}/api/mobile/leaves`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return res.data?.data || [];
        },
        enabled: !!token
    });

    // Offline Mutation
    const { mutate, isLoading: isMutating } = useOfflineMutation();

    useEffect(() => {
        if (historyData) setHistory(historyData);
    }, [historyData]);

    useFocusEffect(
        useCallback(() => {
            fetchHistory();
        }, [fetchHistory])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchHistory();
        setRefreshing(false);
    };

    // Take photo
    const handleCapture = async () => {
        if (cameraRef.current) {
            const result = await cameraRef.current.takePictureAsync({
                quality: 0.7,
                base64: false // We use URI now for offline sync
            });
            if (result?.uri) {
                setPhotos(prev => [...prev, result.uri]);
            }
            setShowCamera(false);
        }
    };

    const removePhoto = (index: number) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    // Submit
    const handleSubmit = async () => {
        if (!reason.trim()) {
            Alert.alert('Error', 'Alasan wajib diisi');
            return;
        }
        if (type !== 'CUTI' && photos.length === 0) {
            Alert.alert('Error', 'Foto bukti wajib diupload');
            return;
        }

        await mutate({
             type,
             startDate: startDate.toISOString(),
             endDate: endDate.toISOString(),
             reason: reason.trim(),
             photos: [], // Placeholder, SyncService will fill
             meta: {
                 photos: photos, // URIs
                 targetField: 'photos',
                 singleFile: false,
                 photoType: 'employee-leave'
             }
        }, {
             url: `/api/mobile/leaves`,
             method: 'POST',
             onSuccess: (data, isOffline) => {
                  Alert.alert(isOffline ? 'Offline' : 'Sukses', isOffline ? 'Pengajuan diantrikan' : 'Pengajuan berhasil dikirim');
                  setShowModal(false);
                  resetForm();
                  fetchHistory();
             },
             onError: (err) => Alert.alert('Error', err.message || 'Gagal mengirim pengajuan')
        });
    };

    const resetForm = () => {
        setType('SAKIT');
        setStartDate(new Date());
        setEndDate(new Date());
        setReason('');
        setPhotos([]);
    };

    // Status helpers
    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'APPROVED': return { bg: tw`bg-green-100`, text: tw`text-green-700` };
            case 'REJECTED': return { bg: tw`bg-red-100`, text: tw`text-red-700` };
            default: return { bg: tw`bg-yellow-100`, text: tw`text-yellow-700` };
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'APPROVED': return <CheckCircle size={16} color="#16a34a" />;
            case 'REJECTED': return <XCircle size={16} color="#dc2626" />;
            default: return <Clock size={16} color="#ca8a04" />;
        }
    };

    // Camera view
    if (showCamera) {
        if (!permission?.granted) {
            return (
                <View style={tw`flex-1 justify-center items-center`}>
                    <Text>Aplikasi butuh izin kamera</Text>
                    <TouchableOpacity onPress={requestPermission} style={tw`bg-teal-600 p-2 rounded mt-2`}>
                        <Text style={tw`text-white`}>Izinkan</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={tw`flex-1 bg-black`}>
                <CameraView style={tw`flex-1`} facing="back" ref={cameraRef}>
                    <View style={tw`absolute top-12 left-0 right-0 px-4 flex-row justify-between items-center`}>
                        <Text style={tw`text-white font-bold`}>Ambil Foto Bukti</Text>
                        <TouchableOpacity onPress={() => setShowCamera(false)} style={tw`bg-white/20 p-2 rounded-full`}>
                            <X size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    <View style={tw`absolute bottom-12 left-0 right-0 items-center`}>
                        <TouchableOpacity
                            onPress={handleCapture}
                            style={tw`h-20 w-20 bg-white rounded-full border-4 border-gray-300 items-center justify-center`}
                        >
                            <View style={tw`h-16 w-16 bg-white rounded-full border-2 border-gray-200`} />
                        </TouchableOpacity>
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
                {/* Header - Teal color for Izin/Cuti */}
                <View style={tw`bg-teal-600 px-6 pt-6 pb-12 rounded-b-[40px]`}>
                    <TouchableOpacity onPress={() => router.back()} style={tw`absolute top-6 left-4`}>
                        <ArrowLeft size={24} color="white" />
                    </TouchableOpacity>
                    <View style={tw`items-center`}>
                        <Text style={tw`text-teal-100 font-medium text-sm mb-1`}>Kelola Kehadiran</Text>
                        <Text style={tw`text-white font-bold text-2xl`}>Izin & Cuti</Text>
                    </View>
                </View>

                {/* Content Card */}
                <View style={tw`px-4 -mt-8`}>
                    <View style={tw`bg-white rounded-2xl shadow-sm p-4 border border-gray-100`}>
                        {/* Action Button */}
                        <TouchableOpacity
                            onPress={() => setShowModal(true)}
                            style={tw`bg-teal-600 py-4 rounded-xl flex-row items-center justify-center mb-4`}
                        >
                            <Plus size={20} color="white" />
                            <Text style={tw`text-white font-bold ml-2`}>Buat Pengajuan Baru</Text>
                        </TouchableOpacity>

                        {/* History */}
                        <View style={tw`flex-row items-center mb-3`}>
                            <Clock size={18} color="#1e293b" />
                            <Text style={tw`text-lg font-bold text-slate-900 ml-2`}>Riwayat Pengajuan</Text>
                        </View>

                        {history.length === 0 ? (
                            <Text style={tw`text-gray-400 text-center py-8`}>Belum ada riwayat pengajuan.</Text>
                        ) : (
                            history.map((item) => {
                                const statusStyle = getStatusStyle(item.status);
                                return (
                                    <View key={item.id} style={tw`bg-gray-50 p-4 rounded-xl mb-3 border border-gray-100`}>
                                        <View style={tw`flex-row justify-between items-start mb-2`}>
                                            <View>
                                                <Text style={tw`font-bold text-sm text-slate-900`}>{item.type}</Text>
                                                <Text style={tw`text-xs text-slate-500`}>
                                                    {format(new Date(item.startDate), 'dd MMM yyyy')} - {format(new Date(item.endDate), 'dd MMM yyyy')}
                                                </Text>
                                            </View>
                                            <View style={[tw`px-2 py-1 rounded-lg flex-row items-center gap-1`, statusStyle.bg]}>
                                                {getStatusIcon(item.status)}
                                                <Text style={[tw`text-xs font-bold`, statusStyle.text]}>{item.status}</Text>
                                            </View>
                                        </View>
                                        <View style={tw`bg-white p-2 rounded-lg`}>
                                            <Text style={tw`text-sm text-slate-600 italic`}>"{item.reason}"</Text>
                                        </View>
                                        {item.rejectionReason && (
                                            <Text style={tw`text-xs text-red-500 mt-2`}>
                                                Alasan Penolakan: {item.rejectionReason}
                                            </Text>
                                        )}
                                    </View>
                                );
                            })
                        )}
                    </View>
                </View>
            </ScrollView>

            {/* Form Modal */}
            <Modal visible={showModal} transparent animationType="slide">
                <View style={tw`flex-1 bg-black/50 justify-end`}>
                    <View style={tw`bg-white rounded-t-3xl p-6 max-h-[90%]`}>
                        <View style={tw`flex-row justify-between items-center mb-4`}>
                            <Text style={tw`text-lg font-bold`}>Form Pengajuan</Text>
                            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                                <X size={24} color="#64748b" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {/* Type Picker */}
                            <View style={tw`mb-4`}>
                                <Text style={tw`text-xs font-bold text-slate-500 uppercase mb-2`}>Tipe Izin</Text>
                                <TouchableOpacity
                                    onPress={() => setShowTypePicker(!showTypePicker)}
                                    style={tw`bg-gray-50 p-3 rounded-xl border border-gray-200 flex-row justify-between items-center`}
                                >
                                    <Text style={tw`text-slate-800`}>{LEAVE_TYPES.find(t => t.value === type)?.label}</Text>
                                    <ChevronDown size={20} color="#64748b" />
                                </TouchableOpacity>
                                {showTypePicker && (
                                    <View style={tw`bg-white border border-gray-200 rounded-xl mt-1 overflow-hidden`}>
                                        {LEAVE_TYPES.map((t) => (
                                            <TouchableOpacity
                                                key={t.value}
                                                onPress={() => { setType(t.value); setShowTypePicker(false); }}
                                                style={tw`p-3 border-b border-gray-100 ${type === t.value ? 'bg-teal-50' : ''}`}
                                            >
                                                <Text style={tw`${type === t.value ? 'text-teal-600 font-bold' : 'text-slate-700'}`}>{t.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            {/* Date Pickers */}
                            <View style={tw`flex-row gap-3 mb-4`}>
                                <View style={tw`flex-1`}>
                                    <Text style={tw`text-xs font-bold text-slate-500 uppercase mb-2`}>Dari</Text>
                                    <TouchableOpacity
                                        onPress={() => setShowStartPicker(true)}
                                        style={tw`bg-gray-50 p-3 rounded-xl border border-gray-200`}
                                    >
                                        <Text style={tw`text-slate-800`}>{format(startDate, 'dd/MM/yyyy')}</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={tw`flex-1`}>
                                    <Text style={tw`text-xs font-bold text-slate-500 uppercase mb-2`}>Sampai</Text>
                                    <TouchableOpacity
                                        onPress={() => setShowEndPicker(true)}
                                        style={tw`bg-gray-50 p-3 rounded-xl border border-gray-200`}
                                    >
                                        <Text style={tw`text-slate-800`}>{format(endDate, 'dd/MM/yyyy')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {showStartPicker && (
                                <DateTimePicker
                                    value={startDate}
                                    mode="date"
                                    onChange={(_, date) => { setShowStartPicker(false); if (date) setStartDate(date); }}
                                />
                            )}
                            {showEndPicker && (
                                <DateTimePicker
                                    value={endDate}
                                    mode="date"
                                    onChange={(_, date) => { setShowEndPicker(false); if (date) setEndDate(date); }}
                                />
                            )}

                            {/* Reason */}
                            <View style={tw`mb-4`}>
                                <Text style={tw`text-xs font-bold text-slate-500 uppercase mb-2`}>Alasan</Text>
                                <TextInput
                                    style={[tw`bg-gray-50 p-3 rounded-xl border border-gray-200`, { minHeight: 80, textAlignVertical: 'top' }]}
                                    placeholder="Jelaskan alasan pengajuan..."
                                    multiline
                                    value={reason}
                                    onChangeText={setReason}
                                    placeholderTextColor="#94a3b8"
                                />
                            </View>

                            {/* Photo Upload (required for non-CUTI) */}
                            {type !== 'CUTI' && (
                                <View style={tw`mb-4`}>
                                    <Text style={tw`text-xs font-bold text-slate-500 uppercase mb-2`}>Foto Bukti (Wajib)</Text>
                                    
                                    {/* Photo Grid */}
                                    {photos.length > 0 && (
                                        <View style={tw`flex-row flex-wrap gap-2 mb-3`}>
                                            {photos.map((photo, idx) => (
                                                <View key={idx} style={tw`relative`}>
                                                    <Image source={{ uri: photo }} style={tw`w-20 h-20 rounded-lg`} />
                                                    <TouchableOpacity
                                                        onPress={() => removePhoto(idx)}
                                                        style={tw`absolute -top-2 -right-2 bg-red-500 rounded-full p-1`}
                                                    >
                                                        <X size={12} color="white" />
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    {/* Add Photo Button */}
                                    <TouchableOpacity
                                        onPress={() => setShowCamera(true)}
                                        style={tw`bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl h-24 items-center justify-center`}
                                    >
                                        <Camera size={28} color="#64748b" />
                                        <Text style={tw`text-slate-500 text-sm mt-1`}>
                                            {photos.length > 0 ? 'Tambah Foto Lain' : 'Ambil Foto'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Submit Button */}
                            <TouchableOpacity
                                onPress={handleSubmit}
                                disabled={loading || (type !== 'CUTI' && photos.length === 0)}
                                style={[
                                    tw`py-4 rounded-xl items-center mt-2`,
                                    (loading || (type !== 'CUTI' && photos.length === 0)) ? tw`bg-gray-300` : tw`bg-teal-600`
                                ]}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text style={tw`text-white font-bold`}>Kirim Pengajuan</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}
