# API Documentation

NetManager API menggunakan Swagger/OpenAPI untuk dokumentasi interaktif.

## 📚 Akses Dokumentasi

### Swagger UI (Interaktif)
Akses dokumentasi interaktif melalui browser:
```
http://localhost:3000/api/docs/ui
```

### OpenAPI Spec (JSON)
Akses OpenAPI specification dalam format JSON:
```
http://localhost:3000/api/docs
```

## 🔐 Authentication

API menggunakan NextAuth.js untuk autentikasi. Ada dua metode autentikasi yang didukung:

1. **Bearer Token** - JWT token dari NextAuth
2. **Cookie** - Session cookie dari NextAuth

Sebagian besar endpoint memerlukan autentikasi sebagai **ADMIN**.

## 📋 Endpoint Categories

### Health
- `GET /api/health` - Health check aplikasi, database, dan Redis

### Users
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `PATCH /api/users/{id}` - Update user
- `DELETE /api/users/{id}` - Delete user

### MikroTik Routers
- `GET /api/mikrotik-routers` - Get all MikroTik routers
- `POST /api/mikrotik-routers` - Create new MikroTik router
- `GET /api/mikrotik-routers/{id}` - Get router by ID
- `PATCH /api/mikrotik-routers/{id}` - Update router
- `DELETE /api/mikrotik-routers/{id}` - Delete router

### FTTH Infrastructure
- **ODC** (Optical Distribution Cabinet)
  - `GET /api/odcs` - Get all ODCs
  - `POST /api/odcs` - Create new ODC
  - `GET /api/odcs/{id}` - Get ODC by ID
  - `PATCH /api/odcs/{id}` - Update ODC
  - `DELETE /api/odcs/{id}` - Delete ODC

- **ODP** (Optical Distribution Point)
  - `GET /api/odps` - Get all ODPs
  - `POST /api/odps` - Create new ODP
  - `GET /api/odps/{id}` - Get ODP by ID
  - `PATCH /api/odps/{id}` - Update ODP
  - `DELETE /api/odps/{id}` - Delete ODP

- **OTB** (Optical Terminal Box)
  - `GET /api/otbs` - Get all OTBs
  - `POST /api/otbs` - Create new OTB
  - `GET /api/otbs/{id}` - Get OTB by ID
  - `PATCH /api/otbs/{id}` - Update OTB
  - `DELETE /api/otbs/{id}` - Delete OTB

- **Pole** (Tiang)
  - `GET /api/poles` - Get all poles
  - `POST /api/poles` - Create new pole
  - `GET /api/poles/{id}` - Get pole by ID
  - `PATCH /api/poles/{id}` - Update pole
  - `DELETE /api/poles/{id}` - Delete pole

- **Joinbox**
  - `GET /api/joinboxes` - Get all joinboxes
  - `POST /api/joinboxes` - Create new joinbox
  - `GET /api/joinboxes/{id}` - Get joinbox by ID
  - `PATCH /api/joinboxes/{id}` - Update joinbox
  - `DELETE /api/joinboxes/{id}` - Delete joinbox

### KMZ Files
- `GET /api/kmz` - Get all KMZ files
- `POST /api/kmz` - Upload KMZ file
- `GET /api/kmz/{id}` - Get KMZ file by ID
- `DELETE /api/kmz/{id}` - Delete KMZ file

### Geocode
- `GET /api/geocode/search?q={query}` - Search location by query
- `GET /api/geocode/reverse?lat={lat}&lon={lon}` - Reverse geocoding

### Speed Profiles
- `GET /api/speedprofiles` - Get all speed profiles
- `POST /api/speedprofiles` - Create new speed profile
- `GET /api/speedprofiles/{id}` - Get speed profile by ID
- `PATCH /api/speedprofiles/{id}` - Update speed profile
- `DELETE /api/speedprofiles/{id}` - Delete speed profile

## 📝 Response Codes

- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized (tidak memiliki akses)
- `404` - Not Found (resource tidak ditemukan)
- `409` - Conflict (duplicate data, misalnya email/IP sudah terpakai)
- `500` - Internal Server Error
- `503` - Service Unavailable (untuk health check jika unhealthy)

## 🔧 Menambah Dokumentasi Endpoint Baru

Untuk menambahkan dokumentasi endpoint baru, tambahkan JSDoc comment dengan format Swagger di atas function handler:

```typescript
/**
 * @swagger
 * /api/my-endpoint:
 *   get:
 *     summary: My endpoint summary
 *     description: Detailed description
 *     tags: [MyTag]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: param
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
export async function GET() {
  // ... implementation
}
```

## 📦 Schema Definitions

Schema definitions didefinisikan di `lib/swagger/swagger-config.ts` dalam `components.schemas`. Schema yang tersedia:

- `User` - User schema
- `MikroTikRouter` - MikroTik router schema
- `Health` - Health check response schema
- `Error` - Error response schema

## 🚀 Development

### Menjalankan Swagger UI

1. Start development server:
```bash
npm run dev
```

2. Akses Swagger UI:
```
http://localhost:3000/api/docs/ui
```

### Update OpenAPI Spec

OpenAPI spec di-generate secara otomatis dari JSDoc comments di file API. Setelah menambahkan atau mengubah dokumentasi, refresh halaman Swagger UI untuk melihat perubahan.

## 📚 Resources

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger JSDoc](https://github.com/Surnet/swagger-jsdoc)
- [Swagger UI React](https://github.com/swagger-api/swagger-ui)

