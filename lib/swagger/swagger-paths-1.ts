/**
 * Swagger OpenAPI Paths - Complete API Documentation
 * Auto-generated comprehensive paths for all NetManager API endpoints
 */

export const swaggerPaths = {
    // ==================== HEALTH ====================
    '/api/health': {
        get: {
            summary: 'Health Check',
            description: 'Check API and database health status',
            tags: ['Health'],
            responses: { 200: { description: 'Health status' } }
        }
    },

    // ==================== AUTH ====================
    '/api/auth/{...nextauth}': {
        get: { summary: 'NextAuth Handler', tags: ['Auth'], responses: { 200: { description: 'Auth response' } } },
        post: { summary: 'NextAuth Handler', tags: ['Auth'], responses: { 200: { description: 'Auth response' } } }
    },

    // ==================== USERS ====================
    '/api/users': {
        get: { summary: 'Get all users', tags: ['Users'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'List of users' } } },
        post: { summary: 'Create user', tags: ['Users'], security: [{ bearerAuth: [] }], responses: { 201: { description: 'User created' } } }
    },
    '/api/users/{id}': {
        get: { summary: 'Get user by ID', tags: ['Users'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'User details' } } },
        put: { summary: 'Update user', tags: ['Users'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'User updated' } } },
        delete: { summary: 'Delete user', tags: ['Users'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'User deleted' } } }
    },

    // ==================== DEPARTMENTS ====================
    '/api/departments': {
        get: { summary: 'Get all departments', tags: ['Departments'], responses: { 200: { description: 'List of departments' } } }
    },
    '/api/admin/departments': {
        get: { summary: 'Get departments (admin)', tags: ['Departments'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'List of departments' } } },
        post: { summary: 'Create department', tags: ['Departments'], security: [{ bearerAuth: [] }], responses: { 201: { description: 'Department created' } } }
    },
    '/api/admin/departments/{id}': {
        get: { summary: 'Get department by ID', tags: ['Departments'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Department details' } } },
        put: { summary: 'Update department', tags: ['Departments'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Department updated' } } },
        delete: { summary: 'Delete department', tags: ['Departments'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Department deleted' } } }
    },

    // ==================== SITES ====================
    '/api/admin/sites': {
        get: { summary: 'Get all sites', tags: ['Sites'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'List of sites' } } },
        post: { summary: 'Create site', tags: ['Sites'], security: [{ bearerAuth: [] }], responses: { 201: { description: 'Site created' } } }
    },
    '/api/admin/sites/{id}': {
        get: { summary: 'Get site by ID', tags: ['Sites'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Site details' } } },
        put: { summary: 'Update site', tags: ['Sites'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Site updated' } } },
        delete: { summary: 'Delete site', tags: ['Sites'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Site deleted' } } }
    },

    // ==================== EMPLOYEES ====================
    '/api/employees/next-id': {
        get: { summary: 'Get next employee ID', tags: ['Employees'], responses: { 200: { description: 'Next available employee ID' } } }
    },

    // ==================== BANDWIDTHS ====================
    '/api/bandwidths': {
        get: { summary: 'Get all bandwidths', tags: ['Bandwidth'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'List of bandwidths' } } },
        post: { summary: 'Create bandwidth', tags: ['Bandwidth'], security: [{ bearerAuth: [] }], responses: { 201: { description: 'Bandwidth created' } } }
    },
    '/api/bandwidths/{id}': {
        get: { summary: 'Get bandwidth by ID', tags: ['Bandwidth'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Bandwidth details' } } },
        put: { summary: 'Update bandwidth', tags: ['Bandwidth'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Bandwidth updated' } } },
        delete: { summary: 'Delete bandwidth', tags: ['Bandwidth'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Bandwidth deleted' } } }
    },

    // ==================== PROFILE PPP ====================
    '/api/profileppps': {
        get: { summary: 'Get all PPP profiles', tags: ['Profile PPP'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'List of PPP profiles' } } },
        post: { summary: 'Create PPP profile', tags: ['Profile PPP'], security: [{ bearerAuth: [] }], responses: { 201: { description: 'Profile created' } } }
    },
    '/api/profileppps/{id}': {
        get: { summary: 'Get PPP profile by ID', tags: ['Profile PPP'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Profile details' } } },
        put: { summary: 'Update PPP profile', tags: ['Profile PPP'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Profile updated' } } },
        delete: { summary: 'Delete PPP profile', tags: ['Profile PPP'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Profile deleted' } } }
    },

    // ==================== HARGA PAKET ====================
    '/api/hargapakets': {
        get: { summary: 'Get all pricing packages', tags: ['Harga Paket'], security: [{ bearerAuth: [] }], responses: { 200: { description: 'List of packages' } } },
        post: { summary: 'Create pricing package', tags: ['Harga Paket'], security: [{ bearerAuth: [] }], responses: { 201: { description: 'Package created' } } }
    },
    '/api/hargapakets/{id}': {
        get: { summary: 'Get package by ID', tags: ['Harga Paket'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Package details' } } },
        put: { summary: 'Update package', tags: ['Harga Paket'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Package updated' } } },
        delete: { summary: 'Delete package', tags: ['Harga Paket'], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Package deleted' } } }
    },
}
