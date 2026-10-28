# --- Build stage: compiles TypeScript with dev dependencies ---
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Runtime stage: only production dependencies and compiled code ---
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Run as the unprivileged user shipped with the node image.
USER node

EXPOSE 3001

CMD ["node", "dist/index.js"]
