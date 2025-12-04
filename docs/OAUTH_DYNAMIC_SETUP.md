# Dynamic OAuth Provider Configuration

This document explains how to set up and use the dynamic OAuth provider management system.

## Overview

The dynamic OAuth system allows administrators to configure OAuth providers through the admin panel without code changes. This provides a flexible way to manage authentication providers.

## Features

- **Dynamic Configuration**: Add, enable/disable OAuth providers through admin panel
- **Security**: OAuth credentials are encrypted in the database
- **Multiple Providers**: Support for Google, GitHub, Microsoft, Facebook, LinkedIn
- **Test Connection**: Verify OAuth provider credentials before enabling
- **Priority Ordering**: Control the order of OAuth providers in login interface
- **Fallback Support**: Graceful fallback to environment variables

## Setup Instructions

### 1. Environment Configuration

Add these environment variables to your `.env` file:

```env
# Enable dynamic OAuth configuration
DYNAMIC_OAUTH=true

# Generate encryption key (32 characters)
OAUTH_ENCRYPTION_KEY=your-32-character-encryption-key-here
```

### 2. Database Migration

The system uses the `OAuthProviderConfig` model. Run migrations if needed:

```bash
npx prisma db push
```

### 3. Access OAuth Configuration

Navigate to: **Admin Panel → Pengaturan → OAuth**

## Supported Providers

### Google OAuth
- **Required**: Client ID, Client Secret
- **Optional**: Hosted Domain, Prompt
- **Setup**: https://console.cloud.google.com/
- **Scopes**: `openid email profile`

### GitHub OAuth
- **Required**: Client ID, Client Secret
- **Optional**: Allow Signup
- **Setup**: https://github.com/settings/applications/new
- **Scopes**: `user:email`

### Microsoft Azure AD
- **Required**: Client ID, Client Secret, Tenant ID
- **Optional**: Prompt
- **Setup**: https://portal.azure.com/
- **Scopes**: `openid email profile`

### Facebook OAuth
- **Required**: Client ID, Client Secret
- **Setup**: https://developers.facebook.com/
- **Scopes**: `email public_profile`

### LinkedIn OAuth
- **Required**: Client ID, Client Secret
- **Setup**: https://www.linkedin.com/developers/apps/new
- **Scopes**: `openid email profile`

## Configuration Steps

### 1. Create OAuth Application

1. Go to the provider's developer console
2. Create a new OAuth application
3. Set redirect URI: `http://localhost:3000/api/auth/callback/[provider]`
   - Replace `localhost:3000` with your domain in production
4. Get Client ID and Client Secret

### 2. Configure in Admin Panel

1. Go to **Pengaturan → OAuth**
2. Click the gear icon on the provider card
3. Fill in the required fields:
   - **Client ID**: From OAuth application
   - **Client Secret**: From OAuth application
   - **Tenant ID**: Required for Microsoft only
   - **Scopes**: OAuth permissions (comma-separated)
   - **Priority**: Display order (higher = first)
4. Enable the provider
5. Test the connection
6. Save configuration

### 3. Verify Integration

The OAuth provider should now appear in the login interface. Users can authenticate using the configured provider.

## Security Considerations

### Encryption
- All OAuth credentials are encrypted using AES-256-GCM
- Encryption key must be set in `OAUTH_ENCRYPTION_KEY`
- Generate a secure key: `openssl rand -hex 32`

### Access Control
- Only users with `ADMIN` role can access OAuth settings
- API endpoints require admin authentication
- Credentials are never exposed to frontend

### Best Practices
1. Use different redirect URIs for development and production
2. Regularly rotate OAuth client secrets
3. Monitor OAuth provider usage
4. Keep encryption key secure and separate from version control

## Troubleshooting

### Common Issues

1. **Provider not appearing in login**
   - Check if provider is enabled in admin panel
   - Verify credentials are correctly configured
   - Check browser console for errors

2. **Connection test fails**
   - Verify Client ID and Client Secret
   - Check redirect URI configuration
   - Ensure OAuth application is active

3. **Encryption errors**
   - Ensure `OAUTH_ENCRYPTION_KEY` is set
   - Key must be 32 characters long
   - Check for key mismatch across environments

### Debug Mode

Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

## API Endpoints

### Configuration Management
- `GET /api/admin/oauth/configs` - List all configurations
- `GET /api/admin/oauth/configs/[provider]` - Get specific configuration
- `PUT /api/admin/oauth/configs/[provider]` - Update configuration
- `POST /api/admin/oauth/configs` - Create configuration

### Testing
- `POST /api/admin/oauth/test` - Test provider connection

### Frontend
- `GET /api/auth/oauth/providers` - Get enabled providers for login

## Migration from Environment Variables

To migrate existing OAuth configuration:

1. Enable dynamic OAuth: `DYNAMIC_OAUTH=true`
2. Go to OAuth settings in admin panel
3. Configure each provider using existing environment variables
4. Test each provider
5. Remove old environment variables (optional, recommended for security)

The system maintains backward compatibility with environment variables as fallback.

## Production Deployment

### Required Environment Variables
```env
DYNAMIC_OAUTH=true
OAUTH_ENCRYPTION_KEY=your-production-encryption-key
```

### Database Security
- Ensure database connections are encrypted
- Regular database backups recommended
- Monitor OAuth configuration changes

### Monitoring
- Monitor OAuth login attempts
- Check for connection failures
- Review provider-specific rate limits

## Support

For issues or questions:
1. Check application logs
2. Verify provider documentation
3. Test with different browsers
4. Contact system administrator

---

**Note**: This system is designed to work with NextAuth.js v4 and maintains compatibility with existing authentication flows.