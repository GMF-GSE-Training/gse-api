# Puppeteer & Chrome Troubleshooting Guide

Panduan lengkap untuk mengatasi masalah Puppeteer dan Chrome dalam generate PDF certificate.

## 🔍 Identifikasi Masalah

### Error yang Sering Muncul:
```
Could not find Chrome (ver. 138.0.7204.157). This can occur if either:
1. You did not perform an installation before running the script (e.g. `npm install`) or
2. Your cache folder is corrupted (try running `npm cache clean --force`)
```

### Penyebab Umum:
1. **Chrome/Chromium tidak ter-install di sistem**
2. **Puppeteer tidak bisa akses Chrome executable**
3. **Version mismatch** antara Puppeteer dan Chrome
4. **Permission issues** pada Chrome executable
5. **Missing dependencies** untuk headless Chrome

## 🛠️ Solusi Berdasarkan Platform

### Linux (Ubuntu/Debian)

**1. Install Chrome/Chromium:**
```bash
# Google Chrome
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt update
sudo apt install google-chrome-stable

# Atau Chromium (lebih ringan)
sudo apt update
sudo apt install chromium-browser

# Dependencies untuk headless mode
sudo apt install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \
libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 \
libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 \
libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates \
fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

**2. Verify Installation:**
```bash
google-chrome --version
# atau
chromium-browser --version
```

**3. Test Puppeteer:**
```bash
cd /path/to/backend
node -e "
const puppeteer = require('puppeteer');
(async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    console.log('Puppeteer working!');
    await browser.close();
  } catch (e) {
    console.error('Puppeteer failed:', e.message);
  }
})();
"
```

### macOS

**1. Install Chrome:**
```bash
# Via Homebrew
brew install --cask google-chrome

# Atau download manual dari https://www.google.com/chrome/
```

**2. Verify Path:**
```bash
ls -la "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

### Windows

**1. Install Chrome:**
- Download dari [https://www.google.com/chrome/](https://www.google.com/chrome/)
- Install dengan administrator privileges

**2. Install Chocolatey (optional):**
```powershell
# Install via Chocolatey
choco install googlechrome

# Atau Chromium
choco install chromium
```

**3. Verify Installation:**
```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" --version
```

## 🔧 Konfigurasi Puppeteer

### Environment Variables

Tambahkan ke file `.env`:
```env
# Puppeteer configuration
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
PUPPETEER_CACHE_DIR=./node_modules/.cache/puppeteer

# Windows
# PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe

# macOS  
# PUPPETEER_EXECUTABLE_PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

### Package.json Configuration

```json
{
  "config": {
    "puppeteer_skip_chromium_download": "false"
  }
}
```

## 🐳 Docker Solution

Jika masalah persisten, gunakan containerized approach:

**Dockerfile:**
```dockerfile
FROM node:18-slim

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1

# Install Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Add user for Chrome (security)
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Run as non-root user
USER pptruser

EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:  
  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PUPPETEER_ARGS=--no-sandbox,--disable-setuid-sandbox
    volumes:
      - ./uploads:/app/uploads
    security_opt:
      - seccomp:unconfined
```

## 📋 Debugging Steps

### 1. Check Chrome Installation
```bash
# Linux
which google-chrome chromium-browser chromium
ls -la /usr/bin/google-chrome*

# macOS  
ls -la "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Windows (PowerShell)
Get-Command chrome
Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

### 2. Test Manual Launch
```bash
# Linux/macOS
google-chrome --headless --no-sandbox --disable-gpu --remote-debugging-port=9222

# Windows
"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless --no-sandbox --disable-gpu
```

### 3. Check Puppeteer Dependencies
```bash
npm ls puppeteer
npm ls @types/puppeteer

# Reinstall if needed
npm uninstall puppeteer
npm install puppeteer
```

### 4. Debug Script
```javascript
// debug-puppeteer.js
const puppeteer = require('puppeteer');
const fs = require('fs');

async function debugPuppeteer() {
  const possiblePaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser', 
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];

  console.log('Checking Chrome paths:');
  for (const path of possiblePaths) {
    const exists = fs.existsSync(path);
    console.log(`${path}: ${exists ? '✅' : '❌'}`);
  }

  const options = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  };

  try {
    console.log('Launching browser...');
    const browser = await puppeteer.launch(options);
    console.log('✅ Browser launched successfully');
    
    const page = await browser.newPage();
    await page.setContent('<h1>Test PDF</h1>');
    
    const pdf = await page.pdf({ format: 'A4' });
    console.log('✅ PDF generated successfully');
    
    await browser.close();
    return pdf;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

debugPuppeteer()
  .then(() => console.log('Debug completed successfully'))
  .catch(err => console.error('Debug failed:', err));
```

## ⚡ Performance Optimization

### 1. Reuse Browser Instance
```javascript
// certificate.service.ts
export class CertificateService {
  private browserInstance: Browser;

  async getBrowserInstance(): Promise<Browser> {
    if (!this.browserInstance) {
      this.browserInstance = await puppeteer.launch(this.puppeteerOptions);
    }
    return this.browserInstance;
  }

  async createCertificate(...) {
    const browser = await this.getBrowserInstance();
    const page = await browser.newPage();
    // ... rest of the code
    await page.close(); // Close page, not browser
  }

  async onModuleDestroy() {
    if (this.browserInstance) {
      await this.browserInstance.close();
    }
  }
}
```

### 2. Page Pool
```javascript
class PagePool {
  private pages: Page[] = [];
  private browser: Browser;

  async getPage(): Promise<Page> {
    if (this.pages.length > 0) {
      return this.pages.pop();
    }
    return await this.browser.newPage();
  }

  async releasePage(page: Page) {
    await page.goto('about:blank');
    this.pages.push(page);
  }
}
```

## 🔐 Security Considerations

### Sandboxing (Production)
```javascript
const puppeteerOptions = {
  headless: 'new',
  args: [
    '--no-sandbox', // Only in Docker/controlled environments
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-web-security', // Remove in production
  ]
};
```

### User Permissions
```bash
# Create dedicated user for Puppeteer
sudo useradd -r -s /bin/false puppeteeruser
sudo usermod -a -G chrome puppeteeruser

# Run application as puppeteeruser
sudo -u puppeteeruser npm start
```

## 🚨 Common Issues & Solutions

### Issue 1: "Chrome didn't exit cleanly"
**Solution:**
```javascript
process.on('SIGINT', async () => {
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});
```

### Issue 2: "Page crashed" 
**Solution:**
```javascript
const page = await browser.newPage();
page.on('error', msg => console.log('PAGE ERROR:', msg));
page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
```

### Issue 3: Memory leaks
**Solution:**
```javascript
// Always close pages and browser
try {
  // PDF generation
} finally {
  if (page) await page.close();
  if (browser) await browser.close();
}
```

### Issue 4: Timeout errors
**Solution:**
```javascript
await page.setContent(html, { 
  waitUntil: ['load', 'domcontentloaded'],
  timeout: 60000 // Increase timeout
});
```

## 📚 Alternative Solutions

### 1. Playwright (Alternative to Puppeteer)
```bash
npm install playwright
```

```javascript
const { chromium } = require('playwright');

const browser = await chromium.launch();
const page = await browser.newPage();
const pdf = await page.pdf({ format: 'A4' });
await browser.close();
```

### 2. PDF-lib (Pure JavaScript)
```bash
npm install pdf-lib
```

### 3. Serverless PDF Generation
Gunakan service external seperti:
- Puppeteer as a Service 
- HTMLCSStoImage
- API2PDF
- PDFShift

## 🔬 Monitoring & Logging

```javascript
// Add detailed logging
const puppeteerOptions = {
  headless: 'new',
  args: ['--no-sandbox'],
  dumpio: process.env.NODE_ENV === 'development', // Show browser logs
};

console.log('Puppeteer options:', puppeteerOptions);

const browser = await puppeteer.launch(puppeteerOptions);
console.log('Browser version:', await browser.version());
```

## 📞 Support Resources

- **Puppeteer GitHub**: https://github.com/puppeteer/puppeteer
- **Chrome Troubleshooting**: https://github.com/puppeteer/puppeteer/blob/main/docs/troubleshooting.md
- **Docker Examples**: https://github.com/puppeteer/puppeteer/tree/main/examples
- **Community Discord**: https://discord.gg/puppeteer

---

*Untuk masalah spesifik lainnya, lihat [Windows Troubleshooting Guide](./windows-troubleshooting.md)*
