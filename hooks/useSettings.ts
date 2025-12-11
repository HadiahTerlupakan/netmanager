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
    logoInvoice?: string | null;
    logoAplikasi?: string | null;
};

export function useSettings() {
    const [settings, setSettings] = useState<GeneralSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchSettings() {
            try {
                const [generalRes, logoRes] = await Promise.all([
                    fetch('/api/settings/general'),
                    fetch('/api/settings/logo')
                ]);

                if (generalRes.ok) {
                    const generalData = await generalRes.json();
                    let logoData = {};

                    if (logoRes.ok) {
                        logoData = await logoRes.json();
                    }

                    setSettings({ ...generalData, ...logoData });
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
