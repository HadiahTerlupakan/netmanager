import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import tw from 'twrnc';
import { useAuth } from '../../context/AuthContext';
import { Config } from '../../constants/Config';
import axios from 'axios';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DashboardHeader } from '../../components/dashboard/Header';
import { WorkOrderCard } from '../../components/dashboard/WorkOrderCard';
import { PerformanceStats } from '../../components/dashboard/PerformanceStats';
import { QuickMenu } from '../../components/dashboard/QuickMenu';
import { useRouter } from 'expo-router';

// Define stats interface
interface DashboardStats {
    workOrdersAssigned: number;
    workOrdersPending: number;
    woCompletedToday: number;
    woCompletedWeek: number;
    woCompletedMonth: number;
    barangKeluarToday: number;
    barangMasukToday: number;
}

export default function Dashboard() {
    const { user, token } = useAuth();
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats | null>(null);

    const fetchStats = async () => {
        try {
            const res = await axios.get(`${Config.API_URL}/api/mobile/dashboard`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats(res.data);
        } catch (error) {
            console.error('Fetch stats error:', error);
            // Silent error or toast
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (token) fetchStats();
    }, [token]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchStats();
    }, []);

    if (loading && !stats) {
        return (
            <SafeAreaView style={tw`flex-1 bg-gray-50 items-center justify-center`}>
                <ActivityIndicator size="large" color="#2563eb" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={tw`flex-1 bg-gray-50`}>
            {/* Header */}
            <DashboardHeader userName={user?.name || 'Karyawan'} />

            <ScrollView
                contentContainerStyle={tw`pb-10 pt-4`}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
            >
                {/* Greeting */}
                <View style={tw`px-4 pb-4`}>
                    <Text style={tw`text-sm font-medium text-gray-500`}>Selamat datang,</Text>
                    <Text style={tw`text-2xl font-bold text-gray-900`}>{user?.name || 'User'}</Text>
                </View>

                {/* Work Order Card */}
                <WorkOrderCard
                    assigned={stats?.workOrdersAssigned || 0}
                    pending={stats?.workOrdersPending || 0}
                    onPress={() => router.push('/(app)/work-order' as any)}
                />

                {/* Performance Stats */}
                <PerformanceStats
                    today={stats?.woCompletedToday || 0}
                    week={stats?.woCompletedWeek || 0}
                    month={stats?.woCompletedMonth || 0}
                />

                {/* Quick Menu */}
                <QuickMenu />

            </ScrollView>
        </SafeAreaView>
    );
}
