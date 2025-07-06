# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Salin file untuk instalasi dependensi
COPY package*.json nest-cli.json tsconfig*.json ./

# Instal pnpm
RUN npm install -g pnpm

# Instal dependensi dengan pnpm
RUN pnpm install

# Salin folder prisma dan generate Prisma client saat build
COPY prisma ./prisma
RUN npx prisma generate

# Salin semua source code
COPY . .

# Build aplikasi NestJS
RUN npx nest build

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Salin hasil build, node_modules, dan package.json dari builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Salin folder prisma
COPY --from=builder /app/prisma ./prisma

# Tentukan port
ENV PORT=8080
EXPOSE 8080

# Jalankan aplikasi
CMD ["node", "dist/src/main.js"]
