# GMF Utility Training Backend

## Deskripsi Proyek

Repositori ini berisi kode *backend* untuk aplikasi 'GMF Utility Training', yang dibangun menggunakan framework NestJS dan terhubung ke database PostgreSQL (Supabase).

## Instalasi

Pastikan Anda memiliki [pnpm](https://pnpm.io/installation) terinstal. Kemudian, jalankan perintah berikut:

```bash
$ pnpm install
```

## Konfigurasi Lingkungan (`.env`)

Buat file `.env` di direktori `be-dev/` dengan variabel lingkungan berikut. Pastikan untuk mengisi nilai yang sesuai, terutama `DATABASE_URL` yang didapatkan dari Supabase.

```
DATABASE_URL="postgresql://postgres.ckyobbobvftqziemlccu:<YOUR_PASSWORD>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres"
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
*   Untuk `DATABASE_URL`, pastikan Anda menggunakan string koneksi Supavisor (session mode) dari dashboard Supabase Anda.

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

# Watch mode
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

## Deployment

Proyek ini dikonfigurasi untuk deployment *serverless* ke Google Cloud Run menggunakan GitHub Actions. Workflow deployment otomatis terpicu pada *push* ke *branch* `backup/dev-2025-06-15`.

Pastikan [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) berikut dikonfigurasi di repositori GitHub Anda:
*   `GCP_SA_KEY` (Kunci akun layanan Google Cloud dalam format JSON)
*   `DATABASE_URL_DEV` (String koneksi database Supabase untuk lingkungan dev)
*   `ACCESS_TOKEN_DEV`
*   `REFRESH_TOKEN_DEV`
*   `VERIFICATION_TOKEN_DEV`
*   `MAIL_USER_DEV`
*   `MAIL_PASS_DEV`

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
