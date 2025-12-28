import { useState, useEffect, useCallback } from 'react';
import { DatabaseService } from '../services/DatabaseService';
import { SyncService } from '../services/SyncService';

interface QueryOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  onSuccess?: (data: T) => void;
  onError?: (error: any) => void;
  enabled?: boolean;
}

export const useOfflineQuery = <T>(options: QueryOptions<T>) => {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [isOfflineData, setIsOfflineData] = useState(false);

  const fetchData = useCallback(async () => {
    if (options.enabled === false) return;

    setIsLoading(true);
    setError(null);
    setIsOfflineData(false);

    try {
      const isOnline = await SyncService.isOnline();

      if (isOnline) {
        // --- ONLINE ---
        try {
          const result = await options.fetcher();
          setData(result);
          
          // Save to Cache
          await DatabaseService.saveOfflineData(options.key, result);
          options.onSuccess?.(result);
        } catch (err) {
            console.warn(`[useOfflineQuery] Online fetch failed for ${options.key}, falling back to cache.`);
            // Fallback to cache if online fetch fails
            const cached = await DatabaseService.getOfflineData(options.key);
            if (cached) {
                setData(cached as T);
                setIsOfflineData(true);
            } else {
                throw err;
            }
        }
      } else {
        // --- OFFLINE ---
        console.log(`[useOfflineQuery] Offline. Loading from cache: ${options.key}`);
        const cached = await DatabaseService.getOfflineData(options.key);
        if (cached) {
          setData(cached as T);
          setIsOfflineData(true);
          options.onSuccess?.(cached as T);
        } else {
           // No cache available
           setError(new Error('No internet and no cached data available.'));
        }
      }
    } catch (err) {
      console.error(`[useOfflineQuery] Error in ${options.key}:`, err);
      setError(err);
      options.onError?.(err);
    } finally {
      setIsLoading(false);
    }
  }, [options.key, options.enabled]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, isOfflineData, refetch: fetchData };
};
