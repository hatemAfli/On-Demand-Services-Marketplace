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
    const emailConfirmedAt =
      typeof p?.email_confirmed_at === 'string' ? p.email_confirmed_at : null;

    if (!userId) {
      console.error('   ❌ No user ID (sub) in token payload');
      throw new UnauthorizedException('Invalid token');
    }

    const include = {
      client: true,
      provider: true,
      companyAdmin: true,
      platformAdmin: true,
    } as const;

    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      include,
    });

    // Same email as Supabase but different UUID in DB (e.g. re-seeded Postgres)
    if (!user && email) {
      user = await this.prisma.user.findUnique({
        where: { email },
        include,
      });
    }

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
      const emailVerifiedFromMeta =
        userMetadata?.email_verified === true ||
        userMetadata?.is_email_verified === true;

      // User doesn't exist yet - this is OK for first registration
      return {
        id: userId,
        email,
        role: selectedRole,
        isEmailVerified: !!emailConfirmedAt || emailVerifiedFromMeta,
      };
    }

    // Do not reject SUSPENDED / DELETED here: returning 401 breaks the mobile app
    // (axios retries refresh + signOut races → "Auth session missing"). The client
    // loads `user.status` from GET /auth/me and shows account-state screens instead.
    // Protect sensitive write routes with explicit status checks in services/guards.

    console.log('   ✅ User authenticated:', user.email, '| Role:', user.role);
    return {
      ...user,
      // Keep the latest email from Supabase JWT so backend can sync DB email after confirmation.
      tokenEmail: email,
    };
  }
}
