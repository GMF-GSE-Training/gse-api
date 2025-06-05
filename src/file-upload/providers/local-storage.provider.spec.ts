import * as fs from 'fs';
import * as path from 'path';

import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import type { Histogram, Counter } from 'prom-client';
import sanitizePath from 'sanitize-filename';

import {
  FileValidationException,
  StorageOperationException,
} from '../exceptions/file.exceptions.js';
import {
  PROM_HISTOGRAM_UPLOAD,
  PROM_HISTOGRAM_DOWNLOAD,
  PROM_HISTOGRAM_DELETE,
  PROM_COUNTER_ERRORS,
} from '../metrics.tokens.js';

import { LocalStorageProvider } from './local-storage.provider.js';

jest.mock('sanitize-filename');

describe('LocalStorageProvider', () => {
  let provider: LocalStorageProvider;
  let uploadDuration: Histogram<string>;
  let downloadDuration: Histogram<string>;
  let deleteDuration: Histogram<string>;
  let errorCounter: Counter<string>;

  beforeAll(() => {
    jest.resetModules(); // Reset cache modul sebelum semua tes
  });

  beforeEach(async () => {
    // Mock Prometheus metrics
    uploadDuration = {
      startTimer: jest.fn().mockReturnValue(jest.fn()),
    } as any;
    downloadDuration = {
      startTimer: jest.fn().mockReturnValue(jest.fn()),
    } as any;
    deleteDuration = {
      startTimer: jest.fn().mockReturnValue(jest.fn()),
    } as any;
    errorCounter = { inc: jest.fn() } as any;

    // Gunakan modul fs asli dan buat salinan yang dapat dimodifikasi
    const actualFs = jest.requireActual('fs') as typeof fs;
    const mockedFs = {
      ...actualFs,
      existsSync: jest.fn().mockReturnValue(true),
      mkdirSync: jest.fn().mockImplementation(),
      promises: {
        ...actualFs.promises,
        mkdir: jest.fn().mockResolvedValue(undefined),
        writeFile: jest.fn().mockResolvedValue(undefined),
        readFile: jest.fn().mockResolvedValue(Buffer.from('test')),
        unlink: jest.fn().mockResolvedValue(undefined),
        access: jest.fn().mockResolvedValue(undefined),
        readdir: jest.fn().mockResolvedValue([]),
        rmdir: jest.fn().mockResolvedValue(undefined),
      },
    };

    // Ganti modul fs dengan versi yang dimock
    jest.doMock('fs', () => mockedFs);

    // Mock sanitizePath
    (sanitizePath as jest.Mock).mockImplementation((input: string) => input);

    // Set default environment variables
    process.env.UPLOADS_PATH = './uploads';
    process.env.MULTIPART_THRESHOLD_MB = '10';
    process.env.RETRY_COUNT = '3';
    process.env.RETRY_MIN_TIMEOUT = '1000';
    process.env.RETRY_MAX_TIMEOUT = '5000';

    // Create testing module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocalStorageProvider,
        { provide: PROM_HISTOGRAM_UPLOAD, useValue: uploadDuration },
        { provide: PROM_HISTOGRAM_DOWNLOAD, useValue: downloadDuration },
        { provide: PROM_HISTOGRAM_DELETE, useValue: deleteDuration },
        { provide: PROM_COUNTER_ERRORS, useValue: errorCounter },
      ],
    }).compile();

    provider = module.get<LocalStorageProvider>(LocalStorageProvider);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.UPLOADS_PATH;
    delete process.env.MULTIPART_THRESHOLD_MB;
    delete process.env.RETRY_COUNT;
    delete process.env.RETRY_MIN_TIMEOUT;
    delete process.env.RETRY_MAX_TIMEOUT;
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('constructor', () => {
    it('should throw StorageOperationException for invalid UPLOADS_PATH', () => {
      process.env.UPLOADS_PATH = '';
      expect(
        () =>
          new LocalStorageProvider(
            uploadDuration,
            downloadDuration,
            deleteDuration,
            errorCounter
          )
      ).toThrow(StorageOperationException);
      expect(
        () =>
          new LocalStorageProvider(
            uploadDuration,
            downloadDuration,
            deleteDuration,
            errorCounter
          )
      ).toThrow('Local storage configuration is incomplete or invalid');
    });

    it('should create uploads directory if it does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      expect(
        () =>
          new LocalStorageProvider(
            uploadDuration,
            downloadDuration,
            deleteDuration,
            errorCounter
          )
      ).not.toThrow();
      expect(fs.mkdirSync).toHaveBeenCalledWith(process.env.UPLOADS_PATH, {
        recursive: true,
        mode: 0o700,
      });
    });
  });

  describe('upload', () => {
    it('should upload a file with streaming for large files', async () => {
      const file = {
        buffer: Buffer.alloc(15 * 1024 * 1024),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;
      const fileName = 'test.txt';
      const requestId = 'req123';

      const result = await provider.upload(file, fileName, requestId);
      expect(result).toBe(path.join(process.env.UPLOADS_PATH!, fileName));
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
      expect(fs.promises.mkdir).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
        mode: 0o700,
      });
      expect(uploadDuration.startTimer).toHaveBeenCalled();
    });

    it('should upload a small file with secure permissions', async () => {
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;
      const fileName = 'test.txt';
      const requestId = 'req123';

      const result = await provider.upload(file, fileName, requestId);
      expect(result).toBe(path.join(process.env.UPLOADS_PATH!, fileName));
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        file.buffer,
        { mode: 0o600 }
      );
      expect(uploadDuration.startTimer).toHaveBeenCalled();
    });

    it('should throw FileValidationException for invalid file name', async () => {
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;
      const invalidFileName = '../malicious.txt';
      const requestId = 'req123';

      (sanitizePath as jest.Mock).mockReturnValue('malicious.txt');
      await expect(
        provider.upload(file, invalidFileName, requestId)
      ).rejects.toThrow(FileValidationException);
      await expect(
        provider.upload(file, invalidFileName, requestId)
      ).rejects.toThrow('File name contains invalid characters');
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'upload' });
    });

    it('should throw FileValidationException for absolute path', async () => {
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;
      const invalidFileName = '/absolute/path/test.txt';
      const requestId = 'req123';

      await expect(
        provider.upload(file, invalidFileName, requestId)
      ).rejects.toThrow(FileValidationException);
      await expect(
        provider.upload(file, invalidFileName, requestId)
      ).rejects.toThrow(
        'Invalid file name. Use alphanumeric, hyphens, underscores, dots, or slashes only, and avoid absolute paths.'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'upload' });
    });

    it('should throw FileValidationException for empty file name', async () => {
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;
      const fileName = '';
      const requestId = 'req123';

      await expect(provider.upload(file, fileName, requestId)).rejects.toThrow(
        FileValidationException
      );
      await expect(provider.upload(file, fileName, requestId)).rejects.toThrow(
        'File name cannot be empty'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'upload' });
    });

    it('should throw FileValidationException for sanitized empty file name', async () => {
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;
      const fileName = 'invalid*name.txt';
      const requestId = 'req123';

      (sanitizePath as jest.Mock).mockReturnValue('');
      await expect(provider.upload(file, fileName, requestId)).rejects.toThrow(
        FileValidationException
      );
      await expect(provider.upload(file, fileName, requestId)).rejects.toThrow(
        'File name cannot be empty after sanitization'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'upload' });
    });

    it('should throw FileValidationException for no file provided', async () => {
      const file = {} as Express.Multer.File;
      const fileName = 'test.txt';
      const requestId = 'req123';

      await expect(provider.upload(file, fileName, requestId)).rejects.toThrow(
        FileValidationException
      );
      await expect(provider.upload(file, fileName, requestId)).rejects.toThrow(
        'No file provided'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'upload' });
    });

    it('should throw StorageOperationException for permission error', async () => {
      (fs.promises.writeFile as jest.Mock).mockRejectedValue(
        Object.assign(new Error('Permission denied'), { code: 'EACCES' })
      );
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;
      const fileName = 'test.txt';
      const requestId = 'req123';

      await expect(provider.upload(file, fileName, requestId)).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.upload(file, fileName, requestId)).rejects.toThrow(
        'Permission denied during file upload'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'upload' });
    });

    it('should throw StorageOperationException for disk full error', async () => {
      (fs.promises.writeFile as jest.Mock).mockRejectedValue(
        Object.assign(new Error('No space left on device'), { code: 'ENOSPC' })
      );
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;
      const fileName = 'test.txt';
      const requestId = 'req123';

      await expect(provider.upload(file, fileName, requestId)).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.upload(file, fileName, requestId)).rejects.toThrow(
        'Disk full during file upload'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'upload' });
    });

    it('should throw StorageOperationException for busy file error', async () => {
      (fs.promises.writeFile as jest.Mock).mockRejectedValue(
        Object.assign(new Error('File is busy'), { code: 'EBUSY' })
      );
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;
      const fileName = 'test.txt';
      const requestId = 'req123';

      await expect(provider.upload(file, fileName, requestId)).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.upload(file, fileName, requestId)).rejects.toThrow(
        'File is busy or locked during upload'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'upload' });
    });

    it('should throw StorageOperationException for I/O error', async () => {
      (fs.promises.writeFile as jest.Mock).mockRejectedValue(
        Object.assign(new Error('I/O error'), { code: 'EIO' })
      );
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;
      const fileName = 'test.txt';
      const requestId = 'req123';

      await expect(provider.upload(file, fileName, requestId)).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.upload(file, fileName, requestId)).rejects.toThrow(
        'I/O error during file upload'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'upload' });
    });

    it('should retry on transient failure during write', async () => {
      let writeAttempts = 0;
      (fs.promises.writeFile as jest.Mock).mockImplementation(async () => {
        writeAttempts++;
        if (writeAttempts < 3) {
          throw Object.assign(new Error('Temporary error'), { code: 'EAGAIN' });
        }
        return;
      });
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;
      const fileName = 'test.txt';
      const requestId = 'req123';

      await expect(
        provider.upload(file, fileName, requestId)
      ).resolves.toBeDefined();
      expect(fs.promises.writeFile).toHaveBeenCalledTimes(3);
      expect(uploadDuration.startTimer).toHaveBeenCalled();
      expect(errorCounter.inc).not.toHaveBeenCalled();
    });

    it('should use fallback multipart threshold if environment variable is unset', async () => {
      delete process.env.MULTIPART_THRESHOLD_MB;
      const file = {
        buffer: Buffer.alloc(15 * 1024 * 1024),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;
      const fileName = 'test.txt';
      const requestId = 'req123';

      const result = await provider.upload(file, fileName, requestId);
      expect(result).toBe(path.join(process.env.UPLOADS_PATH!, fileName));
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
      expect(fs.promises.mkdir).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
        mode: 0o700,
      });
      expect(uploadDuration.startTimer).toHaveBeenCalled();
    });
  });

  describe('download', () => {
    it('should download a file', async () => {
      const filePath = 'test.txt';
      const requestId = 'req123';

      const result = await provider.download(filePath, requestId);
      expect(result.buffer).toEqual(Buffer.from('test'));
      expect(result.mimeType).toBe('text/plain');
      expect(fs.promises.readFile).toHaveBeenCalled();
      expect(fs.promises.access).toHaveBeenCalled();
      expect(downloadDuration.startTimer).toHaveBeenCalled();
    });

    it('should throw FileValidationException for non-existent file', async () => {
      (fs.promises.access as jest.Mock).mockRejectedValue(
        Object.assign(new Error('No such file'), { code: 'ENOENT' })
      );
      const filePath = 'nonexistent.txt';
      const requestId = 'req123';

      await expect(provider.download(filePath, requestId)).rejects.toThrow(
        FileValidationException
      );
      await expect(provider.download(filePath, requestId)).rejects.toThrow(
        'File not found'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'download' });
    });

    it('should throw StorageOperationException for permission error', async () => {
      (fs.promises.access as jest.Mock).mockRejectedValue(
        Object.assign(new Error('Permission denied'), { code: 'EACCES' })
      );
      const filePath = 'test.txt';
      const requestId = 'req123';

      await expect(provider.download(filePath, requestId)).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.download(filePath, requestId)).rejects.toThrow(
        'Permission denied during file download'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'download' });
    });

    it('should throw StorageOperationException for busy file error', async () => {
      (fs.promises.readFile as jest.Mock).mockRejectedValue(
        Object.assign(new Error('File is busy'), { code: 'EBUSY' })
      );
      const filePath = 'test.txt';
      const requestId = 'req123';

      await expect(provider.download(filePath, requestId)).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.download(filePath, requestId)).rejects.toThrow(
        'File is busy or locked during download'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'download' });
    });

    it('should throw StorageOperationException for I/O error', async () => {
      (fs.promises.readFile as jest.Mock).mockRejectedValue(
        Object.assign(new Error('I/O error'), { code: 'EIO' })
      );
      const filePath = 'test.txt';
      const requestId = 'req123';

      await expect(provider.download(filePath, requestId)).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.download(filePath, requestId)).rejects.toThrow(
        'I/O error during file download'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'download' });
    });

    it('should throw FileValidationException for invalid file path', async () => {
      const filePath = '../malicious.txt';
      const requestId = 'req123';
      (sanitizePath as jest.Mock).mockReturnValue('malicious.txt');

      await expect(provider.download(filePath, requestId)).rejects.toThrow(
        FileValidationException
      );
      await expect(provider.download(filePath, requestId)).rejects.toThrow(
        'File name contains invalid characters'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'download' });
    });

    it('should throw FileValidationException for sanitized empty file path', async () => {
      const filePath = 'invalid*path.txt';
      const requestId = 'req123';
      (sanitizePath as jest.Mock).mockReturnValue('');

      await expect(provider.download(filePath, requestId)).rejects.toThrow(
        FileValidationException
      );
      await expect(provider.download(filePath, requestId)).rejects.toThrow(
        'File name cannot be empty after sanitization'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'download' });
    });

    it('should retry on transient failure during read', async () => {
      let readAttempts = 0;
      (fs.promises.readFile as jest.Mock).mockImplementation(async () => {
        readAttempts++;
        if (readAttempts < 3) {
          throw Object.assign(new Error('Temporary error'), { code: 'EAGAIN' });
        }
        return Buffer.from('test');
      });
      const filePath = 'test.txt';
      const requestId = 'req123';

      await expect(
        provider.download(filePath, requestId)
      ).resolves.toBeDefined();
      expect(fs.promises.readFile).toHaveBeenCalledTimes(3);
      expect(downloadDuration.startTimer).toHaveBeenCalled();
      expect(errorCounter.inc).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a file and clean up empty directories', async () => {
      const filePath = 'test.txt';
      const requestId = 'req123';

      await provider.delete(filePath, requestId);
      expect(fs.promises.unlink).toHaveBeenCalled();
      expect(fs.promises.readdir).toHaveBeenCalled();
      expect(fs.promises.rmdir).toHaveBeenCalled();
      expect(deleteDuration.startTimer).toHaveBeenCalled();
    });

    it('should log warning and not throw for non-existent file', async () => {
      (fs.promises.access as jest.Mock).mockRejectedValue(
        Object.assign(new Error('No such file'), { code: 'ENOENT' })
      );
      const filePath = 'nonexistent.txt';
      const requestId = 'req123';

      await expect(
        provider.delete(filePath, requestId)
      ).resolves.toBeUndefined();
      expect(fs.promises.unlink).not.toHaveBeenCalled();
      expect(fs.promises.readdir).not.toHaveBeenCalled();
      expect(deleteDuration.startTimer).toHaveBeenCalled();
    });

    it('should stop directory cleanup if directory is not empty', async () => {
      const mockDirent = {
        isFile: jest.fn().mockReturnValue(true),
        isDirectory: jest.fn().mockReturnValue(false),
        name: 'other-file.txt',
      } as unknown as fs.Dirent;
      (fs.promises.readdir as jest.Mock).mockResolvedValue([mockDirent]);
      const filePath = 'test.txt';
      const requestId = 'req123';

      await provider.delete(filePath, requestId);
      expect(fs.promises.unlink).toHaveBeenCalled();
      expect(fs.promises.readdir).toHaveBeenCalled();
      expect(fs.promises.rmdir).not.toHaveBeenCalled();
      expect(deleteDuration.startTimer).toHaveBeenCalled();
    });

    it('should throw StorageOperationException for permission error', async () => {
      (fs.promises.unlink as jest.Mock).mockRejectedValue(
        Object.assign(new Error('Permission denied'), { code: 'EACCES' })
      );
      const filePath = 'test.txt';
      const requestId = 'req123';

      await expect(provider.delete(filePath, requestId)).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.delete(filePath, requestId)).rejects.toThrow(
        'Permission denied during file deletion'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'delete' });
    });

    it('should throw StorageOperationException for busy file error', async () => {
      (fs.promises.unlink as jest.Mock).mockRejectedValue(
        Object.assign(new Error('File is busy'), { code: 'EBUSY' })
      );
      const filePath = 'test.txt';
      const requestId = 'req123';

      await expect(provider.delete(filePath, requestId)).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.delete(filePath, requestId)).rejects.toThrow(
        'File is busy or locked during deletion'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'delete' });
    });

    it('should throw StorageOperationException for I/O error', async () => {
      (fs.promises.unlink as jest.Mock).mockRejectedValue(
        Object.assign(new Error('I/O error'), { code: 'EIO' })
      );
      const filePath = 'test.txt';
      const requestId = 'req123';

      await expect(provider.delete(filePath, requestId)).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.delete(filePath, requestId)).rejects.toThrow(
        'I/O error during file deletion'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'delete' });
    });

    it('should throw FileValidationException for invalid file path', async () => {
      const filePath = '../malicious.txt';
      const requestId = 'req123';
      (sanitizePath as jest.Mock).mockReturnValue('malicious.txt');

      await expect(provider.delete(filePath, requestId)).rejects.toThrow(
        FileValidationException
      );
      await expect(provider.delete(filePath, requestId)).rejects.toThrow(
        'File name contains invalid characters'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'delete' });
    });

    it('should throw FileValidationException for sanitized empty file path', async () => {
      const filePath = 'invalid*path.txt';
      const requestId = 'req123';
      (sanitizePath as jest.Mock).mockReturnValue('');

      await expect(provider.delete(filePath, requestId)).rejects.toThrow(
        FileValidationException
      );
      await expect(provider.delete(filePath, requestId)).rejects.toThrow(
        'File name cannot be empty after sanitization'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({ operation: 'delete' });
    });

    it('should retry on transient failure during delete', async () => {
      let unlinkAttempts = 0;
      (fs.promises.unlink as jest.Mock).mockImplementation(async () => {
        unlinkAttempts++;
        if (unlinkAttempts < 3) {
          throw Object.assign(new Error('Temporary error'), { code: 'EAGAIN' });
        }
        return;
      });
      const filePath = 'test.txt';
      const requestId = 'req123';

      await expect(
        provider.delete(filePath, requestId)
      ).resolves.toBeUndefined();
      expect(fs.promises.unlink).toHaveBeenCalledTimes(3);
      expect(deleteDuration.startTimer).toHaveBeenCalled();
      expect(errorCounter.inc).not.toHaveBeenCalled();
    });
  });

  describe('checkExists', () => {
    it('should return true for existing file', async () => {
      const filePath = 'test.txt';
      const requestId = 'req123';

      const result = await provider.checkExists(filePath, requestId);
      expect(result).toBe(true);
      expect(fs.promises.access).toHaveBeenCalledWith(
        expect.any(String),
        fs.constants.F_OK
      );
    });

    it('should return false for non-existent file', async () => {
      (fs.promises.access as jest.Mock).mockRejectedValue(
        Object.assign(new Error('No such file'), { code: 'ENOENT' })
      );
      const filePath = 'nonexistent.txt';
      const requestId = 'req123';

      const result = await provider.checkExists(filePath, requestId);
      expect(result).toBe(false);
      expect(fs.promises.access).toHaveBeenCalledWith(
        expect.any(String),
        fs.constants.F_OK
      );
    });

    it('should throw StorageOperationException for permission error', async () => {
      (fs.promises.access as jest.Mock).mockRejectedValue(
        Object.assign(new Error('Permission denied'), { code: 'EACCES' })
      );
      const filePath = 'test.txt';
      const requestId = 'req123';

      await expect(provider.checkExists(filePath, requestId)).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.checkExists(filePath, requestId)).rejects.toThrow(
        'Permission denied during file existence check'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({
        operation: 'checkExists',
      });
    });

    it('should throw StorageOperationException for busy file error', async () => {
      (fs.promises.access as jest.Mock).mockRejectedValue(
        Object.assign(new Error('File is busy'), { code: 'EBUSY' })
      );
      const filePath = 'test.txt';
      const requestId = 'req123';

      await expect(provider.checkExists(filePath, requestId)).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.checkExists(filePath, requestId)).rejects.toThrow(
        'File is busy or locked during existence check'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({
        operation: 'checkExists',
      });
    });

    it('should throw StorageOperationException for I/O error', async () => {
      (fs.promises.access as jest.Mock).mockRejectedValue(
        Object.assign(new Error('I/O error'), { code: 'EIO' })
      );
      const filePath = 'test.txt';
      const requestId = 'req123';

      await expect(provider.checkExists(filePath, requestId)).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.checkExists(filePath, requestId)).rejects.toThrow(
        'I/O error during file existence check'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({
        operation: 'checkExists',
      });
    });

    it('should throw FileValidationException for invalid file path', async () => {
      const filePath = '../malicious.txt';
      const requestId = 'req123';
      (sanitizePath as jest.Mock).mockReturnValue('malicious.txt');

      await expect(provider.checkExists(filePath, requestId)).rejects.toThrow(
        FileValidationException
      );
      await expect(provider.checkExists(filePath, requestId)).rejects.toThrow(
        'File name contains invalid characters'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({
        operation: 'checkExists',
      });
    });

    it('should throw FileValidationException for empty file path', async () => {
      const filePath = '';
      const requestId = 'req123';

      await expect(provider.checkExists(filePath, requestId)).rejects.toThrow(
        FileValidationException
      );
      await expect(provider.checkExists(filePath, requestId)).rejects.toThrow(
        'File name cannot be empty'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({
        operation: 'checkExists',
      });
    });

    it('should throw FileValidationException for sanitized empty file path', async () => {
      const filePath = 'invalid*path.txt';
      const requestId = 'req123';
      (sanitizePath as jest.Mock).mockReturnValue('');

      await expect(provider.checkExists(filePath, requestId)).rejects.toThrow(
        FileValidationException
      );
      await expect(provider.checkExists(filePath, requestId)).rejects.toThrow(
        'File name cannot be empty after sanitization'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({
        operation: 'checkExists',
      });
    });

    it('should retry on transient failure during access', async () => {
      let accessAttempts = 0;
      (fs.promises.access as jest.Mock).mockImplementation(async () => {
        accessAttempts++;
        if (accessAttempts < 3) {
          throw Object.assign(new Error('Temporary error'), { code: 'EAGAIN' });
        }
        return;
      });
      const filePath = 'test.txt';
      const requestId = 'req123';

      const result = await provider.checkExists(filePath, requestId);
      expect(result).toBe(true);
      expect(fs.promises.access).toHaveBeenCalledTimes(3);
      expect(errorCounter.inc).not.toHaveBeenCalled();
    });
  });

  describe('checkHealth', () => {
    it('should pass health check by writing and deleting test file', async () => {
      await provider.checkHealth();
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        'test',
        { mode: 0o600 }
      );
      expect(fs.promises.unlink).toHaveBeenCalledWith(expect.any(String));
    });

    it('should throw StorageOperationException for permission error', async () => {
      (fs.promises.writeFile as jest.Mock).mockRejectedValue(
        Object.assign(new Error('Permission denied'), { code: 'EACCES' })
      );
      await expect(provider.checkHealth()).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.checkHealth()).rejects.toThrow(
        'Permission denied during health check'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({
        operation: 'checkHealth',
      });
    });

    it('should throw StorageOperationException for disk full error', async () => {
      (fs.promises.writeFile as jest.Mock).mockRejectedValue(
        Object.assign(new Error('No space left on device'), { code: 'ENOSPC' })
      );
      await expect(provider.checkHealth()).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.checkHealth()).rejects.toThrow(
        'Disk full during health check'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({
        operation: 'checkHealth',
      });
    });

    it('should throw StorageOperationException for busy file error', async () => {
      (fs.promises.writeFile as jest.Mock).mockRejectedValue(
        Object.assign(new Error('File is busy'), { code: 'EBUSY' })
      );
      await expect(provider.checkHealth()).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.checkHealth()).rejects.toThrow(
        'File is busy or locked during health check'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({
        operation: 'checkHealth',
      });
    });

    it('should throw StorageOperationException for I/O error', async () => {
      (fs.promises.writeFile as jest.Mock).mockRejectedValue(
        Object.assign(new Error('I/O error'), { code: 'EIO' })
      );
      await expect(provider.checkHealth()).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.checkHealth()).rejects.toThrow(
        'I/O error during health check'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({
        operation: 'checkHealth',
      });
    });

    it('should throw StorageOperationException for generic error', async () => {
      (fs.promises.writeFile as jest.Mock).mockRejectedValue(
        new Error('Disk error')
      );
      await expect(provider.checkHealth()).rejects.toThrow(
        StorageOperationException
      );
      await expect(provider.checkHealth()).rejects.toThrow(
        'Local storage health check failed: Disk error'
      );
      expect(errorCounter.inc).toHaveBeenCalledWith({
        operation: 'checkHealth',
      });
    });

    it('should retry on transient failure during write', async () => {
      let writeAttempts = 0;
      (fs.promises.writeFile as jest.Mock).mockImplementation(async () => {
        writeAttempts++;
        if (writeAttempts < 3) {
          throw Object.assign(new Error('Temporary error'), { code: 'EAGAIN' });
        }
        return;
      });

      await expect(provider.checkHealth()).resolves.toBeUndefined();
      expect(fs.promises.writeFile).toHaveBeenCalledTimes(3);
      expect(fs.promises.unlink).toHaveBeenCalled();
      expect(errorCounter.inc).not.toHaveBeenCalled();
    });

    it('should retry on transient failure during delete', async () => {
      let unlinkAttempts = 0;
      (fs.promises.unlink as jest.Mock).mockImplementation(async () => {
        unlinkAttempts++;
        if (unlinkAttempts < 3) {
          throw Object.assign(new Error('Temporary error'), { code: 'EAGAIN' });
        }
        return;
      });

      await expect(provider.checkHealth()).resolves.toBeUndefined();
      expect(fs.promises.writeFile).toHaveBeenCalled();
      expect(fs.promises.unlink).toHaveBeenCalledTimes(3);
      expect(errorCounter.inc).not.toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should use fallback retry settings if environment variables are unset', async () => {
      delete process.env.RETRY_COUNT;
      delete process.env.RETRY_MIN_TIMEOUT;
      delete process.env.RETRY_MAX_TIMEOUT;
      let writeAttempts = 0;
      (fs.promises.writeFile as jest.Mock).mockImplementation(async () => {
        writeAttempts++;
        if (writeAttempts < 3) {
          throw Object.assign(new Error('Temporary error'), { code: 'EAGAIN' });
        }
        return;
      });
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;
      const fileName = 'test.txt';
      const requestId = 'req123';

      await expect(
        provider.upload(file, fileName, requestId)
      ).resolves.toBeDefined();
      expect(fs.promises.writeFile).toHaveBeenCalledTimes(3);
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        file.buffer,
        { mode: 0o600 }
      );
      expect(uploadDuration.startTimer).toHaveBeenCalled();
      expect(errorCounter.inc).not.toHaveBeenCalled();
    });

    it('should respect custom retry settings from environment variables', async () => {
      process.env.RETRY_COUNT = '2';
      process.env.RETRY_MIN_TIMEOUT = '500';
      process.env.RETRY_MAX_TIMEOUT = '2000';
      let writeAttempts = 0;
      (fs.promises.writeFile as jest.Mock).mockImplementation(async () => {
        writeAttempts++;
        if (writeAttempts <= 2) {
          throw Object.assign(new Error('Temporary error'), { code: 'EAGAIN' });
        }
        return;
      });
      const file = {
        buffer: Buffer.from('test'),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;
      const fileName = 'test.txt';
      const requestId = 'req123';

      await expect(
        provider.upload(file, fileName, requestId)
      ).resolves.toBeDefined();
      expect(fs.promises.writeFile).toHaveBeenCalledTimes(3);
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        file.buffer,
        { mode: 0o600 }
      );
      expect(uploadDuration.startTimer).toHaveBeenCalled();
      expect(errorCounter.inc).not.toHaveBeenCalled();
    });

    it('should use default multipart threshold if MULTIPART_THRESHOLD_MB is invalid', async () => {
      process.env.MULTIPART_THRESHOLD_MB = 'invalid';
      const file = {
        buffer: Buffer.alloc(15 * 1024 * 1024),
        originalname: 'test.txt',
        mimetype: 'text/plain',
      } as Express.Multer.File;
      const fileName = 'test.txt';
      const requestId = 'req123';

      const result = await provider.upload(file, fileName, requestId);
      expect(result).toBe(path.join(process.env.UPLOADS_PATH!, fileName));
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
      expect(fs.promises.mkdir).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
        mode: 0o700,
      });
      expect(uploadDuration.startTimer).toHaveBeenCalled();
    });
  });
});
