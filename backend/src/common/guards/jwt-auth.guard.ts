import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
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
