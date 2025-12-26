import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import { registerForPushNotificationsAsync, addNotificationListeners } from '@/services/PushNotificationService';
import axios from 'axios';
import { Config } from '@/constants/Config';

type User = {
    id: string;
    name: string;
    email: string;
    role: string;
};

type AuthContextType = {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    signIn: (token: string, userData: User) => Promise<void>;
    signOut: () => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadStorageData();
    }, []);

    // Setup notification listeners when user is logged in
    useEffect(() => {
        if (token) {
            const cleanup = addNotificationListeners(
                (notification) => {
                    console.log('[Push] Received:', notification.request.content.title);
                },
                (response) => {
                    console.log('[Push] Tapped:', response.notification.request.content.title);
                    // TODO: Navigate to notification target
                }
            );
            return cleanup;
        }
    }, [token]);

    async function loadStorageData() {
        try {
            const storedToken = await SecureStore.getItemAsync('session_token');
            const storedUser = await SecureStore.getItemAsync('user_data');

            if (storedToken && storedUser) {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
                
                // Re-register push token on app start
                registerForPushNotificationsAsync(storedToken).catch(console.error);
            }
        } catch (e) {
            console.error('Failed to load auth storage', e);
        } finally {
            setIsLoading(false);
        }
    }

    async function signIn(newToken: string, userData: User) {
        setIsLoading(true);
        console.log('[AuthContext] signIn started for:', userData.email);
        try {
            console.log('[AuthContext] Saving token...');
            await SecureStore.setItemAsync('session_token', newToken);
            console.log('[AuthContext] Saving user data...');
            await SecureStore.setItemAsync('user_data', JSON.stringify(userData));

            console.log('[AuthContext] Updating state...');
            setToken(newToken);
            setUser(userData);
            
            // Register for push notifications
            console.log('[AuthContext] Registering push notifications...');
            registerForPushNotificationsAsync(newToken).catch(console.error);
            
            console.log('[AuthContext] signIn complete');
        } catch (error) {
            console.error('[AuthContext] Sign in error', error);
            Alert.alert('Login Error', 'Gagal menyimpan sesi login');
        } finally {
            setIsLoading(false);
            console.log('[AuthContext] Loading state set to false');
        }
    }

    async function signOut() {
        try {
            // Remove push token from backend
            if (token) {
                try {
                    await axios.delete(`${Config.API_URL}/api/mobile/push-token`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                } catch (e) {
                    console.error('Failed to remove push token:', e);
                }
            }
            
            await SecureStore.deleteItemAsync('session_token');
            await SecureStore.deleteItemAsync('user_data');
            setToken(null);
            setUser(null);
        } catch (error) {
            console.error('Sign out error', error);
        }
    }

    // Alias for signOut
    const logout = signOut;

    return (
        <AuthContext.Provider value={{ user, token, isLoading, signIn, signOut, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
