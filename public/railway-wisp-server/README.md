# Wisp Server for Railway

WebSocket server for Ultraviolet proxy deployment on Railway.

## Quick Deploy

### 1. Create GitHub Repository

Create a new GitHub repository and upload these files:
- `package.json`
- `server.js`
- `railway.json`
- `nixpacks.toml`

### 2. Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect and deploy

### 3. Get Your Domain

1. Go to your deployed service in Railway
2. Click "Settings" → "Networking"
3. Click "Generate Domain" or add a custom domain
4. Copy the URL (e.g., `your-app.up.railway.app`)

### 4. Update Lovable Secret

In your Lovable project:
1. Go to Settings → Secrets
2. Update `WISP_SERVER_URL` to: `wss://your-app.up.railway.app`

## Health Check

Visit `https://your-domain/health` to verify the server is running.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT`   | 3000    | Server port (Railway sets this automatically) |

## Troubleshooting

### Build Fails
- Ensure all 4 files are in the repository root
- Check Railway build logs for specific errors

### WebSocket Not Connecting
- Verify the URL uses `wss://` (not `ws://`)
- Check browser console for connection errors
- Ensure Railway domain is generated/active
