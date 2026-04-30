export const TOPOLOGY_BASE_SELECT = {
  id: true,
  name: true,
  location: true,
  latitude: true,
  longitude: true,
  notes: true,
  images: true,
} as const;

export const ODC_SELECT = {
  ...TOPOLOGY_BASE_SELECT,
  attenuationIn: true,
  attenuationOut: true,
  inputCoreColor: true,
  otbCore: {
    select: {
      coreColor: true,
      tubeColor: true,
      otb: {
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  },
} as const;

export const ODP_SELECT = {
  ...TOPOLOGY_BASE_SELECT,
  attenuationIn: true,
  attenuationOut: true,
  inputCoreColor: true,
  odcOutput: {
    select: {
      coreColor: true,
      tubeColor: true,
      odc: {
        select: {
          id: true,
          name: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  },
  _count: { select: { odpOutput: true } },
  site: { select: { name: true } },
} as const;

export const POLE_SELECT = {
  ...TOPOLOGY_BASE_SELECT,
  cableSlack: true,
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
  odp: {
    select: { id: true, name: true, latitude: true, longitude: true },
  },
} as const;

export const KMZ_FILE_SELECT = {
  id: true,
  name: true,
  kmlPath: true,
  lineColor: true,
  isActive: true,
} as const;
