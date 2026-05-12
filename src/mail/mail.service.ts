import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { resolvePublicUrl } from '../utils/public-url.util';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type Mail from 'nodemailer/lib/mailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Mail;
  private defaultFrom: string;

  constructor() {
    const port = Number(process.env.MAIL_PORT || 587);
    const secure = port === 465;
    if (!process.env.MAIL_HOST) {
      throw new Error('Missing MAIL_HOST');
    }

    if (!process.env.MAIL_USER) {
      throw new Error('Missing MAIL_USER');
    }

    if (!process.env.MAIL_PASS) {
      throw new Error('Missing MAIL_PASS');
    }

    const transportConfig: SMTPTransport.Options = {
      host: process.env.MAIL_HOST,
      port,
      secure,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    };

    this.defaultFrom = process.env.MAIL_FROM || process.env.MAIL_USER || 'no-reply@otto.local';
    this.transporter = nodemailer.createTransport(transportConfig);
  }

  async onModuleInit() {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully');
    } catch (error) {
      this.logger.error('SMTP verify failed', error instanceof Error ? error.stack : String(error));
    }
  }

  private async sendMailWithLogging(options: Mail.Options, tag: string) {
    try {
      const info = await this.transporter.sendMail({
        from: this.defaultFrom,
        ...options,
      });

      this.logger.log(`[${tag}] Mail sent: messageId=${info.messageId} to=${options.to}`);
      return info;
    } catch (error) {
      this.logger.error(`[${tag}] Mail send failed to=${options.to}`, error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  async sendVerifyEmail(email: string, token: string) {
    const backend = resolvePublicUrl(process.env.BACKEND_URL, process.env.FRONTEND_URL);
    const link = `${backend}/auth/verify-email?token=${token}`;

    await this.sendMailWithLogging({
      to: email,
      subject: "Xác thực email Otto",
      html: `
      <h2>Chào bạn 👋</h2>
      <p>Vui lòng xác thực email để sử dụng Otto:</p>
      <a href="${link}">Xác thực email</a>
      <p>Link hết hạn sau 15 phút</p>
    `,
    }, 'verify-email');
  }

  async sendOtpEmail(email: string, otp: string) {
    await this.sendMailWithLogging({
      to: email,
      subject: 'OTP xác nhận thanh toán OTTO',
      html: `
      <h3>Xác nhận thanh toán</h3>
      <p>Mã OTP của bạn:</p>
      <h1>${otp}</h1>
      <p>Hết hạn sau 5 phút</p>
    `,
    }, 'otp-payment');
  }

  async sendResetPasswordEmail(email: string, token: string) {
    const frontend = resolvePublicUrl(process.env.FRONTEND_URL, process.env.BACKEND_URL);
    const link = `${frontend}/reset-password?token=${encodeURIComponent(token)}`;

    await this.sendMailWithLogging({
      to: email,
      subject: 'Đặt lại mật khẩu Otto',
      html: `
      <h2>Yêu cầu đặt lại mật khẩu</h2>
      <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
      <p>Nếu đúng là bạn, vui lòng bấm vào liên kết bên dưới:</p>
      <a href="${link}">Đặt lại mật khẩu</a>
      <p>Liên kết hết hạn sau 15 phút.</p>
      <p>Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
    `,
    }, 'reset-password');
  }

  async sendTaskerAccountCreatedEmail(email: string, fullName: string, tempPassword: string) {
    const frontend = resolvePublicUrl(process.env.FRONTEND_URL, process.env.BACKEND_URL);
    const loginLink = `${frontend}/login`;

    console.log('📧 Gửi email tasker mới tới:', email);

    await this.sendMailWithLogging({
      to: email,
      subject: 'Tài khoản Tasker ở Otto của bạn đã được tạo',
      html: `
      <h2>Chào ${fullName} 👋</h2>
      <p>Quản trị viên Otto đã tạo tài khoản Tasker cho bạn.</p>
      
      <h3>Thông tin đăng nhập:</h3>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Mật khẩu tạm thời:</strong> <code>${tempPassword}</code></p>
      
      <p>Vui lòng <a href="${loginLink}">đăng nhập tại đây</a> và đổi mật khẩu của bạn ngay lập tức.</p>
      
      <p>Sau khi đăng nhập, bạn có thể:</p>
      <ul>
        <li>Cập nhật thông tin hồ sơ cá nhân</li>
        <li>Chọn các dịch vụ bạn muốn cung cấp</li>
        <li>Bắt đầu nhận đơn hàng</li>
      </ul>
      
      <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi.</p>
      <p>Cảm ơn bạn đã gia nhập Otto! 🙏</p>
    `,
    }, 'tasker-account-created');

    console.log('✅ Email tasker mới đã gửi thành công tới:', email);
  }

  async sendOrderAcceptedEmail(
    email: string,
    customerName: string,
    taskerName: string,
    orderId: string,
    serviceName: string
  ) {
    const frontend = resolvePublicUrl(process.env.FRONTEND_URL, process.env.BACKEND_URL);
    const orderLink = `${frontend}/orders/${orderId}`;

    await this.sendMailWithLogging({
      to: email,
      subject: `✅ Đơn hàng "${serviceName}" của bạn đã được nhận`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Xin chào ${customerName} 👋</h2>
        <p>Tin vui! Đơn hàng của bạn đã được <strong style="color: #10b981;">${taskerName}</strong> nhận.</p>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1f2937;">📋 Thông tin đơn hàng:</h3>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Dịch vụ:</strong> ${serviceName}</li>
            <li><strong>Người thực hiện:</strong> ${taskerName}</li>
            <li><strong>Mã đơn:</strong> ${orderId}</li>
          </ul>
        </div>
        
        <p style="text-align: center; margin: 30px 0;">
          <a href="${orderLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Xem chi tiết đơn hàng</a>
        </p>
        
        <p>Người cung cấp dịch vụ sẽ sớm liên hệ với bạn để xác nhận thời gian.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">Cảm ơn bạn đã sử dụng Otto! 🙏</p>
      </div>
      `,
    }, 'order-accepted');
  }

  async sendOrderCompletedEmail(
    email: string,
    customerName: string,
    taskerName: string,
    orderId: string,
    serviceName: string,
    totalPrice: number,
    billHtml: string
  ) {
    const frontend = resolvePublicUrl(process.env.FRONTEND_URL, process.env.BACKEND_URL);
    const orderLink = `${frontend}/orders/${orderId}`;
    const formattedPrice = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(totalPrice);

    await this.sendMailWithLogging({
      to: email,
      subject: `🎉 Đơn hàng "${serviceName}" của bạn đã hoàn thành`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Xin chào ${customerName} 👋</h2>
        <p>Đơn hàng của bạn đã hoàn thành thành công!</p>
        
        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <h3 style="margin-top: 0; color: #15803d;">✅ Đơn hàng hoàn thành</h3>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Dịch vụ:</strong> ${serviceName}</li>
            <li><strong>Người thực hiện:</strong> ${taskerName}</li>
            <li><strong>Mã đơn:</strong> ${orderId}</li>
          </ul>
        </div>

        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1f2937;">📊 Chi tiết hóa đơn:</h3>
          ${billHtml}
          <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #e5e7eb; text-align: right;">
            <h3 style="margin: 0; color: #10b981;">Tổng tiền: ${formattedPrice}</h3>
          </div>
        </div>
        
        <p style="text-align: center; margin: 30px 0;">
          <a href="${orderLink}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Xem chi tiết đơn hàng</a>
        </p>
        
        <div style="background-color: #fef3c7; padding: 12px; border-radius: 5px; border-left: 4px solid #f59e0b; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;"><strong>💭 Nhận xét của bạn rất quan trọng!</strong> Vui lòng để lại đánh giá cho dịch vụ của ${taskerName} để giúp cộng đồng.</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">Cảm ơn bạn đã sử dụng Otto! 🙏</p>
      </div>
      `,
    }, 'order-completed');
  }
}
