import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import tw from 'twrnc';
import { FileText, ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface WorkOrderCardProps {
    assigned: number;
    pending: number;
    onPress: () => void;
}

export const WorkOrderCard = ({ assigned, pending, onPress }: WorkOrderCardProps) => {
    return (
        <View style={tw`mx-4 mb-4 rounded-xl overflow-hidden shadow-md`}>
            {/* Note: LinearGradient needs expo-linear-gradient package. 
                Using View with bg-blue-600 as fallback if package missing, 
                but user has expo, so we should install it or use simple view first for safety 
                if we didn't check package.json for it. 
                Wait, I checked package.json and didn't see expo-linear-gradient.
                So I will use a simple View with background color to avoid crashing.
            */}
            <View style={tw`bg-blue-600 p-5`}>
                <View style={tw`flex-row justify-between items-start mb-4`}>
                    <View>
                        <Text style={tw`text-blue-100 text-sm font-medium mb-1`}>Work Order Saya</Text>
                        <Text style={tw`text-4xl font-bold text-white`}>{assigned}</Text>
                    </View>
                    <View style={tw`p-2 bg-white/20 rounded-lg`}>
                        <FileText size={24} color="white" />
                    </View>
                </View>

                <View style={tw`flex-row items-center mb-4`}>
                    <View style={tw`h-2 w-2 rounded-full bg-green-400 mr-2`} />
                    <Text style={tw`text-sm font-medium text-blue-50`}>
                        {pending} tiket tersedia untuk diambil
                    </Text>
                </View>

                <TouchableOpacity
                    onPress={onPress}
                    style={tw`bg-white py-3 px-4 rounded-lg flex-row items-center justify-center`}
                >
                    <Text style={tw`text-blue-600 font-bold text-sm mr-2`}>Lihat Work Order</Text>
                    <ArrowRight size={16} color="#2563eb" />
                </TouchableOpacity>
            </View>
        </View>
    );
};
