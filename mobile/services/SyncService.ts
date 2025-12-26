import NetInfo from '@react-native-community/netinfo';
import { DatabaseService } from './DatabaseService';
import axios from 'axios';
import { Config } from '../constants/Config';
import * as FileSystem from 'expo-file-system';

export const SyncService = {
    // Check if device is online
    isOnline: async () => {
        const state = await NetInfo.fetch();
        return state.isConnected && state.isInternetReachable;
    },

    // --- Sync UP (Upload Pending Actions) ---
    syncUp: async (token: string) => {
        const online = await SyncService.isOnline();
        if (!online) return;

        const queue = await DatabaseService.getPendingQueue();
        if (queue.length === 0) return;

        console.log(`Syncing ${queue.length} items...`);

        for (const item of queue) {
            try {
                let body = JSON.parse(item.body);
                const meta = item.meta ? JSON.parse(item.meta) : {};

                // 1. Handle Photo Uploads first if they exist in meta
                if (meta.photos && Array.isArray(meta.photos)) {
                    const uploadedUrls: string[] = [];
                    for (const photoUri of meta.photos) {
                        if (photoUri.startsWith('file://')) {
                            // Upload the file
                            const uploadRes = await SyncService.uploadFile(photoUri, token, meta.photoType || 'general');
                            if (uploadRes) uploadedUrls.push(uploadRes);
                        } else {
                            uploadedUrls.push(photoUri); // Already a URL
                        }
                    }

                    // Replace the local URIs in the body with the uploaded URLs
                    // Assumption: The body has a field (e.g., 'fotoBukti') that expects these URLs
                    // We need to know which field to update. For simplicity, let's assume 'fotoBukti' for now or check meta.
                    if (meta.targetField) {
                        body[meta.targetField] = uploadedUrls;
                    }
                }

                // 2. Execute the Main Request
                await axios({
                    method: item.method,
                    url: item.url,
                    data: body,
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                // 3. Remove from Queue on Success
                await DatabaseService.removeFromQueue(item.id);
                console.log(`Sync item ${item.id} success`);

            } catch (error) {
                console.error(`Sync item ${item.id} failed:`, error);

                // Optional: implementation specific retry logic
                // For now, leave it as PENDING (or mark RETRY count)
                // If it's a 4xx error (validation), maybe mark as FAILED?
                // await DatabaseService.markAsRetry(item.id); 
            }
        }
    },

    uploadFile: async (uri: string, token: string, type: string): Promise<string | null> => {
        try {
            const formData = new FormData();
            const filename = uri.split('/').pop() || 'photo.jpg';

            formData.append('file', {
                uri,
                type: 'image/jpeg',
                name: filename,
            } as any);
            formData.append('type', type);

            const res = await axios.post(`${Config.API_URL}/api/mobile/upload`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                }
            });
            return res.data?.url || null;
        } catch (error) {
            console.error('File upload failed:', error);
            return null;
        }
    },

    // --- Sync DOWN (Download Data) ---
    syncDown: async (token: string) => {
        const online = await SyncService.isOnline();
        if (!online) return;

        try {
            // 1. Fetch Work Orders
            console.log('Syncing Down: Work Orders...');
            const woRes = await axios.get(`${Config.API_URL}/api/mobile/work-orders`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await DatabaseService.saveOfflineData('work_orders', woRes.data.data || []);

            // 2. Fetch Inventory (Gudang & Barangs)
            // Ideally backend should provide a "master sync" endpoint. 
            // For now, maybe we fetch a default list or simplified list.
            // Or we just cache what we can. 
            // TODO: Implement specific inventory fetch if needed.

            console.log('Sync Down Complete');
        } catch (error) {
            console.error('Sync Down Error:', error);
        }
    },

    // --- Auto Sync Listener ---
    startAutoSync: (token: string | null) => {
        if (!token) return;

        // Listen for network changes
        const unsubscribe = NetInfo.addEventListener(state => {
            if (state.isConnected && state.isInternetReachable) {
                console.log('Online detected, triggering Sync Up...');
                SyncService.syncUp(token);
            }
        });

        return unsubscribe;
    }
};
