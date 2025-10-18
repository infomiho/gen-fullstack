# Dockerfile for running generated full-stack apps in isolation
#
# This image provides a secure, isolated environment for executing
# AI-generated full-stack applications (client + server + database)
# with resource limits and network isolation.

FROM node:22-alpine

# Install Prisma CLI globally for database migrations
RUN npm install -g prisma@6.10.0

# Create non-root user for security
RUN addgroup -g 1001 appuser && \
    adduser -D -u 1001 -G appuser appuser

# Set working directory
WORKDIR /app

# Change ownership of /app to appuser
RUN chown -R appuser:appuser /app

# Switch to non-root user BEFORE cache warming so cache is in appuser's home
USER appuser

# Pre-populate npm cache with common dependencies to speed up installs
# This creates a dummy package.json with all typical dependencies,
# installs them to populate the cache, then removes the files but keeps the cache.
#
# PERFORMANCE BENEFIT: Reduces npm install time from ~60s to ~10-15s for typical apps
# by serving packages from Docker layer cache instead of downloading from npm registry.
# IMPORTANT: This runs as appuser so the cache is in /home/appuser/.npm (accessible at runtime)
RUN mkdir -p /tmp/npm-cache && cd /tmp/npm-cache && \
    # Create package.json with all common dependencies
    echo '{ \
      "name": "npm-cache-warmer", \
      "private": true, \
      "workspaces": ["client", "server"], \
      "devDependencies": { \
        "concurrently": "^9.2.1", \
        "prisma": "^6.10.0" \
      } \
    }' > package.json && \
    # Create client workspace with typical React dependencies
    mkdir -p client && cd client && \
    echo '{ \
      "name": "client", \
      "type": "module", \
      "dependencies": { \
        "react": "^19.2.0", \
        "react-dom": "^19.2.0" \
      }, \
      "devDependencies": { \
        "@types/react": "^19.2.2", \
        "@types/react-dom": "^19.2.2", \
        "@vitejs/plugin-react": "^5.0.4", \
        "typescript": "~5.9.3", \
        "vite": "^7.1.9" \
      } \
    }' > package.json && cd .. && \
    # Create server workspace with typical Express dependencies
    mkdir -p server && cd server && \
    echo '{ \
      "name": "server", \
      "type": "module", \
      "dependencies": { \
        "@prisma/client": "^6.10.0", \
        "express": "^5.1.0", \
        "cors": "^2.8.5" \
      }, \
      "devDependencies": { \
        "@types/express": "^5.0.0", \
        "@types/cors": "^2.8.17", \
        "@types/node": "^22.10.2", \
        "tsx": "^4.19.2", \
        "typescript": "~5.9.3" \
      } \
    }' > package.json && cd .. && \
    # Install all dependencies to populate npm cache (this is the key step!)
    npm install --prefer-offline=false && \
    # Clean up the temp directory but keep the npm cache
    cd / && rm -rf /tmp/npm-cache

# Expose ports for client (Vite) and server (Express)
EXPOSE 5173 3000

# Health check (optional, can be used to verify container is responsive)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node --version || exit 1

# Default command (will be overridden when running)
CMD ["/bin/sh"]
