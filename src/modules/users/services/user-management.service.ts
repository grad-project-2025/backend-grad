import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { IUserRepository } from '../repositories/user.repository.interface';
import { CreateUserDto } from '../dto/register-user.dto';
import { UpdateProfileDto } from '../dto/updateProfile.dto';
import { User, UserDocument } from '../schemas/user.schema';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../../email/email.service';
import { Inject } from '@nestjs/common';
import {
  UserResponseDto,
  RegisterResponseDto,
  BasicUserResponseDto,
} from '../dto/register-response.dto';
import { VerifyEmailResponseDto } from '../dto/verifyEmail-response.dto';
import { ResendVerificationResponseDto } from '../dto/resendVerificationResponse.dto';
import { LogoutResponseDto } from '../dto/logout-response.dto';
import { ProfileResponseDto } from '../dto/profile-response.dto';

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    private readonly emailService: EmailService,
  ) {}

  async getAllUsers(): Promise<{ message: string; users: UserResponseDto[] }> {
    const users = await this.userRepository.findAll();
    return {
      message: 'Users retrieved successfully',
      users: users.map((user) => this.excludeSensitiveFields(user)),
    };
  }

  async register(createUserDto: CreateUserDto): Promise<RegisterResponseDto> {
    if ('roles' in createUserDto) {
      throw new BadRequestException('Role assignment is not allowed');
    }

    return this.userRepository.withTransaction(async (session) => {
      // Check for existing email
      const existingUser = await this.userRepository.findByEmail(
        createUserDto.email,
        { session },
      );
      if (existingUser) {
        this.logger.warn(
          `Registration failed: Email ${createUserDto.email} already exists`,
        );
        throw new ConflictException('Email already exists');
      }

      // Check for existing phone number (if provided)
      if (createUserDto.phoneNumber) {
        const existingPhone = await this.userRepository.findByPhoneNumber(
          createUserDto.phoneNumber,
          { session },
        );
        if (existingPhone) {
          this.logger.warn(
            `Registration failed: Phone number ${createUserDto.phoneNumber} already exists`,
          );
          throw new ConflictException('Phone number already exists');
        }
      }

      // Determine roles (admin for first user, user for others)
      const userCount = await this.userRepository.countByRole('admin', {
        session,
      });
      const assignedRoles = userCount === 0 ? ['admin'] : ['user'];

      // Hash the password
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

      // Convert birthdate to Date object (optional field)
      let birthdate: Date | undefined;
      if (createUserDto.birthdate) {
        try {
          birthdate = new Date(createUserDto.birthdate);
          if (isNaN(birthdate.getTime())) {
            this.logger.error(
              `Invalid birthdate format: ${createUserDto.birthdate}`,
            );
            throw new BadRequestException('Invalid birthdate format');
          }
        } catch (error) {
          this.logger.error(
            `Failed to parse birthdate: ${createUserDto.birthdate}`,
            error,
          );
          throw new BadRequestException('Invalid birthdate format');
        }
      }

      // Create the new user
      const newUser: Partial<User> = {
        ...createUserDto,
        roles: assignedRoles,
        password: hashedPassword,
        isVerified: false,
        verificationToken: this.generateCode(),
        verificationTokenExpiry: new Date(Date.now() + 3600000), // 1 hour expiry
        birthdate, // Store as Date object if provided
      };

      const savedUser = await this.userRepository.create(newUser, { session });

      // Send verification email
      try {
        await this.emailService.sendVerificationEmail(
          savedUser.email,
          savedUser.verificationToken,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send verification email to ${savedUser.email}`,
          error,
        );
        await this.userRepository.update(
          savedUser._id.toString(),
          { needsEmailResend: true },
          { session },
        );
        throw new BadRequestException(
          'Failed to send verification email. Please try resending.',
        );
      }

      const userResponse = this.getBasicUserFields(savedUser);
      this.logger.log(`User ${savedUser.email} registered successfully`);
      return {
        success: true,
        data: {
          message:
            userCount === 0
              ? 'First admin user created successfully'
              : 'User registered successfully, Check your Email for code verification',
          user: userResponse,
        },
      };
    });
  }

  async verifyEmail(
    email: string,
    code: string,
  ): Promise<VerifyEmailResponseDto> {
    return this.userRepository.withTransaction(async (session) => {
      const user = await this.userRepository.findByEmail(email, { session });
      if (!user) {
        this.logger.warn(`Email verification failed: Email ${email} not found`);
        throw new NotFoundException('Email not found');
      }
      if (!user.verificationToken || !user.verificationTokenExpiry) {
        this.logger.warn(
          `Email verification failed: No verification code for ${email}`,
        );
        throw new BadRequestException(
          'No verification code found for this email',
        );
      }
      if (user.verificationToken !== code) {
        this.logger.warn(
          `Email verification failed: Invalid code for ${email}`,
        );
        throw new BadRequestException('Invalid verification code');
      }
      const expirationDate = new Date(user.verificationTokenExpiry);
      const currentDate = new Date();
      if (expirationDate < currentDate) {
        this.logger.warn(
          `Email verification failed: Code expired for ${email}`,
        );
        throw new BadRequestException('Verification code has expired');
      }
      if (user.isVerified) {
        this.logger.warn(
          `Email verification failed: ${email} already verified`,
        );
        throw new BadRequestException('User is already verified');
      }
      const updatedUser = await this.userRepository.update(
        user._id.toString(),
        {
          $set: { isVerified: true },
          $unset: { verificationToken: '', verificationTokenExpiry: '' },
        },
        { session },
      );
      if (!updatedUser) {
        this.logger.error(
          `Email verification failed: Failed to update user ${email}`,
        );
        throw new NotFoundException('Failed to update user verification');
      }
      this.logger.log(`Email ${email} verified successfully`);
      return {
        success: true,
        data: { message: 'Email verified successfully' },
      };
    });
  }

  async resendVerificationEmail(
    email: string,
  ): Promise<ResendVerificationResponseDto> {
    return this.userRepository.withTransaction(async (session) => {
      const user = await this.userRepository.findByEmail(email, { session });
      if (!user) {
        this.logger.warn(
          `Resend verification failed: Email ${email} not found`,
        );
        throw new NotFoundException('Email not found');
      }
      if (user.isVerified) {
        this.logger.warn(
          `Resend verification failed: ${email} already verified`,
        );
        throw new BadRequestException('User is already verified');
      }
      const verificationCode = this.generateCode();
      const verificationTokenExpiry = new Date(Date.now() + 3600000);
      const updatedUser = await this.userRepository.update(
        user._id.toString(),
        { verificationToken: verificationCode, verificationTokenExpiry },
        { session },
      );
      if (!updatedUser) {
        this.logger.error(
          `Resend verification failed: Failed to update user ${email}`,
        );
        throw new NotFoundException('Failed to update user');
      }
      await this.emailService.sendVerificationEmail(
        user.email,
        verificationCode,
      );
      this.logger.log(`Verification email resent to ${email}`);
      return {
        success: true,
        data: { message: 'Verification email sent successfully' },
      };
    });
  }

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      this.logger.warn(`Get profile failed: User ${userId} not found`);
      throw new NotFoundException('User not found');
    }
    if (!user.isVerified) {
      this.logger.warn(`Get profile failed: User ${userId} not verified`);
      throw new UnauthorizedException('Verify your account please');
    }
    return {
      success: true,
      data: {
        message: 'User profile retrieved successfully',
        user: this.excludeSensitiveFields(user),
      },
    };
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.userRepository.withTransaction(async (session) => {
      const user = await this.userRepository.findById(userId, { session });
      if (!user) {
        this.logger.warn(`Update profile failed: User ${userId} not found`);
        throw new NotFoundException('User not found');
      }
      if (!user.isVerified) {
        this.logger.warn(`Update profile failed: User ${userId} not verified`);
        throw new UnauthorizedException('Verify your account please');
      }

      const updateData: Partial<User> = {};

      if (updateProfileDto.firstName)
        updateData.firstName = updateProfileDto.firstName;
      if (updateProfileDto.lastName)
        updateData.lastName = updateProfileDto.lastName;
      if (updateProfileDto.phoneNumber) {
        if (updateProfileDto.phoneNumber !== user.phoneNumber) {
          const phoneExists = await this.userRepository.findByPhoneNumber(
            updateProfileDto.phoneNumber,
            { session },
          );
          if (phoneExists && phoneExists._id.toString() !== userId) {
            this.logger.warn(
              `Update profile failed: Phone number ${updateProfileDto.phoneNumber} already in use`,
            );
            throw new ConflictException('Phone number already in use');
          }
        }
        updateData.phoneNumber = updateProfileDto.phoneNumber;
      }
      if (updateProfileDto.email && updateProfileDto.email !== user.email) {
        const existingUser = await this.userRepository.findByEmail(
          updateProfileDto.email,
          { session },
        );
        if (existingUser) {
          this.logger.warn(
            `Update profile failed: Email ${updateProfileDto.email} already in use`,
          );
          throw new ConflictException(
            'Email is already in use by another account',
          );
        }
        updateData.email = updateProfileDto.email;
        updateData.isVerified = false;
        updateData.verificationToken = this.generateCode();
        updateData.verificationTokenExpiry = new Date(Date.now() + 3600000);
      }

      if (updateProfileDto.gender) updateData.gender = updateProfileDto.gender;
      if (updateProfileDto.preferredLanguage)
        updateData.preferredLanguage = updateProfileDto.preferredLanguage;
      if (updateProfileDto.preferredAirlines)
        updateData.preferredAirlines = updateProfileDto.preferredAirlines;
      if (updateProfileDto.deviceType)
        updateData.deviceType = updateProfileDto.deviceType;
      if (updateProfileDto.loyaltyProgram)
        updateData.loyaltyProgram = updateProfileDto.loyaltyProgram;
      if (updateProfileDto.bookingHistory)
        updateData.bookingHistory = updateProfileDto.bookingHistory.map(
          (bh) => ({
            airline: bh.airline,
            date: new Date(bh.date),
            cabinClass: bh.cabinClass,
          }),
        );
      if (updateProfileDto.preferredCabinClass)
        updateData.preferredCabinClass = updateProfileDto.preferredCabinClass;
      if (updateProfileDto.useRecommendationSystem !== undefined)
        updateData.useRecommendationSystem =
          updateProfileDto.useRecommendationSystem;

      const updatedUser = await this.userRepository.update(userId, updateData, {
        session,
      });
      if (!updatedUser) {
        this.logger.error(
          `Update profile failed: Failed to update user ${userId}`,
        );
        throw new NotFoundException('Failed to update user profile');
      }

      if (updateProfileDto.email && updateProfileDto.email !== user.email) {
        await this.emailService.sendVerificationEmail(
          updateData.email,
          updateData.verificationToken,
        );
      }

      this.logger.log(`Profile updated successfully for user ${userId}`);
      return {
        success: true,
        data: {
          message:
            'Profile updated successfully' +
            (updateProfileDto.email && updateProfileDto.email !== user.email
              ? ' - Please verify your new email'
              : ''),
          user: this.excludeSensitiveFields(updatedUser),
        },
      };
    });
  }

  async getById(userId: string): Promise<UserDocument | null> {
    return this.userRepository.findById(userId);
  }

  async logout(
    userId: string,
    providedRefreshToken: string,
  ): Promise<LogoutResponseDto> {
    return this.userRepository.withTransaction(async (session) => {
      const user = await this.userRepository.findById(userId, { session });
      if (!user) {
        this.logger.warn(`Logout failed: User ${userId} not found`);
        throw new NotFoundException('User not found');
      }
      if (user.refreshToken !== providedRefreshToken) {
        this.logger.warn(
          `Logout failed: Invalid refresh token for user ${userId}`,
        );
        throw new UnauthorizedException('Invalid refresh token');
      }
      await this.userRepository.updateRefreshToken(userId, null, { session });
      this.logger.log(`User ${userId} logged out successfully`);
      return {
        success: true,
        data: { message: 'User logged out successfully' },
      };
    });
  }

  async deleteUserByEmail(email: string): Promise<{ message: string }> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      this.logger.warn(`Delete user failed: Email ${email} not found`);
      throw new NotFoundException(`User with email ${email} not found`);
    }
    await this.userRepository.delete(email);
    this.logger.log(`User with email ${email} deleted successfully`);
    return { message: `User with email ${email} deleted successfully` };
  }

  private getBasicUserFields(user: User): BasicUserResponseDto {
    const plainUser = (user as UserDocument).toObject();
    return {
      id: plainUser._id.toString(),
      firstName: plainUser.firstName,
      lastName: plainUser.lastName,
      email: plainUser.email,
      country: plainUser.country,
      phoneNumber: plainUser.phoneNumber,
      isVerified: plainUser.isVerified,
      birthdate: plainUser.birthdate
        ? plainUser.birthdate.toISOString().split('T')[0]
        : undefined,
    };
  }

  private excludeSensitiveFields(user: User): UserResponseDto {
    const plainUser = (user as UserDocument).toObject();
    const {
      _id,
      firstName,
      lastName,
      email,
      country,
      phoneNumber,
      isVerified,
      birthdate,
      gender,
      preferredLanguage,
      preferredAirlines,
      deviceType,
      loyaltyProgram,
      bookingHistory,
      preferredCabinClass,
      useRecommendationSystem,
    } = plainUser;
    return {
      id: _id.toString(),
      firstName,
      lastName,
      email,
      country,
      phoneNumber,
      isVerified,
      birthdate: birthdate ? birthdate.toISOString().split('T')[0] : undefined,
      gender,
      preferredLanguage,
      preferredAirlines,
      deviceType,
      loyaltyProgram,
      bookingHistory,
      preferredCabinClass,
      useRecommendationSystem,
    };
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userRepository.findByEmail(email);
  }
}
