import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import tw from 'twrnc';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Building2, MapPin, Clock, LogOut, User, Calendar, Briefcase } from 'lucide-react-native';
import axios from 'axios';
import { Config } from '@/constants/Config';
import { useAuth } from '@/context/AuthContext';
import { useFocusEffect } from 'expo-router';

interface ProfileData {
    name: string;
    email: string;
    department?: { name: string } | null;
    site?: { name: string } | null;
    role?: { name: string } | null;
    workingHourMode?: 'FIXED' | 'FLEXIBLE' | 'SHIFT';
    startWorkTime?: string | null;
    endWorkTime?: string | null;
    workDays?: string | null;
}

export default function Profile() {
    const { user, token, logout } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [profileData, setProfileData] = useState<ProfileData | null>(null);

    // Fetch profile data
    const fetchProfile = useCallback(async () => {
        if (!token) return;
        try {
            const res = await axios.get(`${Config.API_URL}/api/mobile/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setProfileData(res.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch profile', error);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useFocusEffect(
        useCallback(() => {
            fetchProfile();
        }, [fetchProfile])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchProfile();
        setRefreshing(false);
    };

    const handleLogout = () => {
        Alert.alert(
            'Konfirmasi Logout',
            'Apakah Anda yakin ingin keluar?',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Keluar',
                    style: 'destructive',
                    onPress: async () => {
                        setIsLoggingOut(true);
                        try {
                            await logout();
                        } catch (error) {
                            console.error('Logout error', error);
                        } finally {
                            setIsLoggingOut(false);
                        }
                    }
                }
            ]
        );
    };

    const getInitials = (name?: string) => {
        if (!name) return 'U';
        return name.charAt(0).toUpperCase();
    };

    const formatWorkDays = (days?: string | null) => {
        if (!days) return 'Sen - Jum';
        const dayMap: Record<string, string> = {
            'Mon': 'Sen', 'Tue': 'Sel', 'Wed': 'Rab',
            'Thu': 'Kam', 'Fri': 'Jum', 'Sat': 'Sab', 'Sun': 'Min'
        };
        return days.split(',').map(d => dayMap[d.trim()] || d).join(', ');
    };

    if (loading) {
        return (
            <SafeAreaView style={tw`flex-1 bg-gray-50 justify-center items-center`}>
                <ActivityIndicator size="large" color="#2563eb" />
            </SafeAreaView>
        );
    }

    const displayName = profileData?.name || user?.name || 'User';
    const displayEmail = profileData?.email || user?.email || '-';

    return (
        <SafeAreaView style={tw`flex-1 bg-gray-50`}>
            <ScrollView
                contentContainerStyle={tw`pb-20`}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Header */}
                <View style={tw`bg-blue-600 px-6 pt-6 pb-16 rounded-b-[40px]`}>
                    <View style={tw`items-center`}>
                        <View style={tw`w-24 h-24 bg-white rounded-full items-center justify-center mb-4 shadow-lg`}>
                            <Text style={tw`text-blue-600 text-4xl font-bold`}>{getInitials(displayName)}</Text>
                        </View>
                        <Text style={tw`text-white font-bold text-2xl`}>{displayName}</Text>
                        <Text style={tw`text-blue-100 text-sm mt-1`}>{displayEmail}</Text>
                        {profileData?.role?.name && (
                            <View style={tw`bg-blue-500 px-3 py-1 rounded-full mt-2`}>
                                <Text style={tw`text-white text-xs font-medium`}>{profileData.role.name}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Info Cards */}
                <View style={tw`px-4 -mt-8`}>
                    <View style={tw`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden`}>
                        {/* Email */}
                        <View style={tw`flex-row items-center p-4 border-b border-gray-100`}>
                            <View style={tw`w-10 h-10 bg-blue-50 rounded-full items-center justify-center mr-4`}>
                                <Mail size={20} color="#2563eb" />
                            </View>
                            <View>
                                <Text style={tw`text-xs text-gray-400 font-medium`}>Email</Text>
                                <Text style={tw`text-gray-800 font-semibold`}>{displayEmail}</Text>
                            </View>
                        </View>

                        {/* Department */}
                        <View style={tw`flex-row items-center p-4 border-b border-gray-100`}>
                            <View style={tw`w-10 h-10 bg-purple-50 rounded-full items-center justify-center mr-4`}>
                                <Building2 size={20} color="#7c3aed" />
                            </View>
                            <View>
                                <Text style={tw`text-xs text-gray-400 font-medium`}>Department</Text>
                                <Text style={tw`text-gray-800 font-semibold`}>{profileData?.department?.name || 'Belum diatur'}</Text>
                            </View>
                        </View>

                        {/* Site */}
                        <View style={tw`flex-row items-center p-4 border-b border-gray-100`}>
                            <View style={tw`w-10 h-10 bg-green-50 rounded-full items-center justify-center mr-4`}>
                                <MapPin size={20} color="#16a34a" />
                            </View>
                            <View>
                                <Text style={tw`text-xs text-gray-400 font-medium`}>Site / Lokasi</Text>
                                <Text style={tw`text-gray-800 font-semibold`}>{profileData?.site?.name || 'Belum diatur'}</Text>
                            </View>
                        </View>

                        {/* Work Schedule */}
                        <View style={tw`p-4`}>
                            <View style={tw`flex-row items-center mb-3`}>
                                <View style={tw`w-10 h-10 bg-amber-50 rounded-full items-center justify-center mr-4`}>
                                    <Clock size={20} color="#d97706" />
                                </View>
                                <View style={tw`flex-1`}>
                                    <Text style={tw`text-xs text-gray-400 font-medium`}>Jam Kerja</Text>
                                    <View style={tw`flex-row items-center`}>
                                        <Text style={tw`text-gray-800 font-semibold`}>
                                            {profileData?.workingHourMode === 'FLEXIBLE' ? 'Fleksibel' : 'Fixed'}
                                        </Text>
                                        <View style={tw`bg-blue-100 px-2 py-0.5 rounded-full ml-2`}>
                                            <Text style={tw`text-blue-700 text-xs font-medium`}>
                                                {profileData?.workingHourMode || 'FIXED'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                            
                            {profileData?.workingHourMode !== 'FLEXIBLE' && (
                                <View style={tw`bg-gray-50 rounded-xl p-3 ml-14`}>
                                    <View style={tw`flex-row items-center mb-1`}>
                                        <Briefcase size={14} color="#6b7280" />
                                        <Text style={tw`text-gray-600 text-sm ml-2`}>
                                            {profileData?.startWorkTime || '09:00'} - {profileData?.endWorkTime || '17:00'}
                                        </Text>
                                    </View>
                                    <View style={tw`flex-row items-center`}>
                                        <Calendar size={14} color="#6b7280" />
                                        <Text style={tw`text-gray-500 text-xs ml-2`}>
                                            {formatWorkDays(profileData?.workDays)}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Logout Button */}
                    <TouchableOpacity
                        onPress={handleLogout}
                        disabled={isLoggingOut}
                        style={tw`mt-6 bg-red-50 border border-red-100 rounded-2xl p-4 flex-row items-center justify-center`}
                    >
                        {isLoggingOut ? (
                            <ActivityIndicator color="#dc2626" />
                        ) : (
                            <>
                                <LogOut size={20} color="#dc2626" />
                                <Text style={tw`text-red-600 font-bold ml-2`}>Keluar</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* App Version */}
                    <Text style={tw`text-center text-gray-400 text-xs mt-6`}>
                        NetManager Mobile v1.0.0
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
