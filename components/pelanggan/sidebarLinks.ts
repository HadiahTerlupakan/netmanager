import { HiOutlineHome, HiOutlineDocumentText, HiOutlineUser, HiOutlineInformationCircle } from 'react-icons/hi2';

export const SIDEBAR_LINKS = [
    {
        href: '/pelanggan',
        label: 'Beranda',
        icon: HiOutlineHome,
    },
    {
        href: '/pelanggan/tagihan',
        label: 'Tagihan',
        icon: HiOutlineDocumentText,
    },
    {
        href: '/pelanggan/profil',
        label: 'Profil',
        icon: HiOutlineUser,
    },
    {
        href: '/pelanggan/bantuan',
        label: 'Bantuan',
        icon: HiOutlineInformationCircle,
    },
];
