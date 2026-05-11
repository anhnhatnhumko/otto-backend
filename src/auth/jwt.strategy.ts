import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {
    const jwtSecret = config.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          if (!req || !req.cookies) return null;
          return req.cookies['accessToken'];
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtSecret, // ⭐ FIX CHUẨN
    });
  }

  async validate(payload: any) {
    const user = await this.userModel.findById(payload.sub).select(
      'isEmailVerified email role',
    );

    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException({
        message: 'Email chưa được xác thực. Vui lòng kiểm tra hộp thư của bạn.',
        email: user.email,
      });
    }

    return {
      _id: payload.sub,
      userId: payload.sub,
      role: payload.role,
    };
  }
}