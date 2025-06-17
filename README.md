# GMF Utility Training Backend

<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="100" alt="Nest Logo" />
</p>

<p align="center">
  Aplikasi *backend* untuk <b>GMF Utility Training</b>, dibangun dengan <b>NestJS</b> dan terhubung ke <b>PostgreSQL</b>.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nestjs/core" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/package/@nestjs/core" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
  <a href="https://www.npmjs.com/package/@nestjs/common" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
</p>

## Deskripsi Proyek

Repositori ini berisi kode *backend* untuk aplikasi 'GMF Utility Training', yang dibangun menggunakan framework NestJS dan terhubung ke database PostgreSQL. Ini menyediakan API untuk manajemen pengguna, otentikasi, otorisasi berdasarkan peran, dan fitur terkait pelatihan.

## Fitur Utama

*   **Autentikasi & Otorisasi:** Menggunakan JWT (JSON Web Tokens) dengan refresh token, verifikasi email, dan reset password. Mendukung otorisasi berbasis peran.
*   **Manajemen Pengguna & Peran:** Pengelolaan data pengguna dan peran (`super admin`, `supervisor`, `lcu`, `user`).
*   **Integrasi Database:** Menggunakan Prisma ORM untuk interaksi dengan database PostgreSQL.
*   **Sistem Notifikasi:** Pengiriman email untuk verifikasi akun dan reset password.
*   **Manajemen Dokumen:** Fitur untuk mengelola dokumen dan sertifikat.
*   **Logging:** Implementasi logging yang robust menggunakan Winston untuk pemantauan aplikasi.

## Struktur Proyek

Proyek mengikuti konvensi modular NestJS:

```
be-dev/
├── src/
│   ├── auth/              # Modul autentikasi dan otorisasi (login, register, JWT)
│   ├── common/            # Modul umum (Prisma, Validation, JWT config, Error Filter, Winston)
│   ├── capability/        # Modul untuk manajemen kapabilitas
│   ├── certificate/       # Modul untuk manajemen sertifikat
│   ├── config/            # Konfigurasi aplikasi
│   ├── cot/               # Modul untuk Chain of Trust (COT)
│   ├── curriculum-syllabus/# Modul untuk kurikulum dan silabus
│   ├── e-sign/            # Modul untuk tanda tangan elektronik
│   ├── mail/              # Modul untuk pengiriman email
│   ├── participant/       # Modul untuk manajemen peserta
│   ├── participant-cot/   # Modul untuk peserta COT
│   ├── role/              # Modul untuk manajemen peran
│   ├── shared/            # Modul dan layanan bersama lainnya
│   ├── user/              # Modul untuk manajemen pengguna
│   └── main.ts            # Entry point aplikasi
├── prisma/                # Skema Prisma dan migrasi database
├── public/                # Folder untuk file statis (misalnya QR code, sertifikat)
├── uploads/               # Folder untuk unggahan file
├── .env.example           # Contoh file konfigurasi lingkungan
├── pnpm-lock.yaml         # Lock file dependensi pnpm
└── package.json           # Definisi proyek dan skrip
```

## Instalasi

Pastikan Anda memiliki [pnpm](https://pnpm.io/installation) terinstal. Kemudian, jalankan perintah berikut:

```bash
$ pnpm install
```

## Konfigurasi Lingkungan (`.env`)

Buat file `.env` di direktori `be-dev/` dengan variabel lingkungan berikut. Pastikan untuk mengisi nilai yang sesuai, terutama `DATABASE_URL`.

```
DATABASE_URL="postgresql://postgres.ckyobbobvftqziemlccu:<YOUR_PASSWORD>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?pgbouncer=true"
NODE_ENV=development
PROTOCOL=http
HOST=0.0.0.0
FRONTEND_URL=http://localhost:4200
BACKEND_URL=http://localhost:3000
QR_CODE_LINK=http://localhost:4200/participants/{id}/detail
ACCESS_TOKEN=<YOUR_ACCESS_TOKEN>
REFRESH_TOKEN=<YOUR_REFRESH_TOKEN>
VERIFICATION_TOKEN=<YOUR_VERIFICATION_TOKEN>
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=<YOUR_MAIL_USER>
MAIL_PASS=<YOUR_MAIL_PASS>
APP_NAME="Admin GMF Training"
```

**Catatan Penting:**
*   Ganti `<YOUR_PASSWORD>`, `<YOUR_ACCESS_TOKEN>`, `<YOUR_REFRESH_TOKEN>`, `<YOUR_VERIFICATION_TOKEN>`, `<YOUR_MAIL_USER>`, dan `<YOUR_MAIL_PASS>` dengan nilai yang sebenarnya.
*   Untuk `DATABASE_URL`, pastikan Anda menggunakan string koneksi Supavisor (session mode) dari dashboard Anda, dan tambahkan `?pgbouncer=true` di akhir untuk kompatibilitas Cloud Run.

## Migrasi dan Seeding Database

Setelah mengkonfigurasi `.env`, jalankan migrasi database dan *seeding* awal:

```bash
pnpm prisma migrate deploy
pnpm run seed
```

## Menjalankan Aplikasi

```bash
# Development
$ pnpm run start

# Watch mode (hot-reloading)
$ pnpm run start:dev

# Production mode
$ pnpm run start:prod
```

## Testing

```bash
# Unit tests
$ pnpm run test

# E2E tests
$ pnpm run test:e2e

# Test coverage
$ pnpm run test:cov
```

## Deployment ke Google Cloud Run (via GitHub Actions)

Proyek ini dikonfigurasi untuk deployment *serverless* otomatis ke Google Cloud Run menggunakan GitHub Actions. Setiap *push* ke *branch* `backup/dev-2025-06-15` akan memicu alur kerja deployment.

Pastikan [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) berikut dikonfigurasi di repositori GitHub Anda (terutama untuk lingkungan produksi/Cloud Run):

*   `GCP_SA_KEY` (Kunci akun layanan Google Cloud dalam format JSON)
*   `DATABASE_URL` (String koneksi database PostgreSQL untuk lingkungan Cloud Run, harus menyertakan `?pgbouncer=true`)
*   `ACCESS_TOKEN`
*   `REFRESH_TOKEN`
*   `VERIFICATION_TOKEN`
*   `MAIL_USER`
*   `MAIL_PASS`
*   `FRONTEND_URL`
*   `BACKEND_URL`
*   `QR_CODE_LINK`
*   `APP_NAME`

**Penting:** Nama secret di GitHub Actions harus sama persis dengan nama variabel lingkungan yang diharapkan oleh aplikasi di Cloud Run.

## Pemecahan Masalah (`Troubleshooting`)

### `bcrypt_lib.node` module not found error

Jika Anda menemukan error seperti `Error: Cannot find module '.../bcrypt_lib.node'` saat menjalankan `pnpm run seed`, itu mungkin karena masalah kompatibilitas dengan versi Node.js Anda atau instalasi `node_modules` yang rusak.

**Solusi:**

1.  **Perbarui bcrypt:**
    ```bash
    pnpm update bcrypt@latest
    ```
2.  **Regenerate Prisma Client:**
    ```bash
    pnpm prisma generate
    ```
3.  **Pertimbangkan Kompatibilitas Versi Node.js:**
    `bcrypt` mungkin memiliki masalah kompatibilitas dengan versi Node.js yang lebih baru (misalnya, Node.js 22.x dengan bcrypt 5.x.x). Jika pembaruan `bcrypt` tidak menyelesaikan masalah, pertimbangkan untuk menggunakan versi Node.js yang diketahui kompatibel (misalnya, Node.js 20.x).

    Untuk beralih versi Node.js (membutuhkan `nvm`):
    ```bash
    nvm install 20 # Instal Node.js 20 jika belum terinstal
    nvm use 20     # Beralih ke Node.js 20
    rm -rf node_modules pnpm-lock.yaml && pnpm install # Instal ulang dependensi
    pnpm prisma generate # Regenerate Prisma Client
    pnpm run seed # Coba jalankan seed lagi
    ```

## Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).
