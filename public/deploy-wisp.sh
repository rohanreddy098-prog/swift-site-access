#!/bin/bash

# ============================================
# Wisp Server VPS Auto-Install Script
# For Ultraviolet Proxy Backend
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Variables
INSTALL_DIR="/var/www/wisp-server"
PORT=8080

print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║         Wisp Server VPS Auto-Install Script               ║"
    echo "║              For Ultraviolet Proxy                        ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_root() {
    if [ "$EUID" -ne 0 ]; then
        print_error "Please run as root: sudo $0"
        exit 1
    fi
}

get_config() {
    echo ""
    read -p "Enter your domain (e.g., wisp.yourdomain.com): " DOMAIN
    read -p "Enter your email (for SSL certificate): " EMAIL
    read -p "Enable SSL with Let's Encrypt? (y/n) [y]: " ENABLE_SSL
    ENABLE_SSL=${ENABLE_SSL:-y}
    echo ""
    
    print_status "Configuration:"
    echo "  Domain: $DOMAIN"
    echo "  Email: $EMAIL"
    echo "  SSL: $ENABLE_SSL"
    echo ""
    
    read -p "Continue with these settings? (y/n): " CONFIRM
    if [ "$CONFIRM" != "y" ]; then
        print_error "Aborted by user"
        exit 1
    fi
}

install_dependencies() {
    print_status "Updating system packages..."
    apt update && apt upgrade -y
    
    print_status "Installing dependencies..."
    apt install -y curl git nginx ufw
    
    if [ "$ENABLE_SSL" = "y" ]; then
        apt install -y certbot python3-certbot-nginx
    fi
    
    print_success "Dependencies installed"
}

install_nodejs() {
    print_status "Installing Node.js 20.x..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 20 ]; then
            print_success "Node.js $(node -v) already installed"
        else
            print_warning "Upgrading Node.js..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt install -y nodejs
        fi
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt install -y nodejs
    fi
    
    print_status "Installing PM2..."
    npm install -g pm2
    
    print_success "Node.js $(node -v) and PM2 installed"
}

create_wisp_server() {
    print_status "Creating Wisp server..."
    
    mkdir -p $INSTALL_DIR
    cd $INSTALL_DIR
    
    # Create package.json - minimal dependencies
    cat > package.json << 'PACKAGE_EOF'
{
  "name": "wisp-server",
  "version": "1.0.0",
  "description": "Wisp WebSocket server for Ultraviolet proxy",
  "type": "module",
  "scripts": {},
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "wisp-server-node": "^1.1.4"
  }
}
PACKAGE_EOF

    # Create server.js - minimal server
    cat > server.js << 'SERVER_EOF'
import { createServer } from "node:http";
import { routeRequest } from "wisp-server-node";

const PORT = process.env.PORT || 8080;

const server = createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ 
      status: "ok", 
      server: "wisp",
      timestamp: new Date().toISOString() 
    }));
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

// Handle WebSocket upgrades for Wisp
server.on("upgrade", (req, socket, head) => {
  routeRequest(req, socket, head);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✓ Wisp server running on port ${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log(`✓ WebSocket ready for connections`);
});
SERVER_EOF

    print_status "Installing npm packages..."
    npm install
    
    print_success "Wisp server created"
}

configure_pm2() {
    print_status "Configuring PM2..."
    
    cd $INSTALL_DIR
    
    # Create PM2 ecosystem file
    cat > ecosystem.config.cjs << 'PM2_EOF'
module.exports = {
  apps: [{
    name: "wisp-server",
    script: "server.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "500M",
    env: {
      NODE_ENV: "production",
      PORT: 8080
    },
    error_file: "/var/log/wisp/error.log",
    out_file: "/var/log/wisp/output.log",
    log_file: "/var/log/wisp/combined.log",
    time: true
  }]
};
PM2_EOF

    # Create log directory
    mkdir -p /var/log/wisp
    
    # Stop existing if running
    pm2 delete wisp-server 2>/dev/null || true
    
    # Start with PM2
    pm2 start ecosystem.config.cjs
    pm2 startup systemd -u root --hp /root
    pm2 save
    
    print_success "PM2 configured and server started"
}

configure_nginx() {
    print_status "Configuring Nginx..."
    
    cat > /etc/nginx/sites-available/wisp << NGINX_EOF
server {
    listen 80;
    server_name $DOMAIN;

    # WebSocket location for Wisp
    location /wisp/ {
        proxy_pass http://127.0.0.1:$PORT/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 60s;
        
        # Disable buffering for WebSocket
        proxy_buffering off;
        proxy_cache off;
    }

    # Root and health check
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        
        # CORS headers
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
    }
}
NGINX_EOF

    # Enable site
    ln -sf /etc/nginx/sites-available/wisp /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test and reload
    nginx -t
    systemctl reload nginx
    
    print_success "Nginx configured"
}

configure_ssl() {
    if [ "$ENABLE_SSL" = "y" ]; then
        print_status "Setting up SSL with Let's Encrypt..."
        certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --non-interactive --redirect
        print_success "SSL configured"
    else
        print_warning "SSL skipped - using HTTP only"
    fi
}

configure_firewall() {
    print_status "Configuring firewall..."
    
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow http
    ufw allow https
    ufw --force enable
    
    print_success "Firewall configured"
}

verify_installation() {
    print_status "Verifying installation..."
    
    sleep 3
    
    # Check if server is running
    if pm2 list | grep -q "wisp-server"; then
        print_success "PM2 process running"
    else
        print_error "PM2 process not found"
    fi
    
    # Check health endpoint
    if curl -s http://localhost:$PORT/health | grep -q "ok"; then
        print_success "Health endpoint responding"
    else
        print_warning "Health endpoint not responding yet"
    fi
    
    # Check nginx
    if systemctl is-active --quiet nginx; then
        print_success "Nginx running"
    else
        print_error "Nginx not running"
    fi
}

print_summary() {
    echo ""
    echo -e "${GREEN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║         Wisp Server Installed Successfully!               ║"
    echo "╠═══════════════════════════════════════════════════════════╣"
    
    if [ "$ENABLE_SSL" = "y" ]; then
        WISP_URL="wss://$DOMAIN/wisp/"
        HEALTH_URL="https://$DOMAIN/health"
    else
        WISP_URL="ws://$DOMAIN/wisp/"
        HEALTH_URL="http://$DOMAIN/health"
    fi
    
    echo "║                                                           ║"
    echo "║  Add this to your Lovable project secrets:                ║"
    echo "║                                                           ║"
    echo -e "║  ${CYAN}VITE_WISP_SERVER_URL${GREEN} = ${CYAN}$WISP_URL${GREEN}"
    echo "║                                                           ║"
    echo "╠═══════════════════════════════════════════════════════════╣"
    echo -e "║  Health Check: ${CYAN}$HEALTH_URL${GREEN}"
    echo "╠═══════════════════════════════════════════════════════════╣"
    echo "║  Useful Commands:                                         ║"
    echo "║    pm2 list        - View running processes               ║"
    echo "║    pm2 logs        - View server logs                     ║"
    echo "║    pm2 restart all - Restart server                       ║"
    echo "║    pm2 monit       - Real-time monitoring                 ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Save connection info to file
    cat > /root/WISP_CONNECTION_INFO.txt << EOF
Wisp Server Connection Information
===================================
Date: $(date)
Domain: $DOMAIN

VITE_WISP_SERVER_URL: $WISP_URL
Health Check: $HEALTH_URL

Useful Commands:
  pm2 list        - View running processes
  pm2 logs        - View server logs
  pm2 restart all - Restart server
  pm2 monit       - Real-time monitoring
  
Test WebSocket:
  curl $HEALTH_URL
EOF
    
    print_success "Connection info saved to /root/WISP_CONNECTION_INFO.txt"
}

# Main execution
main() {
    print_banner
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

main
