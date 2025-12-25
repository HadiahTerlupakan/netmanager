import { View, Text } from 'react-native';
import tw from 'twrnc';
import { Clock, MapPin, AlertCircle, CheckCircle, XCircle } from 'lucide-react-native';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface WorkOrderListItemProps {
    item: any;
    userId?: string;
}

export default function WorkOrderListItem({ item, userId }: WorkOrderListItemProps) {
    // Check if I am a partner with PENDING status
    const myAssignment = item.assignments?.find((a: any) => a.userId === userId);
    const isPendingPartner = myAssignment?.role === 'PARTNER' && myAssignment?.status === 'PENDING';

    const getStatusColor = (status: string) => {
        if (isPendingPartner) return 'bg-yellow-100 text-yellow-800'; // Override for pending partner

        switch (status) {
            case 'ASSIGNED': return 'bg-blue-100 text-blue-800';
            case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
            case 'COMPLETED': return 'bg-green-100 text-green-800';
            case 'PENDING': return 'bg-gray-100 text-gray-800';
            case 'CANCELLED': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusText = (status: string) => {
        if (isPendingPartner) return 'Undangan';
        return status;
    }

    const getPriorityColor = (priority: string) => {
        if (priority === 'URGENT' || priority === 'CRITICAL') return 'text-red-600';
        if (priority === 'HIGH') return 'text-orange-500';
        return 'text-gray-500';
    };

    return (
        <View style={tw`bg-white p-4 rounded-xl shadow-sm mb-3 border ${isPendingPartner ? 'border-yellow-200 bg-yellow-50' : 'border-gray-100'}`}>
            {/* Header: Number & Status */}
            <View style={tw`flex-row justify-between items-center mb-2`}>
                <Text style={tw`font-bold text-gray-800`}>{item.workOrderNumber}</Text>
                <View style={tw`px-2 py-0.5 rounded-full ${getStatusColor(item.status).split(' ')[0]}`}>
                    <Text style={tw`text-xs font-bold ${getStatusColor(item.status).split(' ')[1]}`}>
                        {getStatusText(item.status)}
                    </Text>
                </View>
            </View>

            {/* Title & Priority */}
            <Text style={tw`text-base font-semibold text-gray-900 mb-1`} numberOfLines={1}>
                {item.title}
            </Text>
            <View style={tw`flex-row items-center mb-3`}>
                <AlertCircle size={12} style={tw`${getPriorityColor(item.priority)} mr-1`} />
                <Text style={tw`text-xs ${getPriorityColor(item.priority)} font-medium`}>
                    {item.priority}
                </Text>
            </View>

            {/* Customer & Location */}
            <View style={tw`flex-row items-center mb-1`}>
                <MapPin size={14} color="#6b7280" style={tw`mr-1.5`} />
                <Text style={tw`text-sm text-gray-600 flex-1`} numberOfLines={1}>
                    {item.locationAddress || item.pelanggan?.alamat || item.contactName || item.pelanggan?.nama || item.site?.name || '-'}
                </Text>
            </View>

            {/* Date */}
            {item.scheduledDate && (
                <View style={tw`flex-row items-center mt-1`}>
                    <Clock size={14} color="#9ca3af" style={tw`mr-1.5`} />
                    <Text style={tw`text-xs text-gray-500`}>
                        {format(new Date(item.scheduledDate), 'd MMM yyyy, HH:mm', { locale: id })}
                    </Text>
                </View>
            )}

            {isPendingPartner && (
                <View style={tw`mt-3 pt-2 border-t border-yellow-200`}>
                    <Text style={tw`text-xs text-yellow-700 font-bold text-center`}>
                        Menunggu Konfirmasi Anda
                    </Text>
                </View>
            )}
        </View>
    );
}
