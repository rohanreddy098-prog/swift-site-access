#!/bin/bash

#############################################
# Wisp Server Automated VPS Deployment Script
# For Ultraviolet Proxy Backend
#############################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print colored output
print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_header() { 
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN} $1${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Get user configuration
get_config() {
    print_header "Wisp Server Configuration"
    
    read -p "Enter your domain name (e.g., wisp.example.com): " DOMAIN
    if [[ -z "$DOMAIN" ]]; then
        print_error "Domain name is required"
        exit 1
    fi
    
    read -p "Enter your email for SSL certificates: " EMAIL
    if [[ -z "$EMAIL" ]]; then
        print_error "Email is required for SSL certificates"
        exit 1
    fi
    
    read -p "Enable SSL with Let's Encrypt? (y/n) [y]: " ENABLE_SSL
    ENABLE_SSL=${ENABLE_SSL:-y}
    
    read -p "Server port (default: 8080): " PORT
    PORT=${PORT:-8080}
    
    echo ""
    print_status "Configuration Summary:"
    echo "  Domain: $DOMAIN"
    echo "  Email: $EMAIL"
    echo "  SSL: $ENABLE_SSL"
    echo "  Port: $PORT"
    echo ""
    
    read -p "Proceed with installation? (y/n): " CONFIRM
    if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
        print_warning "Installation cancelled"
        exit 0
    fi
}

# Update system and install dependencies
install_dependencies() {
    print_header "Installing System Dependencies"
    
    print_status "Updating system packages..."
    apt-get update -y
    apt-get upgrade -y
    
    print_status "Installing required packages..."
    apt-get install -y curl git build-essential nginx certbot python3-certbot-nginx ufw
    
    print_success "System dependencies installed"
}

# Install Node.js 20.x
install_nodejs() {
    print_header "Installing Node.js 20.x"
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        print_status "Node.js already installed: $NODE_VERSION"
        
        # Check if it's version 18+
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | tr -d 'v')
        if [[ $MAJOR_VERSION -lt 18 ]]; then
            print_warning "Node.js version is too old, upgrading..."
        else
            print_success "Node.js version is compatible"
            return
        fi
    fi
    
    print_status "Installing Node.js 20.x from NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    
    print_status "Installing PM2 globally..."
    npm install -g pm2
    
    print_success "Node.js $(node -v) and PM2 installed"
}

# Create Wisp server application
create_wisp_server() {
    print_header "Creating Wisp Server Application"
    
    SERVER_DIR="/var/www/wisp-server"
    
    print_status "Creating server directory: $SERVER_DIR"
    mkdir -p $SERVER_DIR
    cd $SERVER_DIR
    
    print_status "Creating package.json..."
    cat > package.json << 'EOF'
{
  "name": "wisp-server",
  "version": "1.0.0",
  "description": "Ultraviolet Wisp Server for Proxy",
  "main": "server.js",
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "express": "^4.18.2",
    "@titaniumnetwork-dev/ultraviolet": "^3.2.6",
    "ultraviolet-static": "^1.0.10",
    "@mercuryworkshop/epoxy-transport": "^2.1.4",
    "@mercuryworkshop/bare-mux": "^2.0.6",
    "wisp-server-node": "^1.1.4"
  }
}
EOF

    print_status "Creating server.js..."
    cat > server.js << 'SERVEREOF'
import express from "express";
import { createServer } from "http";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import wisp from "wisp-server-node";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 8080;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(",") 
  : ["*"];

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin || "*");
  }
  
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.header("Access-Control-Allow-Credentials", "true");
  
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({ 
    name: "Wisp Server",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/health",
      wisp: "/wisp/"
    }
  });
});

// Serve UV static files
try {
  const uvPath = dirname(fileURLToPath(import.meta.resolve("@titaniumnetwork-dev/ultraviolet")));
  app.use("/uv/", express.static(uvPath));
} catch (e) {
  console.warn("[WARN] UV static files not available:", e.message);
}

// Serve Epoxy static files
try {
  const epoxyPath = dirname(fileURLToPath(import.meta.resolve("@mercuryworkshop/epoxy-transport")));
  app.use("/epoxy/", express.static(epoxyPath));
} catch (e) {
  console.warn("[WARN] Epoxy static files not available:", e.message);
}

// Serve BareMux static files
try {
  const bareMuxPath = dirname(fileURLToPath(import.meta.resolve("@mercuryworkshop/bare-mux")));
  app.use("/baremux/", express.static(bareMuxPath));
} catch (e) {
  console.warn("[WARN] BareMux static files not available:", e.message);
}

// Handle WebSocket upgrade for Wisp
server.on("upgrade", (req, socket, head) => {
  if (req.url && req.url.startsWith("/wisp/")) {
    wisp.routeRequest(req, socket, head);
  } else {
    socket.end();
  }
});

// Start server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                  Wisp Server Started                       ║
╠═══════════════════════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(50)}║
║  Health: http://localhost:${PORT}/health                     ║
║  Wisp:   ws://localhost:${PORT}/wisp/                        ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
SERVEREOF

    print_status "Installing npm dependencies..."
    npm install
    
    print_success "Wisp server application created"
}

# Configure PM2
configure_pm2() {
    print_header "Configuring PM2 Process Manager"
    
    cd /var/www/wisp-server
    
    print_status "Creating PM2 ecosystem file..."
    cat > ecosystem.config.cjs << EOF
module.exports = {
  apps: [{
    name: "wisp-server",
    script: "server.js",
    cwd: "/var/www/wisp-server",
    instances: 1,
    exec_mode: "fork",
    env: {
      NODE_ENV: "production",
      PORT: $PORT
    },
    error_file: "/var/log/wisp-server/error.log",
    out_file: "/var/log/wisp-server/out.log",
    log_file: "/var/log/wisp-server/combined.log",
    time: true,
    max_memory_restart: "500M",
    restart_delay: 1000,
    autorestart: true,
    watch: false
  }]
};
EOF

    print_status "Creating log directory..."
    mkdir -p /var/log/wisp-server
    
    print_status "Starting Wisp server with PM2..."
    pm2 delete wisp-server 2>/dev/null || true
    pm2 start ecosystem.config.cjs
    
    print_status "Configuring PM2 startup..."
    pm2 startup systemd -u root --hp /root
    pm2 save
    
    print_success "PM2 configured and server started"
}

# Configure Nginx
configure_nginx() {
    print_header "Configuring Nginx Reverse Proxy"
    
    print_status "Creating Nginx configuration..."
    cat > /etc/nginx/sites-available/wisp << EOF
# Wisp Server Nginx Configuration
# Domain: $DOMAIN

upstream wisp_backend {
    server 127.0.0.1:$PORT;
    keepalive 64;
}

server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/wisp-access.log;
    error_log /var/log/nginx/wisp-error.log;

    # Health check endpoint
    location /health {
        proxy_pass http://wisp_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Wisp WebSocket endpoint
    location /wisp/ {
        proxy_pass http://wisp_backend;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Timeouts for long-lived connections
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 60s;
        
        # Buffer settings
        proxy_buffering off;
        proxy_buffer_size 8k;
    }

    # Static files and other endpoints
    location / {
        proxy_pass http://wisp_backend;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # CORS headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With" always;
        
        if (\$request_method = OPTIONS) {
            return 204;
        }
    }
}
EOF

    print_status "Enabling Nginx site..."
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
    ln -sf /etc/nginx/sites-available/wisp /etc/nginx/sites-enabled/
    
    print_status "Testing Nginx configuration..."
    nginx -t
    
    print_status "Reloading Nginx..."
    systemctl reload nginx
    
    print_success "Nginx configured"
}

# Configure SSL with Let's Encrypt
configure_ssl() {
    if [[ "$ENABLE_SSL" != "y" && "$ENABLE_SSL" != "Y" ]]; then
        print_warning "Skipping SSL configuration"
        return
    fi
    
    print_header "Configuring SSL with Let's Encrypt"
    
    print_status "Obtaining SSL certificate..."
    certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --non-interactive --redirect
    
    print_status "Testing certificate renewal..."
    certbot renew --dry-run
    
    print_success "SSL configured with auto-renewal"
}

# Configure firewall
configure_firewall() {
    print_header "Configuring Firewall (UFW)"
    
    print_status "Setting up firewall rules..."
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow http
    ufw allow https
    ufw --force enable
    
    print_status "Firewall status:"
    ufw status verbose
    
    print_success "Firewall configured"
}

# Verify installation
verify_installation() {
    print_header "Verifying Installation"
    
    print_status "Checking Node.js..."
    node -v
    
    print_status "Checking PM2 processes..."
    pm2 list
    
    print_status "Checking Nginx status..."
    systemctl status nginx --no-pager -l
    
    print_status "Testing local health endpoint..."
    sleep 2
    curl -s http://localhost:$PORT/health | head -c 200
    echo ""
    
    print_success "Installation verified"
}

# Print final summary
print_summary() {
    print_header "Installation Complete!"
    
    PROTOCOL="http"
    if [[ "$ENABLE_SSL" == "y" || "$ENABLE_SSL" == "Y" ]]; then
        PROTOCOL="https"
    fi
    
    WSS_PROTOCOL="ws"
    if [[ "$ENABLE_SSL" == "y" || "$ENABLE_SSL" == "Y" ]]; then
        WSS_PROTOCOL="wss"
    fi
    
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              Wisp Server Deployed Successfully!               ║${NC}"
    echo -e "${GREEN}╠═══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║${NC}                                                               ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${CYAN}Server URLs:${NC}                                                ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  • Health Check: ${PROTOCOL}://${DOMAIN}/health                  ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  • Wisp Server:  ${WSS_PROTOCOL}://${DOMAIN}/wisp/                   ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                               ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${CYAN}For your Lovable app, set this secret:${NC}                      ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  VITE_WISP_SERVER_URL = ${WSS_PROTOCOL}://${DOMAIN}/wisp/            ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                               ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  ${CYAN}Useful Commands:${NC}                                             ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  • View logs:     pm2 logs wisp-server                        ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  • Restart:       pm2 restart wisp-server                     ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  • Stop:          pm2 stop wisp-server                        ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  • Status:        pm2 status                                  ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}  • Nginx logs:    tail -f /var/log/nginx/wisp-*.log           ${GREEN}║${NC}"
    echo -e "${GREEN}║${NC}                                                               ${GREEN}║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Save connection info to file
    cat > /var/www/wisp-server/CONNECTION_INFO.txt << EOF
Wisp Server Connection Information
===================================
Generated: $(date)

Health Check URL: ${PROTOCOL}://${DOMAIN}/health
Wisp Server URL:  ${WSS_PROTOCOL}://${DOMAIN}/wisp/

For Lovable App Secret:
VITE_WISP_SERVER_URL = ${WSS_PROTOCOL}://${DOMAIN}/wisp/

Server Directory: /var/www/wisp-server
Log Directory:    /var/log/wisp-server

PM2 Commands:
  pm2 logs wisp-server    - View logs
  pm2 restart wisp-server - Restart server
  pm2 stop wisp-server    - Stop server
  pm2 status              - Check status
EOF

    print_status "Connection info saved to /var/www/wisp-server/CONNECTION_INFO.txt"
}

# Main execution
main() {
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║          Wisp Server VPS Deployment Script v1.0               ║${NC}"
    echo -e "${CYAN}║                                                               ║${NC}"
    echo -e "${CYAN}║  This script will install and configure:                      ║${NC}"
    echo -e "${CYAN}║  • Node.js 20.x                                               ║${NC}"
    echo -e "${CYAN}║  • PM2 Process Manager                                        ║${NC}"
    echo -e "${CYAN}║  • Nginx Reverse Proxy                                        ║${NC}"
    echo -e "${CYAN}║  • Let's Encrypt SSL (optional)                               ║${NC}"
    echo -e "${CYAN}║  • UFW Firewall                                               ║${NC}"
    echo -e "${CYAN}║  • Wisp Server for Ultraviolet Proxy                          ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    check_root
    get_config
    install_dependencies
    install_nodejs
    create_wisp_server
    configure_pm2
    configure_nginx
    configure_ssl
    configure_firewall
    verify_installation
    print_summary
}

# Run main function
main "$@"
