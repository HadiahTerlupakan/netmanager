import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Bell } from 'lucide-react-native';
import tw from 'twrnc';
import { useRouter, useFocusEffect } from 'expo-router';
import axios from 'axios';
import { Config } from '@/constants/Config';
import { useAuth } from '@/context/AuthContext';

interface NotificationBellProps {
    color?: string;
}

export default function NotificationBell({ color = '#ffffff' }: NotificationBellProps) {
    const { token } = useAuth();
    const router = useRouter();
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchUnreadCount = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${Config.API_URL}/api/mobile/notifications`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setUnreadCount(res.data.data.unreadCount);
            }
        } catch (error) {
            console.error('Failed to fetch notifications', error);
        }
    }, [token]);

    // Fetch on focus
    useFocusEffect(
        useCallback(() => {
            fetchUnreadCount();
        }, [fetchUnreadCount])
    );

    // Poll every 30 seconds
    useEffect(() => {
        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

    const handlePress = () => {
        router.push('/(app)/notifications');
    };

    return (
        <TouchableOpacity onPress={handlePress} style={tw`relative p-2`}>
            <Bell size={24} color={color} />
            {unreadCount > 0 && (
                <View style={tw`absolute -top-0 -right-0 bg-red-500 rounded-full min-w-5 h-5 items-center justify-center px-1`}>
                    <Text style={tw`text-white text-xs font-bold`}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}
