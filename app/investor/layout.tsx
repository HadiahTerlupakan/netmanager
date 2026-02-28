import React from 'react';

export default function InvestorLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-neutral-900 w-full flex justify-center">
            {/* Mobile container constraint */}
            <div className="w-full h-full min-h-screen max-w-md bg-white dark:bg-black overflow-hidden shadow-2xl relative flex flex-col mx-auto">
                {children}
            </div>
        </div>
    );
}
