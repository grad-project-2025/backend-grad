import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  EmailTemplateService,
  BookingEmailData,
} from './services/email-template.service';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private config: ConfigService,
    private emailTemplateService: EmailTemplateService,
  ) {}

  async onModuleInit() {
    await this.initializeTransporter();
  }

  private async initializeTransporter(): Promise<void> {
    try {
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('MAIL_HOST'),
        port: 587,
        secure: false,
        auth: {
          user: this.config.get<string>('MAIL_USER'),
          pass: this.config.get<string>('MAIL_PASSWORD'),
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 10000,
        socketTimeout: 10000,
        logger: true,
        debug: true,
      });

      await this.verifyTransporter();
    } catch (error) {
      this.logger.error(
        'Failed to initialize email transporter',
        (error as Error).stack,
      );
      throw new Error('Email service configuration error');
    }
  }

  private async verifyTransporter(): Promise<void> {
    try {
      const success = await this.transporter.verify();
      if (success) {
        this.logger.log('Email transporter verified successfully');
      }
    } catch (error) {
      this.logger.error(
        'Failed to verify email transporter',
        (error as Error).stack,
      );
      throw new Error('Email service connection failed');
    }
  }

  async sendVerificationEmail(email: string, code: string): Promise<void> {
    if (!code) {
      this.logger.error('Verification code missing for email: ' + email);
      throw new BadRequestException('Verification code is required');
    }

    const html = this.generateEmailTemplate({
      title: 'Email Verification',
      message: `Hi there,<br><br>Thanks for signing up! Your verification code is:<br><br><strong style="font-size: 24px; letter-spacing: 5px;">${code}</strong><br><br>Please enter this code in the app to verify your email.`,
      buttonText: '',
      buttonUrl: '',
      footer:
        'If you didn’t request this, feel free to ignore this email.<br><br>Best,<br>The Airport Team',
    });

    await this.sendEmail({
      to: email,
      subject: 'Verify Your Email Address',
      html,
      from: `"Backend Team" <${this.config.get('MAIL_FROM')}>`,
    });
  }
  private generateEmailTemplate(options: {
    title: string;
    message: string;
    buttonText: string;
    buttonUrl: string;
    footer: string;
  }): string {
    const buttonHtml = options.buttonUrl
      ? `<a href="${options.buttonUrl}" style="background-color: ${options.title.includes('Verification') ? '#2196F3' : '#4CAF50'}; color: white; padding: 14px 25px; text-align: center; text-decoration: none; display: inline-block; border-radius: 4px;">${options.buttonText}</a>`
      : '';
    return `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>${options.title}</h2>
        <p>${options.message}</p>
        ${buttonHtml}
        <p style="margin-top: 20px; color: #666;">${options.footer}</p>
      </div>
    `;
  }
  async sendPasswordResetEmail(email: string, code: string): Promise<void> {
    if (!code) {
      this.logger.error('Password reset code missing for email: ' + email);
      throw new BadRequestException('Reset code is required');
    }

    const html = this.generateEmailTemplate({
      title: 'Reset Your Password',
      message: `
        Hi there,<br><br>
        We received a request to reset your password. Here’s your reset code:<br><br>
        <span style="background-color: #4CAF50; color: white; padding: 10px 20px; font-size: 20px; font-weight: bold; border-radius: 5px; display: inline-block;">${code}</span><br><br>
        Please enter this code in the app to reset your password.
      `,
      buttonText: '', // No button
      buttonUrl: '', // No URL
      footer: `
        This code will expire in 1 hour. If you didn’t request this, feel free to ignore this email.<br><br>
        Best,<br>The Airport Team
      `,
    });

    await this.sendEmail({
      to: email,
      subject: 'Reset Your Password',
      html,
      from: `"Backend Team" <${this.config.get('MAIL_FROM')}>`,
    });
  }

  async sendImportantEmail(
    email: string,
    subject: string,
    html: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject,
      html,
      from: `"Important Notification" <${this.config.get('MAIL_FROM')}>`,
    });
  }

  /**
   * Send booking confirmation email with QR code
   */
  async sendBookingConfirmationEmail(
    bookingData: BookingEmailData,
  ): Promise<void> {
    try {
      this.logger.log(
        `Generating booking confirmation email for ${bookingData.bookingRef}`,
      );

      const html =
        await this.emailTemplateService.generateBookingConfirmationEmail(
          bookingData,
        );

      // Generate subject line based on booking type
      let subject = `✈️ Booking Confirmed - ${bookingData.bookingRef}`;

      if (bookingData.bookingType === 'ROUND_TRIP' && bookingData.flightData) {
        const goFlight = bookingData.flightData.find(f => f.typeOfFlight === 'GO');
        if (goFlight) {
          subject += ` | ${goFlight.originAirportCode} ⇄ ${goFlight.destinationAirportCode}`;
        }
      } else if (bookingData.originAirportCode && bookingData.destinationAirportCode) {
        subject += ` | ${bookingData.originAirportCode} → ${bookingData.destinationAirportCode}`;
      }

      await this.sendEmail({
        to: bookingData.contactDetails.email,
        subject,
        html,
        from: `"Smart Airport" <${this.config.get('MAIL_FROM')}>`,
      });

      this.logger.log(
        `Booking confirmation email sent successfully to ${bookingData.contactDetails.email} for booking ${bookingData.bookingRef}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send booking confirmation email for booking ${bookingData.bookingRef}:`,
        error instanceof Error ? error.stack : error,
      );
      // Don't throw error here - email failure shouldn't fail the payment process
      // Just log the error and continue
    }
  }

  /**
   * Display QR code in terminal for debugging/verification
   */
  async displayQRCodeInTerminal(bookingRef: string): Promise<void> {
    try {
      await this.emailTemplateService.generateAndLogQRCodeToTerminal(
        bookingRef,
      );
    } catch (error) {
      this.logger.error(
        `Failed to display QR code in terminal for booking ${bookingRef}:`,
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }

  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    from: string;
  }): Promise<void> {
    try {
      await this.transporter.sendMail(options);
      this.logger.log(
        `Email sent successfully to ${options.to} with subject: ${options.subject}`,
      );
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack =
        error instanceof Error ? error.stack : 'No stack trace available';
      this.logger.error(
        `Failed to send email to ${options.to}: ${errorMessage}`,
        errorStack,
      );
      // Don't throw error here - let the calling function handle it
      throw error;
    }
  }
}

export class EmailServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailServiceError';
  }
}
