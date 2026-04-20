FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

# Create data directory for any local file storage
RUN mkdir -p /app/data/pdfs

# Non-root user for security
RUN addgroup -S icss && adduser -S icss -G icss
USER icss

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server/app.js"]
