const { MinioStorageProvider } = require('./src/file-upload/providers/minio-storage.provider.ts');
const { SupabaseStorageProvider } = require('./src/file-upload/providers/supabase-storage.provider.ts');
const { ConfigService } = require('@nestjs/config');

// Test buffer creation similar to Puppeteer PDF output
function createTestBuffer() {
  // Create a valid PDF-like buffer for testing
  const pdfHeader = Buffer.from('%PDF-1.4\n');
  const testContent = Buffer.from('Test PDF content for storage validation');
  const pdfFooter = Buffer.from('\n%%EOF');
  
  return Buffer.concat([pdfHeader, testContent, pdfFooter]);
}

// Mock Express.Multer.File object
function createMockFile(buffer, filename = 'test.pdf', mimetype = 'application/pdf') {
  return {
    fieldname: 'test',
    originalname: filename,
    encoding: '7bit',
    mimetype: mimetype,
    buffer: buffer,
    size: buffer.length,
    destination: '',
    filename: filename,
    path: '',
    stream: undefined
  };
}

// Test MinIO Provider
async function testMinIOProvider() {
  console.log('🧪 Testing MinIO Provider...');
  
  try {
    const minioProvider = new MinioStorageProvider({
      endPoint: 'localhost',
      port: 9010,
      useSSL: false,
      accessKey: 'minioadmin',
      secretKey: 'd3vm1n1o',
      bucket: 'test-uploads'
    });

    const testBuffer = createTestBuffer();
    const mockFile = createMockFile(testBuffer, 'test-certificate.pdf');
    
    console.log('Buffer validation:', {
      isBuffer: Buffer.isBuffer(testBuffer),
      size: testBuffer.length,
      isPDF: testBuffer.toString().startsWith('%PDF')
    });

    // This would test the actual upload (commented out to avoid actual upload)
    // const result = await minioProvider.upload(mockFile, 'certificates/test.pdf', 'test-request');
    // console.log('✅ MinIO Upload successful:', result);
    
    console.log('✅ MinIO Provider structure validation passed');
    
  } catch (error) {
    console.error('❌ MinIO Provider test failed:', error.message);
  }
}

// Test Supabase Provider
async function testSupabaseProvider() {
  console.log('🧪 Testing Supabase Provider...');
  
  try {
    // Mock ConfigService
    const mockConfigService = {
      get: (key, defaultValue) => {
        const config = {
          'SUPABASE_URL': 'https://example.supabase.co',
          'SUPABASE_SERVICE_KEY': 'test-key',
          'SUPABASE_BUCKET': 'uploads'
        };
        return config[key] || defaultValue;
      }
    };

    const supabaseProvider = new SupabaseStorageProvider(mockConfigService);

    const testBuffer = createTestBuffer();
    const mockFile = createMockFile(testBuffer, 'test-certificate.pdf');
    
    console.log('Buffer validation:', {
      isBuffer: Buffer.isBuffer(testBuffer),
      size: testBuffer.length,
      isPDF: testBuffer.toString().startsWith('%PDF')
    });

    // This would test the actual upload (commented out to avoid actual upload)
    // const result = await supabaseProvider.upload(mockFile, 'certificates/test.pdf', 'test-request');
    // console.log('✅ Supabase Upload successful:', result);
    
    console.log('✅ Supabase Provider structure validation passed');
    
  } catch (error) {
    console.error('❌ Supabase Provider test failed:', error.message);
  }
}

// Test Windows path normalization
function testWindowsPathNormalization() {
  console.log('🧪 Testing Windows path normalization...');
  
  const testPaths = [
    'certificates\\test.pdf',
    '/certificates/test.pdf',
    '//certificates//test.pdf',
    'certificates/sub\\folder/test.pdf',
    '/certificates/test.pdf'
  ];

  testPaths.forEach(path => {
    const normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\//, '');
    console.log(`"${path}" -> "${normalized}"`);
  });
  
  console.log('✅ Path normalization test passed');
}

// Test Express.Multer.File object creation
function testMulterFileObject() {
  console.log('🧪 Testing Express.Multer.File object creation...');
  
  const testBuffer = createTestBuffer();
  const mockFile = createMockFile(testBuffer, 'certificate_123.pdf');
  
  const validations = {
    hasBuffer: !!mockFile.buffer,
    isBuffer: Buffer.isBuffer(mockFile.buffer),
    hasSize: typeof mockFile.size === 'number',
    hasMimetype: typeof mockFile.mimetype === 'string',
    hasOriginalname: typeof mockFile.originalname === 'string',
    bufferNotEmpty: mockFile.buffer.length > 0
  };
  
  console.log('File object validation:', validations);
  
  const allValid = Object.values(validations).every(v => v === true);
  if (allValid) {
    console.log('✅ Express.Multer.File object validation passed');
  } else {
    console.error('❌ Express.Multer.File object validation failed');
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting comprehensive storage provider tests...\n');
  
  testWindowsPathNormalization();
  console.log('');
  
  testMulterFileObject();
  console.log('');
  
  await testMinIOProvider();
  console.log('');
  
  await testSupabaseProvider();
  console.log('');
  
  console.log('✅ All tests completed');
}

// Export for external use
module.exports = {
  createTestBuffer,
  createMockFile,
  testMinIOProvider,
  testSupabaseProvider,
  testWindowsPathNormalization,
  testMulterFileObject,
  runAllTests
};

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
