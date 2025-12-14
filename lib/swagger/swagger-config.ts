/**
 * Swagger/OpenAPI Configuration
 * Comprehensive API Documentation for NetManager
 */

export const swaggerConfig = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NetManager API',
      version: '1.0.0',
      description: `
# NetManager API Documentation

Platform Manajemen Jaringan FTTH (Fiber To The Home) yang komprehensif.

## Fitur Utama
- **OLT Management** - Mengelola Optical Line Terminal
- **ONU Management** - Mengelola Optical Network Unit
- **Infrastructure** - ODP, ODC, OTB, Pole, Joinbox
- **Customer Management** - Manajemen Pelanggan PPPoE
- **Inventory** - Stok barang dan gudang
- **Work Orders** - Tiket kerja untuk teknisi
- **HRIS** - Employee dan Department management

## Authentication
API menggunakan JWT Bearer Token atau Session Cookie untuk autentikasi.
      `,
      contact: {
        name: 'NetManager Support',
        email: 'support@netmanager.com',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.netmanager.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer Token untuk autentikasi',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'next-auth.session-token',
          description: 'NextAuth session cookie',
        },
      },
      schemas: {
        // Common Schemas
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            message: {
              type: 'string',
              description: 'Detailed error message',
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 10 },
            total: { type: 'integer', example: 100 },
            totalPages: { type: 'integer', example: 10 },
          },
        },

        // User & Auth
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // OLT & ONU
        OLT: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            ipAddress: { type: 'string', format: 'ipv4' },
            type: { type: 'string' },
            version: { type: 'string', nullable: true },
            temperature: { type: 'integer', nullable: true },
            connectedDevices: { type: 'integer' },
            model: { type: 'string', nullable: true },
            uptime: { type: 'string', nullable: true },
            syncStatus: { type: 'string' },
            syncDate: { type: 'string', format: 'date-time', nullable: true },
            telnetConnected: { type: 'boolean' },
            snmpConnected: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ONU: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            oltId: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            pppoe: { type: 'string', nullable: true },
            gponOnu: { type: 'string' },
            status: { type: 'string', enum: ['online', 'offline', 'los', 'dying-gasp'] },
            rxOlt: { type: 'string', nullable: true },
            rxOnu: { type: 'string', nullable: true },
            serialNumber: { type: 'string', nullable: true },
            macAddress: { type: 'string', nullable: true },
            lastUpdate: { type: 'string', format: 'date-time' },
          },
        },

        // MikroTik
        MikroTikRouter: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            ipAddress: { type: 'string' },
            timezone: { type: 'string' },
            apiPort: { type: 'integer' },
            apiUsername: { type: 'string' },
            authPort: { type: 'integer' },
            accountingPort: { type: 'integer' },
            secretRadius: { type: 'string' },
            isolirUrl: { type: 'string', nullable: true },
            description: { type: 'string', nullable: true },
            pingStatus: { type: 'string', enum: ['online', 'offline'] },
            userOnline: { type: 'integer' },
            lastStatusCheck: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // Infrastructure
        OTB: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            location: { type: 'string', nullable: true },
            coreCount: { type: 'integer' },
            notes: { type: 'string', nullable: true },
            latitude: { type: 'number', nullable: true },
            longitude: { type: 'number', nullable: true },
            status: { type: 'string', enum: ['AKTIF', 'NONAKTIF'] },
          },
        },
        ODC: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            location: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            latitude: { type: 'number', nullable: true },
            longitude: { type: 'number', nullable: true },
            status: { type: 'string', enum: ['AKTIF', 'NONAKTIF'] },
            otbCoreId: { type: 'string' },
          },
        },
        ODP: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            location: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            latitude: { type: 'number', nullable: true },
            longitude: { type: 'number', nullable: true },
            status: { type: 'string', enum: ['AKTIF', 'NONAKTIF'] },
            odcOutputId: { type: 'string' },
          },
        },
        // FTTH Infrastructure Schemas
        Otb: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            location: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            keteranganJumlahKabelFeeder: { type: 'string', nullable: true },
            latitude: { type: 'number', nullable: true },
            longitude: { type: 'number', nullable: true },
            coreCount: { type: 'integer' },
            cores: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  idx: { type: 'integer' },
                  slotName: { type: 'string' },
                  tubeColor: { type: 'string' },
                  coreColor: { type: 'string' },
                },
              },
            },
            status: { type: 'string', enum: ['AKTIF', 'NONAKTIF'] },
          },
        },
        Odc: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            location: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            keteranganJumlahKabelFeeder: { type: 'string', nullable: true },
            latitude: { type: 'number', nullable: true },
            longitude: { type: 'number', nullable: true },
            otbCoreId: { type: 'string' },
            outputs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  idx: { type: 'integer' },
                  slotName: { type: 'string' },
                  redaman: { type: 'number', nullable: true },
                  tubeColor: { type: 'string' },
                  coreColor: { type: 'string' },
                },
              },
            },
            status: { type: 'string', enum: ['AKTIF', 'NONAKTIF'] },
          },
        },
        Odp: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            location: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            keteranganJumlahKabelFeeder: { type: 'string', nullable: true },
            latitude: { type: 'number', nullable: true },
            longitude: { type: 'number', nullable: true },
            odcOutputId: { type: 'string' },
            outputs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  idx: { type: 'integer' },
                  slotName: { type: 'string' },
                  redaman: { type: 'number', nullable: true },
                  tubeColor: { type: 'string' },
                  coreColor: { type: 'string' },
                },
              },
            },
            status: { type: 'string', enum: ['AKTIF', 'NONAKTIF'] },
          },
        },
        Pole: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            location: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            latitude: { type: 'number', nullable: true },
            longitude: { type: 'number', nullable: true },
            cableSlack: { type: 'boolean' },
            status: { type: 'string', enum: ['AKTIF', 'NONAKTIF'] },
          },
        },
        Joinbox: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            location: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            latitude: { type: 'number', nullable: true },
            longitude: { type: 'number', nullable: true },
            status: { type: 'string', enum: ['AKTIF', 'NONAKTIF'] },
          },
        },

        // Customer (Pelanggan)
        Pelanggan: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            idPelanggan: { type: 'string' },
            nama: { type: 'string' },
            username: { type: 'string' },
            tipe: { type: 'string', enum: ['REGULER', 'VIP', 'CORPORATE'] },
            tanggalAktif: { type: 'string', format: 'date-time' },
            jatuhTempo: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['AKTIF', 'NONAKTIF', 'ISOLIR'] },
            alamat: { type: 'string', nullable: true },
            noTelp: { type: 'string', nullable: true },
            email: { type: 'string', format: 'email', nullable: true },
          },
        },

        // Work Order
        WorkOrder: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            ticketNumber: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            type: { type: 'string', enum: ['INSTALLATION', 'MAINTENANCE', 'TROUBLESHOOTING', 'RELOCATION'] },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
            status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
            pelangganId: { type: 'string', nullable: true },
            assignedDepartmentId: { type: 'string', nullable: true },
            scheduledDate: { type: 'string', format: 'date-time', nullable: true },
            completedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },

        // HRIS
        Department: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            jobDescription: { type: 'string', nullable: true },
            _count: {
              type: 'object',
              properties: {
                employees: { type: 'integer' },
              },
            },
          },
        },
        Employee: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            employeeId: { type: 'string' },
            fullName: { type: 'string' },
            email: { type: 'string', format: 'email', nullable: true },
            phone: { type: 'string', nullable: true },
            departmentId: { type: 'string', nullable: true },
            positionId: { type: 'string', nullable: true },
            joinDate: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'] },
            isActive: { type: 'boolean' },
          },
        },

        // Inventory
        Barang: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            kode: { type: 'string' },
            nama: { type: 'string' },
            kategori: { type: 'string' },
            satuan: { type: 'string' },
            stok: { type: 'integer' },
            minStok: { type: 'integer' },
            hargaBeli: { type: 'number' },
            hargaJual: { type: 'number', nullable: true },
            status: { type: 'string', enum: ['AKTIF', 'NONAKTIF'] },
          },
        },
        Gudang: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            kode: { type: 'string' },
            nama: { type: 'string' },
            alamat: { type: 'string', nullable: true },
            isDefault: { type: 'boolean' },
            status: { type: 'string', enum: ['AKTIF', 'NONAKTIF'] },
          },
        },

        // Bandwidth & Profile
        Bandwidth: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            maxLimitDownload: { type: 'string' },
            maxLimitUpload: { type: 'string' },
            burstLimitDownload: { type: 'string', nullable: true },
            burstLimitUpload: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['AKTIF', 'NONAKTIF'] },
          },
        },
        ProfilePPP: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            localAddress: { type: 'string' },
            remoteAddress: { type: 'string' },
            dnsServer: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['AKTIF', 'NONAKTIF'] },
          },
        },
        HargaPaket: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            harga: { type: 'integer' },
            durasi: { type: 'integer' },
            durasiUnit: { type: 'string', enum: ['HARI', 'MINGGU', 'BULAN', 'TAHUN'] },
            featured: { type: 'boolean' },
            status: { type: 'string', enum: ['AKTIF', 'NONAKTIF'] },
          },
        },

        // Health Check
        Health: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'unhealthy'] },
            timestamp: { type: 'string', format: 'date-time' },
            services: {
              type: 'object',
              properties: {
                database: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    responseTime: { type: 'integer' },
                  },
                },
                redis: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    responseTime: { type: 'integer' },
                  },
                },
              },
            },
            uptime: { type: 'number' },
            memory: {
              type: 'object',
              properties: {
                used: { type: 'integer' },
                total: { type: 'integer' },
                unit: { type: 'string' },
              },
            },
          },
        },

        // Notifications
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            message: { type: 'string' },
            type: { type: 'string', enum: ['INFO', 'WARNING', 'ERROR', 'SUCCESS'] },
            isRead: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
      {
        cookieAuth: [],
      },
    ],
    tags: [
      // System
      { name: 'Health', description: 'Health check dan monitoring endpoints' },
      { name: 'Auth', description: 'Authentication dan authorization endpoints' },

      // Core
      { name: 'Users', description: 'User management endpoints' },
      { name: 'Pelanggan', description: 'Customer (Pelanggan) management' },
      { name: 'Work Orders', description: 'Work order / tiket kerja management' },

      // Network Equipment
      { name: 'OLTs', description: 'OLT (Optical Line Terminal) management' },
      { name: 'ONUs', description: 'ONU (Optical Network Unit) management' },
      { name: 'MikroTik', description: 'MikroTik Router management' },

      // Infrastructure
      { name: 'FTTH', description: 'FTTH infrastructure (OTB, ODC, ODP, Pole, Joinbox)' },
      { name: 'KMZ', description: 'KMZ file management untuk peta' },
      { name: 'Geocode', description: 'Geocoding services' },

      // Configuration
      { name: 'Bandwidth', description: 'Bandwidth profile management' },
      { name: 'Profile PPP', description: 'PPPoE profile management' },
      { name: 'Harga Paket', description: 'Pricing package management' },

      // HRIS
      { name: 'Departments', description: 'Department management' },
      { name: 'Employees', description: 'Employee management' },

      // Inventory
      { name: 'Inventory', description: 'Inventory dan stock management' },

      // Settings
      { name: 'Settings', description: 'Application settings' },
      { name: 'Notifications', description: 'Push notification management' },
    ],
  },
  apis: [
    './app/api/**/*.ts',
    './app/api/**/*.tsx',
  ],
}
