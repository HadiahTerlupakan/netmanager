'use client';

import React, { useEffect } from 'react';

/**
 * Component to display security warning in browser console
 * Similar to Facebook's "Stop!" warning to prevent Self-XSS attacks
 */
export default function ConsoleWarning(): React.ReactElement | null {
    useEffect(() => {
        // Only run in browser
        if (typeof window === 'undefined') return;

        // CSS styles for console warning
        const stopStyle = [
            'color: red',
            'font-size: 50px',
            'font-weight: bold',
            'text-shadow: 1px 1px 2px black',
        ].join(';');

        const warningStyle = [
            'color: #333',
            'font-size: 16px',
            'line-height: 1.6',
        ].join(';');

        const linkStyle = [
            'color: blue',
            'font-size: 14px',
        ].join(';');

        // Display warning messages using console.warn (not removed by Terser)
        console.warn('%cStop!', stopStyle);
        console.warn(
            '%cIni adalah fitur browser yang ditujukan untuk developer.\n\n' +
            'Jika seseorang menyuruh Anda untuk menyalin dan menempel sesuatu di sini ' +
            'untuk mengaktifkan "fitur khusus" atau "meretas" akun seseorang, ' +
            'itu adalah penipuan dan akan memberi mereka akses ke akun Anda.\n\n' +
            'Jangan ketik atau tempel kode apapun yang tidak Anda mengerti.',
            warningStyle
        );
        console.warn(
            '%cPelajari lebih lanjut tentang Self-XSS: https://en.wikipedia.org/wiki/Self-XSS',
            linkStyle
        );
    }, []);

    return null;
}
