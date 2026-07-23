import type {
  LandingFeature,
  LandingPricing,
  LandingFaq,
  LandingFooter,
} from "@/modules/website";

export interface DefaultFeature {
  icon: string;
  title: string;
  description: string;
}

export interface DefaultPricing {
  name: string;
  price: string;
  period: string;
  features: string[];
  isPopular: boolean;
  ctaText: string;
  ctaLink: string;
}

export interface DefaultFaqItem {
  question: string;
  answer: string;
}

export interface DefaultFooter {
  companyName: string;
  description: string;
  email: string;
  links: Record<string, Array<{ label: string; href: string }>>;
  logoUrl: string | null;
}

export const DEFAULT_HERO = {
  badge: "Platform ISP All-in-One",
  title: "Kelola ISP Anda",
  highlight: "lebih cerdas",
  subtitle:
    "Billing otomatis, manajemen jaringan MikroTik & OLT, portal pelanggan, dan manajemen karyawan — terintegrasi untuk ISP modern.",
  ctaPrimary: "Mulai gratis 14 hari",
  ctaSecondary: "Lihat fitur",
  ctaLink: "/admin/login",
  logoUrl: null as string | null,
};

export const DEFAULT_FEATURES: DefaultFeature[] = [
  {
    icon: "MdReceiptLong",
    title: "Billing & invoicing otomatis",
    description:
      "Generate tagihan bulanan, kirim notifikasi jatuh tempo, terima pembayaran multi-metode tanpa spreadsheet.",
  },
  {
    icon: "MdRouter",
    title: "Manajemen jaringan",
    description:
      "Integrasi MikroTik RouterOS dan OLT. Kelola PPPoE, bandwidth, dan konfigurasi perangkat dari satu dashboard.",
  },
  {
    icon: "MdPeople",
    title: "Portal pelanggan",
    description:
      "Pelanggan cek tagihan, bayar, buat tiket gangguan, dan pantau status layanan mandiri.",
  },
  {
    icon: "MdAccessTime",
    title: "Manajemen karyawan",
    description:
      "Absensi, shift, lembur, dan penggajian. Kelola tim teknisi lapangan dengan rapi.",
  },
  {
    icon: "MdMonitor",
    title: "Monitoring real-time",
    description:
      "Pantau status perangkat, trafik, dan uptime dengan alert otomatis saat ada gangguan.",
  },
  {
    icon: "MdBusiness",
    title: "Keamanan & privasi data",
    description:
      "Data bisnis Anda terenkripsi dan terisolasi per akun. Backup harian, akses berbasis peran, siap dipakai produksi.",
  },
];

export const DEFAULT_PRICING: DefaultPricing[] = [
  {
    name: "Starter",
    price: "Gratis",
    period: "Hingga 50 pelanggan",
    features: [
      "Billing otomatis",
      "Portal pelanggan",
      "1 admin user",
      "Support email",
    ],
    isPopular: false,
    ctaText: "Mulai gratis",
    ctaLink: "/admin/login",
  },
  {
    name: "Pro",
    price: "Rp 499K",
    period: "per bulan · hingga 500 pelanggan",
    features: [
      "Semua fitur Starter",
      "Integrasi MikroTik & OLT",
      "Manajemen karyawan",
      "Monitoring real-time",
      "5 admin user",
      "Support prioritas",
    ],
    isPopular: true,
    ctaText: "Coba 14 hari gratis",
    ctaLink: "/admin/login",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "Pelanggan tidak terbatas",
    features: [
      "Semua fitur Pro",
      "White-label & branding kustom",
      "Custom domain",
      "SLA 99.9% uptime",
      "Dedicated support",
      "On-premise option",
    ],
    isPopular: false,
    ctaText: "Hubungi sales",
    ctaLink: "mailto:sales@radpro.id",
  },
];

export const DEFAULT_FAQ: DefaultFaqItem[] = [
  {
    question: "Apakah RADPRO.ID cocok untuk ISP kecil?",
    answer:
      "Ya. Paket Starter gratis hingga 50 pelanggan, cocok untuk ISP yang baru mulai. Upgrade kapan saja seiring pertumbuhan.",
  },
  {
    question: "Bagaimana cara integrasi dengan MikroTik?",
    answer:
      "Masukkan IP, username, dan password RouterOS di dashboard. RADPRO.ID terhubung via API RouterOS dan sinkronisasi PPPoE otomatis.",
  },
  {
    question: "Apakah data pelanggan aman?",
    answer:
      "Data di server terenkripsi dengan backup harian. Setiap tenant punya isolasi data penuh — tidak tercampur antar ISP.",
  },
  {
    question: "Bisakah saya menggunakan domain sendiri?",
    answer:
      "Ya. Custom domain tersedia di paket Enterprise. Pelanggan mengakses portal dengan domain ISP Anda.",
  },
  {
    question: "Apakah ada kontrak jangka panjang?",
    answer:
      "Tidak. Semua paket berbasis bulanan dan bisa dibatalkan kapan saja tanpa penalti.",
  },
];

export const DEFAULT_FOOTER: DefaultFooter = {
  companyName: "RADPRO.ID",
  description:
    "Platform manajemen ISP all-in-one untuk bisnis internet modern di Indonesia.",
  email: "sales@radpro.id",
  links: {
    Produk: [
      { label: "Fitur", href: "#features" },
      { label: "Harga", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
    Perusahaan: [
      { label: "Kontak", href: "mailto:sales@radpro.id" },
      { label: "Kebijakan Privasi", href: "/kebijakan-privasi" },
    ],
    Akun: [
      { label: "Login Admin", href: "/admin/login" },
      { label: "Portal Pelanggan", href: "/login" },
    ],
  },
  logoUrl: null,
};

export const NAV_LINKS = [
  { href: "#features", label: "Fitur" },
  { href: "#pricing", label: "Harga" },
  { href: "#faq", label: "FAQ" },
] as const;

export const EASE = "duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

/** Official RADPRO mark from mobile app (assets/images/icon.png). */
export const RADPRO_MARK = "/brand/radpro-icon.png";

/** Shared surface tokens — paired light/dark, no orphan hex. */
export const cx = {
  page: "bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
  surface: "bg-white dark:bg-zinc-900",
  surfaceGlass: "bg-white/80 dark:bg-zinc-900/80",
  surfaceSheet: "bg-white/95 dark:bg-zinc-900/95",
  surfaceMuted: "bg-zinc-50 dark:bg-zinc-900/60",
  surfaceAlt: "bg-white dark:bg-zinc-950",
  ink: "text-zinc-900 dark:text-zinc-50",
  muted: "text-zinc-500 dark:text-zinc-400",
  faint: "text-zinc-400 dark:text-zinc-500",
  line: "border-zinc-200/80 dark:border-white/10",
  ring: "ring-zinc-200/80 dark:ring-white/10",
  accent: "text-[#0a46aa] dark:text-[#5b8def]",
  accentBg:
    "bg-[#0a46aa] hover:bg-[#083a8f] dark:bg-[#1a5bc4] dark:hover:bg-[#2a6bd4]",
  accentSoft:
    "bg-[#0a46aa]/[0.08] text-[#0a46aa] ring-[#0a46aa]/15 dark:bg-[#5b8def]/10 dark:text-[#5b8def] dark:ring-[#5b8def]/20",
  deep: "bg-zinc-950 text-white dark:bg-zinc-900 dark:ring-1 dark:ring-white/10",
} as const;

export type LandingFeatureLike = DefaultFeature | LandingFeature;
export type LandingPricingLike = DefaultPricing | LandingPricing;
export type LandingFaqLike = DefaultFaqItem | LandingFaq;
export type LandingFooterLike = DefaultFooter | LandingFooter;
