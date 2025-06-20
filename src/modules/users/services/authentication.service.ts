import {
  Inject,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { IUserRepository } from '../repositories/user.repository.interface';
import { User, UserDocument } from '../schemas/user.schema';
import { LoginUserDto } from '../dto/login-user.dto';
import { Types } from 'mongoose';
import { Role } from 'src/common/enums/role.enum';
import { UpdateUserRolesDto } from '../dto/update-user-roles.dto';
import { Logger } from '@nestjs/common';
import { RefreshTokenResponseDto } from '../dto/refreshToken-response.dto';
import { LoginResponseDto } from '../dto/login-response.dto';
import { UpdateRolesResponseDto } from '../dto/updateRoles-response.dto';
import { UserResponseDto } from '../dto/register-response.dto';
import { JwtUser } from 'src/common/interfaces/jwtUser.interface';

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
  ) {}

  async validateUser(loginDto: LoginUserDto): Promise<LoginResponseDto> {
    const user = await this.userRepository.findByEmailWithPassword(
      loginDto.email,
    );
    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    return this.userRepository.withTransaction(async (session) => {
      const accessToken = this.jwtService.sign(
        { sub: user._id.toString(), email: user.email, roles: user.roles },
        { secret: this.config.get('JWT_SECRET'), expiresIn: '1d' },
      );

      const refreshToken = this.jwtService.sign(
        { sub: user._id.toString(), email: user.email, roles: user.roles },
        { secret: this.config.get('JWT_REFRESH_SECRET'), expiresIn: '7d' },
      );

      await this.userRepository.updateRefreshToken(
        user._id.toString(),
        refreshToken,
        { session },
      );

      return {
        success: true,
        data: {
          message: 'User logged in successfully',
          accessToken,
          refreshToken,
        },
      };
    });
  }

  async generateTokens(
    userId: string,
    email: string,
    roles: string[],
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email, roles },
      { secret: this.config.get('JWT_SECRET'), expiresIn: '1d' },
    );
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, email, roles },
      { secret: this.config.get('JWT_REFRESH_SECRET'), expiresIn: '7d' },
    );
    return { accessToken, refreshToken };
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponseDto> {
    try {
      console.log('Verifying refresh token...');
      const payload = this.jwtService.verify<{
        sub: string;
        email: string;
        roles: string[];
      }>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      console.log('Refresh token verified successfully.');

      console.log('Finding and validating user...');
      const user = await this.userRepository.update(
        payload.sub,
        { $set: { refreshToken: null } }, // Clear the old token
        {
          query: { refreshToken }, // Additional condition to match refresh token
          new: false, // Return the original document
        },
      );

      if (!user) {
        console.error('Invalid or expired refresh token.');
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      console.log('Generating new tokens...');
      const { accessToken, refreshToken: newToken } = await this.generateTokens(
        user._id.toString(),
        user.email,
        user.roles,
      );

      console.log('Updating refresh token with new value...');
      await this.userRepository.updateRefreshToken(payload.sub, newToken);

      console.log('Tokens generated and updated successfully.');
      return {
        success: true,
        data: { accessToken, refreshToken: newToken },
      };
    } catch (error) {
      console.error('Error refreshing token:', error);
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async updateRoles(
    email: string,
    updateUserRolesDto: UpdateUserRolesDto,
    currentUser: JwtUser,
  ): Promise<UpdateRolesResponseDto> {
    if (updateUserRolesDto.roles.length === 0) {
      throw new BadRequestException('User must have at least one role');
    }
    if (
      updateUserRolesDto.roles.some(
        (role) => !Object.values(Role).includes(role),
      )
    ) {
      throw new BadRequestException('Invalid role provided');
    }
    if (!currentUser.roles?.includes(Role.Admin)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Find user by email
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (currentUser.id === user._id.toString()) {
      throw new BadRequestException('Admins cannot modify their own roles');
    }

    this.logger.log(
      `Admin ${currentUser.email} updating roles for user ${user._id}`,
    );

    return this.userRepository.withTransaction(async (session) => {
      const updatedUser = await this.userRepository.updateRoles(
        user.id,
        updateUserRolesDto.roles,
        { session },
      );

      this.logger.log(
        `Roles updated for ${user.email}: ${updateUserRolesDto.roles.join(', ')}`,
      );

      return {
        success: true,
        data: {
          message: 'User roles updated successfully',
          user: this.excludeSensitiveFields(updatedUser),
        },
      };
    });
  }

  private excludeSensitiveFields(user: UserDocument): UserResponseDto {
    const plainUser = user.toObject();
    const {
      password,
      verificationToken,
      verificationTokenExpiry,
      refreshToken,
      resetToken,
      resetTokenExpiry,
      __v,
      ...safeUser
    } = plainUser;
    return {
      ...safeUser,
      id: safeUser._id.toString(),
    } as UserResponseDto;
  }
}
