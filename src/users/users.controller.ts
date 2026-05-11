
import { Controller, Patch, Body, Req, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateAvatarDto } from 'src/avatar/dto/update-avatar.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt.guard';
import { FileInterceptor } from '@nestjs/platform-express';


@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @UseGuards(JwtAuthGuard)
    @Patch('avatar')
    @UseInterceptors(FileInterceptor('file'))
    async updateAvatar(
        @Req() req,
        @UploadedFile() file: Express.Multer.File,
    ) {
        return this.usersService.updateAvatarWithUpload(req.user.userId, file);
    }
}