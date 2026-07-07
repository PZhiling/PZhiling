# Build stage: install all deps and build the client + server bundle
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: pure-JS runtime deps only (see package.json dependencies)
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# Cloud Run injects PORT (defaults to 8080); server.ts reads process.env.PORT
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
