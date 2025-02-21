# Stage 1: Builder
FROM node:20-alpine AS builder

# Tentukan working directory
WORKDIR /app

# Salin file yang diperlukan untuk instalasi dependensi
COPY package*.json nest-cli.json tsconfig*.json ./

# Instal dependensi
RUN npm install --only=production

# Jika menggunakan Prisma, salin folder prisma dan generate client
COPY prisma ./prisma
#RUN npx prisma generate

# Salin semua file source code
COPY . .

# Build aplikasi menggunakan NestJS CLI
RUN npx nest build

# Hapus file yang tidak diperlukan
RUN rm -rf .env src

# Stage 2: Runtime
FROM node:20-alpine

# Tentukan working directory
WORKDIR /app

# Salin hasil build dari stage builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Tentukan port yang digunakan oleh aplikasi
ENV PORT=8080
EXPOSE 8080

# Jalankan aplikasi
CMD ["node", "dist/main.js"]