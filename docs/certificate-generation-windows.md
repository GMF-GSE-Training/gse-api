# Certificate Generation Windows Troubleshooting

Panduan lengkap untuk mengatasi masalah generate certificate di environment Windows.

## 🔍 Common Errors & Solutions

### Error 1: Chrome Detection Issue
```
Could not find Chrome (ver. 138.0.7204.157). This can occur if either...
```

### Error 2: File Upload Buffer Issue
```
third argument of type "stream.Readable" or "Buffer" or "string"
```

## 🛠️ Complete Windows Setup Guide

### 1. Install Chrome (Required for PDF Generation)

**Option A: Manual Installation**
```powershell
# Download and install Chrome manually
# https://www.google.com/chrome/
```

**Option B: Chocolatey**
```powershell
# Install Chocolatey first if not installed
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# Install Chrome
choco install googlechrome -y

# Verify installation
"C:\Program Files\Google\Chrome\Application\chrome.exe" --version
```

**Option C: Scoop**
```powershell
# Install Scoop
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Install Chrome
scoop bucket add extras
scoop install googlechrome
```

### 2. Verify Chrome Installation

```powershell
# Check if Chrome is installed in standard locations
Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"
Test-Path "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

# Get Chrome version
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --version

# Test headless mode
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --no-sandbox --disable-gpu --virtual-time-budget=1000 --run-all-compositor-stages-before-draw about:blank
```

### 3. Environment Configuration

**Create `.env.windows` file:**
```env
# Chrome Configuration for Windows
PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

# Debug settings
DEBUG=true
EXPORT_LOGS=true

# Storage configuration (choose one)
STORAGE_TYPE=supabase  # or 'minio'

# Supabase settings
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_BUCKET=uploads

# Alternative: MinIO for local development
# STORAGE_TYPE=minio
# MINIO_ENDPOINT=localhost
# MINIO_PORT=9010
# MINIO_ACCESS_KEY=minioadmin
# MINIO_SECRET_KEY=d3vm1n1o
# MINIO_BUCKET=uploads
```

### 4. Network Configuration (Windows Specific)

**A. Windows Defender Firewall**
```powershell
# Run as Administrator
# Allow Node.js through firewall
New-NetFirewallRule -DisplayName "Node.js Server" -Direction Inbound -Program "C:\Program Files\nodejs\node.exe" -Action Allow

# Allow Chrome through firewall  
New-NetFirewallRule -DisplayName "Google Chrome" -Direction Inbound -Program "C:\Program Files\Google\Chrome\Application\chrome.exe" -Action Allow
```

**B. Corporate Network/Proxy**
```powershell
# Set proxy for npm
npm config set proxy http://proxy-server:port
npm config set https-proxy http://proxy-server:port

# Set proxy for Node.js applications
$env:HTTP_PROXY="http://proxy-server:port"
$env:HTTPS_PROXY="http://proxy-server:port"

# Add to your .env file
HTTP_PROXY=http://proxy-server:port
HTTPS_PROXY=http://proxy-server:port
```

## 🔧 Development Setup

### 1. Install Dependencies
```powershell
# Install project dependencies
npm install

# Install development tools
npm install -g @nestjs/cli
npm install -g ts-node
npm install -g tsx
```

### 2. Database Setup
```powershell
# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Run seeds
npm run seed
```

### 3. Test Certificate Generation
```powershell
# Create test script: test-certificate.js
@"
const puppeteer = require('puppeteer');
const fs = require('fs');

async function testCertificate() {
  console.log('Testing Puppeteer on Windows...');
  
  const options = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security'
    ]
  };
  
  // Try to find Chrome
  const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];
  
  for (const path of chromePaths) {
    if (fs.existsSync(path)) {
      options.executablePath = path;
      console.log(`Found Chrome at: ${path}`);
      break;
    }
  }
  
  try {
    const browser = await puppeteer.launch(options);
    console.log('✅ Browser launched successfully');
    
    const page = await browser.newPage();
    await page.setContent('<h1>Test Certificate</h1><p>Generated on Windows</p>');
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true
    });
    
    await browser.close();
    
    fs.writeFileSync('test-certificate.pdf', pdf);
    console.log('✅ PDF generated successfully: test-certificate.pdf');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCertificate();
"@ | Out-File -FilePath "test-certificate.js" -Encoding UTF8

# Run test
node test-certificate.js
```

## 🚨 Common Windows Issues & Solutions

### Issue 1: "Access Denied" Chrome Launch
**Solution:**
```powershell
# Run PowerShell as Administrator
# Give current user permissions to Chrome directory
icacls "C:\Program Files\Google\Chrome" /grant:r "$env:USERNAME:(OI)(CI)RX" /T
```

### Issue 2: "Module not found" errors
**Solution:**
```powershell
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
```

### Issue 3: Antivirus Blocking
**Solution:**
```powershell
# Add exclusions to Windows Defender (run as Admin)
Add-MpPreference -ExclusionPath "C:\path\to\your\project"
Add-MpPreference -ExclusionProcess "node.exe"
Add-MpPreference -ExclusionProcess "chrome.exe"
```

### Issue 4: Buffer Upload Error
The application now automatically handles this with proper Express.Multer.File formatting.

**Manual verification:**
```javascript
// debug-upload.js
const fs = require('fs');

// Test buffer creation
const testBuffer = Buffer.from('Test content');
console.log('Buffer created:', testBuffer.length, 'bytes');
console.log('Buffer type:', Object.prototype.toString.call(testBuffer));

// Test file object structure
const fileObj = {
  fieldname: 'test',
  originalname: 'test.pdf',
  encoding: '7bit',
  mimetype: 'application/pdf',
  buffer: testBuffer,
  size: testBuffer.length
};

console.log('File object valid:', 
  fileObj.buffer instanceof Buffer && 
  typeof fileObj.mimetype === 'string'
);
```

## 🐳 Docker Alternative (Recommended)

If issues persist, use Docker for consistent environment:

**docker-compose.windows.yml:**
```yaml
version: '3.8'
services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.windows
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - STORAGE_TYPE=supabase
      - DEBUG=true
    volumes:
      - ./uploads:/app/uploads
      - ./logs:/app/logs
```

**Dockerfile.windows:**
```dockerfile
FROM node:18-slim

# Install Chrome for Windows containers
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils

# Install Google Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - && \
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && \
    apt-get install -y google-chrome-stable && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

**Run with Docker:**
```powershell
# Build and run
docker-compose -f docker-compose.windows.yml up --build

# Or use regular Docker
docker build -t certificate-app -f Dockerfile.windows .
docker run -p 3000:3000 --env-file .env certificate-app
```

## 📊 Performance Monitoring

**Create monitoring script:**
```javascript
// monitor-certificate.js
const { performance } = require('perf_hooks');

async function monitorCertificateGeneration() {
  const start = performance.now();
  
  try {
    // Make API call to certificate endpoint
    const response = await fetch('http://localhost:3000/api/certificate/{cotId}/{participantId}', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-token'
      },
      body: JSON.stringify({
        theoryScore: 85,
        practiceScore: 88,
        attendance: true
      })
    });
    
    const end = performance.now();
    const duration = (end - start) / 1000;
    
    if (response.ok) {
      console.log(`✅ Certificate generated in ${duration.toFixed(2)}s`);
    } else {
      console.error(`❌ Failed: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run monitoring
setInterval(monitorCertificateGeneration, 30000); // Every 30 seconds
```

## 🔄 Alternative Solutions

### 1. Use Playwright instead of Puppeteer
```powershell
npm install playwright
```

```javascript
// Alternative implementation with Playwright
const { chromium } = require('playwright');

async function generatePDFWithPlaywright(html) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setContent(html);
  const pdf = await page.pdf({ format: 'A4' });
  await browser.close();
  
  return pdf;
}
```

### 2. Serverless PDF Generation
Use external services for PDF generation:
- **Puppeteer as a Service**: https://puppeteeraas.com/
- **PDFShift**: https://pdfshift.io/
- **API2PDF**: https://www.api2pdf.com/

### 3. Local PDF Service
Run dedicated PDF service:
```powershell
# Install gotenberg (Docker-based PDF service)
docker run --rm -p 3001:3001 gotenberg/gotenberg:7
```

## 📞 Windows Support Checklist

- [ ] ✅ Chrome installed and accessible
- [ ] ✅ Node.js 18+ installed  
- [ ] ✅ Firewall rules configured
- [ ] ✅ Antivirus exclusions added
- [ ] ✅ Environment variables set
- [ ] ✅ Network/proxy configured
- [ ] ✅ Dependencies installed correctly
- [ ] ✅ Test certificate generation works
- [ ] ✅ Storage (Supabase/MinIO) accessible
- [ ] ✅ Log files being generated

## 🆘 Emergency Troubleshooting

If all else fails:

1. **Use Linux Subsystem (WSL2):**
   ```powershell
   wsl --install
   # Then run the project inside WSL2
   ```

2. **Use GitHub Codespaces:**
   - Open repository in GitHub
   - Click "Code" > "Open with Codespaces"
   - Everything works out of the box

3. **Use Cloud Development:**
   - Deploy to Railway, Render, or Heroku
   - Use cloud-based development environment

---

*Untuk masalah lainnya, lihat [Puppeteer Troubleshooting Guide](./puppeteer-troubleshooting.md) dan [Windows Troubleshooting Guide](./windows-troubleshooting.md)*
