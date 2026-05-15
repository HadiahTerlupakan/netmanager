import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        <h1 className="text-6xl font-bold text-red-500 mb-4">403</h1>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
          Akses Ditolak
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Maaf, Anda tidak memiliki izin untuk mengakses halaman ini. Silakan
          hubungi administrator jika Anda merasa ini adalah kesalahan.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
        >
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
