import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { resolvePublicUrl } from '../utils/public-url.util';

type MailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private resendApiKey: string;
  private defaultFrom: string;

  constructor() {
    const key = process.env.RESEND_API_KEY?.trim();
    if (!key) {
      throw new Error('Missing RESEND_API_KEY');
    }

    const from = process.env.MAIL_FROM?.trim();
    if (!from) {
      throw new Error('Missing MAIL_FROM (must be a verified Resend sender)');
    }

    this.resendApiKey = key;
    this.defaultFrom = from;
    this.logger.log('[MailService] Using Resend API (Resend-only mode)');
  }

  async onModuleInit() {
    this.logger.log('[MailService] Resend API key present — ready to send via Resend');
  }

  private async sendMailWithLogging(options: MailOptions, tag: string) {
    try {
      this.logger.log(`[${tag}] Sending email to=${options.to} from=${this.defaultFrom}`);

      const toValue = Array.isArray(options.to)
        ? options.to.map((item) => String(item))
        : [String(options.to)];

      const payload = {
        from: this.defaultFrom,
        to: toValue,
        subject: String(options.subject ?? ''),
        html: String(options.html ?? ''),
        text: options.text ? String(options.text) : undefined,
      };

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let responseData: any = null;
      try {
        responseData = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseData = { raw: responseText };
      }

      if (!response.ok) {
        const resendMessage = responseData?.message || responseText || 'Resend API request failed';
        throw new Error(`Resend send failed (${response.status}): ${resendMessage}`);
      }

      this.logger.log(`[${tag}] Resend send success id=${responseData?.id ?? 'unknown'} to=${options.to}`);
      return responseData;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[${tag}] Mail send failed to=${options.to} error=${errorMsg}`);
      this.logger.error(`[${tag}] Stack:`, error instanceof Error ? error.stack : '');
      throw error;
    }
  }

  async sendVerifyEmail(email: string, token: string) {
    const backend = resolvePublicUrl(process.env.BACKEND_URL, process.env.FRONTEND_URL);
    
    if (!backend) {
      this.logger.error('[verify-email] Không thể resolve BACKEND_URL', {
        BACKEND_URL: process.env.BACKEND_URL,
        FRONTEND_URL: process.env.FRONTEND_URL,
      });
      throw new Error('Không thể tạo link email - BACKEND_URL chưa được cấu hình');
    }
    
    const link = `${backend}/auth/verify-email?token=${token}`;
    this.logger.log(`[verify-email] Link: ${link}`);

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

  async sendOrderCancelledEmail(
    email: string,
    customerName: string,
    orderId: string,
    serviceName: string,
    refundAmount?: number,
  ) {
    const frontend = resolvePublicUrl(process.env.FRONTEND_URL, process.env.BACKEND_URL);
    const orderLink = `${frontend}/orders/${orderId}`;
    const formattedPrice = refundAmount
      ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(refundAmount)
      : null;

    await this.sendMailWithLogging({
      to: email,
      subject: `Đơn hàng "${serviceName}" đã bị hủy`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Xin chào ${customerName} 👋</h2>
        <p>Đơn hàng <strong>${serviceName}</strong> đã được hủy theo yêu cầu của bạn.</p>
        ${formattedPrice ? `<p>Số tiền ${formattedPrice} sẽ được hoàn về ví của bạn trong vài phút.</p>` : ''}
        <p style="text-align: center; margin: 30px 0;">
          <a href="${orderLink}" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Xem chi tiết đơn hàng</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">Nếu bạn cần trợ giúp, vui lòng liên hệ với bộ phận hỗ trợ của chúng tôi.</p>
      </div>
    `,
    }, 'order-cancelled-customer');
  }

  async sendTaskerOrderCancelledEmail(
    email: string,
    taskerName: string,
    orderId: string,
    serviceName: string,
    customerName?: string,
  ) {
    const frontend = resolvePublicUrl(process.env.FRONTEND_URL, process.env.BACKEND_URL);
    const orderLink = `${frontend}/orders/${orderId}`;

    await this.sendMailWithLogging({
      to: email,
      subject: `Khách hàng đã hủy đơn ${serviceName}`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Xin chào ${taskerName} 👋</h2>
        <p>Khách hàng ${customerName ?? ''} đã hủy đơn <strong>${serviceName}</strong> (Mã: <strong>${orderId}</strong>).</p>
        <p>Nếu bạn đã chuẩn bị hoặc đã đến địa điểm, vui lòng bỏ qua hoặc liên hệ khách hàng để xác nhận.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${orderLink}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Xem chi tiết đơn hàng</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">Cảm ơn bạn đã làm việc cùng Otto.</p>
      </div>
    `,
    }, 'order-cancelled-tasker');
  }

  async sendOrderTimeoutEmail(
    email: string,
    customerName: string,
    orderId: string,
    serviceName: string,
    refundAmount?: number,
  ) {
    const frontend = resolvePublicUrl(process.env.FRONTEND_URL, process.env.BACKEND_URL);
    const orderLink = `${frontend}/orders/${orderId}`;
    const formattedPrice = refundAmount
      ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(refundAmount)
      : null;

    await this.sendMailWithLogging({
      to: email,
      subject: `Đơn hàng "${serviceName}" đã quá hạn`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Xin chào ${customerName} 👋</h2>
        <p>Đơn hàng <strong>${serviceName}</strong> đã quá hạn và được hệ thống tự động xử lý.</p>
        ${formattedPrice ? `<p>Số tiền ${formattedPrice} đã được hoàn về ví của bạn.</p>` : ''}
        <p style="text-align: center; margin: 30px 0;">
          <a href="${orderLink}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Xem chi tiết đơn hàng</a>
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">Nếu bạn cần hỗ trợ thêm, vui lòng liên hệ với đội ngũ Otto.</p>
      </div>
    `,
    }, 'order-timeout-customer');
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
