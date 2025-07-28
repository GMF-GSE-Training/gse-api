# GMF GSE Training Backend

<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="100" alt="Nest Logo" />
</p>

<p align="center">
  Aplikasi *backend* untuk <b>GMF GSE Training</b>, dibangun dengan <b>NestJS</b> dan terhubung ke <b>PostgreSQL</b>.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nestjs/core" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/package/@nestjs/core" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
  <a href="https://www.npmjs.com/package/@nestjs/common" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
</p>

---

## Deskripsi Proyek

Repositori ini berisi kode *backend* untuk aplikasi 'GMF GSE Training', dibangun menggunakan framework NestJS dan terhubung ke database PostgreSQL. Backend ini menyediakan API untuk manajemen pengguna, autentikasi, otorisasi berbasis peran, serta fitur pelatihan dan sertifikasi.

## Fitur Utama

- **Autentikasi & Otorisasi:** JWT, refresh token, verifikasi email, reset password, dan otorisasi berbasis peran.
- **Manajemen Pengguna & Peran:** CRUD pengguna dan peran (super admin, supervisor, lcu, user).
- **Integrasi Database:** Prisma ORM untuk PostgreSQL.
- **Sistem Notifikasi:** Email untuk verifikasi akun dan reset password.
- **Manajemen Dokumen:** Upload/download dokumen dan sertifikat.
- **Logging:** Winston untuk pemantauan aplikasi.

## Struktur Proyek

```
backend/
├── src/
│   ├── auth/              # Modul autentikasi & otorisasi
│   ├── common/            # Modul umum (Prisma, Validation, Logging)
│   ├── capability/        # Manajemen kapabilitas
│   ├── certificate/       # Manajemen sertifikat
│   ├── config/            # Konfigurasi aplikasi
│   ├── cot/               # Calendar Of Training (COT)
│   ├── curriculum-syllabus/# Kurikulum & silabus
│   ├── e-sign/            # Tanda tangan elektronik
│   ├── mail/              # Pengiriman email
│   ├── participant/       # Manajemen peserta
│   ├── participant-cot/   # Peserta COT
│   ├── role/              # Manajemen peran
│   ├── shared/            # Modul & layanan bersama
│   ├── user/              # Manajemen pengguna
│   └── main.ts            # Entry point aplikasi
├── prisma/                # Skema & migrasi database
├── public/                # File statis (QR code, sertifikat)
├── uploads/               # File upload
├── .env.example           # Contoh konfigurasi lingkungan
├── pnpm-lock.yaml         # Lock file dependensi
└── package.json           # Definisi proyek & skrip
```

## Instalasi

1. Pastikan [pnpm](https://pnpm.io/installation) sudah terpasang.
2. Jalankan:

```bash
pnpm install
```

## Konfigurasi Lingkungan (`.env`)

Buat file `.env` di direktori `backend/` berdasarkan `.env.example`. Jangan gunakan data asli pada file ini. Contoh:

```
DATABASE_URL="postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DB>?pgbouncer=true"
NODE_ENV=development
PROTOCOL=http
HOST=0.0.0.0
PORT=3000
FRONTEND_URL=https://frontend.example.com
CORS_ORIGIN=http://localhost:4200,https://frontend.example.com
BACKEND_URL=https://api.example.com
ACCESS_TOKEN=<ACCESS_TOKEN>
REFRESH_TOKEN=<REFRESH_TOKEN>
VERIFICATION_TOKEN=<VERIFICATION_TOKEN>
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=<MAIL_USER>
MAIL_PASS=<MAIL_PASS>
APP_NAME="Admin GMF GSE Training"
```

**Catatan:**
- Jangan pernah commit file `.env` yang berisi data asli.
- Gunakan variabel dummy pada contoh.
- Untuk deployment production, sesuaikan domain dan kredensial.

## Migrasi & Seeding Database

```bash
pnpm prisma migrate deploy
pnpm run seed
```

**📚 Dokumentasi Lengkap:**
- [Database Seeding Guide](./docs/database-seeding.md) - Panduan lengkap seeding dengan cross-platform support
- [Windows Troubleshooting](./docs/windows-troubleshooting.md) - Solusi masalah upload Supabase di Windows

## Menjalankan Aplikasi

```bash
# Development
pnpm run start

# Watch mode (hot-reloading)
pnpm run start:dev

# Production mode
pnpm run start:prod
```

## Testing

```bash
# Unit tests
pnpm run test

# E2E tests
pnpm run test:e2e

# Test coverage
pnpm run test:cov
```

## Deployment ke Google Cloud Run

Deployment otomatis ke Cloud Run via GitHub Actions pada branch `backup/dev-2025-06-15`.

**Pastikan secrets berikut sudah diatur di GitHub:**
- GCP_SA_KEY
- DATABASE_URL
- ACCESS_TOKEN
- REFRESH_TOKEN
- VERIFICATION_TOKEN
- MAIL_USER
- MAIL_PASS
- FRONTEND_URL
- BACKEND_URL
- APP_NAME

**Penting:**
- Nama secret harus sama persis dengan variabel environment aplikasi.
- Jangan pernah menaruh data sensitif di README atau file publik.

## Pemecahan Masalah

### bcrypt_lib.node module not found

Jika error terkait bcrypt, update bcrypt dan pastikan Node.js versi 20.x:

```bash
pnpm update bcrypt@latest
pnpm prisma generate
nvm install 20 && nvm use 20
rm -rf node_modules pnpm-lock.yaml && pnpm install
pnpm prisma generate
pnpm run seed
```

## Lisensi

MIT License
