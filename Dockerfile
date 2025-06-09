# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Instal PNPM secara global
RUN npm install -g pnpm

# Salin file untuk instalasi dependensi
# PASTIKAN pnpm-lock.yaml SUDAH ADA SEBELUM BUILD IMAGE INI
COPY package.json pnpm-lock.yaml nest-cli.json tsconfig*.json ./

# Instal dependensi dengan PNPM
RUN pnpm install --frozen-lockfile

# Salin folder prisma dan generate Prisma client saat build
COPY prisma ./prisma
RUN pnpm exec prisma generate

# Salin semua source code
COPY . .

# Build aplikasi NestJS dengan PNPM
RUN pnpm run build

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Instal PNPM secara global di runtime stage juga
RUN npm install -g pnpm

# Salin package.json dan pnpm-lock.yaml dari builder
COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./

# Salin hasil build dari builder
COPY --from=builder /app/dist ./dist

# Salin folder prisma dari builder
COPY --from=builder /app/prisma ./prisma

# Instal HANYA dependensi produksi
RUN pnpm install --prod --frozen-lockfile

# Tentukan port
ENV PORT=8080
EXPOSE 8080

# Jalankan aplikasi
# Pastikan Prisma client (jika ada di node_modules) juga tersedia untuk runtime
# Jika Prisma client tidak di-bundle, pastikan `pnpm install --prod` menyertakannya
# atau Anda mungkin perlu menyalinnya secara eksplisit dari /app/node_modules/.prisma/client di builder stage.
CMD ["node", "dist/src/main.js"]
