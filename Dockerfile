# Multi-stage build for Next.js
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy web application
COPY . .

# Install dependencies
RUN npm install --legacy-peer-deps

# Build application (standalone output for Docker)
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install dumb-init and wget
RUN apk add --no-cache dumb-init wget

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy public directory if it exists (optional)
# Note: Since there's no public directory in this app, we skip it

# Ensure Next.js listens on all interfaces (required for Docker healthcheck)
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check - use wget (Coolify recommends curl/wget over Node.js for reliability)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Start application
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]