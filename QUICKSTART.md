# ⚡ Quick Start - WordPress Reader for Claude

## 🚀 Super Simple Setup (2 commands)

### 1. Create WordPress.com App (1 minute)

1. Go to [WordPress.com Apps](https://developer.wordpress.com/apps/)
2. Click "Create New Application"  
3. Set **Redirect URI** to: `http://localhost:3000/auth/callback`
4. Copy your **Client ID** and **Client Secret**

### 2. Run Setup (runs everything automatically)

```bash
npm run setup
```

That's it! 🎉

The setup script will:
- ✅ Install everything needed
- ✅ Ask for your WordPress credentials  
- ✅ Build all applications
- ✅ Configure Claude Desktop automatically
- ✅ Open browser for WordPress authentication
- ✅ Start background authentication service

## 🧪 Test It Works

Restart Claude Desktop and try:
- *"Show me my WordPress Reader feed"*
- *"How many unread notifications do I have?"*
- *"Get posts tagged with technology"*

## 🔧 Service Management

The setup automatically starts a background service for authentication. If needed:

```bash
# Check if service is running
npm run service:status

# Restart service if having issues
npm run service:restart

# View service logs
npm run service:logs
```

## 🆘 If Something Goes Wrong

**Common fixes:**
1. Check service status: `npm run service:status`
2. Restart service: `npm run service:restart`
3. Run manual setup: see [README.md](README.md)

---

**Need help?** Check the full [README.md](README.md) for detailed instructions and troubleshooting.