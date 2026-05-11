// users.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './user.schema';
import { Model } from 'mongoose';
import { UploadService } from 'src/avatar/upload.service';
import { AdminGateway } from 'src/admin/admin.gateway';

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<User>,
        private uploadService: UploadService,
        private adminGateway: AdminGateway,
    ) {}

    async updateAvatarWithUpload(userId: string, file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('File required');
        }

        const upload = await this.uploadService.uploadAvatar(file);

        const user = await this.userModel.findByIdAndUpdate(
            userId,
            { avatar: upload.url },
            { new: true },
        );

        if (user) {
            this.adminGateway.emitUserUpdated(user);
        }

        return {
            message: 'Avatar updated',
            avatar: upload.url,
            user,
        };
    }
}