Langkah Verifikasi
Instal Dependensi Baru:
Instal @alicloud/sts dan @alicloud/openapi-client:
bash

npm install @alicloud/sts20150401 @alicloud/openapi-client
Pastikan ali-oss sudah versi terbaru (6.22.0):
bash

npm install ali-oss@latest
Perbarui Konfigurasi Lingkungan:
Tambahkan variabel lingkungan berikut di .env:
env

ALIBABA_REGION=oss-ap-southeast-1
ALIBABA_BUCKET_NAME=your-bucket-name
ALIBABA_ACCESS_KEY_ID=your-access-key-id
ALIBABA_ACCESS_KEY_SECRET=your-access-key-secret
ALIBABA_STS_ROLE_ARN=acs:ram::your-account-id:role/your-role
ALIBABA_STS_SESSION_NAME=oss-session
Catatan: ALIBABA_ACCESS_KEY_ID dan ALIBABA_ACCESS_KEY_SECRET hanya digunakan untuk inisialisasi STS. Pastikan peran STS memiliki izin untuk sts:AssumeRole.
Konfigurasi Peran STS:
Buka Alibaba Cloud RAM Console > Roles > Create Role.
Pilih "User" sebagai trusted entity dan tambahkan izin seperti AliyunOSSFullAccess.
Catat ARN peran (contoh: acs:ram::123456789012:role/oss-role).
Pastikan pengguna dengan ALIBABA_ACCESS_KEY_ID memiliki izin untuk memanggil sts:AssumeRole pada peran tersebut.
Konfigurasi Bucket Privat:
Masuk ke Alibaba Cloud OSS Console.
Set bucket ke "Private" di pengaturan Access Control.
Tambahkan kebijakan bucket:
json

{
"Statement": [
{
"Effect": "Allow",
"Principal": {"RAM": ["acs:ram::your-account-id:role/your-role"]},
"Action": ["oss:GetObject", "oss:PutObject", "oss:DeleteObject"],
"Resource": ["acs:oss:*:*:your-bucket-name/*"]
}
]
}
Kompilasi Proyek:
Jalankan:
bash

npx tsc
Pastikan tidak ada error TypeScript.
Jalankan Aplikasi:
Jalankan:
bash

npm run start:dev
Uji fungsi unggah, unduh, dan hapus:
Unggah file kecil (<10MB) untuk memverifikasi put.
Unggah file besar (>10MB) untuk memverifikasi multipartUpload.
Unduh file yang diunggah.
Hapus file.
Pantau Log:
Verifikasi bahwa token STS diperbarui setiap 15 menit dengan log STS token updated successfully.
Picu error (misalnya, nama file tidak valid) dan pastikan log error tidak mencatat stack trace di NODE_ENV=production.
Pemantauan Kerentanan:
Tambahkan Dependabot di .github/dependabot.yml:
yaml

version: 2
updates:

- package-ecosystem: "npm"
  directory: "/"
  schedule:
  interval: "daily"
  Jalankan npm audit untuk memeriksa kerentanan.
