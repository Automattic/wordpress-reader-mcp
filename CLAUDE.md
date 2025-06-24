# WordPress Reader MCP Project - Current State

## Project Overview

This is a complete WordPress.com Reader API integration for Claude Desktop via the Model Context Protocol (MCP). The project enables Claude to access WordPress.com Reader functionality including reading feeds, managing subscriptions, handling notifications, and interacting with blog content.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Claude    │────▶│  MCP Server  │────▶│   Web App      │
│  Desktop    │◀────│  (Port N/A)  │◀────│ (Port 3000)    │
└─────────────┘     └──────────────┘     └────────┬────────┘
                           │                       │
                           ▼                       ▼
                    ┌──────────────┐     ┌─────────────────┐
                    │ Background   │     │ WordPress.com   │
                    │ Auth Cache   │     │   OAuth/API     │
                    └──────────────┘     └─────────────────┘
```

## Current Project Structure

```
wordpress-reader-mcp/
├── mcp-server/                  # MCP server implementation
│   ├── src/
│   │   ├── index.ts            # MCP server entry point
│   │   ├── tools.ts            # 17 WordPress Reader API tools
│   │   ├── auth.ts             # Multi-layer authentication system
│   │   ├── wordpress-api.ts    # WordPress.com API client
│   │   └── logger.ts           # File-based logging (avoids MCP interference)
│   ├── dist/                   # Compiled JavaScript
│   └── package.json
├── web-app/                    # OAuth handler web application
│   ├── src/
│   │   ├── index.ts           # Express server
│   │   ├── auth.ts            # OAuth 2.0 PKCE implementation
│   │   ├── discovery.ts       # OAuth discovery endpoints
│   │   └── types.ts           # Local TypeScript interfaces
│   ├── dist/                  # Compiled JavaScript
│   └── package.json
├── setup.js                   # Automated setup script
├── service-manager.js          # Background service management
├── start-service.js           # Service wrapper for background execution
├── README.md                  # User documentation
├── QUICKSTART.md              # Quick start guide
└── SETUP_SUMMARY.md           # Setup process documentation
```

## Key Features Implemented

### 🔐 Authentication System (Multi-layered)
1. **Background Authentication** - Primary method using auth server
2. **Environment Token Fallback** - Direct WordPress token from environment
3. **JWT Validation** - Token validation through web app
4. **Request Metadata** - Token from Claude request context

### 🛠️ WordPress Reader API Tools (27 total)
- **Feed Management**: getReaderMenu, getFeed, getFollowingPosts, getLikedPosts
- **Blog Interaction**: followBlog, unfollowBlog, getFollowingFeeds, getRecommendations  
- **Tag Management**: getUserTags, subscribeToTag, unsubscribeFromTag, getTagPosts
- **Content Access**: getPost, getA8CPosts (Automattic company posts)
- **Notifications**: getNotifications, markNotificationsSeen, markNotificationsRead, getUnreadNotificationsCount
- **Comments**: getPostComments, getComment, createComment, replyToComment, likeComment, unlikeComment, getSiteComments, updateComment, deleteComment

### 🌐 Web Application Features
- **OAuth 2.0 PKCE Flow** - Secure authentication with WordPress.com
- **Multiple Endpoints**: `/auth/test`, `/auth/authorize`, `/auth/callback`, `/auth/token`, `/auth/validate`, `/auth/current-token`
- **Browser-friendly Interface** - Easy testing and authentication
- **JWT Token Management** - Secure token handling with expiration
- **CORS & Security** - Production-ready security configuration

### 🔄 Service Management System
- **Background Service** - Runs constantly for seamless authentication
- **Process Management** - Start, stop, restart, status, health checks
- **Cross-platform** - Works on Windows, macOS, Linux
- **Process Tree Cleanup** - Prevents orphaned processes and port conflicts
- **Auto-recovery** - Health monitoring with automatic restart
- **System Integration** - launchd (macOS) and systemd (Linux) support

### 🚀 Setup Automation
- **One-command Setup** - `npm run setup` does everything
- **Intelligent Detection** - Checks existing environment, Claude config
- **Dependency Management** - Installs and builds all components
- **Configuration Generation** - Creates environment files, Claude config
- **User-friendly** - Colored output, clear instructions, error handling

## Service Management Commands

```bash
# Quick service management
npm run service:start    # Start background auth service
npm run service:stop     # Stop background auth service  
npm run service:restart  # Restart service
npm run service:status   # Check if service is running
npm run service:health   # Verify service responds correctly
npm run service:logs     # View service logs

# Advanced service management
node service-manager.js auto-start    # Smart start (start if needed, restart if unhealthy)
node service-manager.js install       # Install as system service (optional)
```

## Environment Configuration

### Web App Environment (`web-app/.env`)
```bash
WORDPRESS_CLIENT_ID=your_client_id
WORDPRESS_CLIENT_SECRET=your_client_secret
REDIRECT_URI=http://localhost:3000/auth/callback
PORT=3000
JWT_SECRET=auto_generated_secure_string
```

### MCP Server Environment
- `AUTH_SERVER_URL=http://localhost:3000` (set in Claude config)
- Optional: `WORDPRESS_ACCESS_TOKEN` for direct token access

## Claude Desktop Configuration

Automatically added to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wordpress-reader": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "AUTH_SERVER_URL": "http://localhost:3000"
      }
    }
  }
}
```

## Authentication Flow

1. **First Time Setup**: User runs `npm run setup`
2. **WordPress OAuth**: Browser opens to authenticate with WordPress.com
3. **Token Storage**: OAuth tokens stored persistently in `.wp-auth-tokens.json`
4. **Background Service**: Auth service runs constantly on port 3000
5. **MCP Integration**: Claude Desktop connects to MCP server
6. **Tool Calls**: MCP server gets fresh tokens from auth service automatically
7. **Token Persistence**: Tokens survive web app restarts, no re-authentication needed
8. **API Calls**: Authenticated requests to WordPress.com Reader API

## Troubleshooting

### Common Issues & Solutions

1. **"Authentication required" in Claude**
   - Check: `npm run service:status`
   - Fix: `npm run service:restart`

2. **"Cannot GET /auth/test"**
   - Check: Web app build is current
   - Fix: `cd web-app && npm run build && cd .. && npm run service:restart`

3. **"EADDRINUSE: address already in use"**
   - Check: Port 3000 conflicts
   - Fix: `npm run service:stop` then `npm run service:start`

4. **Service won't stop properly**
   - Check: Process tree cleanup working
   - Fix: `lsof -ti:3000 | xargs kill -9` then restart

### Health Checks

```bash
# Verify everything is working
npm run service:health                    # Auth service health
curl http://localhost:3000/health         # Direct health check
curl http://localhost:3000/auth/test      # Test OAuth page
```

## WordPress.com Setup Requirements

1. **Create Application**: https://developer.wordpress.com/apps/
2. **Set Redirect URI**: `http://localhost:3000/auth/callback`
3. **Required Scopes**: `global` (provides Reader API access)
4. **Note Credentials**: Client ID and Client Secret for setup

## Usage in Claude Desktop

After setup, Claude can access comprehensive WordPress functionality:

```
"Show me my WordPress Reader feed"
"Get posts tagged with 'technology'"
"How many unread notifications do I have?"
"Follow the blog example.com"
"Get Automattic company posts"
"What blogs am I following?"
"Show me comments on this blog post"
"Reply to this comment"
"Like this comment"
"Get all comments on my site"
```

## Security Features

- **PKCE OAuth 2.0** - Prevents authorization code interception
- **JWT Tokens** - Secure token format with expiration
- **State Validation** - CSRF protection in OAuth flow
- **CORS Configuration** - Restricts cross-origin requests
- **Token Expiration** - Automatic cleanup of expired tokens
- **Process Isolation** - Background service runs independently

## Production Considerations

- **Token Storage**: File-based persistent storage (`.wp-auth-tokens.json`); Redis recommended for production scaling
- **Rate Limiting**: WordPress.com API has rate limits; consider implementing request throttling
- **Monitoring**: Service includes health checks; add metrics for production monitoring
- **Scaling**: Single-instance design; for scale, consider token sharing mechanisms
- **Security**: Token files are in .gitignore; ensure proper file permissions in production

## Recent Updates

- ✅ **Added comprehensive Comments API integration** - Full comment functionality including read, create, reply, like, and manage comments
- ✅ **Implemented persistent token storage** - Tokens survive web app restarts, eliminating redundant setup authentication
- ✅ Fixed service stop/restart functionality with proper process tree cleanup
- ✅ Fixed web app build structure and /auth/test endpoint accessibility  
- ✅ Implemented background service for constant authentication availability
- ✅ Added comprehensive error handling and cross-platform compatibility
- ✅ Created automated setup process with intelligent environment detection

## Project Status: Production Ready

All core functionality is implemented and tested. The system provides seamless WordPress.com Reader integration for Claude Desktop with robust authentication, comprehensive API coverage, and user-friendly setup automation.