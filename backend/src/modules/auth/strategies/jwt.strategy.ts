import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../config/prisma.config';
import * as jwksClient from 'jwks-rsa';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
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
  }

  async validate(payload: unknown) {
    const p = payload as Record<string, unknown> | null;
    const userId = typeof p?.sub === 'string' ? p.sub : undefined;
    const email = typeof p?.email === 'string' ? p.email : undefined;
    const emailConfirmedAt =
      typeof p?.email_confirmed_at === 'string' ? p.email_confirmed_at : null;

    if (!userId) {
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

    if (!user && email) {
      user = await this.prisma.user.findUnique({
        where: { email },
        include,
      });
    }

    if (!user) {
      const userMetadata =
        (p?.user_metadata as Record<string, unknown> | undefined) ?? undefined;
      const selectedRole =
        typeof userMetadata?.selected_role === 'string'
          ? userMetadata.selected_role
          : undefined;
      const emailVerifiedFromMeta =
        userMetadata?.email_verified === true ||
        userMetadata?.is_email_verified === true;

      return {
        id: userId,
        email,
        role: selectedRole,
        isEmailVerified: !!emailConfirmedAt || emailVerifiedFromMeta,
      };
    }

    return {
      ...user,
      tokenEmail: email,
    };
  }
}
