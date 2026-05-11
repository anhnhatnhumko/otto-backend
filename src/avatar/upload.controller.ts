import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // 🔥 validate file type
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image allowed');
    }

    // 🔥 validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('File too large');
    }

    return this.uploadService.uploadAvatar(file);
  }
}