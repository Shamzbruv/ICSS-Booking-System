FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Platform Console imports these shared admin UI modules from /app/public.
# Include them in the frontend stage as well as the final runtime image.
COPY public/js/mobile-navigation.js public/js/page-help.js /app/public/js/
COPY public/css/mobile-navigation.css public/css/page-help.css /app/public/css/
RUN npm run build

FROM node:20-alpine AS backend
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

RUN mkdir -p /app/data/pdfs

RUN addgroup -S icss && adduser -S icss -G icss
USER icss

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1

CMD ["node", "server/app.js"]
