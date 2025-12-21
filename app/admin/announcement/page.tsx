
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Announcement {
    id: string;
    title: string;
    content: string;
    target: 'ALL' | 'CUSTOMER' | 'EMPLOYEE' | 'ADMIN';
    isActive: boolean;
    isPinned: boolean;
    startDate: string | null;
    endDate: string | null;
    createdAt: string;
}

export default function AnnouncementPage() {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/announcements');
            const data = await res.json();
            setAnnouncements(data);
        } catch (error) {
            console.error('Failed to fetch announcements', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this announcement?')) return;
        try {
            await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
            fetchAnnouncements();
        } catch (error) {
            console.error('Failed to delete', error);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Announcements</h1>
                <Link href="/admin/announcement/create" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    Create Announcement
                </Link>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan={5} className="px-6 py-4 text-center">Loading...</td></tr>
                        ) : announcements.length === 0 ? (
                            <tr><td colSpan={5} className="px-6 py-4 text-center">No announcements found</td></tr>
                        ) : (
                            announcements.map((announcement) => (
                                <tr key={announcement.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{announcement.title}</div>
                                        <div className="text-sm text-gray-500 truncate max-w-xs">{announcement.content}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${announcement.target === 'ALL' ? 'bg-purple-100 text-purple-800' :
                                                announcement.target === 'CUSTOMER' ? 'bg-green-100 text-green-800' :
                                                    announcement.target === 'ADMIN' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {announcement.target}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${announcement.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {announcement.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {announcement.startDate ? new Date(announcement.startDate).toLocaleDateString() : 'Now'}
                                        {announcement.endDate ? ` - ${new Date(announcement.endDate).toLocaleDateString()}` : ' - Forever'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <Link href={`/admin/announcement/${announcement.id}`} className="text-indigo-600 hover:text-indigo-900 mr-4">Edit</Link>
                                        <button onClick={() => handleDelete(announcement.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
