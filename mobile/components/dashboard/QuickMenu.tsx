import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import tw from 'twrnc';
import { Briefcase, PackagePlus, PackageMinus, Calendar, ClipboardCheck, Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export const QuickMenu = () => {
    const router = useRouter();

    const menuItems = [
        {
            title: 'Ambil Tiket',
            subtitle: 'Work Order',
            icon: Briefcase,
            color: 'bg-blue-50',
            iconColor: '#2563eb',
            route: '/(app)/work-order'
        },
        {
            title: 'Barang Masuk',
            subtitle: 'Input stok',
            icon: PackagePlus,
            color: 'bg-green-50',
            iconColor: '#16a34a',
            route: '/(app)/barang/masuk'
        },
        {
            title: 'Barang Keluar',
            subtitle: 'Ambil stok',
            icon: PackageMinus,
            color: 'bg-orange-50',
            iconColor: '#ea580c',
            route: '/(app)/barang/keluar'
        },
        {
            title: 'Izin & Cuti',
            subtitle: 'Sakit, Cuti',
            icon: Calendar,
            color: 'bg-teal-50',
            iconColor: '#0d9488',
            route: '/(app)/izin'
        },
        {
            title: 'Absensi',
            subtitle: 'Check In/Out',
            icon: ClipboardCheck,
            color: 'bg-pink-50',
            iconColor: '#db2777',
            route: '/(app)/absensi'
        },
        {
            title: 'Lembur',
            subtitle: 'Ajukan Lembur',
            icon: Clock,
            color: 'bg-indigo-50',
            iconColor: '#4f46e5',
            route: '/(app)/lembur'
        },
    ];

    return (
        <View style={tw`px-4 pb-8`}>
            <Text style={tw`text-lg font-bold text-gray-900 mb-3 ml-1`}>Menu Cepat</Text>
            <View style={tw`flex-row flex-wrap justify-between`}>
                {menuItems.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        onPress={() => router.push(item.route as any)} // Cast to match generic Router type
                        style={tw`w-[48%] mb-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm`}
                    >
                        <View style={tw`h-10 w-10 rounded-lg ${item.color} items-center justify-center mb-3`}>
                            <item.icon size={20} color={item.iconColor} />
                        </View>
                        <Text style={tw`font-bold text-gray-900 text-sm`}>{item.title}</Text>
                        <Text style={tw`text-xs text-gray-500 mt-1`}>{item.subtitle}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};
