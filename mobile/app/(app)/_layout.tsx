import { Tabs } from 'expo-router';
import { Home, ClipboardList, Package, QrCode, User, ScanLine } from 'lucide-react-native';
import tw from 'twrnc';

export default function AppLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: tw`bg-white border-t border-gray-200 h-16 pb-1 pt-1`,
                tabBarActiveTintColor: '#2563eb', // blue-600
                tabBarInactiveTintColor: '#9ca3af', // gray-400
                tabBarLabelStyle: tw`text-xs font-medium mb-1`,
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'Beranda',
                    tabBarIcon: ({ color }) => <Home size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="work-order"
                options={{
                    title: 'Work Order',
                    tabBarIcon: ({ color }) => <ClipboardList size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="barang"
                options={{
                    title: 'Barang',
                    tabBarIcon: ({ color }) => <Package size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="absensi"
                options={{
                    title: 'Absensi',
                    tabBarIcon: ({ color }) => <ScanLine size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profil',
                    tabBarIcon: ({ color }) => <User size={24} color={color} />,
                }}
            />

            {/* Hidden Screens */}
            <Tabs.Screen
                name="history"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="work-order-detail/[id]"
                options={{
                    href: null,
                    tabBarStyle: { display: 'none' },
                }}
            />
            <Tabs.Screen
                name="ambil-barang/[id]"
                options={{
                    href: null,
                    tabBarStyle: { display: 'none' },
                }}
            />

        </Tabs>
    );
}
