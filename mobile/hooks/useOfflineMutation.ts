import { useState } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { DatabaseService } from '../services/DatabaseService';
import { SyncService } from '../services/SyncService';
import axios from 'axios';
import { Config } from '../constants/Config';
import { useAuth } from '../context/AuthContext';

interface MutationOptions {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  onSuccess?: (data: any, isOffline: boolean) => void;
  onError?: (error: any) => void;
}

export const useOfflineMutation = () => {
  const { token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const mutate = async (variables: any, options: MutationOptions) => {
    setIsLoading(true);
    try {
      // 1. Get Location (Tikor) - Attempt to get GPS coordinates
      let location = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
           // Use low accuracy/timeout for speed, or balanced if precision needed. 
           // Balanced is good compromise.
           location = await Location.getCurrentPositionAsync({ 
             accuracy: Location.Accuracy.Balanced,
             timeInterval: 5000 
           });
        }
      } catch (e) {
        console.log('[useOfflineMutation] Failed to access location:', e);
      }

      const meta = {
        latitude: location?.coords.latitude || null,
        longitude: location?.coords.longitude || null,
        capturedAt: new Date().toISOString(),
        ...variables.meta // Allow overriding or adding extra meta
      };

      // 2. Check Connection
      const isOnline = await SyncService.isOnline();

      // Prepare payload - merge location if expected by backend?
      // User asked for "tikor". We send it in body if possible, AND keep in meta.
      const payload = {
          ...variables,
          latitude: meta.latitude,
          longitude: meta.longitude,
          _offline_meta: meta // Optional: backend might ignore this
      };

      if (isOnline) {
        // --- ONLINE MODE ---
        console.log('[useOfflineMutation] Online. Submitting directly:', options.url);
        
        const response = await axios({
            method: options.method,
            url: options.url.startsWith('http') ? options.url : `${Config.API_URL}${options.url}`,
            data: payload,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        options.onSuccess?.(response.data, false);

      } else {
        // --- OFFLINE MODE ---
        console.log('[useOfflineMutation] Offline. Adding to queue:', options.url);
        
        await DatabaseService.addToQueue(
            options.url,
            options.method,
            payload,
            meta
        );

        Alert.alert(
            'Disimpan Offline',
            'Tidak ada koneksi internet. Data (termasuk Lokasi) disimpan di HP dan akan diupload otomatis saat online.'
        );

        // Simulate success response structure
        options.onSuccess?.({ success: true, offline: true, message: 'Saved to queue' }, true);
      }

    } catch (error: any) {
      console.error('[useOfflineMutation] Mutation failed:', error);
      
      // If error is network related (e.g. timeout), maybe fallback to offline queue?
      // Axios network error code is usually "ERR_NETWORK"
      if (error.code === 'ERR_NETWORK' || !error.response) {
         console.log('[useOfflineMutation] Network error detected during online attempt. Fallback to queue.');
          // TODO: Refactor the offline logic to be reusable here
          // For now, simple error alert. 
          // Ideally we should prompt user: "Network failed. Save offline?"
      }
      
      options.onError?.(error);
      Alert.alert('Error', error.response?.data?.error || 'Gagal menyimpan data.');
    } finally {
      setIsLoading(false);
    }
  };

  return { mutate, isLoading };
};
