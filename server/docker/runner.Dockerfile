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

# Switch to non-root user
USER appuser

# Expose ports for client (Vite) and server (Express)
EXPOSE 5173 3000

# Health check (optional, can be used to verify container is responsive)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node --version || exit 1

# Default command (will be overridden when running)
CMD ["/bin/sh"]
