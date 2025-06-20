import {
  Controller,
  Post,
  Body,
  Put,
  UseGuards,
  Get,
  Patch,
  UnauthorizedException,
  Query,
  Param,
  Delete,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserManagementService } from './services/user-management.service';
import { AuthenticationService } from './services/authentication.service';
import { PasswordResetService } from './services/password.service';
import { CreateUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendEmailVerificationDto } from './dto/resend-email-verification.dto';
import { RefreshTokenDto } from './dto/refreshToken.dto';
import { RequestResetPasswordDto } from './dto/request-reset-password.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { UpdateProfileDto } from './dto/updateProfile.dto';
import { UserDocument } from './schemas/user.schema';
import { User } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Role } from '../../common/enums/role.enum';
import { ErrorResponseDto } from './dto/error-response.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { JwtUser } from 'src/common/interfaces/jwtUser.interface';

@Controller('users')
export class UsersController {
  constructor(
    private readonly authService: AuthenticationService,
    private readonly userManagementService: UserManagementService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin, Role.Mod)
  @Get('all')
  async getAllUsers() {
    return this.userManagementService.getAllUsers();
  }

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.userManagementService.register(createUserDto);
  }

  @Post('verify-email')
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.userManagementService.verifyEmail(
      verifyEmailDto.email,
      verifyEmailDto.code,
    );
  }

  @Post('resend-verification')
  async resendVerificationEmail(
    @Body() resendEmailDto: ResendEmailVerificationDto,
  ) {
    return this.userManagementService.resendVerificationEmail(
      resendEmailDto.email,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('refresh-token')
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.authService.validateUser(loginUserDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Put('change-password')
  async changePassword(
    @User() user: JwtUser,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    if (!user || !user.id) {
      throw new UnauthorizedException('User not found');
    }
    return this.passwordResetService.changePassword(user.id, changePasswordDto);
  }

  @Post('request-password-reset')
  async requestPasswordReset(
    @Body() requestPasswordResetDto: RequestResetPasswordDto,
  ) {
    return this.passwordResetService.requestPasswordReset(
      requestPasswordResetDto.email,
    );
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    if (!resetPasswordDto.code || !resetPasswordDto.newPassword) {
      throw new BadRequestException('Reset code and new password are required');
    }
    return this.passwordResetService.resetPassword(resetPasswordDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@User() user: JwtUser) {
    if (!user || !user.id) {
      throw new UnauthorizedException('Invalid user credentials');
    }
    return this.userManagementService.getProfile(user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('profile')
  async updateProfile(
    @User() user: UserDocument,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    if (!user || !user._id) {
      throw new UnauthorizedException('Invalid user credentials');
    }
    return this.userManagementService.updateProfile(
      user._id.toString(),
      updateProfileDto,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(
    @User() user: JwtUser,
    @Body('refreshToken') refreshToken: string,
  ) {
    if (!user || !user.id) {
      throw new UnauthorizedException('Invalid user credentials');
    }
    return this.userManagementService.logout(user.id, refreshToken);
  }

  @Delete(':email')
  async deleteUserByEmail(@Param('email') email: string) {
    return this.userManagementService.deleteUserByEmail(email);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin, Role.Mod)
  @Get('admin-dashboard')
  getAdminDashboard() {
    return { message: 'Admin-only content' };
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin, Role.Mod)
  @Get('flight-management')
  manageFlights() {
    return { message: 'Flight management dashboard' };
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.Admin)
  @Patch('roles')
  async updateRoles(
    @Body() updateUserRolesDto: UpdateUserRolesDto,
    @User() currentUser: JwtUser,
  ) {
    if (!currentUser || !currentUser.id) {
      throw new UnauthorizedException('Unauthorized');
    }
    return this.authService.updateRoles(
      updateUserRolesDto.email,
      updateUserRolesDto,
      currentUser,
    );
  }
}
