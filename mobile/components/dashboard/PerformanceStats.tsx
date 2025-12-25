import React from 'react';
import { View, Text } from 'react-native';
import tw from 'twrnc';

interface PerformanceStatsProps {
    today: number;
    week: number;
    month: number;
}

export const PerformanceStats = ({ today, week, month }: PerformanceStatsProps) => {
    return (
        <View style={tw`mx-4 mb-4 bg-white rounded-xl p-4 shadow-sm border border-gray-100`}>
            <Text style={tw`text-sm font-bold text-gray-900 mb-3`}>Tiket Selesai</Text>
            <View style={tw`flex-row justify-between`}>
                <StatBox value={today} label="Hari Ini" bg="bg-blue-50" text="text-blue-600" />
                <View style={tw`w-2`} />
                <StatBox value={week} label="Minggu" bg="bg-indigo-50" text="text-indigo-600" />
                <View style={tw`w-2`} />
                <StatBox value={month} label="Bulan" bg="bg-violet-50" text="text-violet-600" />
            </View>
        </View>
    );
};

const StatBox = ({ value, label, bg, text }: { value: number, label: string, bg: string, text: string }) => (
    <View style={tw`flex-1 items-center justify-center p-3 rounded-xl ${bg}`}>
        <Text style={tw`text-2xl font-bold ${text}`}>{value}</Text>
        <Text style={tw`text-[10px] uppercase font-bold text-gray-500 mt-1`}>{label}</Text>
    </View>
);
