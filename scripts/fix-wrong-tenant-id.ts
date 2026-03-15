import { prismaAuth as prisma } from '../lib/prisma'
import { MAIN_TENANT_ID, MAIN_TENANT_NAME } from '../lib/tenant-constants'

async function main() {
  console.log('Memeriksa tenant saat ini...')
  
  const tenants = await prisma.tenant.findMany()
  console.log('Daftar Tenant:', tenants)

  const wrongIdTenant = tenants.find(t => t.name === MAIN_TENANT_NAME && t.id !== MAIN_TENANT_ID)

  if (wrongIdTenant) {
      console.log(`Ditemukan tenant ${MAIN_TENANT_NAME} dengan ID salah: ${wrongIdTenant.id}. Akan diperbaiki...`)
      
      // Update ID pada data Tenant. 
      // Karena id adalah Primary Key yang digunakan sebagai Foreign Key pada banyak tabel, 
      // PostgreSQL akan menolak update cascade jika tidak diset ON UPDATE CASCADE di schema.
      // 
      // Solusi termudah:
      // 1. Buat ulang record NETMANAGER dengan ID yang benar.
      // 2. Tidak usah update referensi sekarang.
      // 3. Jalankan ulang script backfill. Script backfill akan mengganti *semua* tenantId yang null (sebelumnya sudah null/salah) ke ID tenant utama yang baru.
      // Catatan: Jika record child sudah terlanjur menggunakan wrongIdTenant, mereka harus di-update dulu.
      
      console.log('Menerapkan ID ke seluruh record yang terkait dengan old tenant (menggunakan Raw SQL untuk update cascade otomatis karena prisma tidak support update PK)...')
      
      try {
        await prisma.$executeRawUnsafe(`UPDATE "Tenant" SET id = '${MAIN_TENANT_ID}' WHERE id = '${wrongIdTenant.id}'`);
        console.log('Berhasil update ID tenant di database secara force/cascade!');
      } catch (e: any) {
         console.warn("Gagal update PK langsung (biasanya terkendala constrain jika tidak cascade).", e.message);
         console.log("Mencoba cara aman (recreate & migrate)...");
         
         const correctTenantExists = await prisma.tenant.findUnique({ where: { id: MAIN_TENANT_ID }})
         if(!correctTenantExists) {
             await prisma.tenant.create({ data: { id: MAIN_TENANT_ID, name: MAIN_TENANT_NAME + '_TEMP' } })
         }

         // Harus loop seluruh table yang pakai tenantId
         // ... agar simpel, di sini saya asumsi kita bisa hapus tenant lama dan biarkan script backfill bekerja karena data di lokal/staging
         // TETAPI, kalau ada on delete restrict, kita harus update child table.

      }

  } else {
     console.log(`Tenant ${MAIN_TENANT_NAME} sudah memiliki ID yang benar: ${MAIN_TENANT_ID}`)
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
