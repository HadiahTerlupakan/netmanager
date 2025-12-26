import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import tw from 'twrnc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Bell, Briefcase, Calendar, Package, Clock, CheckCircle, AlertCircle, Megaphone } from 'lucide-react-native';
import axios from 'axios';
import { Config } from '@/constants/Config';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    isRead: boolean;
    sourceType?: string;
    sourceId?: string;
    createdAt: string;
}

export default function NotificationsScreen() {
    const { token } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${Config.API_URL}/api/mobile/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setNotifications(res.data.data.notifications);
                setUnreadCount(res.data.data.unreadCount);
            }
        } catch (error) {
            console.error('Failed to fetch notifications', error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useFocusEffect(
        useCallback(() => {
            fetchNotifications();
        }, [fetchNotifications])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchNotifications();
        setRefreshing(false);
    };

    const markAsRead = async (notificationId: string) => {
        try {
            await axios.post(`${Config.API_URL}/api/mobile/notifications`,
                { action: 'markRead', notificationId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNotifications(prev =>
                prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark as read', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await axios.post(`${Config.API_URL}/api/mobile/notifications`,
                { action: 'markAllRead' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark all as read', error);
        }
    };

    const handleNotificationPress = (notification: Notification) => {
        const proceed = () => {
            if (!notification.isRead) {
                markAsRead(notification.id);
            }
            if (notification.link) {
                router.push(notification.link as any);
            }
        };

        if (notification.sourceType === 'ANNOUNCEMENT' && !notification.isRead) {
            // Confirm read for analytics
            const { Alert } = require('react-native');
            Alert.alert(
                'Konfirmasi',
                'Apakah Anda sudah membaca pengumuman ini?',
                [
                    {
                        text: 'Belum',
                        style: 'cancel',
                        onPress: () => {
                            // Do nothing, or maybe navigate without marking read?
                            // User request: "agar bisa track ... brapa banyak yang sudah buka"
                            // So if not read, maybe just open to see but don't mark?
                            // Or "buka" means "read". Let's assume navigating is fine, but tracking happens on "Yes".
                            // Actually, usually "Yes" marks it read. "No" keeps it unread.
                            // But usually clicking opens it anyway. 
                            // Let's assume if they click "No", they just close the alert or maybe still navigate?
                            // "ketika di klik mustinya masuk ke modal ... yes no"
                            // If they say No, maybe they just want to peek? 
                            // Let's strictly follow: Yes -> Mark Read & Navigate. No -> Cancel (don't navigate or navigate without read?).
                            // Safest: Yes -> Mark & Navigate. No -> Navigate w/o Mark (or just Cancel).
                            // Let's do: Yes -> Mark & Navigate. No -> Just Navigate (so they can read it). 
                            // Wait, if they haven't read it, they click to READ it.
                            // So asking "Have you read it?" BEFORE opening seems backwards?
                            // Maybe the question is "Mark as read?" AFTER opening? 
                            // But user said: "ketika di klik mustinya masuk ke modal" (When clicked, enter modal).
                            // So: Click -> Modal "Mark as read?" -> Yes (Mark+Open) / No (Open).
                            // Let's TRY: Yes -> Mark Read + Open. No -> Open only.
                            // Update: User said "agar bisa track", implies tracking count of "Yes".

                            if (notification.link) router.push(notification.link as any);
                        }
                    },
                    {
                        text: 'Sudah',
                        onPress: () => {
                            proceed();
                        }
                    }
                ]
            );
        } else {
            proceed();
        }
    };

    const getIcon = (sourceType?: string) => {
        switch (sourceType) {
            case 'WORK_ORDER':
                return <Briefcase size={20} color="#3b82f6" />;
            case 'LEAVE':
                return <Calendar size={20} color="#10b981" />;
            case 'OVERTIME':
                return <Clock size={20} color="#f59e0b" />;
            case 'INVENTORY':
                return <Package size={20} color="#8b5cf6" />;
            case 'ANNOUNCEMENT':
                return <Megaphone size={20} color="#ec4899" />;
            default:
                return <Bell size={20} color="#6b7280" />;
        }
    };

    const formatTime = (dateString: string) => {
        try {
            return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: id });
        } catch {
            return dateString;
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={tw`flex-1 bg-gray-50 justify-center items-center`}>
                <ActivityIndicator size="large" color="#2563eb" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={tw`flex-1 bg-gray-50`}>
            {/* Header */}
            <View style={tw`bg-blue-600 px-4 py-4 flex-row items-center justify-between`}>
                <View style={tw`flex-row items-center`}>
                    <TouchableOpacity onPress={() => router.back()} style={tw`p-2 -ml-2`}>
                        <ArrowLeft size={24} color="white" />
                    </TouchableOpacity>
                    <Text style={tw`text-white font-bold text-lg ml-2`}>Notifikasi</Text>
                    {unreadCount > 0 && (
                        <View style={tw`bg-red-500 rounded-full px-2 py-0.5 ml-2`}>
                            <Text style={tw`text-white text-xs font-bold`}>{unreadCount}</Text>
                        </View>
                    )}
                </View>
                {unreadCount > 0 && (
                    <TouchableOpacity onPress={markAllAsRead}>
                        <Text style={tw`text-blue-100 text-sm font-medium`}>Tandai Dibaca</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                contentContainerStyle={tw`pb-6`}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {notifications.length === 0 ? (
                    <View style={tw`items-center justify-center py-20`}>
                        <Bell size={48} color="#d1d5db" />
                        <Text style={tw`text-gray-400 text-lg mt-4`}>Belum ada notifikasi</Text>
                    </View>
                ) : (
                    notifications.map((notif) => (
                        <TouchableOpacity
                            key={notif.id}
                            onPress={() => handleNotificationPress(notif)}
                            style={tw`flex-row p-4 border-b border-gray-100 ${!notif.isRead ? 'bg-blue-50' : 'bg-white'}`}
                        >
                            <View style={tw`w-10 h-10 rounded-full bg-gray-100 items-center justify-center mr-3`}>
                                {getIcon(notif.sourceType)}
                            </View>
                            <View style={tw`flex-1`}>
                                <View style={tw`flex-row items-center justify-between mb-1`}>
                                    <Text style={tw`font-bold text-gray-800 flex-1`} numberOfLines={1}>
                                        {notif.title}
                                    </Text>
                                    {!notif.isRead && (
                                        <View style={tw`w-2 h-2 rounded-full bg-blue-500 ml-2`} />
                                    )}
                                </View>
                                <Text style={tw`text-gray-600 text-sm mb-1`} numberOfLines={2}>
                                    {notif.message}
                                </Text>
                                <Text style={tw`text-gray-400 text-xs`}>
                                    {formatTime(notif.createdAt)}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
