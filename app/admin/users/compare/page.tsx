import { Suspense } from 'react';
import UsersCompareClient from './UsersCompareClient';
import PageLoader from '@/components/ui/PageLoader';

export const metadata = {
    title: 'Bandingkan Kinerja Karyawan | Admin',
};

export default function UsersComparePage() {
    return (
        <Suspense fallback={<PageLoader />}>
            <UsersCompareClient />
        </Suspense>
    );
}
