import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Alert, Linking } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import tw from 'twrnc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useSocket, useSocketEvent } from '../../context/SocketContext';
import { SOCKET_EVENTS } from '../../context/socketTypes';
import axios from 'axios';
import { Config } from '../../constants/Config';
import WorkOrderListItem from '../../components/dashboard/WorkOrderListItem';
import { useRouter } from 'expo-router';
import { FileText, Inbox, CheckCircle, MapPin, Phone, User, Wifi, WifiOff } from 'lucide-react-native';
import { useOfflineQuery } from '@/hooks/useOfflineQuery';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';
import { SyncService } from '@/services/SyncService';

type TabType = 'tersedia' | 'aktif' | 'riwayat';

export default function WorkOrderScreen() {
    const { token, user } = useAuth();
    const { isConnected } = useSocket();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>('tersedia');
    const [workOrders, setWorkOrders] = useState<any[]>([]);
    
    // Offline Query
    const { data: woData, isLoading: loadingWO, refetch: refetchWO } = useOfflineQuery<any[]>({
        key: `work_orders_${activeTab}`,
        fetcher: async () => {
             let endpoint = '';
             let params = {};
             if (activeTab === 'tersedia') {
                 endpoint = `${Config.API_URL}/api/mobile/work-orders/available`;
             } else {
                 endpoint = `${Config.API_URL}/api/mobile/work-orders`;
                 params = { type: activeTab === 'aktif' ? 'active' : 'history' };
             }
             
             const res = await axios.get(endpoint, {
                 headers: { Authorization: `Bearer ${token}` },
                 params
             });
             return res.data?.data || [];
        },
        enabled: !!token
    });
    
    // Offline Mutation for Claim
    const { mutate: claimMutate, isLoading: isClaiming } = useOfflineMutation();

    useEffect(() => {
        if (woData) setWorkOrders(woData);
    }, [woData]);

    const fetchWorkOrders = refetchWO;

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        refetchWO().finally(() => setRefreshing(false));
    }, [refetchWO]);

    // WebSocket: Auto-refresh on WO updates
    const handleWOEvent = useCallback((data: any) => {
        console.log('[WS Mobile] WO Event received, refreshing list...');
        refetchWO();
    }, [refetchWO]);

    // Subscribe to WO events for real-time updates
    useSocketEvent(SOCKET_EVENTS.WORKORDER_NEW, handleWOEvent);
    useSocketEvent(SOCKET_EVENTS.WORKORDER_UPDATE, handleWOEvent);
    useSocketEvent(SOCKET_EVENTS.WORKORDER_ASSIGNED, handleWOEvent);

    const handleClaimWO = async (workOrderId: string) => {
        Alert.alert(
            'Ambil Tugas',
            'Apakah Anda yakin ingin mengambil tugas ini?',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Ya, Ambil',
                    onPress: async () => {
                        setClaiming(workOrderId);
                        
                        const isOnline = await SyncService.isOnline();
                        
                        // Optimistic Update (Offline)
                        if (!isOnline) {
                             Alert.alert('Offline', 'Permintaan disimpan di antrian.');
                             // Ideally update local state to remove from "Tersedia"
                        }

                        await claimMutate({
                            workOrderId
                        }, {
                            url: '/api/mobile/work-orders/available',
                            method: 'POST',
                            onSuccess: () => {
                                if (isOnline) {
                                    Alert.alert('Berhasil', 'Tugas berhasil diambil!');
                                    setActiveTab('aktif');
                                } else {
                                    setActiveTab('aktif'); // Optimistic switch
                                }
                            },
                             onError: (err) => Alert.alert('Error', err.message || 'Gagal mengambil tugas')
                        });
                        setClaiming(null);
                    }
                }
            ]
        );
    };

    const getTabStyle = (tab: TabType) => {
        const isActive = activeTab === tab;
        return {
            container: `flex-1 py-2.5 items-center border-b-2 ${isActive ? 'border-blue-600' : 'border-transparent'}`,
            text: `text-sm font-bold ${isActive ? 'text-blue-600' : 'text-gray-400'}`
        };
    };

    const getEmptyMessage = () => {
        switch (activeTab) {
            case 'tersedia': return 'Tidak ada tugas tersedia';
            case 'aktif': return 'Tidak ada tugas aktif';
            case 'riwayat': return 'Tidak ada riwayat tugas';
        }
    };

    const getEmptyIcon = () => {
        switch (activeTab) {
            case 'tersedia': return <Inbox size={48} color="#d1d5db" />;
            case 'aktif': return <FileText size={48} color="#d1d5db" />;
            case 'riwayat': return <CheckCircle size={48} color="#d1d5db" />;
        }
    };

    return (
        <SafeAreaView style={tw`flex-1 bg-gray-50`}>
            {/* Header */}
            <View style={tw`px-6 pt-4 pb-3`}>
                <View style={tw`flex-row items-center justify-between`}>
                    <Text style={tw`text-2xl font-bold text-gray-800`}>Work Order</Text>
                    <View style={tw`flex-row items-center`}>
                        <View style={tw`w-2 h-2 rounded-full mr-1.5 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <Text style={tw`text-xs ${isConnected ? 'text-green-600' : 'text-red-500'}`}>
                            {isConnected ? 'Live' : 'Offline'}
                        </Text>
                    </View>
                </View>
                <Text style={tw`text-sm text-gray-500`}>Kelola tugas teknis Anda</Text>
            </View>

            {/* Tabs */}
            <View style={tw`flex-row px-4 bg-white border-b border-gray-100`}>
                <TouchableOpacity
                    onPress={() => setActiveTab('tersedia')}
                    style={tw`${getTabStyle('tersedia').container}`}
                >
                    <Text style={tw`${getTabStyle('tersedia').text}`}>Tersedia</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('aktif')}
                    style={tw`${getTabStyle('aktif').container}`}
                >
                    <Text style={tw`${getTabStyle('aktif').text}`}>Aktif</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('riwayat')}
                    style={tw`${getTabStyle('riwayat').container}`}
                >
                    <Text style={tw`${getTabStyle('riwayat').text}`}>Riwayat</Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {loadingWO && !refreshing && workOrders.length === 0 ? (
                <View style={tw`flex-1 justify-center items-center`}>
                    <ActivityIndicator size="large" color="#2563eb" />
                </View>
            ) : (
                <FlatList
                    data={workOrders}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <View>
                            {activeTab === 'tersedia' ? (
                                <TouchableOpacity
                                    onPress={() => handleClaimWO(item.id)}
                                    disabled={claiming === item.id}
                                    activeOpacity={0.7}
                                >
                                    <View style={tw`bg-white mx-4 mt-3 p-4 rounded-xl shadow-sm border border-blue-100`}>
                                        {/* Header: WO Number & Status */}
                                        <View style={tw`flex-row justify-between items-start mb-2`}>
                                            <Text style={tw`font-bold text-gray-800`}>{item.workOrderNumber}</Text>
                                            <View style={tw`px-2 py-0.5 rounded-full bg-yellow-100`}>
                                                <Text style={tw`text-xs font-bold text-yellow-700`}>TERSEDIA</Text>
                                            </View>
                                        </View>

                                        {/* Title */}
                                        <Text style={tw`text-base font-semibold text-gray-900 mb-3`} numberOfLines={2}>
                                            {item.title}
                                        </Text>

                                        {/* Contact Info */}
                                        {(item.contactName || item.pelanggan?.nama) && (
                                            <View style={tw`flex-row items-center mb-2`}>
                                                <User size={14} color="#6b7280" style={tw`mr-2`} />
                                                <Text style={tw`text-sm text-gray-700 font-medium`}>
                                                    {item.contactName || item.pelanggan?.nama}
                                                </Text>
                                            </View>
                                        )}

                                        {/* Phone - Tappable */}
                                        {(item.contactPhone || item.pelanggan?.noTelp) && (
                                            <TouchableOpacity
                                                onPress={() => Linking.openURL(`tel:${item.contactPhone || item.pelanggan?.noTelp}`)}
                                                style={tw`flex-row items-center mb-2`}
                                            >
                                                <Phone size={14} color="#2563eb" style={tw`mr-2`} />
                                                <Text style={tw`text-sm text-blue-600 font-medium`}>
                                                    {item.contactPhone || item.pelanggan?.noTelp}
                                                </Text>
                                            </TouchableOpacity>
                                        )}

                                        {/* Location */}
                                        {(item.locationAddress || item.pelanggan?.alamat || item.site?.name) && (
                                            <View style={tw`flex-row items-start mb-3`}>
                                                <MapPin size={14} color="#dc2626" style={tw`mr-2 mt-0.5`} />
                                                <Text style={tw`text-sm text-gray-600 flex-1`} numberOfLines={2}>
                                                    {item.locationAddress || item.pelanggan?.alamat || item.site?.name}
                                                </Text>
                                            </View>
                                        )}

                                        {/* Tags & Ambil Button */}
                                        <View style={tw`flex-row items-center justify-between pt-2 border-t border-gray-100`}>
                                            <View style={tw`flex-row gap-2`}>
                                                <View style={tw`px-2 py-0.5 rounded bg-gray-100`}>
                                                    <Text style={tw`text-xs text-gray-600`}>{item.type}</Text>
                                                </View>
                                                <View style={tw`px-2 py-0.5 rounded ${item.priority === 'HIGH' || item.priority === 'URGENT' || item.priority === 'CRITICAL' ? 'bg-red-100' : 'bg-blue-100'}`}>
                                                    <Text style={tw`text-xs ${item.priority === 'HIGH' || item.priority === 'URGENT' || item.priority === 'CRITICAL' ? 'text-red-600' : 'text-blue-600'}`}>
                                                        {item.priority}
                                                    </Text>
                                                </View>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => handleClaimWO(item.id)}
                                                disabled={claiming === item.id}
                                                style={tw`bg-blue-600 px-4 py-2 rounded-lg ${claiming === item.id ? 'opacity-50' : ''}`}
                                            >
                                                {claiming === item.id ? (
                                                    <ActivityIndicator size="small" color="white" />
                                                ) : (
                                                    <Text style={tw`text-white font-bold text-sm`}>Ambil</Text>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity onPress={() => router.push(`/work-order-detail/${item.id}`)}>
                                    <WorkOrderListItem item={item} userId={user?.id} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                    contentContainerStyle={tw`pb-20 pt-1 ${activeTab !== 'tersedia' ? 'px-4' : ''}`}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    ListEmptyComponent={
                        <View style={tw`items-center justify-center py-20`}>
                            {getEmptyIcon()}
                            <Text style={tw`text-gray-400 mt-4`}>{getEmptyMessage()}</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

