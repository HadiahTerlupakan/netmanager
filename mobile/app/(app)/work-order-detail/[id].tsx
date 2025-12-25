import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Image, Dimensions, Modal, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useSocketRoom, useSocketEvent } from '../../../context/SocketContext';
import { SOCKET_EVENTS, WorkOrderActivityPayload } from '../../../context/socketTypes';
import axios from 'axios';
import { Config } from '../../../constants/Config';
import tw from 'twrnc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
    ArrowLeft, MapPin, Calendar, Clock, User, Phone,
    CheckCircle, Play, Pause, Camera, X, FileText,
    History, Users, Package, Plus
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

const { width } = Dimensions.get('window');

export default function WorkOrderDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const { token, user } = useAuth();

    const [wo, setWo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'INFO' | 'TIMELINE' | 'ITEMS'>('INFO');

    // Completion State
    const [showCompleteForm, setShowCompleteForm] = useState(false);
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [photo, setPhoto] = useState<string | null>(null);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);

    // Partner State
    const [isPartnerModalVisible, setIsPartnerModalVisible] = useState(false);
    const [availablePartners, setAvailablePartners] = useState<any[]>([]);
    const [searchPartnerQuery, setSearchPartnerQuery] = useState('');
    const [partnerLoading, setPartnerLoading] = useState(false);

    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Izin Lokasi Ditolak', 'Aplikasi membutuhkan izin lokasi untuk validasi pengerjaan.');
                return;
            }

            const currentLocation = await Location.getCurrentPositionAsync({});
            setLocation(currentLocation);
        })();
    }, []);

    const fetchDetail = async () => {
        try {
            const res = await axios.get(`${Config.API_URL}/api/mobile/work-orders/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setWo(res.data.data);
            }
        } catch (error) {
            console.error('Fetch Detail Error:', error);
            Alert.alert('Error', 'Gagal memuat detail Work Order');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            if (id) {
                fetchDetail();
            }
        }, [id])
    );

    // Join WebSocket room for this Work Order
    useSocketRoom(`workorder:${id}`);

    // Handle real-time work order updates
    const handleWOUpdate = useCallback((data: any) => {
        console.log('[WS Mobile] WorkOrder Update received:', data);
        // Refresh data when WO is updated
        if (data.id === id || data.workOrderId === id) {
            fetchDetail();
        }
    }, [id]);

    // Handle real-time activity updates
    const handleActivityUpdate = useCallback((data: WorkOrderActivityPayload) => {
        console.log('[WS Mobile] Activity received:', data.activity.type);
        if (data.workOrderId === id) {
            fetchDetail();
        }
    }, [id]);

    // Subscribe to WebSocket events
    useSocketEvent(SOCKET_EVENTS.WORKORDER_UPDATE, handleWOUpdate);
    useSocketEvent(SOCKET_EVENTS.WORKORDER_ACTIVITY, handleActivityUpdate);

    // Partner search effect
    useEffect(() => {
        if (isPartnerModalVisible && searchPartnerQuery !== undefined) {
            const fetchPartners = async () => {
                setPartnerLoading(true);
                try {
                    const res = await axios.get(`${Config.API_URL}/api/mobile/partners?search=${searchPartnerQuery}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.data.success) {
                        setAvailablePartners(res.data.data);
                    }
                } catch (error) {
                    console.error('Fetch Partners Error:', error);
                } finally {
                    setPartnerLoading(false);
                }
            };
            fetchPartners();
        }
    }, [isPartnerModalVisible, searchPartnerQuery, token]);

    const handleUpdateStatus = async (action: 'START' | 'PAUSE' | 'COMPLETE' | 'NOTE') => {
        if (action === 'COMPLETE' && !showCompleteForm) {
            setShowCompleteForm(true);
            return;
        }

        if (action === 'COMPLETE' && (!photo || !resolutionNotes)) {
            Alert.alert('Data Belum Lengkap', 'Mohon isi catatan dan upload foto bukti.');
            return;
        }

        setActionLoading(true);
        try {
            // Refresh location before sending
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
                        // Fallback if empty
                        if (!locationName) locationName = addr.name || addr.region || '';
                    }
                }
            } catch (e) {
                console.log("Could not update location/geocode, using cached");
            }

            const formData = new FormData();
            formData.append('action', action);

            if (finalLocation) {
                formData.append('latitude', String(finalLocation.coords.latitude));
                formData.append('longitude', String(finalLocation.coords.longitude));
            }
            if (locationName) {
                formData.append('locationName', locationName);
            }

            if (action === 'COMPLETE' || action === 'NOTE') {
                if (resolutionNotes) formData.append('notes', resolutionNotes);
                if (photo) {
                    // @ts-ignore
                    formData.append('photo', {
                        uri: photo,
                        name: 'upload.jpg',
                        type: 'image/jpeg'
                    });
                }
            }

            if (action === 'PAUSE') {
                formData.append('notes', 'Paused by technician');
            }

            await axios.post(`${Config.API_URL}/api/mobile/work-orders/${id}/update`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            Alert.alert('Berhasil', action === 'COMPLETE' ? 'Pekerjaan Selesai!' : 'Status/Catatan Diperbarui');

            if (action === 'COMPLETE') {
                router.back();
            } else {
                if (action === 'NOTE') {
                    setResolutionNotes('');
                    setPhoto(null);
                }
                fetchDetail();
            }

        } catch (error: any) {
            console.error('Update Status Error:', error);
            Alert.alert('Gagal', error.response?.data?.error || 'Gagal update status');
        } finally {
            setActionLoading(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'], // Fixed deprecation
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
        });

        if (!result.canceled) {
            setPhoto(result.assets[0].uri);
        }
    };

    if (loading) {
        return (
            <View style={tw`flex-1 justify-center items-center bg-gray-50`}>
                <ActivityIndicator size="large" color="#2563eb" />
            </View>
        );
    }

    if (!wo) {
        return (
            <View style={tw`flex-1 justify-center items-center bg-gray-50`}>
                <Text>Data tidak ditemukan</Text>
            </View>
        );
    }

    const handleAddPartner = async (userId: string) => {
        setPartnerLoading(true);
        try {
            await axios.post(`${Config.API_URL}/api/mobile/work-orders/${id}/partners`, {
                userId,
                role: 'PARTNER'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsPartnerModalVisible(false);
            fetchDetail(); // Refresh WO data
            Alert.alert('Berhasil', 'Partner berhasil ditambahkan');
        } catch (error: any) {
            Alert.alert('Gagal', error.response?.data?.error || 'Gagal menambahkan partner');
        } finally {
            setPartnerLoading(false);
        }
    };

    const handleRemovePartner = async (assignmentId: string) => {
        Alert.alert(
            'Hapus Partner',
            'Apakah Anda yakin ingin menghapus partner ini?',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Hapus',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await axios.delete(`${Config.API_URL}/api/mobile/work-orders/${id}/partners?assignmentId=${assignmentId}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            fetchDetail();
                            Alert.alert('Berhasil', 'Partner dihapus');
                        } catch (error) {
                            Alert.alert('Gagal', 'Gagal menghapus partner');
                        }
                    }
                }
            ]
        );
    };


    const handlePartnerResponse = async (response: 'APPROVED' | 'REJECTED') => {
        setActionLoading(true);
        try {
            const res = await axios.post(`${Config.API_URL}/api/mobile/work-orders/${id}/partner-response`, {
                response
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                Alert.alert('Sukses', `Berhasil ${response === 'APPROVED' ? 'menerima' : 'menolak'} permintaan partner.`);

                if (response === 'REJECTED') {
                    // Navigate back since user is no longer involved in this WO
                    router.back();
                } else {
                    fetchDetail();
                }
            }
        } catch (error) {
            console.error('Partner Response Error:', error);
            Alert.alert('Error', 'Gagal merespon permintaan partner');
        } finally {
            setActionLoading(false);
        }
    };

    const renderInfoTab = () => (
        <View>
            <View>
                {/* Status Card */}
                <View style={tw`bg-white p-4 rounded-xl shadow-sm mb-4 border border-gray-100`}>
                    <View style={tw`flex-row justify-between mb-2`}>
                        <Text style={tw`text-xs text-gray-400 font-bold uppercase`}>Jadwal & Status</Text>
                        <Text style={tw`text-xs font-bold ${wo.priority === 'URGENT' ? 'text-red-600' : 'text-gray-500'
                            }`}>{wo.priority}</Text>
                    </View>
                    <View style={tw`flex-row items-center justify-between`}>
                        <View style={tw`px-3 py-1 rounded-full ${wo.status === 'IN_PROGRESS' ? 'bg-blue-100' :
                            wo.status === 'COMPLETED' ? 'bg-green-100' : 'bg-gray-100'
                            }`}>
                            <Text style={tw`font-bold ${wo.status === 'IN_PROGRESS' ? 'text-blue-700' :
                                wo.status === 'COMPLETED' ? 'text-green-700' : 'text-gray-700'
                                }`}>{wo.status}</Text>
                        </View>
                        {wo.scheduledDate && (
                            <View style={tw`flex-row items-center bg-gray-50 px-3 py-1 rounded-lg`}>
                                <Calendar size={14} color="#6b7280" style={tw`mr-1`} />
                                <Text style={tw`text-xs text-gray-700 font-medium`}>
                                    {format(new Date(wo.scheduledDate), 'dd MMM yyyy, HH:mm', { locale: idLocale })}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Description Card */}
                <View style={tw`bg-white p-4 rounded-xl shadow-sm mb-4 border border-gray-100`}>
                    <Text style={tw`text-xs text-gray-400 font-bold mb-2 uppercase`}>Deskripsi Pekerjaan</Text>
                    <Text style={tw`font-bold text-gray-800 text-lg mb-2`}>{wo.title}</Text>
                    <Text style={tw`text-sm text-gray-600 leading-6 bg-gray-50 p-3 rounded-lg`}>
                        {wo.description || 'Tidak ada deskripsi'}
                    </Text>
                </View>

                {/* Schedule & Location Card */}
                <View style={tw`bg-white p-4 rounded-xl shadow-sm mb-4 border border-gray-100`}>
                    <View style={tw`flex-row mb-4`}>
                        <Clock size={20} color="#2563eb" style={tw`mt-0.5 mr-3`} />
                        <View>
                            <Text style={tw`text-xs text-gray-400 mb-0.5`}>Jadwal</Text>
                            <Text style={tw`text-sm font-bold text-gray-800`}>
                                {wo.scheduledDate ? format(new Date(wo.scheduledDate), 'EEEE, dd MMMM yyyy', { locale: idLocale }) : '-'}
                            </Text>
                            <Text style={tw`text-xs text-gray-500`}>
                                {wo.scheduledDate ? format(new Date(wo.scheduledDate), 'HH.mm', { locale: idLocale }) : '-'} - selesai
                            </Text>
                        </View>
                    </View>

                    {wo.startedAt && (
                        <View style={tw`flex-row mb-4 ml-8`}>
                            <View>
                                <Text style={tw`text-xs text-gray-400 mb-0.5`}>Waktu Mulai</Text>
                                <Text style={tw`text-sm font-bold text-green-600`}>
                                    {format(new Date(wo.startedAt), 'EEEE, dd MMMM yyyy • HH.mm', { locale: idLocale })}
                                </Text>
                            </View>
                        </View>
                    )}

                    <View style={tw`flex-row`}>
                        <MapPin size={20} color="#dc2626" style={tw`mt-0.5 mr-3`} />
                        <View style={tw`flex-1`}>
                            <Text style={tw`text-xs text-gray-400 mb-0.5`}>Lokasi</Text>
                            <Text style={tw`text-sm font-bold text-gray-800 leading-5`}>
                                {wo.locationAddress || wo.pelanggan?.alamat || '-'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Contact Card */}
                {(wo.contactName || wo.pelanggan?.nama || wo.contactPhone || wo.pelanggan?.noTelp) && (
                    <View style={tw`bg-white p-4 rounded-xl shadow-sm mb-4 border border-gray-100`}>
                        <Text style={tw`text-xs text-gray-400 font-bold mb-3 uppercase`}>Kontak</Text>

                        {(wo.contactName || wo.pelanggan?.nama) && (
                            <View style={tw`flex-row items-center mb-3`}>
                                <User size={18} color="#6b7280" style={tw`mr-3`} />
                                <View>
                                    <Text style={tw`text-xs text-gray-400`}>Nama</Text>
                                    <Text style={tw`text-sm font-bold text-gray-800`}>
                                        {wo.contactName || wo.pelanggan?.nama}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {(wo.contactPhone || wo.pelanggan?.noTelp) && (
                            <TouchableOpacity
                                onPress={() => {
                                    const phone = wo.contactPhone || wo.pelanggan?.noTelp;
                                    if (phone) {
                                        const { Linking } = require('react-native');
                                        Linking.openURL(`tel:${phone}`);
                                    }
                                }}
                                style={tw`flex-row items-center`}
                            >
                                <Phone size={18} color="#2563eb" style={tw`mr-3`} />
                                <View>
                                    <Text style={tw`text-xs text-gray-400`}>Telepon</Text>
                                    <Text style={tw`text-sm font-bold text-blue-600`}>
                                        {wo.contactPhone || wo.pelanggan?.noTelp}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Team & Partners Card */}
                <View style={tw`bg-white p-4 rounded-xl shadow-sm mb-4 border border-gray-100`}>
                    <View style={tw`flex-row justify-between items-center mb-3`}>
                        <Text style={tw`text-xs text-gray-400 font-bold uppercase`}>Tim Pengerjaan</Text>
                        {wo.status !== 'COMPLETED' && wo.status !== 'CLOSED' && (
                            <TouchableOpacity onPress={() => setIsPartnerModalVisible(true)}>
                                <Text style={tw`text-xs font-bold text-blue-600`}>+ Tambah</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Primary Assigned */}
                    {wo.assignedTo && (
                        <View style={tw`flex-row items-center mb-3 bg-blue-50 p-2 rounded-lg`}>
                            <View style={tw`w-8 h-8 bg-blue-200 rounded-full items-center justify-center mr-3`}>
                                <Text style={tw`font-bold text-blue-700`}>{wo.assignedTo.name?.charAt(0)}</Text>
                            </View>
                            <View style={tw`flex-1`}>
                                <Text style={tw`font-bold text-gray-800 text-sm`}>{wo.assignedTo.name}</Text>
                                <Text style={tw`text-xs text-blue-600`}>Lead Teknisi</Text>
                            </View>
                        </View>
                    )}

                    {/* Partners */}
                    {wo.assignments?.filter((a: any) => a.userId !== wo.assignedToId).map((assignment: any, idx: number) => (
                        <View key={idx} style={tw`flex-row items-center justify-between mb-2 pb-2 border-b border-gray-50 last:border-0`}>
                            <View style={tw`flex-row items-center flex-1`}>
                                <View style={tw`w-8 h-8 rounded-full bg-blue-100 items-center justify-center mr-3`}>
                                    <Text style={tw`font-bold text-blue-600`}>
                                        {assignment.user?.name?.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View style={tw`flex-1`}>
                                    <Text style={tw`font-bold text-gray-800 text-sm`}>{assignment.user?.name}</Text>
                                    <View style={tw`flex-row items-center mt-0.5`}>
                                        <Text style={tw`text-xs text-gray-500 mr-2`}>
                                            {assignment.role || 'Partner'}
                                        </Text>
                                        <View style={tw`px-2 py-0.5 rounded-full ${assignment.status === 'APPROVED' ? 'bg-green-100' :
                                            assignment.status === 'REJECTED' ? 'bg-red-100' :
                                                'bg-yellow-100'
                                            }`}>
                                            <Text style={tw`text-[10px] font-bold ${assignment.status === 'APPROVED' ? 'text-green-700' :
                                                assignment.status === 'REJECTED' ? 'text-red-700' :
                                                    'text-yellow-700'
                                                }`}>
                                                {assignment.status === 'APPROVED' ? 'Setuju' :
                                                    assignment.status === 'REJECTED' ? 'Tolak' : 'Menunggu'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* Action Buttons for Pending Partner (Only if it's me) */}
                            {assignment.status === 'PENDING' && assignment.userId === user?.id && (
                                <View style={tw`flex-row gap-2`}>
                                    <TouchableOpacity
                                        onPress={() => handlePartnerResponse('REJECTED')}
                                        disabled={actionLoading}
                                        style={tw`bg-red-50 p-2 rounded-lg border border-red-100`}
                                    >
                                        <X size={16} color="#ef4444" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handlePartnerResponse('APPROVED')}
                                        disabled={actionLoading}
                                        style={tw`bg-green-50 p-2 rounded-lg border border-green-100`}
                                    >
                                        <CheckCircle size={16} color="#16a34a" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Delete Button (Only for Creator/Assigner or if not me) */}
                            {(!assignment.status || assignment.status === 'APPROVED' || assignment.status === 'PENDING') && assignment.userId !== user?.id && wo.status !== 'COMPLETED' && (
                                <TouchableOpacity onPress={() => handleRemovePartner(assignment.id)} style={tw`p-2`}>
                                    <X size={16} color="#ef4444" />
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}

                    {(!wo.assignments || wo.assignments.length <= 1) && !wo.assignedTo && (
                        <Text style={tw`text-gray-400 text-xs italic`}>Belum ada tim yang ditugaskan</Text>
                    )}
                </View>
            </View>
        </View>
    );

    const renderItemsTab = () => (
        <View style={tw`bg-white p-4 rounded-xl shadow-sm mb-4 border border-gray-100 min-h-64`}>
            <Text style={tw`font-bold text-gray-800 mb-4`}>Barang Digunakan</Text>
            {wo.usedMaterials && Array.isArray(wo.usedMaterials) && wo.usedMaterials.length > 0 ? (
                wo.usedMaterials.map((item: any, idx: number) => (
                    <View key={idx} style={tw`flex-row justify-between items-center py-2 border-b border-gray-100`}>
                        <Text style={tw`text-gray-700`}>{item.name || item.barangName || item.nama}</Text>
                        <Text style={tw`font-bold`}>{item.quantity || item.jumlah} {item.unit || item.satuan || 'pcs'}</Text>
                    </View>
                ))
            ) : (
                <Text style={tw`text-center text-gray-400 mt-4`}>Belum ada barang yang dicatat</Text>
            )}

            <View style={tw`mt-6`}>
                <TouchableOpacity
                    onPress={() => router.push(`/(app)/ambil-barang/${id}`)}
                    style={tw`flex-row items-center justify-center p-3 bg-blue-50 rounded-xl border border-blue-200 active:bg-blue-100`}
                >
                    <Plus size={20} color="#2563eb" style={tw`mr-2`} />
                    <Text style={tw`font-bold text-blue-600`}>Ambil Barang / Material</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderTimelineTab = () => (
        <View style={tw`bg-white p-4 rounded-xl shadow-sm mb-4 border border-gray-100`}>
            <Text style={tw`text-xs text-gray-400 font-bold mb-4 uppercase`}>Update Aktivitas</Text>

            {/* Input Form */}
            <View style={tw`mb-6`}>
                <TextInput
                    style={tw`bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm h-20 mb-3`}
                    multiline
                    textAlignVertical="top"
                    placeholder="Tulis update aktivitas..."
                    value={resolutionNotes} // Reuse specific state or create new one? reusing for now
                    onChangeText={setResolutionNotes}
                />

                {photo && (
                    <View style={tw`mb-3`}>
                        <Image source={{ uri: photo }} style={tw`w-24 h-24 rounded-lg`} resizeMode="cover" />
                        <TouchableOpacity onPress={() => setPhoto(null)} style={tw`absolute top-1 right-1 bg-black/50 p-1 rounded-full`}>
                            <X color="white" size={12} />
                        </TouchableOpacity>
                    </View>
                )}

                <View style={tw`flex-row justify-between items-center`}>
                    <TouchableOpacity onPress={pickImage} style={tw`p-2 bg-gray-100 rounded-lg`}>
                        <Camera size={20} color="#4b5563" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => {
                            // Assuming handleUpdateStatus handles NOTE logic, or we need a new handler?
                            // handleUpdateStatus logic needs to support NOTE
                            handleUpdateStatus('NOTE');
                        }}
                        disabled={actionLoading || (!resolutionNotes && !photo)}
                        style={tw`bg-blue-600 px-4 py-2 rounded-lg ${(actionLoading || (!resolutionNotes && !photo)) ? 'opacity-50' : ''
                            }`}
                    >
                        {actionLoading ? <ActivityIndicator color="white" size="small" /> : <Text style={tw`text-white font-bold text-xs`}>Kirim Update</Text>}
                    </TouchableOpacity>
                </View>
            </View>

            <View style={tw`h-0.5 bg-gray-100 mb-6`} />

            <Text style={tw`text-xs text-gray-400 font-bold mb-4 uppercase`}>Riwayat Aktivitas</Text>
            {wo.updates?.map((update: any, index: number) => (
                <View key={index} style={tw`flex-row mb-6 relative`}>
                    {/* Line */}
                    {index !== wo.updates.length - 1 && (
                        <View style={tw`absolute left-3 top-6 bottom--6 w-0.5 bg-gray-200`} />
                    )}

                    {/* Dot */}
                    <View style={tw`w-6 h-6 rounded-full bg-blue-100 items-center justify-center mr-3 z-10`}>
                        <View style={tw`w-2 h-2 rounded-full bg-blue-600`} />
                    </View>

                    {/* Content */}
                    <View style={tw`flex-1`}>
                        <Text style={tw`text-xs text-gray-500 mb-0.5`}>
                            {format(new Date(update.createdAt), 'dd MMM HH:mm', { locale: idLocale })}
                        </Text>
                        <Text style={tw`font-bold text-gray-800 text-sm`}>
                            {update.updateType === 'STATUS_CHANGE'
                                ? `Status: ${update.newStatus}`
                                : update.updateType}
                        </Text>
                        <Text style={tw`text-gray-600 text-sm mt-1 leading-5`}>{update.message}</Text>

                        {/* Show Attachment if any (Need to filter attachments by match? Or just show general logic?) 
                            Ideally updates should be linked to attachments, but simple list for now.
                        */}

                        {update.createdBy && (
                            <Text style={tw`text-xs text-gray-400 mt-1 italic`}>Oleh: {update.createdBy.name}</Text>
                        )}
                    </View>
                </View>
            ))}
            {(!wo.updates || wo.updates.length === 0) && (
                <Text style={tw`text-center text-gray-400 py-4`}>Belum ada riwayat aktivitas</Text>
            )}
        </View>
    );

    return (
        <SafeAreaView style={tw`flex-1 bg-gray-50`}>
            {/* Header */}
            <View style={tw`px-4 py-3 flex-row items-center border-b border-gray-200 bg-white`}>
                <TouchableOpacity onPress={() => router.back()} style={tw`p-2 mr-2 -ml-2`}>
                    <ArrowLeft size={24} color="#1f2937" />
                </TouchableOpacity>
                <View style={tw`flex-1`}>
                    <Text style={tw`font-bold text-lg text-gray-800`} numberOfLines={1}>{wo.workOrderNumber}</Text>
                    <Text style={tw`text-xs text-gray-500`}>{wo.type}</Text>
                </View>
            </View>

            {/* Tabs */}
            <View style={tw`flex-row bg-white border-b border-gray-200 px-2`}>
                {[
                    { key: 'INFO', label: 'Info', icon: FileText },
                    { key: 'ITEMS', label: 'Barang', icon: Package },
                    { key: 'TIMELINE', label: 'Riwayat', icon: History },
                ].map((tab: any) => (
                    <TouchableOpacity
                        key={tab.key}
                        onPress={() => setActiveTab(tab.key)}
                        style={tw`flex-1 flex-row items-center justify-center py-3 border-b-2 ${activeTab === tab.key ? 'border-blue-600' : 'border-transparent'
                            }`}
                    >
                        <tab.icon size={16} color={activeTab === tab.key ? '#2563eb' : '#6b7280'} style={tw`mr-2`} />
                        <Text style={tw`text-sm font-medium ${activeTab === tab.key ? 'text-blue-600' : 'text-gray-500'
                            }`}>{tab.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <ScrollView contentContainerStyle={tw`p-4 pb-32`}>
                {activeTab === 'INFO' && renderInfoTab()}
                {activeTab === 'ITEMS' && renderItemsTab()}
                {activeTab === 'TIMELINE' && renderTimelineTab()}

                {/* Completion Form (Only shown in Info tab or when completing) */}
                {(activeTab === 'INFO' && showCompleteForm) && (
                    <View style={tw`bg-white p-4 rounded-xl shadow-sm mb-4 border border-blue-200`}>
                        <Text style={tw`font-bold text-gray-800 mb-3`}>Laporan Penyelesaian</Text>

                        <Text style={tw`text-xs text-gray-500 mb-1`}>Catatan Pengerjaan *</Text>
                        <TextInput
                            style={tw`border border-gray-300 rounded-lg p-3 text-sm h-24 mb-4 bg-gray-50`}
                            multiline
                            textAlignVertical="top"
                            placeholder="Jelaskan apa saja yang dikerjakan..."
                            value={resolutionNotes}
                            onChangeText={setResolutionNotes}
                        />

                        <Text style={tw`text-xs text-gray-500 mb-2`}>Bukti Foto *</Text>
                        {photo ? (
                            <View style={tw`mb-4`}>
                                <Image source={{ uri: photo }} style={tw`w-full h-48 rounded-lg mb-2`} resizeMode="cover" />
                                <TouchableOpacity onPress={() => setPhoto(null)} style={tw`absolute top-2 right-2 bg-black/50 p-1 rounded-full`}>
                                    <X color="white" size={16} />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity onPress={pickImage} style={tw`border-2 border-dashed border-gray-300 rounded-lg h-32 items-center justify-center mb-4 bg-gray-50`}>
                                <Camera size={24} color="#9ca3af" />
                                <Text style={tw`text-xs text-gray-400 mt-2`}>Ambil Foto Bukti</Text>
                            </TouchableOpacity>
                        )}

                        <View style={tw`flex-row gap-2`}>
                            <TouchableOpacity
                                onPress={() => setShowCompleteForm(false)}
                                style={tw`flex-1 py-3 bg-gray-200 rounded-lg items-center`}
                            >
                                <Text style={tw`font-bold text-gray-600`}>Batal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => handleUpdateStatus('COMPLETE')}
                                disabled={actionLoading}
                                style={tw`flex-1 py-3 bg-green-600 rounded-lg items-center`}
                            >
                                {actionLoading ? (
                                    <ActivityIndicator color="white" size="small" />
                                ) : (
                                    <Text style={tw`font-bold text-white`}>Kirim Laporan</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

            </ScrollView>

            <Modal
                visible={isPartnerModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsPartnerModalVisible(false)}
            >
                <View style={tw`flex-1 bg-black/50 justify-end`}>
                    <View style={tw`bg-white rounded-t-3xl h-3/4 p-4`}>
                        <View style={tw`flex-row justify-between items-center mb-4`}>
                            <Text style={tw`font-bold text-lg text-gray-800`}>Pilih Partner</Text>
                            <TouchableOpacity onPress={() => setIsPartnerModalVisible(false)} style={tw`p-2 bg-gray-100 rounded-full`}>
                                <X size={20} color="#6b7280" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={tw`bg-gray-50 p-3 rounded-xl mb-4 text-gray-800`}
                            placeholder="Cari nama teknisi..."
                            value={searchPartnerQuery}
                            onChangeText={setSearchPartnerQuery}
                        />

                        {partnerLoading ? (
                            <ActivityIndicator size="large" color="#2563eb" style={tw`mt-10`} />
                        ) : (
                            <FlatList
                                data={availablePartners}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        onPress={() => handleAddPartner(item.id)}
                                        style={tw`flex-row items-center p-3 border-b border-gray-100 active:bg-blue-50`}
                                    >
                                        <View style={tw`w-10 h-10 bg-gray-200 rounded-full items-center justify-center mr-3`}>
                                            <Text style={tw`font-bold text-gray-600`}>{item.name?.charAt(0)}</Text>
                                        </View>
                                        <View>
                                            <Text style={tw`font-bold text-gray-800`}>{item.name}</Text>
                                            <Text style={tw`text-xs text-gray-500`}>{item.role?.name || 'Karyawan'} • {item.site?.name || 'Headquarters'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                                ListEmptyComponent={
                                    <Text style={tw`text-center text-gray-400 mt-10`}>Tidak ada teknisi ditemukan</Text>
                                }
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* Bottom Actions */}
            {!showCompleteForm && (() => {
                // Determine user role and permissions
                const isAssignedToMe = wo.assignedToId === user?.id;
                const myAssignment = wo.assignments?.find((a: any) => a.userId === user?.id);
                const isPendingPartner = myAssignment?.role === 'PARTNER' && myAssignment?.status === 'PENDING';
                const isApprovedPartner = myAssignment?.role === 'PARTNER' && myAssignment?.status === 'APPROVED';

                // Check if all partners responded
                const partnerList = wo.assignments?.filter((a: any) => a.role === 'PARTNER') || [];
                const allPartnersResponded = partnerList.length === 0 || partnerList.every((a: any) => a.status !== 'PENDING');

                // Conditions for actions
                const canStartWork = isAssignedToMe && wo.status === 'ASSIGNED' && allPartnersResponded;
                const canPauseOrComplete = (isAssignedToMe || isApprovedPartner) && wo.status === 'IN_PROGRESS';
                const canResumeWork = isAssignedToMe && wo.status === 'ON_HOLD';

                // Partner pending - show accept/reject buttons
                if (isPendingPartner) {
                    return (
                        <View style={tw`absolute bottom-0 left-0 right-0 bg-yellow-50 p-4 border-t border-yellow-200 shadow-lg z-20`}>
                            <Text style={tw`text-sm text-yellow-800 font-medium text-center mb-3`}>
                                Anda diundang sebagai partner untuk WO ini
                            </Text>
                            <View style={tw`flex-row gap-3`}>
                                <TouchableOpacity
                                    onPress={() => handlePartnerResponse('REJECTED')}
                                    disabled={actionLoading}
                                    style={tw`flex-1 bg-red-100 py-3.5 rounded-xl items-center flex-row justify-center border border-red-200`}
                                >
                                    <X size={20} color="#dc2626" style={tw`mr-2`} />
                                    <Text style={tw`font-bold text-red-700`}>Tolak</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handlePartnerResponse('APPROVED')}
                                    disabled={actionLoading}
                                    style={tw`flex-1 bg-green-600 py-3.5 rounded-xl items-center flex-row justify-center shadow-sm`}
                                >
                                    {actionLoading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <CheckCircle size={20} color="white" style={tw`mr-2`} />
                                            <Text style={tw`font-bold text-white`}>Terima</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                }

                // IN_PROGRESS - show pause/complete (for assignedTo and approved partners)
                if (canPauseOrComplete) {
                    return (
                        <View style={tw`absolute bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-200 flex-row gap-3 shadow-lg z-20`}>
                            <TouchableOpacity
                                onPress={() => handleUpdateStatus('PAUSE')}
                                disabled={actionLoading}
                                style={tw`flex-1 bg-yellow-100 py-3.5 rounded-xl items-center flex-row justify-center border border-yellow-200`}
                            >
                                <Pause size={20} color="#854d0e" style={tw`mr-2`} />
                                <Text style={tw`font-bold text-yellow-800`}>Pause</Text>
                            </TouchableOpacity>
                            {isAssignedToMe && (
                                <TouchableOpacity
                                    onPress={() => handleUpdateStatus('COMPLETE')}
                                    disabled={actionLoading}
                                    style={tw`flex-1 bg-green-600 py-3.5 rounded-xl items-center flex-row justify-center shadow-sm`}
                                >
                                    <CheckCircle size={20} color="white" style={tw`mr-2`} />
                                    <Text style={tw`font-bold text-white`}>Selesai</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                }

                // ASSIGNED - show start work (only for assignedTo when all partners responded)
                if (canStartWork) {
                    return (
                        <View style={tw`absolute bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-200 shadow-lg z-20`}>
                            <TouchableOpacity
                                onPress={() => handleUpdateStatus('START')}
                                disabled={actionLoading}
                                style={tw`bg-blue-600 py-3.5 rounded-xl items-center flex-row justify-center shadow-sm`}
                            >
                                {actionLoading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Play size={20} color="white" style={tw`mr-2`} />
                                        <Text style={tw`font-bold text-white`}>Mulai Pekerjaan</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    );
                }

                // ASSIGNED but waiting for partners - show info
                if (isAssignedToMe && wo.status === 'ASSIGNED' && !allPartnersResponded) {
                    return (
                        <View style={tw`absolute bottom-0 left-0 right-0 bg-yellow-50 p-4 border-t border-yellow-200 shadow-lg z-20`}>
                            <Text style={tw`text-sm text-yellow-800 font-medium text-center`}>
                                Menunggu konfirmasi partner sebelum mulai pekerjaan...
                            </Text>
                        </View>
                    );
                }

                // ON_HOLD - show resume (only for assignedTo)
                if (canResumeWork) {
                    return (
                        <View style={tw`absolute bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-200 shadow-lg z-20`}>
                            <TouchableOpacity
                                onPress={() => handleUpdateStatus('START')}
                                disabled={actionLoading}
                                style={tw`bg-blue-600 py-3.5 rounded-xl items-center flex-row justify-center shadow-sm`}
                            >
                                {actionLoading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Play size={20} color="white" style={tw`mr-2`} />
                                        <Text style={tw`font-bold text-white`}>Lanjutkan Pekerjaan</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    );
                }

                return null;
            })()}
        </SafeAreaView>
    );
}
