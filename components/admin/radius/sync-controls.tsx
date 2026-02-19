'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal';
import { HiOutlineRefresh, HiOutlineCheckCircle, HiOutlineExclamationCircle } from 'react-icons/hi';

export function SyncControls() {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error'>('success');

    const handleSync = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/radius/sync', {
                method: 'POST',
            });

            const data = await response.json();

            if (response.ok) {
                const stats = data.stats || { created: 0, updated: 0, deleted: 0 };
                setToastMessage(`Sync Complete! Created: ${stats.created}, Updated: ${stats.updated}, Del: ${stats.deleted}`);
                setToastType('success');
                setShowToast(true);
                setIsOpen(false);
                // Trigger page refresh to update stats
                setTimeout(() => window.location.reload(), 1500);
            } else {
                throw new Error(data.error || 'Sync failed');
            }
        } catch (error) {
            setToastMessage(error instanceof Error ? error.message : 'Terjadi kesalahan');
            setToastType('error');
            setShowToast(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button onClick={() => setIsOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
                <HiOutlineRefresh className="h-4 w-4" />
                Sync All Users
            </Button>

            {isOpen && (
                <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Sync All Users to RADIUS">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            This will synchronize all active customers from the database to RADIUS.
                            Inactive customers will be removed from RADIUS.
                        </p>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <HiOutlineCheckCircle className="h-5 w-5 text-green-600" />
                                <span>Active customers will be synced</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <HiOutlineExclamationCircle className="h-5 w-5 text-orange-600" />
                                <span>Inactive customers will be removed</span>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
                            <Button onClick={() => setIsOpen(false)}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50"
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleSync}
                                disabled={loading}
                                
                            >
                                {loading ? (
                                    <>
                                        <HiOutlineRefresh className="h-4 w-4 animate-spin" />
                                        Syncing...
                                    </>
                                ) : (
                                    <>
                                        <HiOutlineRefresh className="h-4 w-4" />
                                        Start Sync
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {showToast && (
                <div className="fixed bottom-4 right-4 z-50">
                    <div className={`px-6 py-3 rounded-lg shadow-lg ${toastType === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                        {toastMessage}
                    </div>
                </div>
            )}
        </>
    );
}
