import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Alert } from 'react-native';
import tw from 'twrnc';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { Config } from '../../constants/Config';
import { StatusBar } from 'expo-status-bar';
import { Mail, Lock, CheckCircle2 } from 'lucide-react-native';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn } = useAuth();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Email dan Password harus diisi');
            return;
        }

        setLoading(true);
        try {
            console.log('Attempting login to:', `${Config.API_URL}/api/mobile/auth/login`);
            const res = await axios.post(`${Config.API_URL}/api/mobile/auth/login`, {
                email,
                password
            });

            if (res.data.success) {
                console.log('[LoginScreen] Login success, calling signIn...');
                await signIn(res.data.token, res.data.user);
                console.log('[LoginScreen] signIn returned');
            } else {
                console.log('[LoginScreen] Login failed logic:', res.data);
                Alert.alert('Login Gagal', res.data.error || 'Terjadi kesalahan');
            }
        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.error || 'Gagal terhubung ke server. Cek koneksi internet/IP Server.';
            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={tw`flex-1 bg-white items-center justify-center p-6`}>
            <StatusBar style="dark" />

            {/* Logo Placeholder */}
            <View style={tw`mb-10 items-center`}>
                <View style={tw`h-24 w-24 bg-blue-600 rounded-2xl items-center justify-center mb-4 shadow-lg`}>
                    <Text style={tw`text-white text-4xl font-bold`}>NM</Text>
                </View>
                <Text style={tw`text-2xl font-bold text-gray-900`}>NetManager</Text>
                <Text style={tw`text-gray-500 mt-1`}>Employee Portal App</Text>
            </View>

            <View style={tw`w-full max-w-sm`}>
                <View style={tw`mb-4`}>
                    <Text style={tw`mb-2 font-medium text-gray-700`}>Email Address</Text>
                    <View style={tw`flex-row items-center border border-gray-300 rounded-xl px-4 h-12 bg-gray-50 focus:border-blue-500`}>
                        <Mail color="#9ca3af" size={20} />
                        <TextInput
                            style={tw`flex-1 ml-3 text-gray-900`}
                            placeholder="nama@perusahaan.com"
                            autoCapitalize="none"
                            keyboardType="email-address"
                            value={email}
                            onChangeText={setEmail}
                        />
                    </View>
                </View>

                <View style={tw`mb-8`}>
                    <Text style={tw`mb-2 font-medium text-gray-700`}>Password</Text>
                    <View style={tw`flex-row items-center border border-gray-300 rounded-xl px-4 h-12 bg-gray-50 focus:border-blue-500`}>
                        <Lock color="#9ca3af" size={20} />
                        <TextInput
                            style={tw`flex-1 ml-3 text-gray-900`}
                            placeholder="••••••••"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    onPress={handleLogin}
                    disabled={loading}
                    style={tw`bg-blue-600 h-14 rounded-xl items-center justify-center shadow-md ${loading ? 'opacity-70' : ''}`}
                >
                    <Text style={tw`text-white font-bold text-lg`}>
                        {loading ? 'Memproses...' : 'Sign In'}
                    </Text>
                </TouchableOpacity>

                <View style={tw`mt-8 flex-row justify-center`}>
                    <Text style={tw`text-gray-400 text-xs`}>
                        Powered by Antigravity & Expo
                    </Text>
                </View>
            </View>
        </View>
    );
}
