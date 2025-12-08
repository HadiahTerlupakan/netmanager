import { useState, useEffect } from 'react';

type GeneralSettings = {
    perusahaan: string;
    namaAplikasi: string;
    alamat: string;
    nomorHp: string;
    deskripsiInvoice: string;
    rekeningBank: any[];
    invoiceOtomatis: string;
    disablePerpanjanganPaket: string;
    timezone: string;
};

export function useSettings() {
    const [settings, setSettings] = useState<GeneralSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchSettings() {
            try {
                const res = await fetch('/api/settings/general');
                if (res.ok) {
                    const data = await res.json();
                    setSettings(data);
                }
            } catch (error) {
                console.error('Failed to fetch settings:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchSettings();
    }, []);

    return { settings, loading };
}
