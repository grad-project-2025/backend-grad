import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IUserRepository } from '../repositories/user.repository.interface';
import { EmailService } from 'src/modules/email/email.service';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { RequestResetPasswordResponseDto } from '../dto/requestResetPassword-response.dto';
import { ResetPasswordResponseDto } from '../dto/resetPassword-response.dto';
import { ChangePasswordResponseDto } from '../dto/changePassword-response.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordResetService {
  constructor(
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
  ) {}

  private generateResetCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async requestPasswordReset(
    email: string,
  ): Promise<RequestResetPasswordResponseDto> {
    return this.userRepository.withTransaction(async (session) => {
      const user = await this.userRepository.findByEmail(email, { session });
      if (!user) throw new NotFoundException('Email not found');
      if (!user.isVerified)
        throw new BadRequestException('User must verify before password reset');

      const resetCode = this.generateResetCode();
      const resetCodeExpiry = new Date(Date.now() + 3600000); // 1 hour expiry

      const updatedUser = await this.userRepository.update(
        user._id.toString(),
        { resetCode, resetCodeExpiry },
        { session },
      );
      if (!updatedUser)
        throw new NotFoundException('Failed to update reset code');

      await this.emailService.sendPasswordResetEmail(user.email, resetCode);

      return {
        success: true,
        data: { message: 'Password reset code sent to email' },
      };
    });
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<ResetPasswordResponseDto> {
    const { code, newPassword } = resetPasswordDto;

    return this.userRepository.withTransaction(async (session) => {
      const user = await this.userRepository.findByResetCode(code, { session });
      if (!user) throw new BadRequestException('Invalid reset code');
      if (user.resetCodeExpiry && user.resetCodeExpiry < new Date()) {
        throw new BadRequestException('Reset code has expired');
      }

      // Check if the new password matches the old password
      if (!user.password) {
        throw new NotFoundException('User password not found in database');
      }
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        throw new BadRequestException(
          'New password cannot be the same as the old password',
        );
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      const updatedUser = await this.userRepository.update(
        user._id.toString(),
        {
          password: hashedPassword,
          resetCode: undefined,
          resetCodeExpiry: undefined,
        },
        { session },
      );
      if (!updatedUser) throw new NotFoundException('Failed to reset password');

      return {
        success: true,
        data: { message: 'Password reset successfully' },
      };
    });
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<ChangePasswordResponseDto> {
    const { oldPassword, newPassword } = changePasswordDto;

    return this.userRepository.withTransaction(async (session) => {
      const user = await this.userRepository.findByIdWithPassword(userId, {
        session,
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.password) {
        throw new NotFoundException('User password not found in database');
      }

      // Verify the old password
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        throw new UnauthorizedException('Invalid old password');
      }

      // Check if the new password matches the old password
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        throw new BadRequestException(
          'New password cannot be the same as the old password',
        );
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      const updatedUser = await this.userRepository.update(
        userId,
        { password: hashedNewPassword },
        { session },
      );

      if (!updatedUser) {
        throw new NotFoundException('Failed to update password');
      }

      return {
        success: true,
        data: { message: 'Password changed successfully' },
      };
    });
  }
}
