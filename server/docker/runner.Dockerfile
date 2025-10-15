# Dockerfile for running generated apps in isolation
#
# This image provides a secure, isolated environment for executing
# AI-generated full-stack applications with resource limits and
# network isolation.

FROM node:22-alpine

# npm comes bundled with Node.js, no additional installation needed

# Create non-root user for security
RUN addgroup -g 1001 appuser && \
    adduser -D -u 1001 -G appuser appuser

# Set working directory
WORKDIR /app

# Change ownership of /app to appuser
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Health check (optional, can be used to verify container is responsive)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node --version || exit 1

# Default command (will be overridden when running)
CMD ["/bin/sh"]
