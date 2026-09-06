import { HiArrowPath, HiEye, HiEyeSlash, HiMapPin } from "react-icons/hi2";

export type PppClientInfoTabFormData = {
  idPelanggan: string;
  nama: string;
  alamat: string;
  noTelp: string;
  email: string;
  noDokumen: string;
  provinsi: string;
  kabupatenKota: string;
  kecamatan: string;
  kelurahanDesa: string;
  odpId: string;
  resellerId: string;
  resellerOutletId: string;
  latitude: number | null;
  longitude: number | null;
  username: string;
  password: string;
  passwordLogin: string;
  catatan: string;
};

/**
 * ODP berasal dari node peta (`mapping_nodes` type = "odp"), yang hanya punya
 * id dan nama. Field `location` dan `status` sebelumnya ada di tipe ini tetapi
 * tidak pernah dikirim endpoint mana pun, sehingga label opsi merender
 * "(undefined)" begitu daftarnya terisi.
 */
type OdpOption = {
  id: string;
  name: string;
};

type ResellerOption = {
  id: string;
  name: string;
  code: string;
};

type ResellerOutletOption = {
  id: string;
  resellerId: string;
  name: string;
  code: string;
};

type PppClientInfoTabSectionProps = {
  formData: PppClientInfoTabFormData;
  handleChange: (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => void;
  updateFormData: (
    updater: (
      prev: PppClientInfoTabFormData,
    ) => Partial<PppClientInfoTabFormData>,
  ) => void;
  idPelangganError: string | null;
  checkingId: boolean;
  odps: OdpOption[];
  resellers: ResellerOption[];
  resellerOutlets: ResellerOutletOption[];
  showPasswordLogin: boolean;
  /**
   * Mode edit memperlakukan kedua field password sebagai opsional.
   *
   * Server tidak pernah mengirim balik password: `password` selalu di-strip
   * dari response, dan `passwordLogin` tidak punya kolom di database. Jadi
   * di halaman edit kedua field ini selalu tampil kosong. Selama keduanya
   * ditandai wajib, form itu pasti ditolak — dan admin yang mengisinya asal
   * agar bisa menyimpan justru menimpa password PPPoE asli.
   */
  isEditMode?: boolean;
  onToggleShowPasswordLogin: () => void;
  onOpenMapPicker: () => void;
  roundedClassName: string;
};

export function PppClientInfoTabSection({
  formData,
  handleChange,
  isEditMode = false,
  updateFormData,
  idPelangganError,
  checkingId,
  odps,
  resellers,
  resellerOutlets,
  showPasswordLogin,
  onToggleShowPasswordLogin,
  onOpenMapPicker,
  roundedClassName,
}: PppClientInfoTabSectionProps) {
  const outletOptions = resellerOutlets.filter(
    (outlet) => outlet.resellerId === formData.resellerId,
  );

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
          Data Dasar
        </h3>

        <div className="space-y-2">
          <label
            htmlFor="idPelanggan"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            ID Pelanggan <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              id="idPelanggan"
              name="idPelanggan"
              type="text"
              required
              value={formData.idPelanggan}
              onChange={handleChange}
              maxLength={8}
              pattern="[0-9]{8}"
              className={`w-full ${roundedClassName} border ${idPelangganError ? "border-red-300 dark:border-red-600" : "border-gray-300 dark:border-gray-600"} bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 ${idPelangganError ? "focus:ring-red-500" : "focus:ring-indigo-500"} focus:border-transparent transition-colors`}
              placeholder="8 digit angka (otomatis atau manual)"
            />
            {checkingId && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <HiArrowPath className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            )}
          </div>
          {idPelangganError ? (
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">
              {idPelangganError}
            </p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              ID pelanggan otomatis di-generate (8 digit), bisa diubah manual.
              Pastikan ID unik dan tidak duplikat.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="nama"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Nama Pelanggan <span className="text-red-500">*</span>
          </label>
          <input
            id="nama"
            name="nama"
            type="text"
            required
            value={formData.nama}
            onChange={handleChange}
            className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
            placeholder="Nama lengkap pelanggan"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
          Informasi Kontak
        </h3>

        <div className="space-y-2">
          <label
            htmlFor="alamat"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Alamat
          </label>
          <textarea
            id="alamat"
            name="alamat"
            rows={3}
            value={formData.alamat}
            onChange={handleChange}
            className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
            placeholder="Alamat lengkap pelanggan"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label
              htmlFor="noTelp"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              No. Telepon
            </label>
            <input
              id="noTelp"
              name="noTelp"
              type="text"
              value={formData.noTelp}
              onChange={handleChange}
              className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
              placeholder="081234567890"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
              placeholder="email@example.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="noDokumen"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            No. Dokumen (NIK/Nomor SIM/Nomor Paspor)
          </label>
          <input
            id="noDokumen"
            name="noDokumen"
            type="text"
            value={formData.noDokumen}
            onChange={handleChange}
            className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
            placeholder="Masukkan nomor dokumen"
          />
        </div>

        <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Informasi Wilayah
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label
                htmlFor="provinsi"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Provinsi
              </label>
              <input
                id="provinsi"
                name="provinsi"
                type="text"
                value={formData.provinsi}
                onChange={handleChange}
                className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
                placeholder="Masukkan provinsi"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="kabupatenKota"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Kabupaten/Kota
              </label>
              <input
                id="kabupatenKota"
                name="kabupatenKota"
                type="text"
                value={formData.kabupatenKota}
                onChange={handleChange}
                className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
                placeholder="Masukkan kabupaten/kota"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label
                htmlFor="kecamatan"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Kecamatan
              </label>
              <input
                id="kecamatan"
                name="kecamatan"
                type="text"
                value={formData.kecamatan}
                onChange={handleChange}
                className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
                placeholder="Masukkan kecamatan"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="kelurahanDesa"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Kelurahan/Desa
              </label>
              <input
                id="kelurahanDesa"
                name="kelurahanDesa"
                type="text"
                value={formData.kelurahanDesa}
                onChange={handleChange}
                className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
                placeholder="Masukkan kelurahan/desa"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            ODP (Optical Distribution Point)
          </h4>
          <div className="space-y-2">
            <label
              htmlFor="odpId"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Pilih ODP
            </label>
            <select
              id="odpId"
              name="odpId"
              value={formData.odpId}
              onChange={handleChange}
              className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
            >
              <option value="">-- Pilih ODP --</option>
              {odps.map((odp) => (
                <option key={odp.id} value={odp.id}>
                  {odp.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Pilih ODP yang digunakan oleh pelanggan (opsional)
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
            Assignment Reseller
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label
                htmlFor="resellerId"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Pilih Reseller
              </label>
              <select
                id="resellerId"
                name="resellerId"
                value={formData.resellerId}
                onChange={handleChange}
                className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
              >
                <option value="">-- Tanpa Reseller --</option>
                {resellers.map((reseller) => (
                  <option key={reseller.id} value={reseller.id}>
                    {reseller.code} - {reseller.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="resellerOutletId"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Outlet Reseller
              </label>
              <select
                id="resellerOutletId"
                name="resellerOutletId"
                value={formData.resellerOutletId}
                onChange={handleChange}
                disabled={!formData.resellerId}
                className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <option value="">-- Tanpa Outlet --</option>
                {outletOptions.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.code} - {outlet.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Opsional. Dipakai untuk mengaitkan pelanggan dengan reseller dan
            outlet penanggung jawab.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Titik Koordinat (Tikor)
            </span>
            <button
              type="button"
              onClick={onOpenMapPicker}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
            >
              <HiMapPin className="w-3.5 h-3.5" />
              Pilih dari Peta
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label
                htmlFor="latitude"
                className="block text-xs font-medium text-gray-600 dark:text-gray-400"
              >
                Latitude
              </label>
              <input
                id="latitude"
                name="latitude"
                type="number"
                step="any"
                value={formData.latitude || ""}
                onChange={(e) =>
                  updateFormData(() => ({
                    latitude: e.target.value
                      ? parseFloat(e.target.value)
                      : null,
                  }))
                }
                className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
                placeholder="-6.200000"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="longitude"
                className="block text-xs font-medium text-gray-600 dark:text-gray-400"
              >
                Longitude
              </label>
              <input
                id="longitude"
                name="longitude"
                type="number"
                step="any"
                value={formData.longitude || ""}
                onChange={(e) =>
                  updateFormData(() => ({
                    longitude: e.target.value
                      ? parseFloat(e.target.value)
                      : null,
                  }))
                }
                className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
                placeholder="106.816666"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
          Kredensial PPPoE
        </h3>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Username PPPoE <span className="text-red-500">*</span>
            </label>
            {formData.username !== formData.idPelanggan && (
              <button
                type="button"
                onClick={() =>
                  updateFormData((prev) => ({ username: prev.idPelanggan }))
                }
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
              >
                Gunakan ID Pelanggan
              </button>
            )}
          </div>
          <input
            id="username"
            name="username"
            type="text"
            required
            value={formData.username}
            onChange={handleChange}
            className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
            placeholder="username@domain atau sama dengan ID Pelanggan"
          />
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Default: sama dengan ID Pelanggan ({formData.idPelanggan}), bisa
            diubah manual jika diperlukan
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Password PPPoE{" "}
            {!isEditMode && <span className="text-red-500">*</span>}
          </label>
          <input
            id="password"
            name="password"
            type="text"
            required={!isEditMode}
            value={formData.password}
            onChange={handleChange}
            className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
            placeholder={
              isEditMode
                ? "Biarkan kosong bila tidak ingin mengubah"
                : "Password untuk koneksi PPPoE"
            }
          />
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {isEditMode
              ? "Biarkan kosong bila password PPPoE tidak diubah. Mengisi field ini akan menimpa password lama dan menyinkronkannya ke RADIUS/MikroTik."
              : "Default: 123456, bisa diubah manual jika diperlukan. Password ini digunakan untuk koneksi PPPoE."}
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="passwordLogin"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Password Login Portal{" "}
            {!isEditMode && <span className="text-red-500">*</span>}
          </label>
          <div className="relative">
            <input
              id="passwordLogin"
              name="passwordLogin"
              type={showPasswordLogin ? "text" : "password"}
              required={!isEditMode}
              value={formData.passwordLogin}
              onChange={handleChange}
              className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 pr-10 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
              placeholder={
                isEditMode
                  ? "Biarkan kosong bila tidak ingin mengubah"
                  : "Password untuk login portal pelanggan"
              }
            />
            <button
              type="button"
              onClick={onToggleShowPasswordLogin}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label={
                showPasswordLogin
                  ? "Sembunyikan password"
                  : "Tampilkan password"
              }
            >
              {showPasswordLogin ? (
                <HiEyeSlash className="w-5 h-5" />
              ) : (
                <HiEye className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            Default: 123456, bisa diubah manual jika diperlukan. Password ini
            digunakan untuk login di portal pelanggan (/login).
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-md font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
          Catatan
        </h3>
        <div className="space-y-2">
          <label
            htmlFor="catatan"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Catatan Tambahan
          </label>
          <textarea
            id="catatan"
            name="catatan"
            rows={4}
            value={formData.catatan}
            onChange={handleChange}
            className={`w-full ${roundedClassName} border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors`}
            placeholder="Catatan atau keterangan tambahan tentang pelanggan"
          />
        </div>
      </div>
    </div>
  );
}
