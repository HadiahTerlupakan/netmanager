import NetInfo from '@react-native-community/netinfo';
import { DatabaseService } from './DatabaseService';
import axios from 'axios';
import { API_URL } from '../constants/Config'; // Adjust if using Config object
import { Config } from '../constants/Config'; // Imports might be messy, let's stick to Config.API_URL
import * as SecureStore from 'expo-secure-store';

// Helper for upload (outside component)
const uploadFile = async (uri: string, token: string, type: string, watermarkLines?: string[]): Promise<string | null> => {
    try {
        const formData = new FormData();
        const filename = uri.split('/').pop() || 'photo.jpg';

        // @ts-ignore
        formData.append('file', {
            uri,
            type: 'image/jpeg',
            name: filename,
        });
        formData.append('type', type);
        if (watermarkLines) {
            formData.append('watermarkLines', JSON.stringify(watermarkLines));
        }

        const res = await axios.post(`${Config.API_URL}/api/mobile/upload`, formData, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'multipart/form-data',
            }
        });
        return res.data?.url || null;
    } catch (error) {
        console.error('[SyncService] File upload failed:', error);
        return null;
    }
};

export const SyncService = {
  isMonitoring: false,

  isOnline: async () => {
      const state = await NetInfo.fetch();
      return state.isConnected && state.isInternetReachable;
  },

  startMonitoring: () => {
    if (SyncService.isMonitoring) return;

    SyncService.isMonitoring = true;
    console.log('[SyncService] Starting network monitoring...');

    // Subscribe to network state updates
    NetInfo.addEventListener(state => {
      console.log('[SyncService] Network state changed:', state.isConnected);
      if (state.isConnected && state.isInternetReachable) {
        SyncService.processQueue();
      }
    });
  },

  processQueue: async () => {
    console.log('[SyncService] Checking sync queue...');
    const queue = await DatabaseService.getPendingQueue();

    if (queue.length === 0) {
      console.log('[SyncService] Queue is empty.');
      return;
    }

    console.log(`[SyncService] Found ${queue.length} items to sync.`);

    // Helper to get token (can't use hook here outside component)
    const token = await SecureStore.getItemAsync('session_token'); // Make sure key matches AuthContext ('session_token')

    for (const item of queue) {
      try {
        console.log(`[SyncService] Processing item ${item.id}: ${item.method} ${item.url}`);
        
        // Parse bodies
        let body = item.body ? JSON.parse(item.body) : {};
        const meta = item.meta ? JSON.parse(item.meta) : {};

        // 1. Handle Photo Uploads first if they exist in meta
        if (meta.photos && Array.isArray(meta.photos) && meta.photos.length > 0) {
            console.log(`[SyncService] Uploading ${meta.photos.length} photos...`);
            const uploadedUrls: string[] = [];
            
            for (const photoUri of meta.photos) {
                if (photoUri.startsWith('file://')) {
                    const url = await uploadFile(
                        photoUri, 
                        token || '', 
                        meta.photoType || 'general',
                        meta.watermarkLines // Pass watermark lines from meta
                    );
                    if (url) uploadedUrls.push(url);
                } else {
                    uploadedUrls.push(photoUri); // Already remote?
                }
            }

            // Update body with uploaded/remote URLs
            if (meta.targetField) {
                 if (meta.singleFile) {
                     body[meta.targetField] = uploadedUrls[0] || null;
                 } else {
                     body[meta.targetField] = uploadedUrls;
                 }
            }
        }

        let headers: any = {
          'Content-Type': 'application/json',
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await axios({
          method: item.method,
          url: item.url.startsWith('http') ? item.url : `${Config.API_URL}${item.url}`,
          data: body,
          headers: headers
        });

        if (response.status >= 200 && response.status < 300) {
          console.log(`[SyncService] Item ${item.id} synced successfully.`);
          await DatabaseService.removeFromQueue(item.id);
        } else {
            console.warn(`[SyncService] Item ${item.id} failed with status ${response.status}`);
            await DatabaseService.markAsRetry(item.id);
        }

      } catch (error: any) {
        console.error(`[SyncService] Failed to sync item ${item.id}:`, error.message);
        await DatabaseService.markAsRetry(item.id);
      }
    }
    
    console.log('[SyncService] Queue processing complete.');
  }
};
