import { Injectable } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';

@Injectable()
export class UploadService {
  constructor(private cloudinaryService: CloudinaryService) {}

  async uploadAvatar(file: Express.Multer.File) {
    const result: any = await this.cloudinaryService.uploadAvatar(file);

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }
}