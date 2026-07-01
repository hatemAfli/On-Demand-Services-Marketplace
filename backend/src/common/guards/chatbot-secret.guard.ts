import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ChatbotSecretGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const header = request.headers['x-chatbot-secret'];
    const expected = this.configService.get<string>('NESTJS_CHATBOT_SECRET');
    if (!expected || header !== expected) {
      throw new UnauthorizedException('Invalid chatbot secret');
    }
    return true;
  }
}
