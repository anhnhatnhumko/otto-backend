import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/user.schema';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private mailService: MailService,
    private jwtService: JwtService,
  ) {}

  // ================= REGISTER =================
  async register(dto: RegisterDto): Promise<{ message: string }> {
    const hashed = await bcrypt.hash(dto.password, 10);

    const exists = await this.userModel.findOne({
      $or: [{ email: dto.email }, { phone: dto.phone }],
    });

    if (exists) {
      throw new BadRequestException(
        'Email hoặc số điện thoại đã được sử dụng',
      );
    }

    const verifyToken = this.jwtService.sign(
      { email: dto.email },
      { expiresIn: '15m' },
    );

    const user = await this.userModel.create({
      email: dto.email,
      phone: dto.phone,
      password: hashed,
      fullName: dto.fullName,
      role: 'CUSTOMER',
      isEmailVerified: false,
      emailVerifyToken: verifyToken,
      emailVerifyExpires: new Date(Date.now() + 15 * 60 * 1000),
    });

    // await this.mailService.sendVerifyEmail(user.email, verifyToken);

    return {
      message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực.',
    };
  }

  // ================= LOGIN =================
  async login(dto: LoginDto): Promise<{
    accessToken: string;
    user: {
      _id: string;
      fullName: string;
      email: string;
      role: string;
      mustChangePassword: boolean;
    };
  }> {
    console.log("SIGN SECRET:", process.env.JWT_SECRET);
    const user = await this.userModel.findOne({ email: dto.email });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const match = await bcrypt.compare(dto.password, user.password);

    if (!match) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Email chưa được xác thực. Vui lòng kiểm tra hộp thư của bạn.',
      );
    }

    // ✅ chuẩn JWT
    const payload = {
      sub: user._id.toString(),
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        _id: user._id.toString(), // ✅ luôn string
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        mustChangePassword: Boolean((user as any).mustChangePassword),
      },
    };
  }

  async changePassword(
    userId: string,
    dto: { currentPassword: string; newPassword: string },
  ): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    const isCurrentPasswordMatch = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordMatch) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    (user as any).mustChangePassword = false;

    await user.save();

    return {
      message: 'Đổi mật khẩu thành công',
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userModel.findOne({ email });

    if (!user) {
      return {
        message:
          'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.',
      };
    }

    const resetToken = this.jwtService.sign(
      {
        sub: user._id.toString(),
        purpose: 'reset-password',
      },
      { expiresIn: '15m' },
    );

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    await this.mailService.sendResetPasswordEmail(user.email, resetToken);

    return {
      message:
        'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const token = dto.token?.trim();
    const newPassword = dto.newPassword;

    if (!token) {
      throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ');
    }

    let payload: any;

    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
    }

    if (payload?.purpose !== 'reset-password' || !payload?.sub) {
      throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ');
    }

    const user = await this.userModel.findById(payload.sub);

    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    if (
      !user.resetPasswordToken ||
      user.resetPasswordToken !== token ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires.getTime() < Date.now()
    ) {
      throw new BadRequestException('Yêu cầu đặt lại mật khẩu không còn hiệu lực');
    }

    const isSameAsCurrent = await bcrypt.compare(newPassword, user.password);
    if (isSameAsCurrent) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    (user as any).mustChangePassword = false;

    await user.save();

    return {
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.',
    };
  }

  // ================= VERIFY EMAIL =================
  async verifyEmail(token: string): Promise<{ email: string }> {
    if (!token) {
      throw new UnauthorizedException('Token không tồn tại');
    }

    let payload: any;

    try {
      payload = this.jwtService.verify(token);
    } catch (err) {
      const decoded: any = this.jwtService.decode(token);

      if (decoded?.email) {
        throw new UnauthorizedException({
          message: 'Token không hợp lệ hoặc đã hết hạn',
          email: decoded.email,
        });
      }

      throw new UnauthorizedException('Token không hợp lệ');
    }

    const user = await this.userModel.findOne({
      email: payload.email,
      emailVerifyToken: token,
    });

    if (!user) {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }

    if (
      user.emailVerifyExpires &&
      user.emailVerifyExpires.getTime() < Date.now()
    ) {
      throw new UnauthorizedException({
        message: 'Token đã hết hạn',
        email: user.email,
      });
    }

    if (user.isEmailVerified) {
      return { email: user.email };
    }

    user.isEmailVerified = true;
    user.emailVerifyToken = undefined;
    user.emailVerifyExpires = undefined;

    await user.save();

    return { email: user.email };
  }

  // ================= RESEND =================
  async resendVerifyEmail(email: string) {
    const user = await this.userModel.findOne({ email });

    if (!user) {
      throw new UnauthorizedException('Email không tồn tại, vui lòng kiểm tra lại');
    }

    if (user.isEmailVerified) {
      throw new UnauthorizedException('Email đã được xác thực.');
    }

    const verifyToken = this.jwtService.sign(
      { email: user.email },
      { expiresIn: '15m' },
    );

    user.emailVerifyToken = verifyToken;
    await user.save();

    await this.mailService.sendVerifyEmail(user.email, verifyToken);

    return {
      message:
        'Đã gửi lại email xác thực. Vui lòng kiểm tra hộp thư của bạn.',
    };
  }

  // ================= ME =================
  async me(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('-password');

    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async getProfile(userId: string) {
    return this.userModel.findById(userId).select('-password');
  }
}