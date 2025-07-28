# Database Seeding Guide

Panduan lengkap untuk seeding database dengan support cross-platform (Linux, macOS, Windows).

## 📋 Overview

Script seeding database (`prisma/seed.ts`) dirancang untuk:
- ✅ Membuat data dummy yang konsisten
- ✅ Support multiple storage providers (Supabase, MinIO)
- ✅ Cross-platform compatibility
- ✅ Robust error handling dan retry logic
- ✅ Batch processing untuk performa optimal
- ✅ Comprehensive logging untuk debugging

## 🚀 Quick Start

### Persiapan Environment

1. **Copy dan edit file environment:**
   ```bash
   cp .env.example .env
   # Edit .env sesuai kebutuhan
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Setup database:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run seeding:**
   ```bash
   npm run seed
   ```

## ⚙️ Konfigurasi Environment

### Environment Variables Wajib

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/database
DIRECT_URL=postgresql://user:password@localhost:5432/database

# Storage Provider
STORAGE_TYPE=supabase  # atau 'minio'

# Frontend URL
FRONTEND_URL=http://localhost:4200
```

### Konfigurasi Supabase

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_BUCKET=uploads
```

### Konfigurasi MinIO (Alternative)

```env
MINIO_ENDPOINT=localhost
MINIO_PORT=9010
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=d3vm1n1o
MINIO_BUCKET=uploads
```

### Environment Variables Opsional

```env
# Debugging
DEBUG=true                    # Enable debug logging
EXPORT_LOGS=true             # Export logs to file

# Data dummy configuration
DUMMY_USER_COUNT=10          # Jumlah user dummy
DUMMY_PARTICIPANT_COUNT=10   # Jumlah participant dummy
DUMMY_CAPABILITY_COUNT=20    # Jumlah capability dummy
DUMMY_COT_COUNT=10          # Jumlah COT dummy
DUMMY_SIGNATURE_COUNT=10     # Jumlah signature dummy

# Role distribution
DUMMY_SUPERADMIN_COUNT=1     # Jumlah superadmin
DUMMY_SUPERVISOR_COUNT=3     # Jumlah supervisor
DUMMY_LCU_COUNT=2           # Jumlah LCU

# Advanced options
IGNORE_DUMMY_JSON=false      # Ignore JSON files, generate all data
BACKUP_BEFORE_SEED=true      # Backup tables before seeding
```

## 🏗️ Struktur Data yang Di-seed

### 1. Roles (Core)
- `super admin`
- `supervisor` 
- `lcu`
- `user`

### 2. Capabilities
- Training codes dan names
- Duration information
- Rating codes

### 3. COTs (Certificate of Training)
- Training schedules
- Instructor information
- Training locations
- Status tracking

### 4. Users & Participants
- **Super Admins**: System administrators
- **Supervisors**: Training supervisors dengan dinas assignment
- **LCUs**: Local coordinator users
- **Participants**: Regular users dengan complete profile dan document uploads

### 5. Signatures
- Digital signature files
- Signature types (SIGNATURE1, SIGNATURE2)
- Role assignments

### 6. Relational Data
- Capability-COT mappings
- Participant-COT enrollments
- Curriculum syllabus

## 🖼️ File Upload Strategy

### Automatic File Upload
Script otomatis mengupload file dummy ke storage:

**Participant Files:**
- `foto.jpg` → `/foto/{participantId}.jpg`
- `ktp.jpg` → `/ktp/{participantId}.jpg` 
- `SIM_A.jpg` → `/simA/{participantId}.jpg`
- `SIM_B.jpg` → `/simB/{participantId}.jpg`
- `surat_ket_sehat.jpg` → `/suratSehat/{participantId}.jpg`
- `surat_bebas_narkoba.jpg` → `/suratNarkoba/{participantId}.jpg`

**Signature Files:**
- `e-sign1.png` → `/esign/{signatureId}.png`
- `e-sign2.png` → `/esign/{signatureId}.png`

### Required Source Files
Pastikan file-file berikut ada di `public/assets/images/`:
- `foto.jpg`
- `ktp.jpg`
- `SIM_A.jpg`
- `SIM_B.jpg`
- `surat_ket_sehat.jpg`
- `surat_bebas_narkoba.jpg`
- `e-sign1.png`
- `e-sign2.png`

## 🔄 Cross-Platform Support

### Linux/macOS
```bash
npm run seed
```

### Windows
```cmd
npm run seed
```

### Windows dengan WSL2
```bash
wsl
cd /mnt/c/path/to/project
npm run seed
```

### Docker
```bash
docker build -f Dockerfile.seed -t seed-app .
docker run --env-file .env seed-app
```

## 🚨 Troubleshooting

### Common Issues

1. **Connection Refused (Windows)**
   - Check firewall settings
   - Verify antivirus exceptions
   - Test network connectivity

2. **Upload Failures**
   - Verify storage credentials
   - Check bucket permissions
   - Review network proxy settings

3. **TypeScript Errors**
   - Run `npx prisma generate`
   - Verify Node.js version (18+)

4. **File Not Found**
   - Ensure all required images exist in `public/assets/images/`
   - Check file permissions

### Debug Mode

Enable debug logging:
```env
DEBUG=true
EXPORT_LOGS=true
```

Logs akan disimpan di `prisma/seed_logs_{timestamp}.json`

### Windows-Specific Issues

Jika mengalami masalah di Windows, lihat [Windows Troubleshooting Guide](./windows-troubleshooting.md).

## 📊 Performance Optimization

### Batch Processing
Script menggunakan batch processing untuk efisiensi:
- Default batch size: 100 items
- Upload batch size: 2 items (untuk avoid rate limiting)
- Retry logic dengan exponential backoff

### Memory Management
- Stream-based JSON parsing untuk file besar
- Cleanup database sebelum seeding
- Prisma client disconnect otomatis

## 🔐 Security Considerations

### Production Safety
- Service keys tidak boleh committed ke repository
- Gunakan environment variables untuk semua credentials
- Backup database sebelum seeding di production

### Development vs Production
```env
# Development
NODE_ENV=development
STORAGE_TYPE=minio  # Local development

# Production  
NODE_ENV=production
STORAGE_TYPE=supabase  # Cloud storage
```

## 📝 Custom Data

### Menggunakan JSON Files
Buat file JSON di `prisma/dummy-data/`:
- `roles.json`
- `capabilities.json`
- `cots.json`
- `users.json`
- `signatures.json`

### Format JSON Example

**users.json:**
```json
[
  {
    "email": "admin@example.com",
    "name": "Administrator",
    "role": "super admin",
    "nik": "1234567890123456",
    "idNumber": "ADM001"
  }
]
```

**capabilities.json:**
```json
[
  {
    "ratingCode": "RC01",
    "trainingCode": "TC001", 
    "trainingName": "Forklift Operation",
    "totalDuration": 40
  }
]
```

### Override dengan Environment
```env
IGNORE_DUMMY_JSON=true  # Generate semua data, ignore JSON files
```

## 🧪 Testing

### Validate Seeding Results
```sql
-- Check record counts
SELECT 'roles' as table_name, COUNT(*) as count FROM roles
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL  
SELECT 'participants', COUNT(*) FROM participants
UNION ALL
SELECT 'capabilities', COUNT(*) FROM capabilities;

-- Check relationships
SELECT 
  u.email,
  r.name as role,
  p.name as participant_name
FROM users u
LEFT JOIN roles r ON u."roleId" = r.id
LEFT JOIN participants p ON u."participantId" = p.id
LIMIT 10;
```

### Reset Database
```bash
# Reset dan seed ulang
npx prisma db push --force-reset
npm run seed
```

## 📚 Scripts Available

```json
{
  "scripts": {
    "seed": "tsx prisma/seed.ts",
    "seed:debug": "DEBUG=true tsx prisma/seed.ts",
    "seed:clean": "npx prisma db push --force-reset && npm run seed",
    "seed:backup": "BACKUP_BEFORE_SEED=true npm run seed"
  }
}
```

## 🔮 Advanced Usage

### Custom Seed Scenarios

**Minimal Data:**
```env
DUMMY_USER_COUNT=1
DUMMY_PARTICIPANT_COUNT=1
DUMMY_CAPABILITY_COUNT=1
DUMMY_COT_COUNT=1
```

**Large Dataset:**
```env
DUMMY_USER_COUNT=100
DUMMY_PARTICIPANT_COUNT=100
DUMMY_CAPABILITY_COUNT=50
DUMMY_COT_COUNT=20
```

**Development vs Staging:**
```bash
# Development
cp .env.development .env && npm run seed

# Staging
cp .env.staging .env && npm run seed
```

### Integration dengan CI/CD

```yaml
# .github/workflows/seed.yml
name: Database Seeding
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to seed'
        required: true
        default: 'staging'

jobs:
  seed:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run seed
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

---

*Untuk masalah spesifik Windows, lihat [Windows Troubleshooting Guide](./windows-troubleshooting.md)*
