import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log('\n🔵 Incoming Request:');
    console.log('   Method:', req.method);
    console.log('   URL:', req.url);
    console.log('   Headers:', {
      authorization: req.headers.authorization
        ? 'Present (' + req.headers.authorization.substring(0, 20) + '...)'
        : 'Missing',
      'content-type': req.headers['content-type'],
    });
    console.log('   Body:', req.body);
    next();
  }
}
