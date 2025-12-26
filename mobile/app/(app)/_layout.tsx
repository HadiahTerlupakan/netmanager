import { Tabs } from 'expo-router';
import { Home, ClipboardList, Package, QrCode, User, ScanLine } from 'lucide-react-native';
import tw from 'twrnc';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AppLayout() {
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    ...tw`bg-white border-t border-gray-200`,
                    height: 60 + insets.bottom,
                    paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
                    paddingTop: 10,
                },
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
            <Tabs.Screen
                name="lembur"
                options={{
                    href: null,
                    tabBarStyle: { display: 'none' },
                }}
            />
            <Tabs.Screen
                name="izin"
                options={{
                    href: null,
                    tabBarStyle: { display: 'none' },
                }}
            />
            <Tabs.Screen
                name="notifications"
                options={{
                    href: null,
                    tabBarStyle: { display: 'none' },
                }}
            />

            <Tabs.Screen
                name="complete-work-order/[id]"
                options={{
                    href: null,
                    tabBarStyle: { display: 'none' },
                }}
            />

        </Tabs>
    );
}
