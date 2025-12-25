import { Stack } from 'expo-router';

export default function BarangLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="masuk" />
            <Stack.Screen name="keluar" />
            <Stack.Screen name="riwayat" />
        </Stack>
    );
}
