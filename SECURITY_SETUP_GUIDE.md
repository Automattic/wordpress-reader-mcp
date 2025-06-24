# 🔒 Security Setup Guide - WordPress Reader MCP

## Overview

This guide documents the security improvements and setup requirements for the WordPress Reader MCP integration.

## 🛡️ Security Features Implemented

### 1. **Localhost-Only Access**
- Authentication endpoints restricted to `127.0.0.1`, `::1`, `localhost`
- Blocks all external network access to sensitive endpoints

### 2. **Shared Secret Authentication**
- MCP server and auth service communicate using a shared secret
- 64-character hex secret automatically generated during setup
- Required for accessing `/auth/current-token` and `/auth/wordpress-token/:code` endpoints

### 3. **Rate Limiting**
- Maximum 10 requests per minute per IP for MCP endpoints
- Prevents brute force attacks

### 4. **Persistent Token Storage**
- Tokens stored in `.wp-auth-tokens.json` and `.wp-auth-codes.json`
- Automatic cleanup of expired tokens
- Survives web app restarts

## 🔧 Setup Script Updates

The `setup.js` script has been updated to handle all security requirements:

### Environment Files Created
```
web-app/.env:
├── WORDPRESS_CLIENT_ID
├── WORDPRESS_CLIENT_SECRET  
├── JWT_SECRET (auto-generated)
└── MCP_SHARED_SECRET (auto-generated)

mcp-server/.env:
├── AUTH_SERVER_URL
└── MCP_SHARED_SECRET (same as web-app)
```

### Claude Desktop Configuration
Automatically configures with security environment variables:
```json
{
  "mcpServers": {
    "wordpress-reader": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "AUTH_SERVER_URL": "http://localhost:3000",
        "MCP_SHARED_SECRET": "auto-generated-secret"
      }
    }
  }
}
```

## 🚀 Fresh Installation Process

For new environments, the setup script now:

1. **Generates Security Secrets**
   - Creates unique `JWT_SECRET` for web app
   - Creates unique `MCP_SHARED_SECRET` for MCP authentication

2. **Creates Environment Files**
   - `web-app/.env` with all required settings
   - `mcp-server/.env` with auth server URL and shared secret

3. **Configures Claude Desktop**
   - Automatically adds MCP server configuration
   - Includes security environment variables

4. **Builds Applications**
   - Compiles TypeScript with security middleware
   - Ensures all security features are included

5. **Starts Services**
   - Background auth service with security enabled
   - Ready for secure MCP communication

## 🔄 Upgrading Existing Installation

For existing installations, the setup script:

1. **Detects Existing Configuration**
   - Reads current WordPress credentials
   - Preserves existing JWT secrets

2. **Adds Missing Security**
   - Generates `MCP_SHARED_SECRET` if missing
   - Updates environment files with security settings

3. **Updates Claude Desktop**
   - Adds `MCP_SHARED_SECRET` to existing configuration
   - Preserves other MCP server configurations

## 🧪 Testing Security

You can verify security is working:

```bash
# This should return 401 Unauthorized
curl http://localhost:3000/auth/current-token

# This should work (replace SECRET with actual value)
curl -H "X-MCP-Secret: YOUR_SECRET" http://localhost:3000/auth/current-token
```

## 📋 Manual Setup (if needed)

If automatic setup fails, manually:

1. **Generate Shared Secret**
   ```bash
   openssl rand -hex 32
   ```

2. **Add to web-app/.env**
   ```
   MCP_SHARED_SECRET=your-generated-secret
   ```

3. **Create mcp-server/.env**
   ```
   AUTH_SERVER_URL=http://localhost:3000
   MCP_SHARED_SECRET=your-generated-secret
   ```

4. **Update Claude Desktop Config**
   ```json
   {
     "mcpServers": {
       "wordpress-reader": {
         "env": {
           "AUTH_SERVER_URL": "http://localhost:3000",
           "MCP_SHARED_SECRET": "your-generated-secret"
         }
       }
     }
   }
   ```

## ⚠️ Important Notes

1. **Restart Required**: Always restart Claude Desktop after configuration changes
2. **Secret Security**: Keep MCP_SHARED_SECRET private and secure
3. **Environment Consistency**: Ensure same secret in all three locations
4. **Localhost Only**: Auth endpoints only work from localhost
5. **Token Persistence**: Tokens survive web app restarts but have 1-hour expiry

## 🔍 Troubleshooting

### "Authentication required" Error
- Check MCP_SHARED_SECRET is set in Claude Desktop config
- Verify secret matches across web-app/.env and mcp-server/.env
- Restart Claude Desktop after configuration changes

### "Access denied - localhost only" Error
- MCP server trying to access from wrong IP
- Should only happen if running MCP server remotely

### "Invalid MCP secret" Error
- Shared secret mismatch between components
- Re-run setup script to regenerate consistent secrets

## 📊 Security Validation Checklist

- [ ] MCP_SHARED_SECRET generated and set in all locations
- [ ] `/auth/current-token` returns 401 without secret
- [ ] `/auth/current-token` works with correct secret
- [ ] External access blocked (test from different machine)
- [ ] Rate limiting active (test with rapid requests)
- [ ] Token persistence working (restart web app, check token survival)
- [ ] Claude Desktop can authenticate and use WordPress tools

## 🎯 Result

With these security measures:
- ✅ WordPress credentials are fully protected
- ✅ Only localhost MCP server can access tokens
- ✅ Shared secrets prevent unauthorized access
- ✅ Rate limiting prevents abuse
- ✅ Setup script handles everything automatically
- ✅ Works for both fresh and existing installations