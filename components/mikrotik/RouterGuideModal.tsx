"use client";

import { Button } from "@/components/ui/Button";
import { Modal, ModalFooter } from "@/components/ui/Modal";

type RouterGuideModalProps = {
  open: boolean;
  onClose: () => void;
};

const PUBLIC_ROUTER_STEPS: string[] = [
  "Pastikan server NetManager bisa menjangkau router di IP Router dan Port API: IP publik, atau port-forward ke router.",
  "Isi Nama Router, IP Router, Port API, Username API, dan Password API.",
  "Klik SCRIPT GENERATOR, salin script-nya, lalu tempel di Terminal MikroTik (Winbox → New Terminal). Script menyalakan service API dan membuat user API sesuai form.",
  "Klik Tes Koneksi. Tombol simpan baru aktif setelah tes berhasil.",
  "Simpan router. NetManager langsung memasang entri RADIUS dan CoA, aturan firewall dan NAT isolir, halaman isolir, serta user API khusus NetManager.",
];

const VPN_ROUTER_STEPS: string[] = [
  "Nyalakan RouterOS v7, lalu Pakai VPN; pilih protokol dan server VPN.",
  "Klik SCRIPT GENERATOR atau Lihat script VPN, salin script VPN, lalu tempel di Terminal MikroTik. Username dan Password API terisi sendiri.",
  "Tunggu sampai tunnel tersambung; Tes Koneksi berjalan otomatis.",
  "Simpan router.",
];

function GuideSection({
  heading,
  steps,
}: {
  heading: string;
  steps: string[];
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        {heading}
      </h3>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}

/** Langkah menambah router ke NetManager, untuk router publik maupun lewat VPN. */
export default function RouterGuideModal({
  open,
  onClose,
}: RouterGuideModalProps) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Panduan Dasar Menambah Router"
      size="2xl"
    >
      <div className="p-6 space-y-6">
        <GuideSection
          heading="Router dengan IP publik"
          steps={PUBLIC_ROUTER_STEPS}
        />
        <GuideSection
          heading="Router tanpa IP publik (VPN, RouterOS v7)"
          steps={VPN_ROUTER_STEPS}
        />
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
