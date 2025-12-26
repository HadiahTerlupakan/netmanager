import React from 'react';
import { View, Text } from 'react-native';
import tw from 'twrnc';
import NotificationBell from '@/components/NotificationBell';

interface DashboardHeaderProps {
    userName: string;
}

export const DashboardHeader = ({ userName }: DashboardHeaderProps) => {
    const initial = userName ? userName.charAt(0).toUpperCase() : 'K';

    return (
        <View style={tw`flex-row items-center justify-between p-4 bg-gray-50 border-b border-gray-200`}>
            {/* Avatar */}
            <View style={tw`h-10 w-10 bg-blue-600 rounded-full items-center justify-center`}>
                <Text style={tw`text-white font-bold text-lg`}>{initial}</Text>
            </View>

            {/* Title */}
            <Text style={tw`text-lg font-bold text-gray-900`}>Dashboard</Text>

            {/* Notification Bell */}
            <NotificationBell color="#374151" />
        </View>
    );
};
