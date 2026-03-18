import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../config/prisma.config';
import * as jwksClient from 'jwks-rsa';
import { SupabaseService } from 'src/config/supabase.config';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    // kept injectable for now (may be used later), but not needed for JWT validation
    private supabase: SupabaseService,
  ) {
    // NOTE:
    // Supabase access tokens may be signed with an asymmetric algorithm (e.g. ES256).
    // Using a placeholder secret causes jsonwebtoken to reject the token with:
    // "JsonWebTokenError: invalid algorithm".
    const rawSupabaseUrl = configService.getOrThrow<string>('SUPABASE_URL');
    const supabaseUrl = rawSupabaseUrl.replace(/\/$/, '');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: jwksClient.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      }),
      algorithms: ['ES256'],
    });

    console.log('\n🔧 JwtStrategy Initialized (Supabase JWKS verification)');
  }

  async validate(payload: unknown) {
    // Payload comes from the already-verified Supabase JWT.
    // Common fields: sub (user id), email, user_metadata, app_metadata, aud, exp...
    console.log('\n🔍 JWT Strategy - validate() called');
    const p = payload as Record<string, unknown> | null;
    const userId = typeof p?.sub === 'string' ? p.sub : undefined;
    const email = typeof p?.email === 'string' ? p.email : undefined;

    if (!userId) {
      console.error('   ❌ No user ID (sub) in token payload');
      throw new UnauthorizedException('Invalid token');
    }

    // Check if user exists in database
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        client: true,
        provider: true,
        companyAdmin: true,
        platformAdmin: true,
      },
    });

    if (!user) {
      console.log(
        '   ⚠️  User not found in database (first-time registration)',
      );
      console.log('   → Returning token payload data for registration');

      const userMetadata =
        (p?.user_metadata as Record<string, unknown> | undefined) ?? undefined;
      const selectedRole =
        typeof userMetadata?.selected_role === 'string'
          ? userMetadata.selected_role
          : undefined;

      // User doesn't exist yet - this is OK for first registration
      return {
        id: userId,
        email,
        role: selectedRole,
      };
    }

    if (user.status === 'DELETED' || user.status === 'SUSPENDED') {
      console.log('   ❌ Account is not active:', user.status);
      throw new UnauthorizedException('Account is not active');
    }

    console.log('   ✅ User authenticated:', user.email, '| Role:', user.role);
    return user;
  }
}
