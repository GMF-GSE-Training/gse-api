import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';

import type {
  FileMetadata,
  Participant,
  Certificate,
  ParticipantsCOT,
  User,
} from '@prisma/client';
import NodeCache from 'node-cache';

import { PrismaService } from '../common/service/prisma.service.js';

import {
  FileValidationException,
  StorageOperationException,
} from './exceptions/file.exceptions.js';
import { FileUploadService } from './file-upload.service.js';
import { AlibabaStorageProvider } from './providers/alibaba-storage.provider.js';
import { AwsStorageProvider } from './providers/aws-storage.provider.js';
import { GcpStorageProvider } from './providers/gcp-storage.provider.js';
import { LocalStorageProvider } from './providers/local-storage.provider.js';
import { NasStorageProvider } from './providers/nas-storage.provider.js';

describe('FileUploadService', () => {
  let service: FileUploadService;
  let configService: ConfigService;
  let prismaService: PrismaService;
  let localProvider: LocalStorageProvider;
  let mailService: { sendEmail: jest.Mock };

  const mockFile: Express.Multer.File = {
    buffer: Buffer.from('test content'),
    originalname: 'test.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    fieldname: 'file',
    destination: '',
    filename: '',
    path: '',
    stream: null as any,
    encoding: 'utf8',
  };

  const mockParticipant: Participant & {
    simA: FileMetadata[];
    simB: FileMetadata[];
    ktp: FileMetadata[];
    foto: FileMetadata[];
    suratSehatButaWarna: FileMetadata[];
    suratBebasNarkoba: FileMetadata[];
    qrCode: FileMetadata[];
    participantsCots: ParticipantsCOT[];
    user: User | null;
    certificates: Certificate[];
  } = {
    id: '123',
    name: 'Test Participant',
    nik: '1234567890123456',
    email: 'test@example.com',
    createdAt: new Date(),
    updatedAt: new Date(),
    idNumber: null,
    dinas: null,
    bidang: null,
    company: null,
    phoneNumber: null,
    nationality: null,
    placeOfBirth: null,
    dateOfBirth: null,
    qrCodeLink: null,
    tglKeluarSuratSehatButaWarna: null,
    tglKeluarSuratBebasNarkoba: null,
    gmfNonGmf: null,
    simA: [],
    simB: [],
    ktp: [],
    foto: [],
    suratSehatButaWarna: [],
    suratBebasNarkoba: [],
    qrCode: [],
    participantsCots: [],
    user: null,
    certificates: [],
  };

  const mockFileMetadata: FileMetadata = {
    id: 1,
    path: 'participants/123/ktp/test.jpg',
    fileName: 'test.jpg',
    mimeType: 'image/jpeg',
    fileSize: 1024,
    storageType: 'local',
    iv: 'mockIv',
    isSensitive: true,
    createdAt: new Date(),
    participantSimAId: null,
    participantSimBId: null,
    participantKtpId: '123',
    participantFotoId: null,
    participantSuratSehatButaWarnaId: null,
    participantSuratBebasNarkobaId: null,
    participantQrCodeId: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileUploadService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              switch (key) {
                case 'ENCRYPTION_KEY':
                  return 'a'.repeat(64);
                case 'STORAGE_TYPE':
                  return 'local';
                case 'ALLOWED_MIME_TYPES':
                  return 'image/jpeg,image/png,application/pdf';
                case 'MAX_FILE_SIZE':
                  return 5 * 1024 * 1024;
                case 'MAIL_ADMIN_NOTIFY':
                  return 'admin@example.com';
                case 'MAIL_USER':
                  return 'test@example.com';
                case 'MAIL_HOST':
                  return 'smtp.gmail.com';
                case 'MAIL_PORT':
                  return 587;
                case 'SUBFOLDER_RELATIONS':
                  return {
                    ktp: 'participantKtp',
                    simA: 'participantSimA',
                    simB: 'participantSimB',
                    foto: 'participantFoto',
                    suratSehatButaWarna: 'participantSuratSehatButaWarna',
                    suratBebasNarkoba: 'participantSuratBebasNarkoba',
                    qrCode: 'participantQrCode',
                  };
                default:
                  return undefined;
              }
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            participant: {
              findUnique: jest.fn(),
            },
            fileMetadata: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: LocalStorageProvider,
          useValue: {
            upload: jest.fn(),
            download: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: NasStorageProvider,
          useValue: {
            upload: jest.fn(),
            download: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: GcpStorageProvider,
          useValue: {
            upload: jest.fn(),
            download: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: AwsStorageProvider,
          useValue: {
            upload: jest.fn(),
            download: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: AlibabaStorageProvider,
          useValue: {
            upload: jest.fn(),
            download: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: 'MailService',
          useValue: {
            sendEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FileUploadService>(FileUploadService);
    configService = module.get<ConfigService>(ConfigService);
    prismaService = module.get<PrismaService>(PrismaService);
    localProvider = module.get<LocalStorageProvider>(LocalStorageProvider);
    mailService = module.get('MailService');

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should throw if ENCRYPTION_KEY is invalid', async () => {
      jest.spyOn(configService, 'get').mockImplementation(key => {
        if (key === 'ENCRYPTION_KEY') return 'invalid';
        return 'local';
      });

      await expect(
        Test.createTestingModule({
          providers: [
            FileUploadService,
            { provide: ConfigService, useValue: configService },
            { provide: PrismaService, useValue: {} },
            { provide: LocalStorageProvider, useValue: {} },
            { provide: NasStorageProvider, useValue: {} },
            { provide: GcpStorageProvider, useValue: {} },
            { provide: AwsStorageProvider, useValue: {} },
            { provide: AlibabaStorageProvider, useValue: {} },
            { provide: 'MailService', useValue: {} },
          ],
        }).compile()
      ).rejects.toThrow('Invalid encryption key configuration');
    });

    it('should throw if STORAGE_TYPE is invalid', async () => {
      jest.spyOn(configService, 'get').mockImplementation(key => {
        if (key === 'ENCRYPTION_KEY') return 'a'.repeat(64);
        if (key === 'STORAGE_TYPE') return 'invalid';
        return undefined;
      });

      await expect(
        Test.createTestingModule({
          providers: [
            FileUploadService,
            { provide: ConfigService, useValue: configService },
            { provide: PrismaService, useValue: {} },
            { provide: LocalStorageProvider, useValue: {} },
            { provide: NasStorageProvider, useValue: {} },
            { provide: GcpStorageProvider, useValue: {} },
            { provide: AwsStorageProvider, useValue: {} },
            { provide: AlibabaStorageProvider, useValue: {} },
            { provide: 'MailService', useValue: {} },
          ],
        }).compile()
      ).rejects.toThrow('Invalid storage type configuration');
    });
  });

  describe('uploadFile', () => {
    it('should upload a file successfully', async () => {
      jest
        .spyOn(prismaService.participant, 'findUnique')
        .mockResolvedValue(mockParticipant);
      jest.spyOn(service as any, 'encryptFileAsync').mockResolvedValue({
        encrypted: Buffer.from('encrypted content'),
        iv: 'mockIv',
      });
      jest
        .spyOn(service as any, 'sanitizeFileName')
        .mockReturnValue('test.jpg');
      jest
        .spyOn(prismaService.fileMetadata, 'create')
        .mockResolvedValue(mockFileMetadata);
      jest.spyOn(localProvider, 'upload').mockResolvedValue('uploads/test.jpg');

      const result = await service.uploadFile(
        mockFile,
        '123',
        'ktp',
        true,
        'req123'
      );

      expect(result).toEqual({ fileId: 1, path: 'uploads/test.jpg' });
      expect(prismaService.fileMetadata.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          path: 'uploads/test.jpg',
          fileName: 'test.jpg',
          mimeType: 'image/jpeg',
          fileSize: 1024,
          storageType: 'local',
          iv: 'mockIv',
          isSensitive: true,
          participantKtp: { connect: { id: '123' } },
        }),
      });
      expect(localProvider.upload).toHaveBeenCalled();
    });

    it('should throw FileValidationException for invalid participant', async () => {
      jest
        .spyOn(prismaService.participant, 'findUnique')
        .mockResolvedValue(null);

      await expect(service.uploadFile(mockFile, '123', 'ktp')).rejects.toThrow(
        FileValidationException
      );
    });

    it('should use fallback storage on upload failure', async () => {
      jest
        .spyOn(prismaService.participant, 'findUnique')
        .mockResolvedValue(mockParticipant);
      jest
        .spyOn(localProvider, 'upload')
        .mockRejectedValueOnce(new Error('Upload failed'));
      jest
        .spyOn(localProvider, 'upload')
        .mockResolvedValueOnce('fallback/test.jpg');
      jest.spyOn(configService, 'get').mockImplementation(key => {
        if (key === 'STORAGE_TYPE') return 'aws';
        return 'a'.repeat(64);
      });

      await expect(service.uploadFile(mockFile, '123', 'ktp')).rejects.toThrow(
        StorageOperationException
      );
      expect(localProvider.upload).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('fallback/'),
        'req123'
      );
      expect(mailService.sendEmail).toHaveBeenCalled();
    });
  });

  describe('getFile', () => {
    it('should retrieve a file from cache', async () => {
      jest.spyOn(NodeCache.prototype, 'get').mockReturnValue(mockFileMetadata);
      jest
        .spyOn(service as any, 'decryptFileAsync')
        .mockResolvedValue(Buffer.from('decrypted content'));
      jest.spyOn(localProvider, 'download').mockResolvedValue({
        buffer: Buffer.from('content'),
        mimeType: 'image/jpeg',
      });

      const result = await service.getFile(1, 'req123');

      expect(result.buffer).toEqual(Buffer.from('decrypted content'));
      expect(result.mimeType).toEqual('image/jpeg');
      expect(localProvider.download).toHaveBeenCalledWith(
        mockFileMetadata.path,
        'req123'
      );
    });

    it('should retrieve a file from database', async () => {
      jest.spyOn(NodeCache.prototype, 'get').mockReturnValue(undefined);
      jest
        .spyOn(prismaService.fileMetadata, 'findUnique')
        .mockResolvedValue(mockFileMetadata);
      jest
        .spyOn(service as any, 'decryptFileAsync')
        .mockResolvedValue(Buffer.from('decrypted content'));
      jest.spyOn(localProvider, 'download').mockResolvedValue({
        buffer: Buffer.from('content'),
        mimeType: 'image/jpeg',
      });

      const result = await service.getFile(1, 'req123');

      expect(result.buffer).toEqual(Buffer.from('decrypted content'));
      expect(prismaService.fileMetadata.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw FileValidationException for invalid file ID', async () => {
      await expect(service.getFile(-1)).rejects.toThrow(
        FileValidationException
      );
    });
  });

  describe('deleteFile', () => {
    it('should delete a file successfully', async () => {
      jest.spyOn(NodeCache.prototype, 'get').mockReturnValue(mockFileMetadata);
      jest.spyOn(localProvider, 'delete').mockResolvedValue(undefined);
      jest
        .spyOn(prismaService.fileMetadata, 'delete')
        .mockResolvedValue(mockFileMetadata);

      await service.deleteFile(1, 'req123');

      expect(localProvider.delete).toHaveBeenCalledWith(
        mockFileMetadata.path,
        'req123'
      );
      expect(prismaService.fileMetadata.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(NodeCache.prototype.del).toHaveBeenCalledWith('file:1');
    });

    it('should handle file not found gracefully', async () => {
      jest.spyOn(NodeCache.prototype, 'get').mockReturnValue(undefined);
      jest
        .spyOn(prismaService.fileMetadata, 'findUnique')
        .mockResolvedValue(null);

      await service.deleteFile(1, 'req123');

      expect(prismaService.fileMetadata.delete).not.toHaveBeenCalled();
    });
  });

  describe('sendDailyNotificationSummary', () => {
    it('should send daily summary email', async () => {
      jest.spyOn(NodeCache.prototype, 'get').mockImplementation(key => {
        if (key === 'sensitiveNotifications')
          return ['Sensitive file uploaded'];
        return [];
      });

      await service.sendDailyNotificationSummary();

      expect(mailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Daily File Upload Notification Summary',
          context: expect.objectContaining({
            sensitiveNotifications: ['Sensitive file uploaded'],
            hasSensitive: true,
          }),
        })
      );
      expect(NodeCache.prototype.del).toHaveBeenCalledWith([
        'sensitiveNotifications',
        'failureNotifications',
        'deleteNotifications',
      ]);
    });

    it('should skip if no notifications', async () => {
      jest.spyOn(NodeCache.prototype, 'get').mockReturnValue([]);

      await service.sendDailyNotificationSummary();

      expect(mailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('cleanupOrphanedFiles', () => {
    it('should delete orphaned files', async () => {
      jest
        .spyOn(prismaService.fileMetadata, 'findMany')
        .mockResolvedValue([mockFileMetadata]);
      jest
        .spyOn(localProvider, 'download')
        .mockRejectedValue(new Error('File not found'));
      jest
        .spyOn(prismaService.fileMetadata, 'delete')
        .mockResolvedValue(mockFileMetadata);

      await service.cleanupOrphanedFiles();

      expect(prismaService.fileMetadata.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(NodeCache.prototype.del).toHaveBeenCalledWith('file:1');
    });

    it('should skip files with valid storage', async () => {
      jest
        .spyOn(prismaService.fileMetadata, 'findMany')
        .mockResolvedValue([mockFileMetadata]);
      jest.spyOn(localProvider, 'download').mockResolvedValue({
        buffer: Buffer.from('content'),
        mimeType: 'image/jpeg',
      });

      await service.cleanupOrphanedFiles();

      expect(prismaService.fileMetadata.delete).not.toHaveBeenCalled();
    });

    it('should handle invalid provider', async () => {
      jest
        .spyOn(prismaService.fileMetadata, 'findMany')
        .mockResolvedValue([{ ...mockFileMetadata, storageType: 'invalid' }]);

      await service.cleanupOrphanedFiles();

      expect(prismaService.fileMetadata.delete).not.toHaveBeenCalled();
    });
  });
});
