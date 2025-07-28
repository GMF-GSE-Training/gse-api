const puppeteer = require('puppeteer');

async function testPuppeteerPDF() {
  console.log('🧪 Testing Puppeteer PDF generation...');
  
  const puppeteerOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  };

  // Try to find Chrome executable for different platforms
  const possiblePaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser', 
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];

  // Check if Chrome exists in system PATH or use bundled Chromium
  for (const chromePath of possiblePaths) {
    try {
      const fs = require('fs');
      if (fs.existsSync(chromePath)) {
        puppeteerOptions.executablePath = chromePath;
        console.log(`✅ Found Chrome at: ${chromePath}`);
        break;
      }
    } catch (error) {
      // Continue checking other paths
    }
  }

  let browser;
  try {
    console.log('🚀 Launching Puppeteer with options:', JSON.stringify(puppeteerOptions, null, 2));
    browser = await puppeteer.launch(puppeteerOptions);
    console.log('✅ Puppeteer launched successfully');
    
    const page = await browser.newPage();
    console.log('✅ New page created');
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1200, height: 800 });
    console.log('✅ Viewport set');
    
    // Simple HTML content for testing
    const testHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Test Certificate</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
            background: white;
          }
          .certificate {
            text-align: center;
            padding: 20px;
            border: 2px solid #000;
          }
          h1 { color: #333; }
          p { margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="certificate">
          <h1>TEST CERTIFICATE</h1>
          <p>This is a test certificate</p>
          <p>Generated on: ${new Date().toISOString()}</p>
          <p>Platform: ${process.platform}</p>
        </div>
      </body>
      </html>
    `;
    
    // Set content with enhanced options
    await page.setContent(testHTML, { 
      waitUntil: ['load', 'domcontentloaded', 'networkidle0'],
      timeout: 30000
    });
    console.log('✅ Content set successfully');
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0mm',
        right: '0mm', 
        bottom: '0mm',
        left: '0mm'
      }
    });
    
    console.log('✅ PDF generated successfully');
    console.log('📊 PDF Buffer Info:', {
      isBuffer: Buffer.isBuffer(pdfBuffer),
      length: pdfBuffer.length,
      type: typeof pdfBuffer,
      constructor: pdfBuffer.constructor.name
    });
    
    // Validate PDF signature (use proper conversion like in certificate service)
    const pdfSignatureBytes = pdfBuffer.subarray(0, 5);
    const pdfSignature = String.fromCharCode(...pdfSignatureBytes);
    console.log('📄 PDF Signature Bytes:', Array.from(pdfSignatureBytes));
    console.log('📄 PDF Signature String:', pdfSignature);
    console.log('✅ PDF Signature Valid:', pdfSignature.startsWith('%PDF'));
    
    // Show first 20 bytes as hex
    console.log('🔍 First 20 bytes (hex):', pdfBuffer.subarray(0, 20).toString('hex'));
    
    await browser.close();
    console.log('✅ Browser closed successfully');
    
    return {
      success: true,
      buffer: pdfBuffer,
      bufferSize: pdfBuffer.length,
      validPDF: pdfSignature.includes('%PDF')
    };
    
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    console.error('❌ Puppeteer PDF test failed:', {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 5),
      code: error.code
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the test
if (require.main === module) {
  testPuppeteerPDF()
    .then(result => {
      console.log('\n📋 Test Result:', result);
      if (result.success) {
        console.log('🎉 Puppeteer PDF generation is working correctly!');
      } else {
        console.log('💥 Puppeteer PDF generation failed!');
        process.exit(1);
      }
    })
    .catch(console.error);
}

module.exports = { testPuppeteerPDF };
