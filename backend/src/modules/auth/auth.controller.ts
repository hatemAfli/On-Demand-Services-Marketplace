import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, ProviderType } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('complete-registration')
  @UseGuards(JwtAuthGuard)
  async completeRegistration(
    @CurrentUser() user: any,
    @Body()
    body: {
      phoneNumber?: string;
      firstName: string;
      lastName: string;
      role: UserRole;
      client?: {
        city: string;
        address?: string;
        imageUrl?: string;
      };
      provider?: {
        type?: ProviderType;
        city: string;
        address?: string;
        latitude?: number;
        longitude?: number;
        photoUrl?: string;
        companyId?: string;
      };
      companyAdmin?: {
        companyId: string;
      };
    },
  ) {
    console.log('\n✅ Controller - completeRegistration() reached');
    console.log('   User from token:', user);
    console.log('   Body:', body);
    return this.authService.completeRegistration(user.id, {
      email: user.email,
      isEmailVerified: user?.isEmailVerified === true,
      ...body,
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@CurrentUser() user: any) {
    console.log('\n✅ Controller - getCurrentUser() reached');
    console.log('   User:', user);
    return this.authService.getCurrentUser({
      id: user.id,
      email: user.email,
    });
  }

  @Post('verify-token')
  async verifyToken(@Body() body: { token: string }) {
    try {
      const user = await this.authService.verifySupabaseToken(body.token);
      return { valid: true, user };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}
