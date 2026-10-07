/**
 * Daftar pembatasan jangkauan data yang tidak punya toggle di halaman Hak Akses.
 *
 * Halaman Hak Akses hanya menggambar toggle untuk pembatasan yang ada di katalog
 * kapabilitas. Pembatasan di luar katalog tersimpan di database tanpa tombol:
 * tak terlihat, tak bisa dimatikan, dan ditulis ulang setiap kali role disimpan.
 *
 * Skrip ini tidak menyentuh database. Ia membaca katalog, menerima daftar
 * pasangan `resource:action` yang ADA di database lewat stdin, lalu mencetak
 * mana yang harus dibuang beserta SQL-nya. Pemisahan ini disengaja: pembersihan
 * produksi dijalankan manusia dengan SQL yang bisa dibaca lebih dulu, bukan oleh
 * skrip yang langsung menulis.
 *
 * Jalankan:
 *   cat pasangan.txt | npx tsx scripts/pembatasan-tanpa-toggle.ts
 *   (satu baris per pasangan, format `resource:action`)
 */

import { isPembatasanPunyaToggle } from "../modules/roles/domain/pembatasan-lingkup";

const SCOPE_ACTIONS = ["site_only", "department_only"];

function bacaStdin(): Promise<string> {
  return new Promise((resolve) => {
    let isi = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (potongan) => (isi += potongan));
    process.stdin.on("end", () => resolve(isi));
  });
}

function sqlLiteral(nilai: string): string {
  return `'${nilai.replace(/'/g, "''")}'`;
}

async function main() {
  const pasangan = [
    ...new Set(
      (await bacaStdin())
        .split("\n")
        .map((baris) => baris.trim())
        .filter(Boolean),
    ),
  ];

  const pembatasan = pasangan.filter((p) =>
    SCOPE_ACTIONS.includes(p.split(":")[1] ?? ""),
  );
  const tanpaToggle = pembatasan.filter((p) => !isPembatasanPunyaToggle(p));
  const punyaToggle = pembatasan.filter((p) => isPembatasanPunyaToggle(p));

  console.log(`-- pasangan dibaca      : ${pasangan.length}`);
  console.log(`-- di antaranya pembatas: ${pembatasan.length}`);
  console.log(`-- punya toggle (dibiarkan): ${punyaToggle.length}`);
  for (const p of punyaToggle.sort()) console.log(`--   ${p}`);
  console.log(`-- tanpa toggle (dibuang)  : ${tanpaToggle.length}`);

  if (tanpaToggle.length === 0) return;

  const nilai = tanpaToggle
    .sort()
    .map((p) => {
      const [resource, action] = p.split(":");
      return `(${sqlLiteral(resource!)}, ${sqlLiteral(action!)})`;
    })
    .join(",\n    ");

  console.log(`
DELETE FROM "_PermissionToRole" pr
USING "Permission" p
WHERE pr."A" = p.id
  AND (p.resource, p.action) IN (
    ${nilai}
  );`);
}

main();
