
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface AnnouncementFormProps {
    initialData?: {
        id?: string;
        title: string;
        content: string;
        target: 'ALL' | 'CUSTOMER' | 'EMPLOYEE' | 'ADMIN';
        isActive: boolean;
        isPinned: boolean;
        startDate: string | null;
        endDate: string | null;
    };
    isEdit?: boolean;
}

export default function AnnouncementForm({ initialData, isEdit = false }: AnnouncementFormProps) {
    const router = useRouter();

    // Helper to format date for datetime-local input (YYYY-MM-DDThh:mm) in local time
    const toLocalISOString = (dateString: string | null) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        // Get offset in milliseconds (getTimezoneOffset returns minutes, positive if behind UTC, negative if ahead)
        // We want to ADD the offset to get the local time representation in UTC numbers to use toISOString() trick
        // Actually, toISOString() always gives UTC. To get a string that looks like local time, we shift the time.
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    };

    const [formData, setFormData] = useState({
        title: initialData?.title || '',
        content: initialData?.content || '',
        target: initialData?.target || 'ALL',
        isActive: initialData?.isActive ?? true,
        isPinned: initialData?.isPinned ?? false,
        startDate: toLocalISOString(initialData?.startDate || null),
        endDate: toLocalISOString(initialData?.endDate || null),
    });
    const [saving, setSaving] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const url = isEdit ? `/api/announcements/${initialData?.id}` : '/api/announcements';
            const method = isEdit ? 'PUT' : 'POST';

            // Convert datetime-local values to ISO strings
            // datetime-local gives us local time string like "2025-12-17T13:00"
            // new Date() will interpret this as local time when no timezone is specified
            const payload = {
                ...formData,
                startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
                endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error('Failed to save');

            router.push('/admin/announcement');
            router.refresh();
        } catch (error) {
            console.error(error);
            alert('Failed to save announcement');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 max-w-2xl mx-auto">
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Title</label>
                    <input
                        type="text"
                        name="title"
                        required
                        value={formData.title}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Content</label>
                    <textarea
                        name="content"
                        required
                        rows={4}
                        value={formData.content}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700">Target Audience</label>
                    <select
                        name="target"
                        value={formData.target}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    >
                        <option value="ALL">All Users</option>
                        <option value="CUSTOMER">Customers Only</option>
                        <option value="EMPLOYEE">Employees Only</option>
                        <option value="ADMIN">Admins Only</option>
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Start Date</label>
                        <input
                            type="datetime-local"
                            name="startDate"
                            value={formData.startDate}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">End Date</label>
                        <input
                            type="datetime-local"
                            name="endDate"
                            value={formData.endDate}
                            onChange={handleChange}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                        />
                    </div>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            name="isActive"
                            id="isActive"
                            checked={formData.isActive}
                            onChange={handleChange}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">Active</label>
                    </div>

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            name="isPinned"
                            id="isPinned"
                            checked={formData.isPinned}
                            onChange={handleChange}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor="isPinned" className="ml-2 block text-sm text-gray-900">Pinned</label>
                    </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                    <Link href="/admin/announcement" className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Announcement'}
                    </button>
                </div>
            </div>
        </form>
    );
}
