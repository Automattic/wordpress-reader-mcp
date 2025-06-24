# WordPress Reader for Claude Desktop

Connect your WordPress.com account to Claude Desktop and access your WordPress Reader, notifications, and more directly from Claude.

## ✨ What This Does

This tool allows you to use Claude Desktop to:

- 📖 **Read your WordPress feed** - See posts from blogs you follow
- 🔔 **Check notifications** - View comments, likes, and follows
- 🏷️ **Manage tags** - Subscribe/unsubscribe from topics
- 👥 **Manage follows** - Follow/unfollow blogs
- 🏢 **View A8C posts** - Get Automattic company updates
- ⭐ **Get recommendations** - Discover new blogs

## 🚀 Quick Setup (5 minutes)

### Step 1: Prerequisites

You need:
- A WordPress.com account
- Claude Desktop installed on your computer
- Node.js installed ([Download here](https://nodejs.org/))

### Step 2: Get Your WordPress.com App Credentials

1. Go to [WordPress.com Developer Apps](https://developer.wordpress.com/apps/)
2. Click "Create New Application"
3. Fill in:
   - **Name**: "Claude WordPress Reader" (or any name you like)
   - **Description**: "Personal WordPress Reader for Claude Desktop"
   - **Website URL**: `http://localhost:3000`
   - **Redirect URI**: `http://localhost:3000/auth/callback`
4. Click "Create"
5. Copy your **Client ID** and **Client Secret** (you'll need these in Step 4)

### Step 3: Run the Setup Script

Open Terminal (Mac/Linux) or Command Prompt (Windows) and run:

```bash
# Navigate to this folder
cd path/to/wordpress-reader-mcp

# Run the automated setup
npm run setup
```

The script will:
- Install all dependencies
- Set up your environment
- Build the applications
- Try to configure Claude Desktop automatically

### Step 4: Enter Your WordPress Credentials

When prompted, enter:
- Your WordPress.com Client ID (from Step 2)
- Your WordPress.com Client Secret (from Step 2)

### Step 5: Authenticate with WordPress.com

The setup will:
1. Start the authentication server
2. Open your browser to authenticate with WordPress.com
3. Configure everything automatically

### Step 6: Test in Claude Desktop

Restart Claude Desktop and try these commands:
- "Show me my WordPress Reader feed"
- "How many unread notifications do I have?"
- "Get posts from the technology tag"

## 🔧 Manual Setup (If Automatic Setup Fails)

If the automatic setup doesn't work, follow these manual steps:

### 1. Install Dependencies

```bash
# Install web app dependencies
cd web-app
npm install

# Install MCP server dependencies
cd ../mcp-server  
npm install

# Go back to root
cd ..
```

### 2. Configure Environment

Create `web-app/.env` file:
```
WORDPRESS_CLIENT_ID=your_client_id_here
WORDPRESS_CLIENT_SECRET=your_client_secret_here
REDIRECT_URI=http://localhost:3000/callback
PORT=3000
JWT_SECRET=your_random_secret_here
MCP_SERVER_URL=http://localhost:3001
```

### 3. Build Applications

```bash
cd web-app && npm run build
cd ../mcp-server && npm run build
cd ..
```

### 4. Configure Claude Desktop

Find your Claude Desktop config file:
- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

Add this to the `mcpServers` section:

```json
{
  "mcpServers": {
    "wordpress-reader": {
      "command": "node",
      "args": ["FULL_PATH_TO_THIS_FOLDER/mcp-server/dist/index.js"],
      "env": {
        "AUTH_SERVER_URL": "http://localhost:3000"
      }
    }
  }
}
```

Replace `FULL_PATH_TO_THIS_FOLDER` with the actual path to this folder.

### 5. Authenticate

```bash
# Start the authentication server
cd web-app && npm run dev
```

Open browser to `http://localhost:3000/auth/test` and complete WordPress.com login.

## 📖 Available Commands in Claude

Once set up, you can use these natural language commands in Claude Desktop:

### Reader Feed
- "Show me my WordPress Reader feed"
- "Get the latest 10 posts from my feed"
- "Show me posts from today"

### Notifications
- "Check my WordPress notifications"
- "How many unread notifications do I have?"
- "Show me only comment notifications"
- "Mark my notifications as read"

### Tags & Topics
- "Show me posts tagged with 'technology'"
- "Subscribe me to the 'design' tag"
- "What tags am I following?"

### Blog Management
- "Show me blogs I'm following"
- "Follow the blog example.com"
- "Get blog recommendations for me"

### Automattic Content
- "Show me recent A8C posts"
- "Get Automattic company updates"

## 🔍 Troubleshooting

### "No tools available" or "Authentication required"
1. Make sure both web-app and MCP server are running
2. Complete the authentication at `http://localhost:3000/auth/test`
3. Restart Claude Desktop

### "Command not found: npm"
Install Node.js from [nodejs.org](https://nodejs.org/)

### "Permission denied" errors
Try running with `sudo` on Mac/Linux or "Run as Administrator" on Windows

### Authentication not working
1. Check your WordPress.com app credentials
2. Make sure redirect URI is exactly `http://localhost:3000/auth/callback`
3. Check that web-app is running on port 3000

### Claude Desktop not recognizing tools
1. Check the config file path is correct
2. Make sure the path to `index.js` is absolute (full path)
3. Restart Claude Desktop completely

## 🛠️ Advanced Usage

### Running Services Manually

Start authentication server:
```bash
cd web-app && npm run dev
```

The MCP server starts automatically when Claude Desktop loads.

### Viewing Logs

MCP server logs are in: `mcp-server/mcp-server.log`

### Environment Variables

You can set these in your shell:
- `DEBUG=true` - Enable debug logging
- `NODE_ENV=development` - Development mode

## 🔒 Security & Privacy

- Your WordPress.com credentials are stored locally only
- Authentication tokens are cached securely
- No data is sent to third parties
- All communication is encrypted (HTTPS/TLS)

## 📞 Support

If you need help:

1. Check the troubleshooting section above
2. Look for error messages in the terminal
3. Check the MCP server logs
4. Ensure your WordPress.com app is configured correctly

## 🎉 Enjoy!

You now have full WordPress.com integration in Claude Desktop. Explore your feeds, manage notifications, and discover new content all through natural conversation with Claude!