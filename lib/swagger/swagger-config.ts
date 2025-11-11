/**
 * Swagger/OpenAPI Configuration
 */

export const swaggerConfig = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NetManager API',
      version: '1.0.0',
      description: 'API Documentation untuk NetManager - Platform Manajemen Jaringan FTTH',
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
          description: 'NextAuth JWT token',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'next-auth.session-token',
          description: 'NextAuth session cookie',
        },
      },
      schemas: {
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
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string', nullable: true },
            role: { type: 'string', enum: ['USER', 'ADMIN'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
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
      { name: 'Health', description: 'Health check endpoints' },
      { name: 'Users', description: 'User management endpoints' },
      { name: 'OLTs', description: 'OLT (Optical Line Terminal) management' },
      { name: 'ONUs', description: 'ONU (Optical Network Unit) management' },
      { name: 'MikroTik', description: 'MikroTik Router management' },
      { name: 'FTTH', description: 'FTTH infrastructure (ODC, ODP, OTB, Pole, Joinbox)' },
      { name: 'KMZ', description: 'KMZ file management' },
      { name: 'Geocode', description: 'Geocoding services' },
    ],
  },
  apis: [
    './app/api/**/*.ts',
    './app/api/**/*.tsx',
  ], // Path to API files
}

