# NetApp ONTAP MCP Demo UI - Docker Image
# Nginx-based static file server for the demo web interface

FROM nginx:alpine

# Metadata labels
LABEL maintainer="NetApp ONTAP MCP"
LABEL description="NetApp ONTAP MCP Demo UI - BlueXP-style web interface"
LABEL version="1.0.0"

# Copy demo files to nginx html directory
COPY index.html /usr/share/nginx/html/
COPY styles-new.css /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/
COPY js/ /usr/share/nginx/html/js/

# Copy example configuration files
COPY clusters.json.example /usr/share/nginx/html/
COPY mcp.json.example /usr/share/nginx/html/

# Copy nginx configuration for SPA routing
RUN echo 'server { \
    listen 8080; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Enable CORS for MCP API calls \
    add_header Access-Control-Allow-Origin *; \
    \
    # SPA fallback \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Prevent caching of HTML \
    location ~* \.html$ { \
        add_header Cache-Control "no-store, no-cache, must-revalidate"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080 || exit 1

CMD ["nginx", "-g", "daemon off;"]
