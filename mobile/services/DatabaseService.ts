import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';

const DB_NAME = 'netmanager_offline.db';

export interface SyncQueueItem {
    id: number;
    url: string;
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body: string; // JSON string
    status: 'PENDING' | 'RETRY' | 'FAILED';
    createdAt: string;
    meta: string; // JSON string for extra info (e.g., photo paths to upload first)
}

export const DatabaseService = {
    getDB: async () => {
        return await SQLite.openDatabaseAsync(DB_NAME);
    },

    initDatabase: async () => {
        try {
            const db = await DatabaseService.getDB();

            // Create Settings / Metadata table (for last sync time, etc.)
            await db.execAsync(`
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
            `);

            // Create Sync Queue Table
            await db.execAsync(`
                CREATE TABLE IF NOT EXISTS sync_queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    url TEXT NOT NULL,
                    method TEXT NOT NULL,
                    body TEXT,
                    status TEXT DEFAULT 'PENDING',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    meta TEXT
                );
            `);

            // Create Offline Data Cache Table (Key-Value Store for large JSONs)
            // keys: 'work_orders', 'inventory', 'attendance_history', etc.
            await db.execAsync(`
                CREATE TABLE IF NOT EXISTS offline_cache (
                    key TEXT PRIMARY KEY,
                    data TEXT, -- JSON blob
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Database initialization failed:', error);
        }
    },

    // --- Sync Queue Operations ---

    addToQueue: async (url: string, method: string, body: any, meta: any = {}) => {
        const db = await DatabaseService.getDB();
        const jsonBody = JSON.stringify(body);
        const jsonMeta = JSON.stringify(meta);

        await db.runAsync(
            'INSERT INTO sync_queue (url, method, body, meta, status) VALUES (?, ?, ?, ?, ?)',
            url, method, jsonBody, jsonMeta, 'PENDING'
        );
        console.log('Added to sync queue:', url);
    },

    getPendingQueue: async (): Promise<SyncQueueItem[]> => {
        const db = await DatabaseService.getDB();
        const result = await db.getAllAsync<any>(
            "SELECT * FROM sync_queue WHERE status IN ('PENDING', 'RETRY') ORDER BY created_at ASC"
        );

        return result.map(row => ({
            id: row.id,
            url: row.url,
            method: row.method as any,
            body: row.body,
            status: row.status as any,
            createdAt: row.created_at,
            meta: row.meta
        }));
    },

    removeFromQueue: async (id: number) => {
        const db = await DatabaseService.getDB();
        await db.runAsync('DELETE FROM sync_queue WHERE id = ?', id);
    },

    markAsRetry: async (id: number) => {
        const db = await DatabaseService.getDB();
        await db.runAsync("UPDATE sync_queue SET status = 'RETRY' WHERE id = ?", id);
    },

    // --- Offline Cache Operations ---

    saveOfflineData: async (key: string, data: any) => {
        const db = await DatabaseService.getDB();
        const jsonData = JSON.stringify(data);
        await db.runAsync(
            `INSERT INTO offline_cache (key, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP`,
            key, jsonData
        );
    },

    getOfflineData: async (key: string) => {
        const db = await DatabaseService.getDB();
        const result = await db.getFirstAsync<{ data: string }>(
            'SELECT data FROM offline_cache WHERE key = ?',
            key
        );
        return result ? JSON.parse(result.data) : null;
    }
};
