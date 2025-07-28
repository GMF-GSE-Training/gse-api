# Windows Troubleshooting Guide untuk Supabase Upload

Panduan lengkap untuk mengatasi masalah upload Supabase di environment Windows, terutama saat menjalankan seeding database.

## 🔍 Identifikasi Masalah

### Error yang Sering Muncul di Windows:
```
ERROR: Supabase upload failed: Unexpected token 'I', "Invalid St"... is not valid JSON
```

### Penyebab Umum:
1. **Network Security**: Firewall/Antivirus memblok koneksi
2. **Proxy/VPN**: Corporate proxy menginterfensi koneksi
3. **DNS Resolution**: Masalah resolusi DNS untuk Supabase endpoints
4. **IPv6 vs IPv4**: Konflik protokol jaringan
5. **SSL/TLS**: Sertifikat atau handshake issues

## 🛠️ Solusi Step-by-Step

### 1. Periksa Koneksi Dasar

```bash
# Test koneksi ke Supabase
curl -I https://your-project.supabase.co/storage/v1

# Test DNS resolution
nslookup your-project.supabase.co

# Test dengan verbose
curl -v https://your-project.supabase.co/storage/v1
```

### 2. Konfigurasi Environment Variables

Buat file `.env` dengan konfigurasi yang tepat:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_BUCKET=uploads

# Debugging
DEBUG=true
EXPORT_LOGS=true

# Network timeout settings (optional)
NODE_TLS_REJECT_UNAUTHORIZED=0  # Hanya untuk development!
```

### 3. Firewall dan Antivirus

**Windows Defender:**
1. Buka Windows Security
2. Pilih "Firewall & network protection"
3. Klik "Allow an app through firewall"
4. Tambahkan Node.js dan aplikasi terkait

**Third-party Antivirus:**
- Tambahkan exception untuk folder project
- Disable real-time scanning sementara saat development

### 4. Corporate Network/Proxy

Jika berada di jaringan corporate:

```bash
# Set proxy untuk npm
npm config set proxy http://proxy-server:port
npm config set https-proxy http://proxy-server:port

# Set proxy untuk Node.js
set HTTP_PROXY=http://proxy-server:port
set HTTPS_PROXY=http://proxy-server:port
```

### 5. Alternative: Gunakan MinIO untuk Development

Jika masalah persisten, gunakan MinIO sebagai storage alternative:

```env
# Switch ke MinIO
STORAGE_TYPE=minio

# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9010
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=d3vm1n1o
MINIO_BUCKET=uploads
```

Setup MinIO dengan Docker:
```bash
docker run -p 9010:9000 -p 9011:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=d3vm1n1o \
  minio/minio server /data --console-address ":9001"
```

## 🔧 Best Practices untuk CLI Upload 2025

### 1. Menggunakan Supabase CLI

Install Supabase CLI:
```bash
# Via npm (recommend)
npm install -g @supabase/cli

# Via Chocolatey (Windows)
choco install supabase

# Via Scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Login dan setup:
```bash
# Login ke Supabase
supabase login

# Link project
supabase link --project-ref your-project-ref

# Upload files
supabase storage cp local-file.png supabase://bucket-name/path/file.png
```

### 2. Bulk Upload Script

Buat script PowerShell untuk bulk upload:

```powershell
# bulk-upload.ps1
param(
    [string]$SourceDir = ".\public\assets\images",
    [string]$Bucket = "uploads"
)

Get-ChildItem -Path $SourceDir -Recurse -File | ForEach-Object {
    $relativePath = $_.FullName.Substring($SourceDir.Length + 1)
    $targetPath = "supabase://$Bucket/$relativePath"
    
    Write-Host "Uploading: $($_.Name) -> $targetPath"
    supabase storage cp $_.FullName $targetPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Success: $($_.Name)" -ForegroundColor Green
    } else {
        Write-Host "❌ Failed: $($_.Name)" -ForegroundColor Red
    }
}
```

### 3. Node.js Upload dengan Retry Logic

```javascript
// upload-helper.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function uploadWithRetry(filePath, destPath, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const { data, error } = await supabase.storage
        .from('uploads')
        .upload(destPath, fileBuffer, {
          contentType: getContentType(path.extname(filePath)),
          upsert: true
        });

      if (error) throw error;
      
      console.log(`✅ Uploaded (attempt ${attempt}): ${destPath}`);
      return data;
    } catch (error) {
      console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

function getContentType(ext) {
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.pdf': 'application/pdf'
  };
  return types[ext.toLowerCase()] || 'application/octet-stream';
}

module.exports = { uploadWithRetry };
```

## 🚨 Troubleshooting Commands

### Debug Network Issues

```bash
# Check network connectivity
ping supabase.com

# Trace route to Supabase
tracert your-project.supabase.co

# Check open ports
netstat -an | findstr :443

# DNS flush (run as Administrator)
ipconfig /flushdns
```

### Debug SSL Issues

```bash
# Test SSL connection
openssl s_client -connect your-project.supabase.co:443

# Check certificate
curl -vI https://your-project.supabase.co
```

### Debug dengan Node.js

```javascript
// debug-connection.js
const https = require('https');

const options = {
  hostname: 'your-project.supabase.co',
  port: 443,
  path: '/storage/v1',
  method: 'GET',
  timeout: 5000
};

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.on('timeout', () => {
  console.error('Request timeout');
  req.destroy();
});

req.end();
```

## 📋 Checklist Troubleshooting

- [ ] **Network**: Koneksi internet stabil
- [ ] **Environment**: Variables `.env` sudah benar
- [ ] **Firewall**: Aplikasi allowed through firewall
- [ ] **Antivirus**: Project folder di-exclude dari scan
- [ ] **Proxy**: Proxy settings configured jika diperlukan
- [ ] **CLI**: Supabase CLI ter-install dan ter-login
- [ ] **Permissions**: Service key memiliki storage permissions
- [ ] **Bucket**: Bucket exists dan accessible
- [ ] **Files**: File yang diupload exists dan readable

## 🔄 Alternative Solutions

### 1. Upload via Web Interface
Gunakan Supabase Dashboard untuk upload manual file yang diperlukan.

### 2. Pre-seeded Database
Gunakan database dump yang sudah include file references tanpa perlu upload.

### 3. Local Storage Development
Gunakan file system local untuk development, Supabase untuk production.

### 4. Containerized Development
Gunakan Docker untuk konsistensi environment:

```dockerfile
# Dockerfile.dev
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "seed"]
```

## 🆘 Jika Semua Gagal

1. **Gunakan Linux Subsystem (WSL2)**:
   ```bash
   # Install WSL2
   wsl --install
   
   # Run project dalam WSL2
   wsl
   cd /mnt/c/path/to/project
   npm run seed
   ```

2. **Virtual Machine**:
   Setup Linux VM untuk development yang konsisten.

3. **Remote Development**:
   Gunakan GitHub Codespaces atau similar cloud development environment.

## 📞 Support dan Resources

- **Supabase Discord**: https://discord.supabase.com
- **GitHub Issues**: Report specific Windows issues
- **Documentation**: https://supabase.com/docs/guides/storage
- **CLI Reference**: https://supabase.com/docs/reference/cli

---

*Dokumen ini akan diupdate sesuai dengan issue dan solusi terbaru yang ditemukan.*
