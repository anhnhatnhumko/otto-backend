import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  // private getCookieOptions() {
  //   const isProduction = process.env.NODE_ENV === 'production';

  //   return {
  //     httpOnly: true,
  //     sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
  //     secure: isProduction,
  //     maxAge: 24 * 60 * 60 * 1000,
  //   };
  // }

  private getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'none' as const,
    secure: true,
    maxAge: 24 * 60 * 60 * 1000,
  };
}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { accessToken, user } =
      await this.authService.login(dto);

    res.cookie('accessToken', accessToken, this.getCookieOptions());

    return {
      message: 'Login successful',
      user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    const { maxAge: _maxAge, ...clearOptions } = this.getCookieOptions();

    res.clearCookie('accessToken', clearOptions);

    return { message: 'Logout successful' };
  }

  @Get('verify-email')
  async verifyEmail(
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    try {
      const { email } = await this.authService.verifyEmail(token);

      return res.redirect(
        `${process.env.FRONTEND_URL}/verify-email/success?email=${encodeURIComponent(
          email,
        )}`,
      );
    } catch (error: any) {
      const email = error?.response?.email;

      return res.redirect(
        `${process.env.FRONTEND_URL}/verify-email/error${email ? `?email=${encodeURIComponent(email)}` : ''
        }`,
      );
    }
  }

  @Post('resend-verify-email')
  resendVerifyEmail(@Body('email') email: string) {
    return this.authService.resendVerifyEmail(email);
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(
    @Req() { user }: any,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.userId, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() { user }: any) {
    return this.authService.me(user.userId);
  }
}
