import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    console.log('\n🛡️  JwtAuthGuard - canActivate() called');
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    console.log(
      '   Authorization header:',
      authHeader ? authHeader.substring(0, 30) + '...' : 'MISSING ❌',
    );
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    console.log('\n🛡️  JwtAuthGuard - handleRequest() called');
    console.log('   Error:', err);
    console.log('   User:', user);
    console.log('   Info:', info);

    if (err || !user) {
      console.log('   ❌ Authentication failed');
      throw err || new UnauthorizedException('Authentication failed');
    }

    console.log('   ✅ Authentication successful');
    return user;
  }
}
