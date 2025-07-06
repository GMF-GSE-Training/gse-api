import { Controller, Post, Get, Delete, UploadedFile, UseInterceptors, Param, Body, Res, HttpStatus, Inject } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileUploadService } from './file-upload.service';
import { Response } from 'express';

@Controller('file-upload')
export class FileUploadController {
  constructor(
    private readonly fileUploadService: FileUploadService,
    @Inject('STORAGE_PROVIDER') private readonly storageProvider: any
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Body('fileName') fileName: string) {
    const path = await this.fileUploadService.uploadFile(file, fileName);
    return { status: 'success', path };
  }

  @Get('download/:filePath')
  async downloadFile(@Param('filePath') filePath: string, @Res() res: Response) {
    const { buffer, mimeType } = await this.fileUploadService.downloadFile(filePath);
    res.setHeader('Content-Type', mimeType);
    res.send(buffer);
  }

  @Delete('delete/:filePath')
  async deleteFile(@Param('filePath') filePath: string) {
    await this.fileUploadService.deleteFile(filePath);
    return { status: 'deleted', filePath };
  }

  @Get('signed-url/:filePath')
  async getSignedUrl(@Param('filePath') filePath: string) {
    const signedUrl = await this.fileUploadService.getSignedUrl(filePath);
    return { signedUrl };
  }
} 