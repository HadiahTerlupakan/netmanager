"use client"

import { Building2, Phone, Mail, MapPin, FileText, Plus, X, Landmark } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/Button'

type BankAccount = {
  id?: string
  namaBank: string
  atasNama: string
  noRekening: string
}

type CompanyProfileSettingsProps = {
  settings: {
    perusahaan: string
    namaAplikasi: string
    alamat: string
    nomorHp: string
    email: string
    deskripsiInvoice: string
    rekeningBank: BankAccount[]
  }
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  handleBankChange: (index: number, field: keyof BankAccount, value: string) => void
  addBankAccount: () => void
  removeBankAccount: (index: number) => void
}

export function CompanyProfileSettings({
  settings,
  handleChange,
  handleBankChange,
  addBankAccount,
  removeBankAccount
}: CompanyProfileSettingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-500" />
          Profil Perusahaan
        </CardTitle>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Informasi dasar perusahaan yang akan ditampilkan di invoice dan aplikasi
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor="perusahaan" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Nama Perusahaan <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="perusahaan"
                name="perusahaan"
                type="text"
                value={settings.perusahaan}
                onChange={handleChange}
                placeholder="Masukkan nama perusahaan"
                className="w-full pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="namaAplikasi" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Nama Aplikasi <span className="text-red-500">*</span>
            </label>
            <input
              id="namaAplikasi"
              name="namaAplikasi"
              type="text"
              value={settings.namaAplikasi}
              onChange={handleChange}
              placeholder="Contoh: NetManager"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="nomorHp" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Nomor HP/WhatsApp <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="nomorHp"
                name="nomorHp"
                type="text"
                value={settings.nomorHp}
                onChange={handleChange}
                placeholder="628123456789"
                className="w-full pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Email Perusahaan <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="email"
                name="email"
                type="email"
                value={settings.email}
                onChange={handleChange}
                placeholder="admin@perusahaan.com"
                className="w-full pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="alamat" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Alamat Lengkap <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <textarea
              id="alamat"
              name="alamat"
              value={settings.alamat}
              onChange={handleChange}
              rows={3}
              placeholder="Masukkan alamat lengkap perusahaan"
              className="w-full pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="deskripsiInvoice" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Deskripsi/Catatan Invoice <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="deskripsiInvoice"
              name="deskripsiInvoice"
              type="text"
              value={settings.deskripsiInvoice}
              onChange={handleChange}
              placeholder="Contoh: Terima kasih telah berlangganan"
              className="w-full pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Bank Accounts Section */}
        <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Landmark className="w-4 h-4 text-indigo-500" />
              Rekening Pembayaran
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addBankAccount}
              className="h-8 gap-1"
            >
              <Plus className="w-4 h-4" />
              Tambah Bank
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {settings.rekeningBank.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                <p className="text-sm text-gray-500">Belum ada rekening bank yang ditambahkan</p>
              </div>
            ) : (
              settings.rekeningBank.map((bank, index) => (
                <div key={index} className="relative p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 group">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeBankAccount(index)}
                    className="absolute top-2 right-2 h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mr-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">Nama Bank</label>
                      <input
                        type="text"
                        value={bank.namaBank}
                        onChange={(e) => handleBankChange(index, 'namaBank', e.target.value)}
                        placeholder="Contoh: BCA"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">Atas Nama</label>
                      <input
                        type="text"
                        value={bank.atasNama}
                        onChange={(e) => handleBankChange(index, 'atasNama', e.target.value)}
                        placeholder="Contoh: PT Net Manager"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-500">No. Rekening</label>
                      <input
                        type="text"
                        value={bank.noRekening}
                        onChange={(e) => handleBankChange(index, 'noRekening', e.target.value)}
                        placeholder="000111222333"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
