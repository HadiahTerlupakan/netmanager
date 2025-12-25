import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import tw from 'twrnc';
import { Bell } from 'lucide-react-native';

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

            {/* Bell Icon */}
            <TouchableOpacity style={tw`h-10 w-10 items-center justify-center`}>
                <Bell size={24} color="#374151" />
                <View style={tw`absolute top-2 right-2 h-2.5 w-2.5 bg-red-500 rounded-full border border-white`} />
            </TouchableOpacity>
        </View>
    );
};
