export const TOPOLOGY_BASE_SELECT = {
  id: true,
  name: true,
  location: true,
  latitude: true,
  longitude: true,
  notes: true,
  images: true,
} as const;

export const PELANGGAN_SELECT = {
  id: true,
  idPelanggan: true,
  nama: true,
  latitude: true,
  longitude: true,
  alamat: true,
  status: true,
  odpId: true,
  // Relasi ini kini mengarah ke `mapping_nodes`, yang kunci primernya `nodeId`
  // (bukan `id`). Prisma menolak field tak dikenal pada select saat runtime,
  // sementara TypeScript tidak memvalidasi select bersarang — jadi ketidak-
  // cocokan di sini tidak akan tertangkap compiler.
  odp: {
    select: { nodeId: true, name: true, latitude: true, longitude: true },
  },
} as const;

export const KMZ_FILE_SELECT = {
  id: true,
  name: true,
  kmlPath: true,
  lineColor: true,
  isActive: true,
} as const;
