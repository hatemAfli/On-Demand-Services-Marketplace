import { Controller, Post, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, ProviderType, DocumentType } from '@prisma/client';
import { UpdateUserIdentityDto } from '../accounts/dto/update-user-identity.dto';

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
        verification?: {
          serviceId: string;
          documents: Array<{
            type: DocumentType;
            fichierUrl: string;
          }>;
        };
      };
      companyAdmin?: {
        company: {
          companyName: string;
          taxId: string;
          city: string;
          address?: string;
          latitude?: number;
          longitude?: number;
          serviceZones?: string[];
          logo?: string;
        };
        verification: {
          documents: Array<{
            type: DocumentType;
            fichierUrl: string;
          }>;
        };
      };
    },
  ) {
    console.log('\n✅ Controller - completeRegistration() reached');
    console.log('   User from token:', user);
    console.log('   Body:', body);
    return this.authService.completeRegistration(user.id, {
      email: user.tokenEmail ?? user.email,
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
      email: user.tokenEmail ?? user.email,
    });
  }

  @Patch('me/identity')
  @UseGuards(JwtAuthGuard)
  async updateIdentity(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateUserIdentityDto,
  ) {
    return this.authService.updateIdentity(user.id, dto);
  }

  @Post('magic-login/lookup')
  async lookupMagicLoginAccount(@Body() body: { email: string }) {
    return this.authService.lookupMagicLoginAccount(body);
  }

  @Post('email-change/check')
  @UseGuards(JwtAuthGuard)
  async checkEmailChangeAvailability(
    @CurrentUser() user: any,
    @Body() body: { email: string },
  ) {
    return this.authService.checkEmailChangeAvailability(user.id, body);
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
